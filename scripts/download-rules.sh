#!/usr/bin/env bash
# Clone the NintendaDev/unikit-ai-rules repository into ./rules-registry so
# that it can serve as the bundled (3rd-level) source for HybridRegistry. The
# folder is not tracked in git (see .gitignore); it is regenerated on demand:
#   - locally: head-guard in scripts/test-*.sh when developers run tests
#   - CI:      pipeline step between `npm ci` and `npm run build`
#   - publish: `prepublishOnly` pulls a fresh copy before tsc so that the
#              clone ends up inside the npm tarball ("rules-registry" is
#              listed in package.json "files"). End users therefore never run
#              this script — they get rules-registry/ directly from the
#              installed package.
#
# The script is idempotent: if rules-registry/ already exists it exits 0.
#
# Overrides (dev-time):
#   UNIKIT_RULES_REPO_URL     — alternate git remote (default: official GitHub)
#   UNIKIT_RULES_REPO_BRANCH  — alternate branch (default: main)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

REPO_URL="${UNIKIT_RULES_REPO_URL:-https://github.com/NintendaDev/unikit-ai-rules.git}"
REPO_BRANCH="${UNIKIT_RULES_REPO_BRANCH:-main}"
TARGET_DIR="$ROOT_DIR/rules-registry"

log() {
  echo "[download-rules] $*"
}

# Idempotency: treat the clone as valid only when it contains a manifest.json
# at the root. Any other state (missing dir, empty dir, partial clone without
# manifest) triggers a fresh clone so we never rely on a half-written snapshot.
if [ -f "$TARGET_DIR/manifest.json" ]; then
  log "rules-registry/ already populated, skipping clone"
  exit 0
fi

if ! command -v git >/dev/null 2>&1; then
  log "ERROR: git is required to clone the rules repository" >&2
  exit 1
fi

log "Cloning $REPO_URL (branch $REPO_BRANCH) into rules-registry/"
rm -rf "$TARGET_DIR"
git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$TARGET_DIR"

# Drop the nested .git directory so that the clone is a plain content snapshot.
# Without this the npm tarball would embed another git repo and `npm pack`
# would complain about mixed metadata.
rm -rf "$TARGET_DIR/.git"

log "Rules repository ready at $TARGET_DIR"
