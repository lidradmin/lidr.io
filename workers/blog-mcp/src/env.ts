import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  PUBLIC_URL: string;
  REPO: string;
  SITE: string;
  OWNER_NAME: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  UPLOAD_SIGNING_KEY: string;
}

/** What a signed-in teammate's grant carries (encrypted by the OAuth provider). */
export interface Props {
  [key: string]: unknown;
  id: number;
  login: string;
  token: string;
  refresh?: string;
  /** epoch ms when `token` expires; absent for non-expiring tokens */
  expiresAt?: number;
}
