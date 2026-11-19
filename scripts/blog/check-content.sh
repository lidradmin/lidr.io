#!/usr/bin/env bash
# Checks a lidr-blog content checkout with the real lidr.io validator (strict).
#   check-content.sh <content-dir> [slug]
# With a slug, only that post's problems (except photo location warnings) and hard
# problems anywhere fail the check; other posts' problems are listed under "Not yours".
# Runs from the lidr.io site checkout this script lives in (the Claude Code skill uses
# a cache at ~/.cache/lidr-site). It never modifies the content directory.
set -euo pipefail

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  echo "usage: $0 <content-dir> [slug]" >&2
  exit 2
fi
if [ ! -d "$1" ]; then
  echo "check-content: content directory not found: $1" >&2
  exit 2
fi
CONTENT_DIR="$(cd "$1" && pwd)"
SLUG="${2:-}"
if [ -n "$SLUG" ] && ! [[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "check-content: invalid slug \"$SLUG\" (lowercase letters and numbers joined by single hyphens)" >&2
  exit 2
fi
if [ -n "$SLUG" ] && [ ! -f "$CONTENT_DIR/posts/$SLUG.md" ]; then
  echo "check-content: $CONTENT_DIR/posts/$SLUG.md not found" >&2
  exit 2
fi

SITE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$SITE_DIR"

if command -v sha256sum >/dev/null 2>&1; then
  LOCK_HASH="$(sha256sum package-lock.json | cut -d' ' -f1)"
else
  LOCK_HASH="$(shasum -a 256 package-lock.json | cut -d' ' -f1)"
fi
if [ ! -f node_modules/.lidr-lock-hash ] || [ "$(cat node_modules/.lidr-lock-hash)" != "$LOCK_HASH" ]; then
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --silent --no-audit --no-fund
  echo "$LOCK_HASH" > node_modules/.lidr-lock-hash
fi

BLOG_CONTENT_DIR="$CONTENT_DIR" BLOG_STRICT=1 npx tsx scripts/blog/prepare.ts --check ${SLUG:+--only "$SLUG"}
