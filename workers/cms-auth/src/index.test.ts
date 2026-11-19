import vm from "node:vm";
import { describe, expect, test, vi } from "vitest";
import { handle, type Env } from "./index";

const env: Env = {
  GITHUB_CLIENT_ID: "cid",
  GITHUB_CLIENT_SECRET: "secret",
  ALLOWED_ORIGIN: "https://lidr.io",
  CALLBACK_URL: "https://cms-auth.lidr.io/callback",
};
const BASE = "https://cms-auth.lidr.io";
const COOKIE = "__Host-cms_oauth_state";

const cb = (q: string, cookie?: string) =>
  new Request(`${BASE}/callback?${q}`, { headers: cookie ? { Cookie: cookie } : {} });

const okFetcher = () => vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "tok" })));

describe("/auth", () => {
  test("redirects to GitHub with a __Host- state cookie", async () => {
    const res = await handle(new Request(`${BASE}/auth?provider=github&site_id=lidr.io&scope=repo`), env);
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("Location")!);
    expect(loc.origin + loc.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(loc.searchParams.get("client_id")).toBe("cid");
    expect(loc.searchParams.get("redirect_uri")).toBe(`${BASE}/callback`);
    const state = loc.searchParams.get("state")!;
    expect(state).toMatch(/^[0-9a-f-]{36}$/);
    const cookie = res.headers.get("Set-Cookie")!;
    expect(cookie.startsWith(`${COOKIE}=${state};`)).toBe(true);
    expect(cookie).toContain("Path=/;");
    expect(cookie).not.toMatch(/Domain=/i);
    expect(cookie).toMatch(/HttpOnly; Secure; SameSite=Lax/);
  });

  test("uses CALLBACK_URL for redirect_uri when set", async () => {
    const res = await handle(
      new Request(`https://worker.example.workers.dev/auth?provider=github`),
      { ...env, CALLBACK_URL: "https://cms-auth.lidr.io/callback" },
    );
    expect(new URL(res.headers.get("Location")!).searchParams.get("redirect_uri")).toBe("https://cms-auth.lidr.io/callback");
  });

  test("falls back to the request origin when CALLBACK_URL is unset", async () => {
    const { CALLBACK_URL: _unused, ...rest } = env;
    void _unused;
    const res = await handle(new Request(`https://other.example/auth?provider=github`), rest);
    expect(new URL(res.headers.get("Location")!).searchParams.get("redirect_uri")).toBe("https://other.example/callback");
  });

  test("rejects other providers", async () => {
    expect((await handle(new Request(`${BASE}/auth?provider=gitlab`), env)).status).toBe(400);
  });
});

describe("config validation", () => {
  test.each([
    ["missing client id", { ...env, GITHUB_CLIENT_ID: "" }],
    ["missing client secret", { ...env, GITHUB_CLIENT_SECRET: undefined as unknown as string }],
    ["missing origin", { ...env, ALLOWED_ORIGIN: "" }],
    ["invalid origin", { ...env, ALLOWED_ORIGIN: "not a url" }],
  ])("%s → 500, no-store", async (_name, badEnv) => {
    const fetcher = vi.fn();
    for (const req of [new Request(`${BASE}/auth?provider=github`), cb("code=c&state=s", `${COOKIE}=s`)]) {
      const res = await handle(req, badEnv, fetcher);
      expect(res.status).toBe(500);
      expect(await res.text()).toBe("cms-auth is misconfigured");
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  test("a trailing slash in ALLOWED_ORIGIN is normalised", async () => {
    const html = await (await handle(cb("code=c&state=s", `${COOKIE}=s`), { ...env, ALLOWED_ORIGIN: "https://lidr.io/" }, okFetcher())).text();
    expect(html).toContain('var origin="https://lidr.io";');
  });
});

describe("/callback", () => {
  test("state mismatch → error message, no token exchange", async () => {
    const fetcher = vi.fn();
    const html = await (await handle(cb("code=c&state=a", `${COOKIE}=b`), env, fetcher)).text();
    expect(fetcher).not.toHaveBeenCalled();
    expect(html).toContain("authorization:github:error:");
  });

  test("duplicate state cookies (cookie tossing) → error, no token exchange", async () => {
    const fetcher = vi.fn();
    const html = await (await handle(cb("code=c&state=s", `${COOKIE}=s; ${COOKIE}=s`), env, fetcher)).text();
    expect(fetcher).not.toHaveBeenCalled();
    expect(html).toContain("authorization:github:error:");
  });

  test("the old un-prefixed cookie name is not accepted", async () => {
    const fetcher = vi.fn();
    await handle(cb("code=c&state=s", "cms_oauth_state=s"), env, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
  });

  test("cancelled sign-in (?error=) → cancelled message, no token exchange", async () => {
    const fetcher = vi.fn();
    const html = await (await handle(cb("error=access_denied&state=s", `${COOKIE}=s`), env, fetcher)).text();
    expect(fetcher).not.toHaveBeenCalled();
    expect(html).toContain("authorization:github:error:");
    expect(html).toContain("Sign-in was cancelled. Close this window and try again.");
  });

  test("success posts the token only to the allowed origin, after the handshake", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "tok</script>x" })));
    const res = await handle(cb("code=c&state=s1", `other=1; ${COOKIE}=s1`), env, fetcher);
    const html = await res.text();
    expect(fetcher).toHaveBeenCalledWith("https://github.com/login/oauth/access_token", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body).toMatchObject({ client_id: "cid", client_secret: "secret", code: "c", redirect_uri: "https://cms-auth.lidr.io/callback" });
    expect(html).toContain('"https://lidr.io"');
    expect(html).toContain('postMessage("authorizing:github",origin)');
    expect(html).not.toContain("</script>x"); // token is JSON-escaped (<)
    expect(html).toContain("authorization:github:success:");
    const csp = res.headers.get("Content-Security-Policy")!;
    expect(csp).toMatch(/default-src 'none'; script-src 'nonce-[0-9a-f]+'/);
    expect(html).toMatch(/<script nonce="[0-9a-f]+">/);
    const cookie = res.headers.get("Set-Cookie")!;
    expect(cookie.startsWith(`${COOKIE}=;`)).toBe(true);
    expect(cookie).toContain("Path=/;");
    expect(cookie).toContain("Max-Age=0");
  });

  test("GitHub error → error message", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "bad_verification_code", error_description: "The code passed is incorrect or expired." })));
    const html = await (await handle(cb("code=c&state=s", `${COOKIE}=s`), env, fetcher)).text();
    expect(html).toContain("authorization:github:error:");
    expect(html).toContain("incorrect or expired");
  });

  test("network failure → error message", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("down"));
    const html = await (await handle(cb("code=c&state=s", `${COOKIE}=s`), env, fetcher)).text();
    expect(html).toContain("authorization:github:error:");
  });
});

