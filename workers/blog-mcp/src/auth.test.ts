import { OAuthError } from "@cloudflare/workers-oauth-provider";
import { describe, expect, test, vi } from "vitest";
import { githubAuthorizeUrl, handleAuth, refreshUpstream, renderConsentPage } from "./auth";
import type { Env, Props } from "./env";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

function makeEnv(over: Partial<Env> = {}): Env {
  const original = { redirectUri: "https://claude.ai/api/mcp/auth_callback", state: "s1", scope: ["blog"] };
  const oauth = {
    finishUpstream: vi.fn(async () => ({ request: original, data: { verifier: "v" }, headers: new Headers() })),
    completeAuthorization: vi.fn(async () => ({ redirectTo: "https://claude.ai/api/mcp/auth_callback?code=abc&state=s1" })),
  };
  return {
    OAUTH_KV: {} as KVNamespace,
    OAUTH_PROVIDER: oauth as unknown as Env["OAUTH_PROVIDER"],
    PUBLIC_URL: "https://mcp.lidr.io",
    REPO: "lidradmin/lidr-blog",
    SITE: "https://lidr.io",
    OWNER_NAME: "Conor",
    GITHUB_CLIENT_ID: "cid",
    GITHUB_CLIENT_SECRET: "csecret",
    UPLOAD_SIGNING_KEY: "k",
    ...over,
  };
}

function github(push: boolean) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input);
    if (u === "https://github.com/login/oauth/access_token") {
      const body = JSON.parse(String(init!.body));
      expect(body).toMatchObject({ client_id: "cid", client_secret: "csecret" });
      return json({ access_token: "gho_x", refresh_token: "ghr_y", expires_in: 28800 });
    }
    if (u.endsWith("/user")) return json({ id: 42, login: "eoin" });
    if (u.endsWith("/repos/lidradmin/lidr-blog")) return json({ permissions: { push } });
    return new Response("nope", { status: 404 });
  }) as unknown as typeof fetch;
}

describe("consent page", () => {
  test("escapes the client's self-asserted name and can't be framed", async () => {
    const res = renderConsentPage(
      { clientId: "c", clientName: '<script>alert(1)</script>', redirectUri: "https://claude.ai/cb", redirectHost: "claude.ai", redirectIsLoopback: false, scope: [] } as never,
      "h&1",
      new Headers(),
    );
    const html = await res.text();
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('value="h&amp;1"');
    expect(html).toContain("claude.ai");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });
});

describe("GitHub authorize URL", () => {
  test("uses our callback and PKCE", async () => {
    const u = new URL(await githubAuthorizeUrl(makeEnv(), "st", "verifier"));
    expect(u.searchParams.get("redirect_uri")).toBe("https://mcp.lidr.io/callback");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("code_challenge")).toMatch(/^[\w-]{43}$/);
    expect(u.searchParams.get("state")).toBe("st");
  });
});

describe("/callback", () => {
  const cb = (q: string) => new Request(`https://mcp.lidr.io/callback?${q}`);

  test("a collaborator is signed in with their GitHub token in props", async () => {
    const env = makeEnv();
    const res = await handleAuth(cb("code=c1&state=x"), env, github(true));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("claude.ai/api/mcp/auth_callback");
    const call = (env.OAUTH_PROVIDER.completeAuthorization as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.userId).toBe("42");
    expect(call.props).toMatchObject({ id: 42, login: "eoin", token: "gho_x", refresh: "ghr_y" });
    expect(call.props.expiresAt).toBeGreaterThan(Date.now());
  });

  test("someone not invited to lidr-blog is refused with a helpful page", async () => {
    const env = makeEnv();
    const res = await handleAuth(cb("code=c1&state=x"), env, github(false));
    expect(res.status).toBe(403);
    expect(await res.text()).toMatch(/Ask Conor to invite <strong>eoin<\/strong>/);
    expect(env.OAUTH_PROVIDER.completeAuthorization).not.toHaveBeenCalled();
  });

  test("declining on GitHub sends the client an access_denied redirect", async () => {
    const res = await handleAuth(cb("error=access_denied&state=x"), makeEnv(), github(true));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("error=access_denied");
  });
});

describe("refreshUpstream", () => {
  const props: Props = { id: 42, login: "eoin", token: "old", refresh: "r1", expiresAt: 1_000_000 };
  const env = makeEnv();

  test("does nothing when the GitHub token has plenty of time left", async () => {
    const f = vi.fn();
    expect(await refreshUpstream({ grantType: "refresh_token", props, env }, f as never, 1_000_000 - 3 * 3600_000)).toBeUndefined();
    expect(f).not.toHaveBeenCalled();
  });

  test("refreshes when it's close to expiry", async () => {
    const f = vi.fn(async () => json({ access_token: "new", refresh_token: "r2", expires_in: 28800 })) as unknown as typeof fetch;
    const r = await refreshUpstream({ grantType: "refresh_token", props, env }, f, 1_000_000 - 60_000);
    expect(r!.newProps).toMatchObject({ token: "new", refresh: "r2", login: "eoin" });
  });

  test("revoked access ends the grant; outages are temporary", async () => {
    const bad = vi.fn(async () => json({ error: "bad_refresh_token" })) as unknown as typeof fetch;
    await expect(refreshUpstream({ grantType: "refresh_token", props, env }, bad, 999_000)).rejects.toMatchObject({ code: "invalid_grant" });
    const down = vi.fn(async () => new Response("", { status: 502 })) as unknown as typeof fetch;
    const err = await refreshUpstream({ grantType: "refresh_token", props, env }, down, 999_000).catch((e) => e);
    expect(err).toBeInstanceOf(OAuthError);
    expect(err.code).toBe("temporarily_unavailable");
  });
});
