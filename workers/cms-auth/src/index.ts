/**
 * GitHub OAuth for the Decap CMS editor at lidr.io/admin (spec §9).
 * Implements Decap's popup handshake (decap-cms-lib-auth):
 *   popup → opener: "authorizing:github"; opener echoes it back (only if the
 *   popup's origin matches backend.base_url); popup → opener:
 *   "authorization:github:success:{token,provider}" — sent ONLY to ALLOWED_ORIGIN.
 * Uses a GitHub App installed only on lidradmin/lidr-blog, so tokens can only
 * touch that repo.
 */
export interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ALLOWED_ORIGIN: string;
  /** Exact callback URL registered on the GitHub App. Falls back to `${request origin}/callback`. */
  CALLBACK_URL?: string;
}

/** `__Host-` forbids Domain and requires Secure + Path=/, so a sibling subdomain can't plant or shadow it. */
const STATE_COOKIE = "__Host-cms_oauth_state";

const BASE_HEADERS = { "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

const worker = {
  fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, env);
  },
};
export default worker;

export async function handle(req: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  const origin = allowedOrigin(env.ALLOWED_ORIGIN);
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !origin) {
    return respond("cms-auth is misconfigured", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
  const url = new URL(req.url);
  const callbackUrl = env.CALLBACK_URL || `${url.origin}/callback`;
  if (url.pathname === "/auth") return startAuth(url, env, callbackUrl);
  if (url.pathname === "/callback") return finishAuth(req, url, env, origin, callbackUrl, fetcher);
  return respond("Not found", { status: 404 });
}

function allowedOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const origin = new URL(value).origin;
    return origin === "null" ? undefined : origin;
  } catch {
    return undefined;
  }
}

function respond(body: BodyInit | null, init: ResponseInit = {}): Response {
  return new Response(body, { ...init, headers: { ...BASE_HEADERS, ...(init.headers as Record<string, string>) } });
}

function startAuth(url: URL, env: Env, callbackUrl: string): Response {
  if (url.searchParams.get("provider") !== "github") return respond("Unsupported provider", { status: 400 });
  const state = crypto.randomUUID();
  const gh = new URL("https://github.com/login/oauth/authorize");
  gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  gh.searchParams.set("redirect_uri", callbackUrl);
  gh.searchParams.set("state", state);
  return respond(null, {
    status: 302,
    headers: {
      Location: gh.toString(),
      "Set-Cookie": `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      "Cache-Control": "no-store",
    },
  });
}

async function finishAuth(
  req: Request,
  url: URL,
  env: Env,
  origin: string,
  callbackUrl: string,
  fetcher: typeof fetch,
): Promise<Response> {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = readCookie(req.headers.get("Cookie"), STATE_COOKIE);
  if (!state || !expected || state !== expected) {
    return page(origin, "error", { message: "The sign-in expired or didn't match. Close this window and click Login again." });
  }
  if (url.searchParams.has("error")) {
    return page(origin, "error", { message: "Sign-in was cancelled. Close this window and try again." });
  }
  if (!code) {
    return page(origin, "error", { message: "The sign-in expired or didn't match. Close this window and click Login again." });
  }
  try {
    const res = await fetcher("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "lidr-cms-auth" },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: callbackUrl }),
    });
    const data = (await res.json()) as { access_token?: string; error_description?: string };
    if (!data.access_token) return page(origin, "error", { message: data.error_description || "GitHub didn't return a sign-in token." });
    return page(origin, "success", { token: data.access_token, provider: "github" });
  } catch {
    return page(origin, "error", { message: "Couldn't reach GitHub. Close this window and try again." });
  }
}

function page(origin: string, status: "success" | "error", payload: Record<string, string>): Response {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const js = (v: string) => JSON.stringify(v).replace(/</g, "\\u003c");
  const html =
    `<!doctype html><meta charset="utf-8"><title>Signing in…</title>` +
    `<p style="font-family:sans-serif">Signing you in… This window closes by itself.</p>` +
    `<script nonce="${nonce}">(function(){var origin=${js(origin)};var msg=${js(message)};` +
    `if(!window.opener){document.body.textContent="Open the editor at "+origin+"/admin/ and sign in from there.";return;}` +
    `function receive(e){if(e.origin!==origin||e.data!=="authorizing:github"||e.source!==window.opener)return;` +
    `window.removeEventListener("message",receive);window.opener.postMessage(msg,origin);}` +
    `window.addEventListener("message",receive);window.opener.postMessage("authorizing:github",origin);})();</script>`;
  return respond(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'`,
      "Set-Cookie": `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
}

/** Fails closed: a cookie name that appears more than once (cookie tossing) reads as absent. */
function readCookie(header: string | null, name: string): string | undefined {
  let found: string | undefined;
  let count = 0;
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) {
      count++;
      found = v.join("=");
    }
  }
  return count === 1 ? found : undefined;
}
