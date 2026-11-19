import { describe, expect, test, vi } from "vitest";
import { handle, type Env } from "./index";

const env: Env = { GITHUB_CLIENT_ID: "cid", GITHUB_CLIENT_SECRET: "secret", ALLOWED_ORIGIN: "https://lidr.io" };
const BASE = "https://cms-auth.lidr.io";

describe("/auth", () => {
  test("redirects to GitHub with state cookie", async () => {
    const res = await handle(new Request(`${BASE}/auth?provider=github&site_id=lidr.io&scope=repo`), env);
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("Location")!);
    expect(loc.origin + loc.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(loc.searchParams.get("client_id")).toBe("cid");
    expect(loc.searchParams.get("redirect_uri")).toBe(`${BASE}/callback`);
    const state = loc.searchParams.get("state")!;
    expect(state).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get("Set-Cookie")).toContain(`cms_oauth_state=${state}`);
    expect(res.headers.get("Set-Cookie")).toMatch(/HttpOnly; Secure; SameSite=Lax/);
  });
  test("rejects other providers", async () => {
    expect((await handle(new Request(`${BASE}/auth?provider=gitlab`), env)).status).toBe(400);
  });
});

describe("/callback", () => {
  const cb = (q: string, cookie?: string) =>
    new Request(`${BASE}/callback?${q}`, { headers: cookie ? { Cookie: cookie } : {} });

  test("state mismatch → error message, no token exchange", async () => {
    const fetcher = vi.fn();
    const res = await handle(cb("code=c&state=a", "cms_oauth_state=b"), env, fetcher);
    const html = await res.text();
    expect(fetcher).not.toHaveBeenCalled();
    expect(html).toContain("authorization:github:error:");
  });

  test("success posts the token only to the allowed origin, after the handshake", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "tok</script>x" })));
    const res = await handle(cb("code=c&state=s1", "other=1; cms_oauth_state=s1"), env, fetcher);
    const html = await res.text();
    expect(fetcher).toHaveBeenCalledWith("https://github.com/login/oauth/access_token", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body).toMatchObject({ client_id: "cid", client_secret: "secret", code: "c" });
    expect(html).toContain('"https://lidr.io"');
    expect(html).toContain('postMessage("authorizing:github",origin)');
    expect(html).not.toContain("</script>x"); // token is JSON-escaped (<)
    expect(html).toContain("authorization:github:success:");
    const csp = res.headers.get("Content-Security-Policy")!;
    expect(csp).toMatch(/default-src 'none'; script-src 'nonce-[0-9a-f]+'/);
    expect(html).toMatch(/<script nonce="[0-9a-f]+">/);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  test("GitHub error → error message", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "bad_verification_code", error_description: "The code passed is incorrect or expired." })));
    const html = await (await handle(cb("code=c&state=s", "cms_oauth_state=s"), env, fetcher)).text();
    expect(html).toContain("authorization:github:error:");
    expect(html).toContain("incorrect or expired");
  });

  test("network failure → error message", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("down"));
    const html = await (await handle(cb("code=c&state=s", "cms_oauth_state=s"), env, fetcher)).text();
    expect(html).toContain("authorization:github:error:");
  });
});

test("unknown path → 404", async () => {
  expect((await handle(new Request(`${BASE}/`), env)).status).toBe(404);
});
