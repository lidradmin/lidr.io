import { authorizationErrorRedirect, type ConsentDescription, OAuthError } from "@cloudflare/workers-oauth-provider";
import type { Env, Props } from "./env";
import { GitHub } from "./github";

export const ACCESS_TOKEN_TTL_S = 3600;
/** Refresh GitHub's token when it would expire before our next access token does. */
const REFRESH_MARGIN_MS = (ACCESS_TOKEN_TTL_S + 10 * 60) * 1000;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function page(title: string, body: string, status = 200, headers = new Headers()): Response {
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://github.com; frame-ancestors 'none'");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font:17px/1.5 system-ui,sans-serif;max-width:34rem;margin:3rem auto;padding:0 1rem;color:#1c2a26}h1{font-size:1.5rem}button{font:inherit;padding:.7rem 1.2rem;border-radius:.6rem;border:1px solid #1c2a26;margin-right:.6rem;cursor:pointer;min-height:44px}.go{background:#1c2a26;color:#fff}.muted{color:#5b6763;font-size:.95rem}code{background:#f1f2f0;padding:.1em .3em;border-radius:.3em}</style></head><body>${body}</body></html>`,
    { status, headers },
  );
}

export function renderConsentPage(d: ConsentDescription, handle: string, headers: Headers): Response {
  const who = d.clientDomain ? `${esc(d.clientName)} (${esc(d.clientDomain)})` : esc(d.clientName);
  return page(
    "Connect Lidr Blog",
    `<h1>Connect ${who} to the Lidr blog?</h1>
<p>It will be able to <strong>publish, update and hide posts on lidr.io as you</strong>, using your GitHub account. It can't delete posts or change anything else.</p>
<p class="muted">Sign-in details go to <code>${esc(d.redirectHost)}</code>.${d.redirectIsLoopback ? " That's an app on this computer: only continue if you started this." : ""}</p>
<form method="post" action="/authorize"><input type="hidden" name="handle" value="${esc(handle)}">
<button class="go" name="action" value="allow" type="submit">Continue with GitHub</button><button name="action" value="deny" type="submit">Cancel</button></form>`,
    200,
    headers,
  );
}

export function notInvitedPage(login: string, owner: string): Response {
  return page(
    "Not invited yet",
    `<h1>You're signed in as ${esc(login)}, but you can't publish to the blog yet</h1>
<p>Ask ${esc(owner)} to invite <strong>${esc(login)}</strong> to <code>lidr-blog</code> on GitHub, accept the invite email, then connect again from Claude.</p>`,
    403,
  );
}

export function errorPage(message: string, status = 400): Response {
  return page("Something went wrong", `<h1>That didn't work</h1><p>${esc(message)}</p><p class="muted">Close this window and try connecting again from Claude.</p>`, status);
}

async function s256(verifier: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return btoa(String.fromCharCode(...d)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export async function githubAuthorizeUrl(env: Env, state: string, verifier: string): Promise<string> {
  const u = new URL("https://github.com/login/oauth/authorize");
  u.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  u.searchParams.set("redirect_uri", `${env.PUBLIC_URL}/callback`);
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", await s256(verifier));
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

type GitHubTokens = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };

async function githubToken(env: Env, params: Record<string, string>, fetcher: typeof fetch): Promise<GitHubTokens> {
  const res = await fetcher("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "lidr-blog-mcp" },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, ...params }),
  });
  if (!res.ok) return { error: "http_error", error_description: `GitHub answered ${res.status}` };
  return (await res.json()) as GitHubTokens;
}

const toProps = (t: GitHubTokens, who: { id: number; login: string }, now: number): Props => ({
  id: who.id,
  login: who.login,
  token: t.access_token!,
  ...(t.refresh_token ? { refresh: t.refresh_token } : {}),
  ...(t.expires_in ? { expiresAt: now + t.expires_in * 1000 } : {}),
});

/** GET/POST /authorize and GET /callback. */
export async function handleAuth(req: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  const oauth = env.OAUTH_PROVIDER;
  const url = new URL(req.url);

  if (url.pathname === "/authorize" && req.method === "GET") {
    let authRequest;
    try {
      authRequest = await oauth.parseAuthRequest(req);
    } catch (e) {
      return errorPage(e instanceof Error ? e.message : "The sign-in request isn't valid.");
    }
    const consent = await oauth.beginConsent(authRequest);
    return renderConsentPage(await oauth.describeConsent(authRequest), consent.handle, consent.headers);
  }

  if (url.pathname === "/authorize" && req.method === "POST") {
    const form = await req.formData();
    const handle = String(form.get("handle") ?? "");
    try {
      if (form.get("action") !== "allow") {
        const denied = await oauth.denyConsent(req, handle);
        return new Response(null, { status: 302, headers: denied.headers });
      }
      const approved = await oauth.approveConsent(req, handle);
      const verifier = crypto.randomUUID() + crypto.randomUUID();
      const { state, headers } = await oauth.beginUpstream(approved.request, { data: { verifier }, headers: approved.headers });
      headers.set("Location", await githubAuthorizeUrl(env, state, verifier));
      return new Response(null, { status: 302, headers });
    } catch (e) {
      return errorPage(e instanceof Error ? e.message : "This sign-in page has expired.");
    }
  }

  if (url.pathname === "/callback" && req.method === "GET") {
    let resumed;
    try {
      resumed = await oauth.finishUpstream<{ verifier: string }>(req);
    } catch (e) {
      return errorPage(e instanceof Error ? e.message : "This sign-in has expired.");
    }
    const { request: original, data, headers } = resumed;
    const code = url.searchParams.get("code");
    if (url.searchParams.get("error") || !code) {
      headers.set("Location", authorizationErrorRedirect(original, "access_denied"));
      return new Response(null, { status: 302, headers });
    }
    const tokens = await githubToken(env, { code, redirect_uri: `${env.PUBLIC_URL}/callback`, code_verifier: data.verifier }, fetcher);
    if (!tokens.access_token) return errorPage(tokens.error_description || "GitHub didn't return a sign-in token.", 502);
    const gh = new GitHub(tokens.access_token, fetcher);
    const who = await gh.whoAmI();
    if (!(await gh.canWrite(env.REPO))) return notInvitedPage(who.login, env.OWNER_NAME);
    const { redirectTo } = await oauth.completeAuthorization({
      request: original,
      userId: String(who.id),
      metadata: { login: who.login },
      scope: original.scope,
      props: toProps(tokens, who, Date.now()),
    });
    headers.set("Location", redirectTo);
    return new Response(null, { status: 302, headers });
  }

  return new Response("Not found", { status: 404 });
}

/** Keeps the GitHub token fresh when Claude refreshes its access token. */
export async function refreshUpstream(
  opts: { grantType: string; props: Props; env: Env },
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<{ newProps: Props } | undefined> {
  const { props } = opts;
  if (opts.grantType !== "refresh_token" || !props.refresh || !props.expiresAt) return undefined;
  if (props.expiresAt - now > REFRESH_MARGIN_MS) return undefined;
  const t = await githubToken(opts.env, { grant_type: "refresh_token", refresh_token: props.refresh }, fetcher);
  if (t.error === "bad_refresh_token" || t.error === "incorrect_client_credentials") {
    throw new OAuthError("invalid_grant", { description: "GitHub access was revoked. Reconnect the Lidr Blog connector." });
  }
  if (!t.access_token) throw new OAuthError("temporarily_unavailable", { description: "GitHub is unavailable", statusCode: 503 });
  return { newProps: { ...toProps(t, props, now), refresh: t.refresh_token ?? props.refresh } };
}
