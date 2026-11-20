import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { ACCESS_TOKEN_TTL_S, handleAuth, refreshUpstream } from "./auth";
import type { Env, Props } from "./env";
import { GitHub } from "./github";
import { INSTRUCTIONS } from "./instructions";
import { handleMcp } from "./mcp";
import { createTools } from "./tools";
import { handleUpload } from "./upload";

/** /mcp — only reached with a valid access token; ctx.props is the teammate's grant. */
const mcpHandler = {
  async fetch(req: Request, env: Env, ctx: ExecutionContext & { props: Props }): Promise<Response> {
    const props = ctx.props;
    const tools = createTools({
      gh: new GitHub(props.token),
      kv: env.OAUTH_KV,
      user: { id: props.id, login: props.login },
      repo: env.REPO,
      site: env.SITE,
      publicUrl: env.PUBLIC_URL,
      signingKey: env.UPLOAD_SIGNING_KEY,
    });
    return handleMcp(req, tools, { instructions: INSTRUCTIONS });
  },
};

/** Everything that isn't /mcp or the OAuth endpoints the provider owns. */
const defaultHandler = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/authorize" || url.pathname === "/callback") return handleAuth(req, env);
    if (url.pathname.startsWith("/upload/")) {
      return handleUpload(req, url.pathname.slice("/upload/".length), { kv: env.OAUTH_KV, signingKey: env.UPLOAD_SIGNING_KEY });
    }
    if (url.pathname === "/") {
      return new Response(
        "Lidr Blog connector for Claude. Add https://mcp.lidr.io/mcp as a custom connector in Claude's settings.",
        { headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }
    return new Response("Not found", { status: 404 });
  },
};

const provider = new OAuthProvider<Env>({
  apiRoute: "/mcp",
  apiHandler: mcpHandler as never,
  defaultHandler: defaultHandler as never,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/oauth/token",
  clientRegistrationEndpoint: "/oauth/register",
  clientIdMetadataDocumentEnabled: true,
  scopesSupported: ["blog"],
  resourceMetadata: {
    resource: "https://mcp.lidr.io/mcp",
    authorization_servers: ["https://mcp.lidr.io"],
    resource_name: "Lidr Blog",
  },
  accessTokenTTL: ACCESS_TOKEN_TTL_S,
  tokenExchangeCallback: async (opts) => refreshUpstream({ grantType: opts.grantType, props: opts.props as Props, env: opts.env }),
});

export default provider;
