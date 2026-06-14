#!/bin/bash
# Smoke tests: validates `unikit-ai rules list` against fake registry fixtures.
#
# Scope (post multi-module rework):
#   - default (no --module) lists ALL registered modules: human blocks
#     (── code (engine) ── + ── gamedesign ──) and a flat-all JSON where EVERY
#     row carries `module`
#   - --module <id> scopes to one module: the legacy single-module human format
#     + the back-compat flat-single JSON (NO per-row `module`)
#   - exit-code matrix: 0 (normal + engine-missing), 1 (no config), 3 (bad
#     --module). exit 2 (every catalog unreachable) is intentionally NOT
#     exercised here — see the note near the end of this file.
#   - --engine override (flat-single) and engine-missing (warning to stderr,
#     exit 0, code section empty while gamedesign still backfills)
#   - multi-version fixture (v1 vs v2) under --module code
#   - --module gamedesign backfill (#R2a B-merge) + --module bogus → exit 3
#
# These scenarios replace the rules-list drive-by assertions that used to
# live in test-install.sh / test-update.sh. The fake registries let us
# assert exact content without hitting the bundled production snapshot
# (which keeps drifting as real rules are added/updated upstream).
#
# Usage: ./scripts/test-rules-list.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure the bundled rules snapshot exists (referenced by some helpers even
# though this test sources its fixtures from scripts/test-fixtures/).
if [ ! -f "$ROOT_DIR/rules-registry/manifest.json" ]; then
    bash "$SCRIPT_DIR/download-rules.sh"
fi

# Shared helpers: pass/fail counters, assert_*, use_fake_registry, etc.
# shellcheck source=./test-fixtures.sh
source "$SCRIPT_DIR/test-fixtures.sh"

# Ensure dist/ is up to date for CLI smoke tests (skipped when parent built).
ensure_build

CLI="$ROOT_DIR/dist/cli/index.js"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo -e "${BOLD}=== rules list Smoke Tests ===${NC}"

# ─────────────────────────────────────────────
# Scenario 1: missing .unikit.json → exit 1 (NOT_FOUND)
# ─────────────────────────────────────────────
# The CLI loads config via loadConfigOrExit, which errors out with
# EXIT.NOT_FOUND (1) when .unikit.json is missing. After the multi-module
# rework, exit 1 is reserved EXCLUSIVELY for this "no config" case — an
# engine that is missing from the registry no longer collides with it
# (it is now exit 0 + a warning, see Scenario 5).
echo -e "\n${BOLD}Scenario 1: missing .unikit.json${NC}"

S1_DIR="$TMPDIR/s1-no-config"
mkdir -p "$S1_DIR"

assert_cmd_exit 1 "rules list without config exits 1" "$TMPDIR/s1.log" -- \
    env -C "$S1_DIR" node "$CLI" rules list

assert_stdout_contains "$TMPDIR/s1.log" "Not a UniKit project" \
    "error message mentions missing UniKit project"

# ─────────────────────────────────────────────
# Scenario 2: default (no --module) → ALL-modules human blocks
# ─────────────────────────────────────────────
# With no --module the catalog lists every registered module as a block:
# `── code (unity) ──` (engine-partitioned) and `── gamedesign ──`
# (non-engine). gamedesign is backfilled from the bundled snapshot since
# minimal-valid ships no gamedesign tier (#R2a per-id B-merge).
echo -e "\n${BOLD}Scenario 2: default all-modules blocks (human)${NC}"

S2_DIR="$TMPDIR/s2-default"
mkdir -p "$S2_DIR"
use_fake_registry "$S2_DIR" unity minimal-valid

assert_cmd_exit 0 "rules list exits 0 on minimal-valid fixture" "$TMPDIR/s2.log" -- \
    env -C "$S2_DIR" node "$CLI" rules list

assert_stdout_contains "$TMPDIR/s2.log" "Rules catalog (engine: unity)" \
    "all-modules header names the engine"
assert_stdout_contains "$TMPDIR/s2.log" "── code (unity) ──" \
    "code block header (engine-partitioned)"
assert_stdout_contains "$TMPDIR/s2.log" "code-style" \
    "code core rule id appears in the code block"
assert_stdout_contains "$TMPDIR/s2.log" "sample-stack-rule" \
    "code stack rule id appears in the code block"
assert_stdout_contains "$TMPDIR/s2.log" "── gamedesign ──" \
    "gamedesign block header (non-engine)"
