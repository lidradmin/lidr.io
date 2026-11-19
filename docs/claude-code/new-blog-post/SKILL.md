---
name: new-blog-post
description: Write, check and (after the user approves) publish a lidr.io blog post from a clone of lidradmin/lidr-blog. Use when the user runs /new-blog-post
disable-model-invocation: true
---

# Publish a lidr.io blog post

Posts go live on https://lidr.io/blog/ about 3 minutes after they reach `main` of `lidradmin/lidr-blog`. No one else reviews them, so you are the review. Follow every step in order, and never push without the user's explicit approval (step 6).

This skill is maintained in the lidr.io site repo (owner-only). Don't run scripts from the content repo; it holds posts, images and tags only.

## Before you start (once)

Check these and, if anything is missing, tell the user how to fix it and stop:

- **Node 22**: `node --version` starts with `v22`. Install from https://nodejs.org.
- **Git**: `git --version` works. On a Mac: `xcode-select --install`.
- **GitHub CLI, signed in**: `gh auth status` succeeds. Otherwise: `brew install gh`, then `gh auth login`.
- **Git identity** using the email address on their GitHub account: `git config user.name` and `git config user.email` both print something. Otherwise:
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "you@example.com"
  ```

The checker's cache (a copy of the lidr.io site code at `~/.cache/lidr-site`) is set up automatically in step 0.

## 0. Get the checker

The checker lives in a dedicated cache folder, `~/.cache/lidr-site`, marked by a file called `.lidr-check-cache`. Never reset or delete any other folder.

- If `~/.cache/lidr-site` exists but `~/.cache/lidr-site/.lidr-check-cache` does not, **stop**. Tell the user: "`~/.cache/lidr-site` exists but wasn't created by this skill, so I won't overwrite it. Move or delete it, then run /new-blog-post again."
- If `~/.cache/lidr-site/.lidr-check-cache` exists, update it:
  ```bash
  git -C ~/.cache/lidr-site fetch --depth 1 origin main && git -C ~/.cache/lidr-site reset --hard origin/main
  ```
- If `~/.cache/lidr-site` doesn't exist, create it:
  ```bash
  mkdir -p ~/.cache && git clone --depth 1 https://github.com/lidradmin/lidr.io.git ~/.cache/lidr-site && touch ~/.cache/lidr-site/.lidr-check-cache
  ```

## 1. Start clean

1. Confirm the current directory is a clone of the content repo: `git remote get-url origin` must contain `lidradmin/lidr-blog`. If it doesn't, stop and tell the user to run Claude Code inside their `lidr-blog` clone (`gh repo clone lidradmin/lidr-blog`).
2. Note the repo's absolute path: `git rev-parse --show-toplevel`. Call it `<repo>`.
3. If `git -C <repo> worktree list` shows any worktree under `<repo>/.worktrees/`, it's left over from an earlier run. Remove each one with `git -C <repo> worktree remove --force <path>` (and delete its `post-…` branch with `git -C <repo> branch -D <branch>`).
4. Fetch and create a fresh worktree inside the repo, on a new branch from `origin/main`:
   ```bash
   git -C <repo> fetch origin
   TS=$(date +%Y%m%d%H%M%S)
   git -C <repo> worktree add -b post-$TS <repo>/.worktrees/post-$TS origin/main
   ```
   Call the absolute path `<repo>/.worktrees/post-<timestamp>` `<wt>`.

From now on, **never use `cd`**. Every command uses `git -C <wt> …` or absolute paths under `<wt>`. Only create or change `<wt>/posts/<slug>.md` and files under `<wt>/images/<slug>/`. Never edit other posts, `tags.yml` or anything else.

## 2. Pick a topic nobody has covered

- Read every file in `<wt>/posts/` (titles, descriptions, headings) and `<wt>/tags.yml`.
- Choose a topic and ONE target search phrase that no existing post already targets.
- If the user's topic overlaps an existing post, say which one and suggest updating that post instead. Only continue with a new post if the user still wants one.

## 3. Write the post: `<wt>/posts/<slug>.md`

- `<slug>`: lowercase letters and numbers joined by single hyphens, e.g. `photo-evidence-for-snagging`. It becomes the URL forever, so choose carefully and make sure no post with that slug exists.
- Front-matter, exactly these keys:
  ```yaml
  ---
  title: Photo evidence for snagging that clients accept
  description: One or two sentences that Google shows under the title.
  date: YYYY-MM-DD
  tags: [site-photos, reporting]
  ---
  ```
  - `title`: 10–70 characters, no `_` or `~`, and includes the target phrase.
  - `description`: 50–160 characters.
  - `date`: today, as `YYYY-MM-DD`.
  - `tags`: 1–3 tag slugs that exist in `tags.yml`. Never invent tags.
  - Optional cover: `cover: /images/blog/<slug>/<name>.<ext>` plus `coverAlt: what the photo shows`.
- **Images**: use only photos the user gives you. Never invent, generate or download images. Save each one at `<wt>/images/<slug>/<name>.<ext>`, keeping its original extension (`.jpg`, `.png` or `.webp`; lowercase name with hyphens). Reference it in the post as `/images/blog/<slug>/<name>.<ext>` with the same extension. The site publishes `images/<slug>/` under `/images/blog/<slug>/`.
- Every image needs alt text describing what it shows: `![Scaffold tag photographed beside the date board](/images/blog/<slug>/scaffold-tag.jpg)`.
- Body: Markdown. Start with the answer, not a preamble. Use `##` and `###` headings only (never `#`). 700–1,400 words.
- Links: at least one to `/features/` or `/pricing/`. If an existing post is genuinely related, link it too as `/blog/<its-slug>/`. If none is related, don't force one.
- The target phrase appears naturally in the title, the description and the first paragraph.

