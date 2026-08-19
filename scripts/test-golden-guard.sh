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
#     `RULES_INDEX.md` filename are out of scope. Three files are excluded
#     because their job is to handle/prove the legacy layout: this guard itself,
#     the memory-migration smoke test (which must seed the flat layout to
#     migrate it), and test-fixtures.sh (its `use_unmigrated_registry` helper
#     seeds the flat layout so the exit-8 staleness guard can be exercised).
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
use_fake_registry "$G_DIR" unity minimal-valid '[{"id":"claude","installedSkills":["unikit"],"installedSubagents":[]}]'

assert_cmd_exit 0 "rules install defaults exits 0" "$TMPDIR/golden.log" -- \
    env -C "$G_DIR" node "$CLI" rules install defaults

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
#
# The three excluded files are the ones whose JOB is the flat layout: this guard
# (it names the pattern), and the two migration smokes, which have to CREATE the
# pre-modular shape before they can assert it is gone. Excluding them by name
# keeps that need visible; assembling the path from variables to slip past the
# grep would hide it.
FLAT_PATTERN='\.unikit/memory/(core|stack)/|memory/RULES_INDEX\.md'

set +e
OFFENDERS=$(grep -rnE "$FLAT_PATTERN" \
    "$ROOT_DIR/src" "$ROOT_DIR/scripts" "$ROOT_DIR/skills" "$ROOT_DIR/subagents" \
    --exclude=test-golden-guard.sh \
    --exclude=test-memory-migration.sh \
    --exclude=test-migrations.sh \
    --exclude=test-fixtures.sh)
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

# ═════════════════════════════════════════════════════════════════════
# golden-guard #3 — the modular WORKSPACE migration (PR#4) must leave NO
# trace of the legacy flat `.unikit/{plans,patches,researches,PLAN.md,
# FIX_PLAN.md,RESEARCHES_INDEX.md}` layout, in tracked content (Part A) or
# on disk after `update` (Part B). Mirrors guard #1's two arms.
# ═════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}=== golden-guard #3 (modular workspace layout) ===${NC}"

# ─────────────────────────────────────────────
# Part A — static: no residual flat workspace literals in tracked content
# ─────────────────────────────────────────────
# Scope is skills + subagents + docs + AGENTS.md — the 20 files Task #2
# rewrote. Unlike guard #1 (which excludes docs/ as PR#5 work), guard #3
# INCLUDES docs/ because those files carry workspace paths that DID migrate.
# src/ + scripts/ are out of scope: a repo-wide grep confirms the only
# `RESEARCHES_INDEX.md` literal outside markdown is the migration's own
# rename constant (the legacy *from*-name), which must stay.
echo -e "\n${BOLD}Part A: no residual flat workspace literals in skills/subagents/docs/AGENTS.md${NC}"

# Matches the bare flat forms (`.unikit/plans`, `.unikit/PLAN.md`, …) and the
# old researches-index name in any form. The migrated forms carry `code/` right
# after `.unikit/`, so `.unikit/code/plans` and `.unikit/code/researches/INDEX.md`
# do NOT match; the renamed `researches/INDEX.md` does NOT match either.
WS_FLAT_PATTERN='\.unikit/(plans|patches|researches|PLAN\.md|FIX_PLAN\.md)|RESEARCHES_INDEX\.md'

set +e
WS_OFFENDERS=$(grep -rnE "$WS_FLAT_PATTERN" \
    "$ROOT_DIR/skills" "$ROOT_DIR/subagents" "$ROOT_DIR/docs" "$ROOT_DIR/AGENTS.md")
set -e

if [[ -z "$WS_OFFENDERS" ]]; then
    pass "no flat workspace literals in skills/subagents/docs/AGENTS.md (all carry .unikit/code/)"
else
    fail "residual flat workspace literals found — repoint them under .unikit/code/"
    echo "$WS_OFFENDERS"
fi