assert_stdout_contains "$TMPDIR/s2.log" "balance" \
    "a canonical gamedesign core rule appears (backfilled from bundled)"
assert_stdout_contains "$TMPDIR/s2.log" "code: 1 core, 1 stack" \
    "footer reports the code module's 1/1 partition"
assert_stdout_contains "$TMPDIR/s2.log" "0 library" \
    "footer shows the gamedesign library tier is empty"

# ─────────────────────────────────────────────
# Scenario 3: default --json → flat-all (per-row `module`)
# ─────────────────────────────────────────────
# flat-all lists every surviving module's rules in one array, each row tagged
# with `module`. code rows come first (registry order), then gamedesign. The
# gamedesign count tracks the bundled snapshot, so assert on stable ids /
# fields, NOT a hardcoded array length.
echo -e "\n${BOLD}Scenario 3: default --json flat-all${NC}"

S3_DIR="$TMPDIR/s3-json"
mkdir -p "$S3_DIR"
use_fake_registry "$S3_DIR" unity minimal-valid

assert_cmd_exit 0 "rules list --json exits 0" "$TMPDIR/s3.log" -- \
    env -C "$S3_DIR" node "$CLI" rules list --json

assert_json_field "$TMPDIR/s3.log" engine unity "JSON reports engine=unity"
assert_json_field "$TMPDIR/s3.log" "rules.0.id" code-style "first row is the code core rule"
assert_json_field "$TMPDIR/s3.log" "rules.0.module" code "first row is tagged module=code (flat-all)"
assert_json_field "$TMPDIR/s3.log" "rules.0.category" core "first row category is core"
assert_json_field "$TMPDIR/s3.log" "rules.0.version" 1.0.0 "first row version is 1.0.0"
assert_json_field "$TMPDIR/s3.log" "rules.1.id" sample-stack-rule "second row is the code stack rule"
assert_json_field "$TMPDIR/s3.log" "rules.1.module" code "second row is tagged module=code"
assert_json_field "$TMPDIR/s3.log" "rules.1.category" stack "second row category is stack"
assert_stdout_contains "$TMPDIR/s3.log" '"module": "gamedesign"' \
    "flat-all includes gamedesign rows (backfilled)"
assert_stdout_contains "$TMPDIR/s3.log" '"id": "balance"' \
    "a canonical gamedesign id is present in the flat-all array"

# ─────────────────────────────────────────────
# Scenario 3b: --module code --json → flat-single (back-compat shape)
# ─────────────────────────────────────────────
# A scoped `--module` request returns the legacy single-module shape:
# `{ engine, module, rules:[{ id, category, description, version }] }` with NO
# per-row `module` key. Machine consumers (unikit-memory, /unikit) always send
# --module and rely on this exact shape.
echo -e "\n${BOLD}Scenario 3b: --module code --json flat-single${NC}"

S3B_DIR="$TMPDIR/s3b-single"
mkdir -p "$S3B_DIR"
use_fake_registry "$S3B_DIR" unity minimal-valid

assert_cmd_exit 0 "rules list --module code --json exits 0" "$TMPDIR/s3b.log" -- \
    env -C "$S3B_DIR" node "$CLI" rules list --module code --json

assert_json_field "$TMPDIR/s3b.log" engine unity "flat-single reports engine=unity"
assert_json_field "$TMPDIR/s3b.log" module code "flat-single carries top-level module=code"
assert_json_array_length "$TMPDIR/s3b.log" rules 2 "flat-single has exactly the 2 code rules"
assert_json_field "$TMPDIR/s3b.log" "rules.0.id" code-style "flat-single first rule id"
assert_json_field "$TMPDIR/s3b.log" "rules.0.category" core "flat-single first rule category"
assert_json_field "$TMPDIR/s3b.log" "rules.1.id" sample-stack-rule "flat-single second rule id"
# The ONLY `"module":` key in flat-single is the top-level one — no per-row
# module key leaks (that is the flat-all shape). Count must be exactly 1.
S3B_MOD_COUNT=$(grep -c '"module":' "$TMPDIR/s3b.log" || true)
if [[ "$S3B_MOD_COUNT" -eq 1 ]]; then
    pass "flat-single has exactly one (top-level) module key — no per-row module"
else
    fail "flat-single leaked per-row module keys (found $S3B_MOD_COUNT \"module\": occurrences, expected 1)"
fi