## 4. Self-review (required)

Read the post back and make a **fact list**: every number, percentage, date, organisation, regulation or guidance (e.g. CDM 2015, HSE guidance) and quotation in the post. For each one, note where it came from.

- Each must come from the user or from a page you fetched and can link to. If it doesn't, remove it.
- No vague authority: never "studies show", "experts say", "many firms" or similar.
- Never promise legal or regulatory compliance (for example, don't say Lidr "makes you CDM compliant").
- Every claim about Lidr must match the live https://lidr.io/features/ and https://lidr.io/pricing/ pages. Fetch them and check.
- No invented customers, testimonials or quotes.
- British English, plain and practical, written for construction site teams rather than marketers.

## 5. Check with the real validator

```bash
~/.cache/lidr-site/scripts/blog/check-content.sh <wt> <slug>
```

(The first run installs the checker's dependencies, which takes a minute or two.)

- Fix every problem listed under **Your post**, then run it again until it passes.
- A warning that a photo **contains the location** where it was taken is the one exception: you can't fix it by editing. Tell the user, and ask for a copy with location turned off (iPhone: Share → Options → Location off), then replace the file and check again. It doesn't block the check, but the original upload stays public, so ask before publishing.
- Problems under **Not yours (for information)** belong to other posts. Never edit other posts. Tell the user about them. If the check still fails only because of a **hard** problem in someone else's post, stop and tell the user; they need to get it fixed (or ask the site owner) before anything can be published.

## 6. Approval (required)

Show the user:
1. the full post exactly as it will be published (front-matter and body), with the image list;
2. the fact list from step 4, with a source for each item;
3. the checker result.

Ask them to reply **"publish"** to put it live. Make any changes they ask for, then re-run steps 4 and 5 and show it again. Do not push until they explicitly say "publish".

## 7. Publish

```bash
git -C <wt> add posts/<slug>.md images/<slug>
git -C <wt> diff --cached --name-only
```

The second command must list ONLY `posts/<slug>.md` and files under `images/<slug>/`. If anything else appears, unstage it (`git -C <wt> restore --staged <path>`) and check again. (If the post has no images, add only `posts/<slug>.md`.)

```bash
git -C <wt> commit -m "Publish blog post \"<slug>\""
git -C <wt> push origin HEAD:main
```

If the push is rejected because `main` moved on:

```bash
git -C <wt> pull --rebase origin main
~/.cache/lidr-site/scripts/blog/check-content.sh <wt> <slug>
git -C <wt> push origin HEAD:main
```

If the push fails twice, stop and tell the user what the error said. Don't force-push.

## 8. Report and clean up

Tell the user:
- the URL: `https://lidr.io/blog/<slug>/`;
- that it will be live in about 3 minutes;
- anything they could add later, such as real photos or a customer example they can share.

Then remove the worktree and its branch:

```bash
git -C <repo> worktree remove <wt>
git -C <repo> branch -D post-<timestamp>
```
