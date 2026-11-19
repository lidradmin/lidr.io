import type { Element, Root } from "hast";
import { toString as mdToString } from "mdast-util-to-string";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";
import type { Problem } from "./types";

export type ImageVariant = { src: string; srcset: string; width: number; height: number };
export type ImageManifest = Record<string, ImageVariant>;

/** Body column is 728px; images span it on desktop, full width on mobile. */
const BODY_IMAGE_SIZES = "(min-width: 760px) 728px, 100vw";

const soft = (field: string, message: string): Problem => ({ level: "soft", field, message });

export function markdownToPlainText(md: string): string {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md);
  // Join block-level text with spaces, then normalise whitespace.
  const blocks = (tree.children ?? []).map((n) => mdToString(n));
  return blocks.join(" ").replace(/\s+/g, " ").trim();
}

function rehypeBlogImages(opts: { images: ImageManifest; warnings: Problem[] }) {
  return (tree: Root) => {
    let first = true;
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "img" || !parent || index === undefined) return;
      const src = String(node.properties.src ?? "");
      const alt = String(node.properties.alt ?? "");
      if (!alt) {
        opts.warnings.push(soft("images", `A photo has no alt text (${src}). Describe what it shows so screen readers and Google understand it.`));
      }
      if (!src.startsWith("/images/blog/")) {
        node.properties.loading = "lazy";
        return;
      }
      const img = opts.images[src];
      if (!img) {
        opts.warnings.push(soft("images", `Photo not found: ${src}. Upload it again in the editor.`));
        parent.children.splice(index, 1);
        return [SKIP, index];
      }
      const picture: Element = {
        type: "element",
        tagName: "picture",
        properties: {},
        children: [
          { type: "element", tagName: "source", properties: { type: "image/webp", srcSet: img.srcset, sizes: BODY_IMAGE_SIZES }, children: [] },
          {
            type: "element",
            tagName: "img",
            properties: {
              src: img.src,
              alt,
              width: img.width,
              height: img.height,
              ...(first ? {} : { loading: "lazy" }),
              decoding: "async",
            },
            children: [],
          },
        ],
      };
      first = false;
      parent.children[index] = picture;
      return SKIP;
    });
  };
}

function rehypeExternalLinks() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return;
      const href = String(node.properties.href ?? "");
      if (/^https?:\/\//.test(href) && !/^https:\/\/(www\.)?lidr\.io(\/|$)/.test(href)) {
        node.properties.rel = ["noopener", "noreferrer"];
      }
    });
  };
}

function rehypeWrapTables() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "table" || !parent || index === undefined) return;
      parent.children[index] = { type: "element", tagName: "div", properties: { className: ["table-wrap"] }, children: [node] };
      return SKIP;
    });
  };
}

export async function renderMarkdown(
  md: string,
  opts: { images: ImageManifest }
): Promise<{ html: string; words: number; warnings: Problem[] }> {
  const warnings: Problem[] = [];
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype) // raw HTML is dropped (allowDangerousHtml is off)
    .use(rehypeSanitize) // default GitHub schema: no scripts, handlers, javascript: URLs
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: "wrap" })
    .use(rehypeBlogImages, { images: opts.images, warnings })
    .use(rehypeExternalLinks)
    .use(rehypeWrapTables)
    .use(rehypeStringify)
    .process(md);
  const text = markdownToPlainText(md);
  return { html: String(file), words: text ? text.split(/\s+/).length : 0, warnings };
}