# ─────────────────────────────────────────────
# Scenario 4: --engine override (scoped with --module code → flat-single)
# ─────────────────────────────────────────────
# Config pins engine=unity. The primary (minimal-valid) ships both unity and
# godot code sections, so --engine godot stays on the primary and serves its
# godot catalog. Scoped with --module code so the array length is deterministic
# (flat-all would also fold in gamedesign rows).
echo -e "\n${BOLD}Scenario 4: --engine override (--module code)${NC}"

S4_DIR="$TMPDIR/s4-engine-override"
mkdir -p "$S4_DIR"
use_fake_registry "$S4_DIR" unity minimal-valid

assert_cmd_exit 0 "rules list --engine godot --module code exits 0" "$TMPDIR/s4.log" -- \
    env -C "$S4_DIR" node "$CLI" rules list --engine godot --module code --json

assert_json_field "$TMPDIR/s4.log" engine godot \
    "override engine wins over config.engine"
assert_json_array_length "$TMPDIR/s4.log" rules 1 \
    "override serves the fixture's godot code section (1 rule)"
assert_json_field "$TMPDIR/s4.log" "rules.0.id" code-style \
    "godot section has the fixture's code-style rule"

# ─────────────────────────────────────────────
# Scenario 5: --engine unknown → exit 0 + warning (de-overloaded exit 1)
# ─────────────────────────────────────────────
# Engine-missing is NO LONGER exit 1. Under the default all-modules + flat-all:
#   - exit 0
#   - the warning text from Task-2 branch (b) goes to STDERR (so --json stdout
#     stays a clean parseable document)
#   - the flat-all `rules` array contains NO code rows (engine missing → empty
#     code section) but DOES contain gamedesign rows (backfilled, non-engine)
echo -e "\n${BOLD}Scenario 5: --engine unknown → exit 0 + stderr warning${NC}"

S5_DIR="$TMPDIR/s5-engine-unknown"
mkdir -p "$S5_DIR"
use_fake_registry "$S5_DIR" unity minimal-valid

set +e
env -C "$S5_DIR" node "$CLI" rules list --engine unknown-xyz --json \
    > "$TMPDIR/s5.out" 2> "$TMPDIR/s5.err"
S5_CODE=$?
set -e

assert_exit 0 "$S5_CODE" "rules list --engine unknown-xyz exits 0 (engine-missing no longer exit 1)" "$TMPDIR/s5.err"
assert_json_field "$TMPDIR/s5.out" engine unknown-xyz \
    "stdout is clean flat-all JSON with the overridden engine"
assert_stdout_contains "$TMPDIR/s5.err" 'not in registry for module "code"' \
    "engine-missing warning is emitted to STDERR"
assert_stdout_contains "$TMPDIR/s5.out" '"module": "gamedesign"' \
    "flat-all still backfills gamedesign rows despite the missing code engine"
if grep -qF '"module": "code"' "$TMPDIR/s5.out"; then
    fail "engine-missing: code rows must be ABSENT under flat-all (code section is empty)"
else
    pass "engine-missing: no code rows in flat-all (code section empty), gamedesign intact"
fi

# ─────────────────────────────────────────────
# Scenario 6: multi-version v1 fixture (scoped with --module code)
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 6: multi-version v1 (--module code)${NC}"

S6_DIR="$TMPDIR/s6-v1"
mkdir -p "$S6_DIR"
use_fake_registry "$S6_DIR" unity multi-version/v1

assert_cmd_exit 0 "rules list --module code --json against v1" "$TMPDIR/s6.log" -- \
    env -C "$S6_DIR" node "$CLI" rules list --module code --json

assert_json_array_length "$TMPDIR/s6.log" rules 2 "v1 fixture has 2 code rules"
# Find unitask in the rules array: index 1 because core is listed first.
assert_json_field "$TMPDIR/s6.log" "rules.1.id" unitask "stack rule is unitask"
assert_json_field "$TMPDIR/s6.log" "rules.1.version" 1.0.0 "v1 fixture reports unitask v1.0.0"

# ─────────────────────────────────────────────
# Scenario 7: multi-version v2 fixture (version bump visible)
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 7: multi-version v2 (--module code)${NC}"

S7_DIR="$TMPDIR/s7-v2"
mkdir -p "$S7_DIR"
use_fake_registry "$S7_DIR" unity multi-version/v2

assert_cmd_exit 0 "rules list --module code --json against v2" "$TMPDIR/s7.log" -- \
    env -C "$S7_DIR" node "$CLI" rules list --module code --json

