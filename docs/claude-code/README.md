# Claude Code blog skill

The `/new-blog-post` Claude Code skill (`new-blog-post/SKILL.md`) and its checker (`scripts/blog/check-content.sh`) are maintained here, in the lidr.io site repo, which only the owner can change. The content repo (`lidradmin/lidr-blog`) is data only: posts, images and `tags.yml`. Anyone with write access there can change it, so no code that runs on an author's machine lives there.

The skill clones this repo into `~/.cache/lidr-site` (marked with a `.lidr-check-cache` file) and runs `scripts/blog/check-content.sh <content-dir> <slug>` from it. With a slug, the check fails on any problem in that post (except photo location warnings, which the skill raises with the user) and on hard problems in any post; everything else is listed under "Not yours (for information)".

Authors' setup instructions are in `lidr-blog`'s `docs/claude-code.md`. Keep the install steps below identical to that page.

## Prerequisites

- **Node 22**: install from https://nodejs.org
- **Git**: install the Xcode Command Line Tools with `xcode-select --install`
- **GitHub CLI**: `brew install gh`, then `gh auth login`
- **Git identity**, using the email address on your GitHub account:
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "you@example.com"
  ```

## Install the skill

```bash
mkdir -p ~/.claude/skills/new-blog-post && curl -fsSL https://raw.githubusercontent.com/lidradmin/lidr.io/main/docs/claude-code/new-blog-post/SKILL.md -o ~/.claude/skills/new-blog-post/SKILL.md
```

## Use it

1. Clone the content repo: `gh repo clone lidradmin/lidr-blog`
2. Run Claude Code inside the cloned folder.
3. Type `/new-blog-post` and say what the post is about.
