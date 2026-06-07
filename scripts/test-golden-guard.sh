#!/bin/bash
# Golden-guard #1 — the modular memory migration (PR#1) must leave NO trace of
# the legacy flat `.unikit/memory/{core,stack}` layout, on disk or in source.
#
# Two arms:
#   Part A (runtime) — after a step that actually populates memory (`rules
#     install` no-args bootstrap), assert everything lands under
#     `.unikit/memory/code/` and the flat layout never materializes. Bare `init`
#     is intentionally NOT used: it installs no rules, so the absence assertion
#     would be vacuous.
#   Part B (static) — grep src + scripts + skills + subagents for residual
#     path-qualified flat literals. Only docs/ (rewritten in PR#5) and the bare
#     `RULES_INDEX.md` filename are out of scope. Two files are excluded because
#     their job is to handle/prove the legacy layout: this guard itself and the
#     memory-migration smoke test (which must seed the flat layout to migrate it).
#
# Usage: ./scripts/test-golden-guard.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -f "$ROOT_DIR/rules-registry/manifest.json" ]; then
    bash "$SCRIPT_DIR/download-rules.sh"
fi

# shellcheck source=./test-fixtures.sh
source "$SCRIPT_DIR/test-fixtures.sh"

ensure_build

CLI="$ROOT_DIR/dist/cli/index.js"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo -e "${BOLD}=== golden-guard #1 (modular memory layout) ===${NC}"

# ─────────────────────────────────────────────
# Part A — runtime: rules install populates code/, never flat
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part A: rules install lands under .unikit/memory/code/${NC}"

G_DIR="$TMPDIR/golden-install"
mkdir -p "$G_DIR"
use_fake_registry "$G_DIR" unity minimal-valid

assert_cmd_exit 0 "rules install (no-args bootstrap) exits 0" "$TMPDIR/golden.log" -- \
    env -C "$G_DIR" node "$CLI" rules install

# Memory is populated under the module-keyed layout …
assert_exists "$G_DIR/.unikit/memory/code/core/code-style.md" \
    "bootstrap wrote the core rule under code/"
assert_exists "$G_DIR/.unikit/memory/code/RULES_INDEX.md" \
    "index generated under code/"

# … and the flat layout never materializes.
GUARD_MEM="$G_DIR/.unikit/memory"
assert_not_exists "$GUARD_MEM/core" \
    "no flat core dir after install"
assert_not_exists "$GUARD_MEM/stack" \
    "no flat stack dir after install"
assert_not_exists "$GUARD_MEM/RULES_INDEX.md" \
    "no top-level RULES_INDEX.md after install"
pass "runtime layout is fully module-keyed (no flat residue)"

# ─────────────────────────────────────────────
# Part B — static: no residual flat literals in tracked source
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part B: no residual flat memory literals in source${NC}"

# Matches `.unikit/memory/core/…` / `.unikit/memory/stack/…` (flat dirs) and the
# top-level `memory/RULES_INDEX.md` (with or without the `.unikit/` prefix). The
# migrated forms carry `code/` after `memory/`, so `memory/code/core` and
# `memory/code/RULES_INDEX.md` do NOT match. Bare `RULES_INDEX.md` (no path) is
# intentionally not matched.
FLAT_PATTERN='\.unikit/memory/(core|stack)/|memory/RULES_INDEX\.md'

set +e
OFFENDERS=$(grep -rnE "$FLAT_PATTERN" \
    "$ROOT_DIR/src" "$ROOT_DIR/scripts" "$ROOT_DIR/skills" "$ROOT_DIR/subagents" \
    --exclude=test-golden-guard.sh \
    --exclude=test-memory-migration.sh)
set -e

if [[ -z "$OFFENDERS" ]]; then
    pass "no path-qualified flat memory literals in src/scripts/skills/subagents (docs/ deferred to PR#5)"
else
    fail "residual flat memory literals found — repoint them to .unikit/memory/code/"
    echo "$OFFENDERS"
fi

# ─────────────────────────────────────────────
# Part C — no-hardcode guard (centralization directive)
# ─────────────────────────────────────────────
# lint/knip do not inspect string literals, so this stays a shell assert.
# Module-id and well-known file names must come from constants.ts / modules.ts;
# memory paths must be assembled via moduleDir / moduleTierDir — never a raw
# `memory/code` segment. Comment lines (`//`, ` *`) are excluded: they describe
# the layout, they do not hardcode it.
echo -e "\n${BOLD}Part C: no hardcoded module-id / file names / paths in src${NC}"

DROP_COMMENTS='^[^:]+:[0-9]+:[[:space:]]*(//|\*)'

# 1) 'modules.yml' must come from MODULES_YML_FILE.
set +e
H1=$(grep -rnE "'modules\.yml'|\"modules\.yml\"" "$ROOT_DIR/src" --include='*.ts' \
    | grep -vE 'constants\.ts|modules\.ts')
set -e
if [[ -z "$H1" ]]; then
    pass "no raw 'modules.yml' literal outside constants.ts / modules.ts"
else
    fail "raw 'modules.yml' literal found — use MODULES_YML_FILE"
    echo "$H1"
fi

# 2) raw 'code' module-id must come from CODE_MODULE_ID.
set +e
H2=$(grep -rnE "'code'" "$ROOT_DIR/src" --include='*.ts' \
    | grep -vE 'constants\.ts|modules\.ts' | grep -vE "$DROP_COMMENTS")
set -e
if [[ -z "$H2" ]]; then
    pass "no raw 'code' module-id literal outside constants.ts / modules.ts"
else
    fail "raw 'code' module-id literal found — use CODE_MODULE_ID"
    echo "$H2"
fi

# 3) no hardcoded `memory/code` path segment — assemble via moduleDir/moduleTierDir.
set +e
H3=$(grep -rnE "memory/code" "$ROOT_DIR/src" --include='*.ts' \
    | grep -vE 'constants\.ts|modules\.ts' | grep -vE "$DROP_COMMENTS")
set -e
if [[ -z "$H3" ]]; then
    pass "no hardcoded memory/code path segment (assembled via moduleDir/moduleTierDir)"
else
    fail "hardcoded memory/code path segment found — use moduleDir/moduleTierDir"
    echo "$H3"
fi

print_summary_and_exit "golden-guard #1"