assert_json_field "$TMPDIR/s7.log" "rules.0.id" code-style "v2 core rule is code-style"
assert_json_field "$TMPDIR/s7.log" "rules.0.version" 1.1.0 "v2 fixture bumped code-style to 1.1.0"
assert_json_field "$TMPDIR/s7.log" "rules.1.id" unitask "v2 stack rule is unitask"
assert_json_field "$TMPDIR/s7.log" "rules.1.version" 2.0.0 "v2 fixture bumped unitask to 2.0.0"

# ─────────────────────────────────────────────
# Scenario 8: core vs stack partitioning inside the code block
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 8: core vs stack partitioning (all-modules)${NC}"

S8_DIR="$TMPDIR/s8-partitioning"
mkdir -p "$S8_DIR"
use_fake_registry "$S8_DIR" unity minimal-valid

assert_cmd_exit 0 "rules list exits 0 for partitioning check" "$TMPDIR/s8.log" -- \
    env -C "$S8_DIR" node "$CLI" rules list

assert_stdout_contains "$TMPDIR/s8.log" "Core rules:" \
    "code block has a Core rules section header"
assert_stdout_contains "$TMPDIR/s8.log" "Stack rules:" \
    "code block has a Stack rules section header"
assert_stdout_contains "$TMPDIR/s8.log" "code: 1 core, 1 stack" \
    "footer reports the exact 1/1 partition of the code module"

# ─────────────────────────────────────────────
# Scenario 9: --module gamedesign lists the backfilled canonical catalog
# ─────────────────────────────────────────────
# gamedesign is non-engine-partitioned. minimal-valid ships no gamedesign tier,
# so the module-aware catalog backfills the canonical core rules from the
# bundled snapshot (#R2a per-id B-merge). The single-module human render keeps
# the back-compat `Rules catalog for <module>:` format. The exact count tracks
# the snapshot, so assert on stable canonical ids + the empty library tier, not
# a hardcoded total.
echo -e "\n${BOLD}Scenario 9: --module gamedesign catalog (backfill)${NC}"

S9_DIR="$TMPDIR/s9-gd-list"
mkdir -p "$S9_DIR"
use_fake_registry "$S9_DIR" unity minimal-valid

assert_cmd_exit 0 "rules list --module gamedesign exits 0" "$TMPDIR/s9.log" -- \
    env -C "$S9_DIR" node "$CLI" rules list --module gamedesign

assert_stdout_contains "$TMPDIR/s9.log" "Rules catalog for gamedesign" \
    "single-module header names the gamedesign module (back-compat format)"
assert_stdout_contains "$TMPDIR/s9.log" "balance" \
    "a canonical gamedesign core rule appears (backfilled from bundled)"
assert_stdout_contains "$TMPDIR/s9.log" "0 library" \
    "library tier is empty (custom-only slot, no official/bundled backfill)"

# ─────────────────────────────────────────────
# Scenario 10: --module bogus → exit 3 (INVALID_ARGS)
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 10: --module bogus (exit 3)${NC}"

S10_DIR="$TMPDIR/s10-bad-module"
mkdir -p "$S10_DIR"
use_fake_registry "$S10_DIR" unity minimal-valid

assert_cmd_exit 3 "rules list --module bogus exits 3" "$TMPDIR/s10.log" -- \
    env -C "$S10_DIR" node "$CLI" rules list --module bogus

assert_stdout_contains "$TMPDIR/s10.log" "Unknown module" \
    "error names the unknown module"
assert_stdout_contains "$TMPDIR/s10.log" "gamedesign" \
    "error lists gamedesign among available modules"

# ─────────────────────────────────────────────
# Note on exit 2 (every catalog unreachable) — intentionally NOT exercised here
# ─────────────────────────────────────────────
# `rules list` resolves through the registry CHAIN (primary → official →
# bundled). The bundled snapshot ALWAYS carries both `code` and `gamedesign`,
# so a refused-port / unreachable primary still resolves (exit 0) via the
# bundled fallback — verified by hand: `.unikit.json.rulesRegistry` set to
# http://127.0.0.1:1 returns exit 0 (chain falls back to bundled), NOT exit 2.
# exit 2 requires the ENTIRE chain (including bundled) to be unreachable, which
# cannot be staged hermetically without deleting the bundled snapshot the whole
# suite depends on. The deterministic exit-2 source is `rules registry status`
# (a SINGLE source with NO fallback chain) — covered by Row 4 of
# scripts/test-rules-registry-status.sh (refused-port http://127.0.0.1:1). The
# global exit-code matrix (test-exit-codes.sh) is satisfied by that path.

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
print_summary_and_exit "rules list Smoke Tests"
