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
    expect(r.html).toContain('<h2 id="why-photos-matter"><a href="#why-photos-matter">');
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

test("markdownToPlainText", () => {
  expect(markdownToPlainText("## Hi\n\nSome **bold** [link](/x).")).toBe("Hi Some bold link.");
});