# ─────────────────────────────────────────────
# Part B — runtime: `update` relocates the flat workspace under code/,
# version-gated like test-rules-migrate.sh (Part 17).
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part B: update migrates flat workspace → .unikit/code/${NC}"

PKG_VERSION=$(cd "$ROOT_DIR" && node -p "require('./package.json').version")

# Seed the flat (pre-PR#4) project workspace directly under `.unikit/`.
seed_flat_workspace() {
    local d="$1"
    mkdir -p "$d/.unikit/plans/2026-06-12_demo" "$d/.unikit/patches" \
             "$d/.unikit/researches/2026-06-12_topic"
    echo "# tasks"             > "$d/.unikit/plans/2026-06-12_demo/TASKS.md"
    echo "# fast plan"         > "$d/.unikit/PLAN.md"
    echo "# fix plan"          > "$d/.unikit/FIX_PLAN.md"
    echo "# patch"             > "$d/.unikit/patches/2026-06-12-10.00.md"
    echo "# research"          > "$d/.unikit/researches/2026-06-12_topic/RESEARCH_RESULT.md"
    echo "# researches index"  > "$d/.unikit/RESEARCHES_INDEX.md"
}

# Assert the full flat workspace relocated under code/ and the flat copies are gone.
assert_workspace_migrated() {
    local d="$1"
    assert_exists "$d/.unikit/code/plans/2026-06-12_demo/TASKS.md" "plans/ relocated under code/"
    assert_exists "$d/.unikit/code/PLAN.md"                        "PLAN.md relocated under code/"
    assert_exists "$d/.unikit/code/FIX_PLAN.md"                    "FIX_PLAN.md relocated under code/"
    assert_exists "$d/.unikit/code/patches/2026-06-12-10.00.md"    "patches/ relocated under code/"
    assert_exists "$d/.unikit/code/researches/2026-06-12_topic/RESEARCH_RESULT.md" \
        "researches/ subtree relocated under code/"
    assert_exists "$d/.unikit/code/researches/INDEX.md"            "RESEARCHES_INDEX.md renamed → researches/INDEX.md"
    assert_not_exists "$d/.unikit/plans"            "no flat plans/ after migration"
    assert_not_exists "$d/.unikit/patches"          "no flat patches/ after migration"
    assert_not_exists "$d/.unikit/researches"       "no flat researches/ after migration"
    assert_not_exists "$d/.unikit/PLAN.md"          "no flat PLAN.md after migration"
    assert_not_exists "$d/.unikit/FIX_PLAN.md"      "no flat FIX_PLAN.md after migration"
    assert_not_exists "$d/.unikit/RESEARCHES_INDEX.md" "no flat RESEARCHES_INDEX.md after migration"
}

# ── Scenario B1 — a pre-1.1.0 project migrates memory AND workspace + stamps ──
echo -e "\n${BOLD}B1: pre-modular project fully migrates on update${NC}"
WS1="$TMPDIR/ws-premodular"
mkdir -p "$WS1"
use_unmigrated_registry "$WS1" unity minimal-valid   # flat memory + version 1.0.1
seed_flat_workspace "$WS1"

assert_cmd_exit 0 "update on pre-modular project exits 0" "$TMPDIR/ws1-update.log" -- \
    env -C "$WS1" node "$CLI" update

assert_workspace_migrated "$WS1"
# Memory migrated in the SAME update pass …
assert_exists "$WS1/.unikit/memory/code/core/code-style.md" "flat memory wrapped under code/ in same pass"
assert_not_exists "$WS1/.unikit/memory/core" "no flat memory/core after migration"
# … and the version stamp advanced off the pre-modular 1.0.1.
assert_json_field "$WS1/.unikit.json" "version" "$PKG_VERSION" "config.version stamped to package version"

# ── Scenario B2 — second update is a no-op (sha-stable, no flat resurrection) ──
echo -e "\n${BOLD}B2: second update is idempotent${NC}"
WS_SHA_PLAN="$(sha_of "$WS1/.unikit/code/PLAN.md")"
WS_SHA_IDX="$(sha_of "$WS1/.unikit/code/researches/INDEX.md")"

