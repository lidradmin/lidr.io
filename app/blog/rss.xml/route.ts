import { getPosts } from "../../../lib/blog/data";
import { postUrl } from "../../../lib/blog/jsonld";
import { RSS_URL } from "../../../lib/blog/seo";

export const dynamic = "force-static";

// XML 1.0 forbids most C0 control characters (tab, LF and CR are allowed).
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

const esc = (s: string) =>
  s
    .replace(INVALID_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const rfc822 = (date: string) => new Date(`${date}T00:00:00Z`).toUTCString();

export function GET() {
  const posts = getPosts();
  const items = posts
    .slice(0, 50)
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${postUrl(p.slug)}</link>
      <guid isPermaLink="true">${postUrl(p.slug)}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <description>${esc(p.description)}</description>
    </item>`
    )
    .join("\n");
  // Posts are newest first, but an older post can have the latest update.
  const newest = posts.map((p) => p.updated ?? p.date).sort().at(-1);
  const lastBuildDate = newest ? `\n    <lastBuildDate>${rfc822(newest)}</lastBuildDate>` : "";
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Lidr.io Blog</title>
    <link>https://lidr.io/blog/</link>
    <atom:link href="${RSS_URL}" rel="self" type="application/rss+xml"/>
    <description>Guides for site teams on photo records and reporting.</description>
    <language>en-gb</language>${lastBuildDate}
${items}
  </channel>
</rss>
`;
  // Under `output: "export"` these response headers are dropped: the file is served
  // statically, so its Content-Type comes from public/_headers (Cloudflare Pages).
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
