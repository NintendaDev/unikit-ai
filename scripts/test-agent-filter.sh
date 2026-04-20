#!/bin/bash
# Unit-test harness for src/core/agent-filter.ts.
# Usage: bash scripts/test-agent-filter.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=./test-fixtures.sh
source "$SCRIPT_DIR/test-fixtures.sh"

# Head-guard: regenerate the bundled rules-registry snapshot only if missing.
# Matches the pattern used by the other scripts/test-*.sh files.
if [ ! -f "$ROOT_DIR/rules-registry/manifest.json" ]; then
    bash "$SCRIPT_DIR/download-rules.sh"
fi

ensure_build

node "$SCRIPT_DIR/test-agent-filter.mjs"
