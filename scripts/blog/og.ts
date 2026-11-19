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

let fontData: Buffer | null = null;
async function amenti(): Promise<Buffer> {
  // satori can't read woff2; decompress the site's own font to TTF in memory.
  fontData ??= Buffer.from(await decompress(readFileSync(join(process.cwd(), "app/fonts/Amenti-Medium.woff2"))));
  return fontData;
}

let logo: { uri: string; width: number; height: number } | null = null;
function footerLogo(height: number) {
  if (!logo) {
    const svg = readFileSync(join(process.cwd(), "public/icons/footer_logo.svg"), "utf8");
    const [, , w, h] = (svg.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 199 80").split(/\s+/).map(Number);
    logo = { uri: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, width: w, height: h };
  }
  return { src: logo.uri, height, width: Math.round((height * logo.width) / logo.height) };
}

type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, children, ...extra },
});

export async function renderOgImage(opts: { title: string; tagName?: string }): Promise<Buffer> {
  const len = opts.title.length;
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
        el("div", { display: "block", fontSize, lineHeight: 1.15, lineClamp: 3 }, opts.title),
        el("div", { width: 96, height: 8, background: ACCENT, marginTop: 32 }),
      ]),
      el("div", { display: "flex", justifyContent: "space-between", alignItems: "center" }, [
        el("img", {}, undefined, img),
        el("div", { display: "flex", fontSize: 28, color: ACCENT }, opts.tagName ?? ""),
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