describe("security headers", () => {
  test.each([
    ["auth", () => new Request(`${BASE}/auth?provider=github`)],
    ["bad provider", () => new Request(`${BASE}/auth?provider=gitlab`)],
    ["callback", () => cb("code=c&state=s", `${COOKIE}=s`)],
    ["404", () => new Request(`${BASE}/`)],
  ])("%s response carries Referrer-Policy and nosniff", async (_n, req) => {
    const res = await handle(req(), env, okFetcher());
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
  test("misconfigured response carries them too", async () => {
    const res = await handle(new Request(`${BASE}/`), { ...env, GITHUB_CLIENT_ID: "" });
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

/** Runs the callback page's inline script against a fake window. */
async function runPopup(withOpener: boolean) {
  const html = await (await handle(cb("code=c&state=s", `${COOKIE}=s`), env, okFetcher())).text();
  const script = html.match(/<script nonce="[0-9a-f]+">([\s\S]*?)<\/script>/)![1];
  const posts: Array<[unknown, string]> = [];
  const opener = { postMessage: (data: unknown, target: string) => posts.push([data, target]) };
  let handler: ((e: { origin: string; data: unknown; source: unknown }) => void) | undefined;
  const document = { body: { textContent: "" } };
  const window = {
    opener: withOpener ? opener : null,
    addEventListener: (type: string, fn: typeof handler) => {
      if (type === "message") handler = fn;
    },
    removeEventListener: (type: string, fn: typeof handler) => {
      if (type === "message" && fn === handler) handler = undefined;
    },
  };
  vm.runInNewContext(script, { window, document });
  const send = (e: { origin: string; data: unknown; source: unknown }) => handler?.(e);
  return { posts, opener, send, document };
}

describe("popup handshake (inline script)", () => {
  test("first post is authorizing:github to the allowed origin", async () => {
    const { posts } = await runPopup(true);
    expect(posts).toEqual([["authorizing:github", "https://lidr.io"]]);
  });

  test("echoes from the wrong origin, with other data, or from another source post nothing", async () => {
    const { posts, opener, send } = await runPopup(true);
    send({ origin: "https://evil.com", data: "authorizing:github", source: opener });
    send({ origin: "https://lidr.io", data: "something-else", source: opener });
    send({ origin: "https://lidr.io", data: "authorizing:github", source: {} });
    expect(posts).toHaveLength(1);
  });

  test("the correct echo posts exactly one success message to the allowed origin", async () => {
    const { posts, opener, send } = await runPopup(true);
    send({ origin: "https://lidr.io", data: "authorizing:github", source: opener });
    send({ origin: "https://lidr.io", data: "authorizing:github", source: opener });
    expect(posts).toHaveLength(2);
    const [data, target] = posts[1];
    expect(target).toBe("https://lidr.io");
    expect(String(data).startsWith("authorization:github:success:")).toBe(true);
    expect(JSON.parse(String(data).slice("authorization:github:success:".length))).toEqual({ token: "tok", provider: "github" });
  });

  test("with no opener nothing is posted", async () => {
    const { posts, document } = await runPopup(false);
    expect(posts).toHaveLength(0);
    expect(document.body.textContent).toContain("https://lidr.io/admin");
  });
});

test("unknown path → 404", async () => {
  expect((await handle(new Request(`${BASE}/`), env)).status).toBe(404);
});
