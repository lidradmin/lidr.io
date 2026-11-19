import type { Element, ElementContent, Root } from "hast";
import { toString as mdToString } from "mdast-util-to-string";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
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
  // Code isn't prose: drop code blocks and inline code before extracting text.
  visit(tree, (node, index, parent) => {
    if ((node.type === "code" || node.type === "inlineCode") && parent && index !== undefined) {
      parent.children.splice(index, 1);
      return [SKIP, index];
    }
  });
  // Join block-level text with spaces, then normalise whitespace.
  const blocks = (tree.children ?? []).map((n) => mdToString(n, { includeImageAlt: false }));
  return blocks.join(" ").replace(/\s+/g, " ").trim();
}

function lookupImage(images: ImageManifest, src: string): ImageVariant | undefined {
  if (Object.hasOwn(images, src)) return images[src];
  try {
    const decoded = decodeURIComponent(src);
    if (Object.hasOwn(images, decoded)) return images[decoded];
  } catch {
    // malformed escape: treat as unknown
  }
  return undefined;
}

function isBlank(n: ElementContent): boolean {
  return n.type === "text" && n.value.trim() === "";
}

function rehypeBlogImages(opts: { images: ImageManifest; warnings: Problem[] }) {
  return (tree: Root) => {
    let first = true;
    let removed = false;
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "img" || !parent || index === undefined) return;
      const src = String(node.properties.src ?? "");
      const alt = String(node.properties.alt ?? "");
      const img = lookupImage(opts.images, src);
      if (!img) {
        opts.warnings.push(soft("images", `Only photos uploaded in the editor can be shown. This image was removed: ${src}`));
        parent.children.splice(index, 1);
        removed = true;
        return [SKIP, index];
      }
      if (!alt) {
        opts.warnings.push(soft("images", `A photo has no alt text (${src}). Describe what it shows so screen readers and Google understand it.`));
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
              ...(first ? { fetchPriority: "high" } : { loading: "lazy" }),
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
    if (removed) {
      // Drop paragraphs left empty by a removed image.
      visit(tree, "element", (node: Element, index, parent) => {
        if (node.tagName !== "p" || !parent || index === undefined) return;
        if (node.children.every(isBlank)) {
          parent.children.splice(index, 1);
          return [SKIP, index];
        }
      });
    }
  };
}

function isExternal(href: string): boolean {
  try {
    const u = new URL(href, "https://lidr.io/");
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return u.hostname !== "lidr.io" && u.hostname !== "www.lidr.io";
  } catch {
    return false;
  }
}

function rehypeExternalLinks() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return;
      if (isExternal(String(node.properties.href ?? ""))) {
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
    // Default GitHub schema: no scripts, handlers, javascript: URLs. remark-rehype already
    // prefixes footnote ids, so don't let sanitize prefix them a second time.
    .use(rehypeSanitize, { ...defaultSchema, clobberPrefix: "" })
    .use(rehypeSlug, { prefix: "h-" }) // avoids colliding with the layout's id="main"
    .use(rehypeAutolinkHeadings, {
      behavior: "append",
      properties: { className: ["heading-anchor"], ariaHidden: "true", tabIndex: -1 },
      content: { type: "text", value: "#" },
      test: (node) => {
        const c = node.properties?.className;
        return !(Array.isArray(c) && c.includes("sr-only"));
      },
    })
    .use(rehypeBlogImages, { images: opts.images, warnings })
    .use(rehypeExternalLinks)
    .use(rehypeWrapTables)
    .use(rehypeStringify)
    .process(md);
  const text = markdownToPlainText(md);
  return { html: String(file), words: text ? text.split(/\s+/).length : 0, warnings };
}
