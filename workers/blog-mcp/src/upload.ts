import { imagePublicPath } from "./content";
import { NotJpegError, stripJpegMetadata } from "./jpeg";

/** What a one-time upload link allows: user `u` uploads file `f` for post `s`. */
export type UploadClaims = { u: number; s: string; f: string; k: "cover" | "inline"; alt?: string; exp: number; n?: string };

export type KV = {
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
  get(key: string): Promise<string | null>;
  put(key: string, value: string | ArrayBuffer | ArrayBufferView, opts?: { expirationTtl?: number; metadata?: unknown }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix?: string }): Promise<{ keys: { name: string; metadata?: unknown }[]; list_complete: boolean }>;
};

export const UPLOAD_LINK_TTL_MS = 15 * 60 * 1000;
export const PHOTO_TTL_S = 24 * 60 * 60;
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

class UploadError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function hmac(data: string, key: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)));
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

export async function signUploadToken(c: UploadClaims, key: string): Promise<string> {
  // A random nonce makes every link unique, so single-use tracking never collides.
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ ...c, n: c.n ?? crypto.randomUUID() })));
  return `${payload}.${b64url(await hmac(payload, key))}`;
}

/** Checks signature and expiry, then marks the link used (single use). */
export async function verifyUploadToken(token: string, key: string, kv: KV): Promise<UploadClaims> {
  const invalid = new UploadError(403, "This upload link isn't valid. Ask Claude for a new one (start_photo_upload).");
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined) throw invalid;
  let given: Uint8Array;
  let claims: UploadClaims;
  try {
    given = fromB64url(sig);
    claims = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
  } catch {
    throw invalid;
  }
  if (!equal(given, await hmac(payload, key))) throw invalid;
  if (typeof claims.exp !== "number" || claims.exp < Date.now()) {
    throw new UploadError(403, "This upload link has expired (links last 15 minutes). Ask Claude for a new one.");
  }
  const usedKey = `used:${sig}`;
  if (await kv.get(usedKey)) throw new UploadError(403, "This upload link has already been used. Ask Claude for a new one.");
  await kv.put(usedKey, "1", { expirationTtl: 3600 });
  return claims;
}

export const photoKey = (u: number, slug: string, file: string) => `photo:${u}:${slug}:${file}`;

export type PendingPhoto = { key: string; file: string; path: string; kind: "cover" | "inline"; alt?: string };

export async function listPendingPhotos(kv: KV, u: number, slug: string): Promise<PendingPhoto[]> {
  const prefix = `photo:${u}:${slug}:`;
  const { keys } = await kv.list({ prefix });
  return keys.map(({ name, metadata }) => {
    const m = (metadata ?? {}) as { kind?: "cover" | "inline"; alt?: string };
    const file = name.slice(prefix.length);
    return { key: name, file, path: imagePublicPath(slug, file), kind: m.kind ?? "inline", alt: m.alt };
  });
}

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** POST /upload/<token> with the raw JPEG as the body (from Claude's sandbox). */
export async function handleUpload(req: Request, token: string, deps: { kv: KV; signingKey: string }): Promise<Response> {
  try {
    if (req.method !== "POST") throw new UploadError(405, "Send the photo with POST.");
    const declared = Number(req.headers.get("Content-Length") ?? "0");
    if (declared > MAX_PHOTO_BYTES) throw new UploadError(413, "The photo is over 15 MB. Use the command from start_photo_upload, which shrinks it first.");
    const claims = await verifyUploadToken(token, deps.signingKey, deps.kv);
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length === 0) throw new UploadError(400, "No photo was sent.");
    if (bytes.length > MAX_PHOTO_BYTES) throw new UploadError(413, "The photo is over 15 MB. Use the command from start_photo_upload, which shrinks it first.");
    let clean: Uint8Array;
    try {
      clean = stripJpegMetadata(bytes);
    } catch (e) {
      if (e instanceof NotJpegError) throw new UploadError(415, e.message);
      throw e;
    }
    await deps.kv.put(photoKey(claims.u, claims.s, claims.f), clean, {
      expirationTtl: PHOTO_TTL_S,
      metadata: { kind: claims.k, alt: claims.alt },
    });
    const path = imagePublicPath(claims.s, claims.f);
    return reply(200, { ok: true, path, message: `Uploaded. It will be published with the post. Use ${path} in the post.` });
  } catch (e) {
    if (e instanceof UploadError) return reply(e.status, { ok: false, error: e.message });
    return reply(500, { ok: false, error: "The upload failed on our side. Try again in a minute." });
  }
}
