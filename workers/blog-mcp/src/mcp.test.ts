/* eslint-disable @typescript-eslint/no-explicit-any -- JSON-RPC responses in tests */
import { describe, expect, test } from "vitest";
import { handleMcp, SUPPORTED_VERSIONS, type Tools } from "./mcp";

const tools: Tools = {
  defs: [{ name: "echo", title: "Echo", description: "Echoes", inputSchema: { type: "object", properties: { msg: { type: "string" } } } }],
  async call(name, args) {
    if (name === "boom") throw new Error("kaboom");
    if (name !== "echo") return { text: `Unknown tool: ${name}`, isError: true };
    return { text: String(args.msg), structured: { msg: args.msg } };
  },
};
const info = { instructions: "Be nice." };

const post = (body: unknown) =>
  new Request("https://mcp.example/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const rpc = async (body: unknown) => {
  const res = await handleMcp(post(body), tools, info);
  return { res, json: res.status === 200 ? ((await res.json()) as Record<string, any>) : null };
};

describe("handleMcp", () => {
  test("initialize echoes a supported version and advertises tools + instructions", async () => {
    const { res, json } = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } });
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(json!.id).toBe(1);
    expect(json!.result.protocolVersion).toBe("2025-06-18");
    expect(json!.result.capabilities).toEqual({ tools: { listChanged: false } });
    expect(json!.result.serverInfo.name).toBe("lidr-blog");
    expect(json!.result.instructions).toBe("Be nice.");
  });

  test("initialize with an unknown version answers with the latest", async () => {
    const { json } = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } });
    expect(json!.result.protocolVersion).toBe(SUPPORTED_VERSIONS[0]);
  });

  test("notifications get 202 with no body", async () => {
    const { res } = await rpc({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  test("ping and tools/list", async () => {
    expect((await rpc({ jsonrpc: "2.0", id: "a", method: "ping" })).json!.result).toEqual({});
    const { json } = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(json!.result.tools.map((t: { name: string }) => t.name)).toEqual(["echo"]);
  });

  test("tools/call returns text and structured content", async () => {
    const { json } = await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "echo", arguments: { msg: "hi" } } });
    expect(json!.result).toEqual({ content: [{ type: "text", text: "hi" }], structuredContent: { msg: "hi" }, isError: false });
  });

  test("a throwing tool becomes an error result without a stack trace", async () => {
    const { json } = await rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "boom", arguments: {} } });
    expect(json!.result.isError).toBe(true);
    expect(json!.result.content[0].text).toBe("kaboom");
    expect(JSON.stringify(json)).not.toContain("at ");
  });

  test("missing arguments default to {}", async () => {
    const { json } = await rpc({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "echo" } });
    expect(json!.result.content[0].text).toBe("undefined");
  });

  test("unknown method, bad JSON and batches are JSON-RPC errors", async () => {
    expect((await rpc({ jsonrpc: "2.0", id: 6, method: "resources/list" })).json!.error.code).toBe(-32601);
    expect((await rpc("{not json")).json!.error.code).toBe(-32700);
    expect((await rpc([{ jsonrpc: "2.0", id: 1, method: "ping" }])).json!.error.code).toBe(-32600);
    expect((await rpc({ id: 7, method: "ping" })).json!.error.code).toBe(-32600);
  });

  test("GET and DELETE are not supported (stateless server)", async () => {
    for (const method of ["GET", "DELETE"]) {
      const res = await handleMcp(new Request("https://mcp.example/mcp", { method }), tools, info);
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("POST");
    }
  });
});
