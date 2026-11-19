import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import satori from "satori";
import sharp from "sharp";
import { decompress } from "wawoff2";

// Colours mirror styles/tokens.css (--color-brand, --color-accent, --color-white).
const BRAND = "#192c27";
const ACCENT = "#f2e32b";
const WHITE = "#ffffff";

function readAsset(rel: string): Buffer {
  const path = join(process.cwd(), rel);
  try {
    return readFileSync(path);
  } catch {
    throw new Error(`OG renderer: can't read ${path} (run from the repo root)`);
  }
}

// satori can't read woff2; decompress the site's own font to TTF in memory (cached as a promise).
let fontPromise: Promise<Buffer> | null = null;
const amenti = () => (fontPromise ??= decompress(readAsset("app/fonts/Amenti-Medium.woff2")).then((d) => Buffer.from(d)));

// Amenti is Latin-only: Latin/Latin Extended (U+0020-U+024F), General Punctuation, and the euro sign.
const supported = (cp: number) => (cp >= 0x20 && cp <= 0x24f) || (cp >= 0x2000 && cp <= 0x206f) || cp === 0x20ac;

export function ogUnsupportedChars(text: string): string[] {
  return [...new Set([...text].filter((c) => !supported(c.codePointAt(0)!)))];
}

function clean(text: string): string {
  return [...text].filter((c) => supported(c.codePointAt(0)!)).join("").replace(/\s+/g, " ").trim();
}

let logo: { uri: string; width: number; height: number } | null = null;
function footerLogo(height: number) {
  if (!logo) {
    const svg = readAsset("public/icons/footer_logo.svg").toString("utf8");
    const [, , w, h] = (svg.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 199 80").trim().split(/[\s,]+/).map(Number);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      throw new Error("OG renderer: footer_logo.svg has an unparseable viewBox");
    }
    logo = { uri: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, width: w, height: h };
  }
  return { src: logo.uri, height, width: Math.round((height * logo.width) / logo.height) };
}

// Plain {type, props} objects rather than JSX: this runs under tsx with no React/JSX transform needed.
type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, children, ...extra },
});

export async function renderOgImage(opts: { title: string; tagName?: string }): Promise<Buffer> {
  const title = clean(opts.title) || "Lidr.io";
  const tagName = clean(opts.tagName ?? "");
  const len = title.length;
  const fontSize = len <= 40 ? 72 : len <= 60 ? 60 : 52;
  const img = footerLogo(56);
  const tree = el(
    "div",
    {
      width: 1200,
      height: 630,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      background: BRAND,
      padding: "72px 80px",
      boxSizing: "border-box",
      fontFamily: "Amenti",
      color: WHITE,
    },
    [
      el("div", { display: "flex", flexDirection: "column" }, [
        el("div", { display: "block", fontSize, lineHeight: 1.15, lineClamp: 3, wordBreak: "break-word" }, title),
        el("div", { width: 96, height: 8, background: ACCENT, marginTop: 32 }),
      ]),
      el("div", { display: "flex", justifyContent: "space-between", alignItems: "center" }, [
        el("img", {}, undefined, img),
        tagName ? el("div", { display: "flex", fontSize: 28, color: ACCENT }, tagName) : el("div", { display: "flex" }),
      ]),
    ]
  );
  const svg = await satori(tree as unknown as ReactNode, {
    width: 1200,
    height: 630,
    fonts: [{ name: "Amenti", data: await amenti(), weight: 500, style: "normal" }],
  });
  return sharp(Buffer.from(svg)).png().toBuffer();
}