assert_cmd_exit 0 "second update exits 0" "$TMPDIR/ws1-update2.log" -- \
    env -C "$WS1" node "$CLI" update

assert_file_unchanged "$WS1/.unikit/code/PLAN.md" "$WS_SHA_PLAN" "code/PLAN.md sha-stable on 2nd update"
assert_file_unchanged "$WS1/.unikit/code/researches/INDEX.md" "$WS_SHA_IDX" "code/researches/INDEX.md sha-stable on 2nd update"
assert_not_exists "$WS1/.unikit/plans" "no flat plans/ resurrected on 2nd update"
assert_not_exists "$WS1/.unikit/PLAN.md" "no flat PLAN.md resurrected on 2nd update"

# ── Scenario B3 — exit-8 gate is driven by diskPending, NOT versionStale ──
# The project is at version 1.1.0 (already-modular memory via use_fake_registry,
# so `versionStale` is false) but carries a flat workspace. `rules sync` must
# still refuse with exit 8 purely on the workspace step's diskPending signal,
# proving the gate needs no version bump.
echo -e "\n${BOLD}B3: rules sync exits 8 on flat workspace at version 1.1.0 (diskPending)${NC}"
WS3="$TMPDIR/ws-gate"
mkdir -p "$WS3"
use_fake_registry "$WS3" unity minimal-valid   # version 1.1.0, modular memory/code
seed_flat_workspace "$WS3"
WS3_CONFIG_SHA="$(sha_of "$WS3/.unikit.json")"

assert_cmd_exit 8 "rules sync refused on stale workspace (exit 8)" "$TMPDIR/ws3-sync.log" -- \
    env -C "$WS3" node "$CLI" rules sync
assert_file_unchanged "$WS3/.unikit.json" "$WS3_CONFIG_SHA" "rules sync left .unikit.json byte-identical on exit 8"
assert_not_exists "$WS3/.unikit/code/PLAN.md" "rules sync did not migrate (update is the sole migrator)"

assert_cmd_exit 0 "update clears the workspace staleness" "$TMPDIR/ws3-update.log" -- \
    env -C "$WS3" node "$CLI" update
assert_workspace_migrated "$WS3"

assert_cmd_exit 0 "rules sync passes after migration" "$TMPDIR/ws3-sync2.log" -- \
    env -C "$WS3" node "$CLI" rules sync

# ── Scenario B4 — partial migration self-heals ──
# Some artifacts already relocated under code/, one straggler left flat. `update`
# must move only the straggler and leave the already-migrated ones untouched.
echo -e "\n${BOLD}B4: partial migration self-heals${NC}"
WS4="$TMPDIR/ws-selfheal"
mkdir -p "$WS4"
use_fake_registry "$WS4" unity minimal-valid
mkdir -p "$WS4/.unikit/code/plans/2026-06-12_done"
echo "# already" > "$WS4/.unikit/code/plans/2026-06-12_done/TASKS.md"
WS4_DONE_SHA="$(sha_of "$WS4/.unikit/code/plans/2026-06-12_done/TASKS.md")"
echo "# straggler fast plan" > "$WS4/.unikit/PLAN.md"   # the only flat leftover

assert_cmd_exit 0 "update self-heals partial workspace" "$TMPDIR/ws4-update.log" -- \
    env -C "$WS4" node "$CLI" update
assert_exists "$WS4/.unikit/code/PLAN.md" "straggler PLAN.md relocated under code/"
assert_not_exists "$WS4/.unikit/PLAN.md" "flat PLAN.md straggler removed"
assert_file_unchanged "$WS4/.unikit/code/plans/2026-06-12_done/TASKS.md" "$WS4_DONE_SHA" \
    "already-migrated plan left untouched by self-heal"

print_summary_and_exit "golden-guard #1 + #3"
