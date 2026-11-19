import { RULES } from "../../lib/blog/rules";
import { REDIRECT_PATTERN } from "../../lib/blog/validate";

/**
 * Builds the Decap CMS config (written to public/admin/config.yml by
 * prepare.ts). Every limit comes from lib/blog/rules.ts so the editor and the
 * build-time validator can never disagree. Never hand-edit config.yml.
 */
export type CmsOptions = { repo: string; branch: string; authBaseUrl: string; siteUrl: string };

export const DEFAULT_CMS_OPTIONS: CmsOptions = {
  repo: "lidradmin/lidr-blog",
  branch: "main",
  authBaseUrl: "https://cms-auth.lidr.io",
  siteUrl: "https://lidr.io",
};

const lengthPattern = (min: number, max: number, what: string): [string, string] => [
  `^[\\s\\S]{${min},${max}}$`,
  `${what} must be ${min}–${max} characters.`,
];

const dateField = (name: string, label: string, required: boolean, hint?: string) => ({
  name,
  label,
  widget: "datetime",
  format: "YYYY-MM-DD",
  date_format: "D MMM YYYY",
  time_format: false,
  picker_utc: true,
  required,
  ...(required ? { default: "{{now}}" } : {}),
  ...(hint ? { hint } : {}),
});

export function buildCmsConfig(o: CmsOptions = DEFAULT_CMS_OPTIONS) {
  const maxMb = Math.round(RULES.maxImageBytes / 1024 / 1024);
  return {
    backend: {
      name: "github",
      repo: o.repo,
      branch: o.branch,
      base_url: o.authBaseUrl,
      auth_endpoint: "auth",
      commit_messages: {
        create: 'Publish blog post "{{slug}}"',
        update: 'Update blog post "{{slug}}"',
        delete: 'Delete blog post "{{slug}}"',
        uploadMedia: 'Upload "{{path}}"',
        deleteMedia: 'Delete "{{path}}"',
      },
    },
    site_url: o.siteUrl,
    display_url: o.siteUrl,
    logo_url: `${o.siteUrl}/favicon-270x270.png`,
    locale: "en",
    media_folder: "images",
    public_folder: "/images/blog",
    media_library: { name: "default", config: { max_file_size: RULES.maxImageBytes } },
    slug: { encoding: "ascii", clean_accents: true, sanitize_replacement: "-" },
    collections: [
      {
        name: "blog",
        label: "Blog posts",
        label_singular: "Blog post",
        description: "Write a post, check the preview on the right, then click Publish. It's live on lidr.io in about 3 minutes.",
        folder: "posts",
        create: true,
        delete: false, // retire posts with "Hide this post" or a redirect, never delete (spec §2)
        slug: "{{slug}}",
        extension: "md",
        format: "frontmatter",
        preview_path: "blog/{{slug}}",
        media_folder: "/images/{{slug}}",
        public_folder: "/images/blog/{{slug}}",
        summary: "{{title}} ({{date}})",
        sortable_fields: ["date", "title"],
        fields: [
          {
            name: "title",
            label: "Title",
            widget: "string",
            pattern: lengthPattern(RULES.title.min, RULES.title.max, "The title"),
            hint: `The page heading and the blue link in Google. ${RULES.title.min}–${RULES.title.max} characters.`,
          },
          {
            name: "description",
            label: "Description for Google",
            widget: "text",
            pattern: lengthPattern(RULES.description.min, RULES.description.max, "The description"),
            hint: `One or two sentences shown under the title in Google results. ${RULES.description.min}–${RULES.description.max} characters.`,
          },
          dateField("date", "Publish date", true),
          dateField("updated", "Last updated", false, "Set this to today when you make a real change to a live post."),
          {
            name: "tags",
            label: "Topics",
            widget: "relation",
            collection: "settings",
            file: "tags",
            value_field: "tags.*.slug",
            search_fields: ["tags.*.name"],
            display_fields: ["tags.*.name"],
            multiple: true,
            min: RULES.tags.min,
            max: RULES.tags.max,
            hint: `Pick ${RULES.tags.min}–${RULES.tags.max} topics.`,
          },
          {
            name: "cover",
            label: "Cover photo",
            widget: "image",
            required: false,
            choose_url: false,
            hint: `Optional. JPEG, PNG or WebP up to ${maxMb} MB. Turn off location on your phone's camera before taking site photos.`,
            media_library: { config: { max_file_size: RULES.maxImageBytes } },
          },
          {
            name: "coverAlt",
            label: "Describe the cover photo",
            widget: "string",
            required: false,
            hint: "What the photo shows, for people using screen readers. Needed if you add a cover photo.",
          },
          { name: "draft", label: "Hide this post (draft)", widget: "boolean", default: false, required: false },
          {
            name: "redirectTo",
            label: "Retire this post and send visitors to",
            widget: "string",
            required: false,
            pattern: [REDIRECT_PATTERN.source, "Use a lidr.io path like /blog/another-post/"],
            hint: "Only to retire a post. Leave empty otherwise.",
          },
          {
            name: "body",
            label: "Post",
            widget: "markdown",
            sanitize_preview: true,
            modes: ["rich_text", "raw"],
            buttons: ["bold", "italic", "link", "heading-two", "heading-three", "quote", "bulleted-list", "numbered-list"],
            editor_components: ["image"],
          },
        ],
      },
      {
        name: "settings",
        label: "Settings",
        delete: false,
        editor: { preview: false },
        files: [
          {
            name: "tags",
            label: "Topics",
            file: "tags.yml",
            fields: [
              {
                name: "tags",
                label: "Topics",
                widget: "list",
                summary: "{{fields.name}}",
                fields: [
                  { name: "name", label: "Name", widget: "string" },
                  {
                    name: "slug",
                    label: "Web address part",
                    widget: "string",
                    pattern: [RULES.slugPattern.source, "Lowercase letters, numbers and hyphens only, e.g. site-photos"],
                    hint: "Used in the topic page's address. Never change it once posts use the topic.",
                  },
                  { name: "description", label: "Intro text on the topic page", widget: "text", required: false },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}
