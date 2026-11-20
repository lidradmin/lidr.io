/**
 * Minimal stateless MCP server over Streamable HTTP (JSON responses only).
 * We need just initialize / ping / tools/list / tools/call, so this is
 * hand-written rather than depending on SDKs that are mid-migration.
 */

export type ToolDef = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations?: Record<string, unknown>;
};
export type ToolResult = { text: string; isError?: boolean; structured?: unknown };
export type Tools = { defs: ToolDef[]; call(name: string, args: Record<string, unknown>): Promise<ToolResult> };

/** Newest first; we answer with the client's version when we know it. */
export const SUPPORTED_VERSIONS = ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26"];

type Id = string | number | null;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const rpcError = (id: Id, code: number, message: string) => json({ jsonrpc: "2.0", id, error: { code, message } });
const rpcResult = (id: Id, result: unknown) => json({ jsonrpc: "2.0", id, result });

export async function handleMcp(req: Request, tools: Tools, info: { instructions: string }): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("This MCP server is stateless: send JSON-RPC requests with POST.", { status: 405, headers: { Allow: "POST" } });
  }

  let msg: unknown;
  try {
    msg = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  if (Array.isArray(msg)) return rpcError(null, -32600, "Batch requests are not supported");
  if (!msg || typeof msg !== "object" || (msg as { jsonrpc?: unknown }).jsonrpc !== "2.0") {
    return rpcError(null, -32600, "Invalid request");
  }
  const { id, method, params } = msg as { id?: Id; method?: unknown; params?: Record<string, unknown> };
  // A response from the client (to a request we never send) needs no answer.
  if (method === undefined && ("result" in msg || "error" in msg)) return new Response(null, { status: 202 });
  if (typeof method !== "string") return rpcError(id ?? null, -32600, "Invalid request");

  // Notifications (no id) need no answer.
  if (id === undefined) return new Response(null, { status: 202 });

  switch (method) {
    case "initialize": {
      const asked = typeof params?.protocolVersion === "string" ? params.protocolVersion : "";
      return rpcResult(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "lidr-blog", title: "Lidr Blog", version: "1.0.0" },
        instructions: info.instructions,
      });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: tools.defs });
    case "tools/call": {
      const name = typeof params?.name === "string" ? params.name : "";
      const args = params?.arguments && typeof params.arguments === "object" ? (params.arguments as Record<string, unknown>) : {};
      let r: ToolResult;
      try {
        r = await tools.call(name, args);
      } catch (e) {
        if (e && typeof e === "object" && (e as { authFailure?: boolean }).authFailure) throw e; // caller answers 401
        r = { text: e instanceof Error ? e.message : "Something went wrong.", isError: true };
      }
      const result: Record<string, unknown> = { content: [{ type: "text", text: r.text }] };
      if (r.structured !== undefined) result.structuredContent = r.structured;
      result.isError = !!r.isError;
      return rpcResult(id, result);
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}
