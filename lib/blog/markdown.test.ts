import { describe, expect, test } from "vitest";
import { markdownToPlainText, renderMarkdown } from "./markdown";

const IMAGES = {
  "/images/blog/p/site.jpg": {
    src: "/images/blog/p/site-1600.jpg",
    srcset: "/images/blog/p/site-480.webp 480w, /images/blog/p/site-960.webp 960w",
    width: 960,
    height: 640,
  },
};

describe("renderMarkdown", () => {
  test("renders GFM tables wrapped for scrolling", async () => {
    const r = await renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |", { images: {} });
    expect(r.html).toContain('<div class="table-wrap"><table>');
  });
  test("strips raw HTML and javascript: links", async () => {
    const r = await renderMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert(1)) <b onclick="x">b</b>', { images: {} });
    expect(r.html).not.toContain("<script");
    expect(r.html).not.toContain("javascript:");
    expect(r.html).not.toContain("onclick");
  });
  test("headings get ids and wrapping anchor links", async () => {
    const r = await renderMarkdown("## Why photos matter", { images: {} });
    expect(r.html).toContain('<h2 id="h-why-photos-matter">Why photos matter<a class="heading-anchor" aria-hidden="true" tabindex="-1" href="#h-why-photos-matter">#</a></h2>');
  });
  test("known images become <picture> with webp source and dimensions", async () => {
    const r = await renderMarkdown("![A scaffold](/images/blog/p/site.jpg)", { images: IMAGES });
    expect(r.html).toContain('<picture><source type="image/webp"');
    expect(r.html).toContain('width="960" height="640"');
    expect(r.warnings).toEqual([]);
  });
  test("first image is eager, later images lazy", async () => {
    const r = await renderMarkdown("![a](/images/blog/p/site.jpg)\n\n![b](/images/blog/p/site.jpg)", { images: IMAGES });
    expect(r.html.match(/loading="lazy"/g)).toHaveLength(1);
    const imgs = r.html.match(/<img [^>]*>/g)!;
    expect(imgs[0]).toContain('fetchpriority="high"');
    expect(imgs[0]).not.toContain("loading=");
    expect(imgs[1]).toContain('loading="lazy"');
    expect(imgs[1]).not.toContain("fetchpriority");
  });
  test("when the first image is missing, the next kept image is eager", async () => {
    const r = await renderMarkdown("![x](/images/blog/p/missing.jpg)\n\n![b](/images/blog/p/site.jpg)", { images: IMAGES });
    expect(r.html).not.toContain("loading=");
    expect(r.html).toContain('fetchpriority="high"');
    expect(r.warnings).toHaveLength(1);
  });
  test("footnote links round-trip to ids", async () => {
    const r = await renderMarkdown("Hi[^1]\n\n[^1]: Note.", { images: {} });
    const ids = [...r.html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    const hrefs = [...r.html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) expect(ids).toContain(h);
  });
  test.each([
    ["http", "![a](http://x.com/a.png)"],
    ["https", "![a](https://x.com/a.png)"],
    ["protocol-relative", "![a](//x.com/a.png)"],
    ["relative", "![a](foo/a.png)"],
    ["data", "![a](data:image/png;base64,AAAA)"],
    ["unlisted blog path", "![a](/images/blog/p/nope.jpg)"],
  ])("non-manifest image (%s) is removed with one warning", async (_n, md) => {
    const r = await renderMarkdown(md, { images: IMAGES });
    expect(r.html).not.toContain("<img");
    expect(r.html).not.toContain("<p></p>");
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].message).toMatch(/^Only photos uploaded in the editor can be shown\. This image was removed: /);
  });
  test("percent-encoded src matches a manifest key with spaces", async () => {
    const images = { "/images/blog/p/my site.jpg": IMAGES["/images/blog/p/site.jpg"] };
    const r = await renderMarkdown("![a](/images/blog/p/my%20site.jpg)", { images });
    expect(r.html).toContain("<picture>");
    expect(r.warnings).toEqual([]);
  });
  test("heading containing a link has no nested anchors; anchor is a sibling", async () => {
    const r = await renderMarkdown("## See [docs](/x/)", { images: {} });
    expect(r.html).not.toMatch(/<a[^>]*>(?:(?!<\/a>).)*<a /);
    expect(r.html).toContain('<a href="/x/">docs</a>');
  });
  test("footnote label heading gets no anchor", async () => {
    const r = await renderMarkdown("Hi[^1]\n\n[^1]: Note.", { images: {} });
    const h = r.html.match(/<h2[^>]*sr-only[^>]*>[\s\S]*?<\/h2>/)![0];
    expect(h).not.toContain("<a");
  });
  test("## Main does not collide with the layout main id", async () => {
    const r = await renderMarkdown("## Main", { images: {} });
    expect(r.html).toContain('id="h-main"');
    expect(r.html).not.toContain('id="main"');
  });
  test.each([
    ["//example.com/x", true],
    ["https://example.com/x", true],
    ["http://lidr.io/x", false],
    ["https://www.lidr.io/x", false],
    ["/features/", false],
  ])("external link detection %s", async (href, ext) => {
    const r = await renderMarkdown(`[t](${href})`, { images: {} });
    expect(r.html.includes('rel="noopener noreferrer"')).toBe(ext);
  });
  test("link emptied by a removed image is dropped with its paragraph", async () => {
    const r = await renderMarkdown("[![a](/images/blog/p/nope.jpg)](https://x.com)", { images: IMAGES });
    expect(r.html).not.toContain("<a");
    expect(r.html).not.toContain("<p></p>");
  });
  test.each(["HTTPS://example.com", "javascript:alert(1)"])("link with disallowed href %s is unwrapped with a warning", async (href) => {
    const r = await renderMarkdown(`[x](${href})`, { images: {} });
    expect(r.html).not.toContain("<a");
    expect(r.html).toContain("x");
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].message).toBe(
      `A link was removed because its address isn't allowed: "x". Use a normal web address starting with https://.`
    );
  });
  test("every id is namespaced", async () => {
    const r = await renderMarkdown("Hi[^__proto__]\n\n## __proto__\n\n## Main\n\n[^__proto__]: Note.", { images: {} });
    const ids = [...r.html.matchAll(/ id="([^"]*)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(2);
    for (const id of ids) expect(id.startsWith("user-content-") || id.startsWith("h-") || id === "footnote-label").toBe(true);
  });
  test("alt warning only for kept images", async () => {
    const r = await renderMarkdown("![](/images/blog/p/missing.jpg)", { images: IMAGES });
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].message).not.toMatch(/alt text/);
  });
  test("missing image is removed with a soft warning", async () => {
    const r = await renderMarkdown("![x](/images/blog/p/missing.jpg)", { images: {} });
    expect(r.html).not.toContain("missing.jpg");
    expect(r.warnings[0]).toMatchObject({ level: "soft", field: "images" });
  });
  test("image without alt warns", async () => {
    const r = await renderMarkdown("![](/images/blog/p/site.jpg)", { images: IMAGES });
    expect(r.warnings[0].message).toMatch(/alt text/);
  });
  test("external links get rel noopener noreferrer, internal links don't", async () => {
    const r = await renderMarkdown("[ext](https://example.com) [int](/features/)", { images: {} });
    expect(r.html).toContain('<a href="https://example.com" rel="noopener noreferrer">');
    expect(r.html).toContain('<a href="/features/">');
  });
  test("counts words", async () => {
    const r = await renderMarkdown("one two three", { images: {} });
    expect(r.words).toBe(3);
  });
});

test("markdownToPlainText skips code and image alt", () => {
  expect(markdownToPlainText("Hi `code` there\n\n```\nconst a = 1;\n```\n\n![alt text](/x.png)")).toBe("Hi there");
});

test("markdownToPlainText", () => {
  expect(markdownToPlainText("## Hi\n\nSome **bold** [link](/x).")).toBe("Hi Some bold link.");
});
