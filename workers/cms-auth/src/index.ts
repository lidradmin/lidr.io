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
}

const STATE_COOKIE = "cms_oauth_state";

const worker = {
  fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, env);
  },
};
export default worker;

export async function handle(req: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname === "/auth") return startAuth(url, env);
  if (url.pathname === "/callback") return finishAuth(req, url, env, fetcher);
  return new Response("Not found", { status: 404 });
}

function startAuth(url: URL, env: Env): Response {
  if (url.searchParams.get("provider") !== "github") return new Response("Unsupported provider", { status: 400 });
  const state = crypto.randomUUID();
  const gh = new URL("https://github.com/login/oauth/authorize");
  gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  gh.searchParams.set("redirect_uri", `${url.origin}/callback`);
  gh.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: gh.toString(),
      "Set-Cookie": `${STATE_COOKIE}=${state}; Path=/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      "Cache-Control": "no-store",
    },
  });
}

async function finishAuth(req: Request, url: URL, env: Env, fetcher: typeof fetch): Promise<Response> {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = readCookie(req.headers.get("Cookie"), STATE_COOKIE);
  if (!code || !state || !expected || state !== expected) {
    return page(env, "error", { message: "The sign-in expired or didn't match. Close this window and click Login again." });
  }
  try {
    const res = await fetcher("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "lidr-cms-auth" },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: `${url.origin}/callback` }),
    });
    const data = (await res.json()) as { access_token?: string; error_description?: string };
    if (!data.access_token) return page(env, "error", { message: data.error_description || "GitHub didn't return a sign-in token." });
    return page(env, "success", { token: data.access_token, provider: "github" });
  } catch {
    return page(env, "error", { message: "Couldn't reach GitHub. Close this window and try again." });
  }
}

function page(env: Env, status: "success" | "error", payload: Record<string, string>): Response {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const js = (v: string) => JSON.stringify(v).replace(/</g, "\\u003c");
  const html =
    `<!doctype html><meta charset="utf-8"><title>Signing in…</title>` +
    `<p style="font-family:sans-serif">Signing you in… This window closes by itself.</p>` +
    `<script nonce="${nonce}">(function(){var origin=${js(env.ALLOWED_ORIGIN)};var msg=${js(message)};` +
    `if(!window.opener){document.body.textContent="Open the editor at "+origin+"/admin/ and sign in from there.";return;}` +
    `function receive(e){if(e.origin!==origin||e.data!=="authorizing:github")return;window.removeEventListener("message",receive);window.opener.postMessage(msg,origin);}` +
    `window.addEventListener("message",receive);window.opener.postMessage("authorizing:github",origin);})();</script>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'`,
      "Set-Cookie": `${STATE_COOKIE}=; Path=/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
}

function readCookie(header: string | null, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}
