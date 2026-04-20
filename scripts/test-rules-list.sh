#!/bin/bash
# Smoke tests: validates `unikit-ai rules list` against fake registry fixtures.
#
# Scope:
#   - exit code matrix (0 / 1 / 2) against configured vs unknown engines
#   - --json output shape (engine + rules[] with id/category/description/version)
#   - --engine override behavior (valid override, unknown override)
#   - core vs stack partitioning in the catalog
#   - multi-version fixture (v1 vs v2) so the listed version actually matches
#     the manifest currently on disk
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
# EXIT.NOT_FOUND (1) when .unikit.json is missing. The plan originally
# listed this as exit 0; the real behavior is exit 1.
echo -e "\n${BOLD}Scenario 1: missing .unikit.json${NC}"

S1_DIR="$TMPDIR/s1-no-config"
mkdir -p "$S1_DIR"

assert_cmd_exit 1 "rules list without config exits 1" "$TMPDIR/s1.log" -- \
    env -C "$S1_DIR" node "$CLI" rules list

assert_stdout_contains "$TMPDIR/s1.log" "Not a UniKit project" \
    "error message mentions missing UniKit project"

# ─────────────────────────────────────────────
# Scenario 2: minimal-valid fixture — default (human) output
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 2: minimal-valid fixture, human output${NC}"

S2_DIR="$TMPDIR/s2-default"
mkdir -p "$S2_DIR"
use_fake_registry "$S2_DIR" unity minimal-valid

assert_cmd_exit 0 "rules list exits 0 on minimal-valid fixture" "$TMPDIR/s2.log" -- \
    env -C "$S2_DIR" node "$CLI" rules list

assert_stdout_contains "$TMPDIR/s2.log" "Rules catalog for unity" \
    "human output headers with the configured engine"
assert_stdout_contains "$TMPDIR/s2.log" "code-style" \
    "core rule id appears in the catalog"
assert_stdout_contains "$TMPDIR/s2.log" "sample-stack-rule" \
    "stack rule id appears in the catalog"
assert_stdout_contains "$TMPDIR/s2.log" "Total: 2 rules" \
    "footer counts both fixture rules"

# ─────────────────────────────────────────────
# Scenario 3: minimal-valid fixture — --json output
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 3: minimal-valid fixture, --json output${NC}"

S3_DIR="$TMPDIR/s3-json"
mkdir -p "$S3_DIR"
use_fake_registry "$S3_DIR" unity minimal-valid

assert_cmd_exit 0 "rules list --json exits 0" "$TMPDIR/s3.log" -- \
    env -C "$S3_DIR" node "$CLI" rules list --json

assert_json_field "$TMPDIR/s3.log" engine unity "JSON reports engine=unity"
assert_json_array_length "$TMPDIR/s3.log" rules 2 "JSON array has both fixture rules"
assert_json_field "$TMPDIR/s3.log" "rules.0.id" code-style "first rule id matches fixture"
assert_json_field "$TMPDIR/s3.log" "rules.0.category" core "first rule category is core"
assert_json_field "$TMPDIR/s3.log" "rules.0.version" 1.0.0 "first rule version is 1.0.0"
assert_json_field "$TMPDIR/s3.log" "rules.1.id" sample-stack-rule "second rule id matches fixture"
assert_json_field "$TMPDIR/s3.log" "rules.1.category" stack "second rule category is stack"

# ─────────────────────────────────────────────
# Scenario 4: --engine override points at a different engine in the
# same primary fixture
# ─────────────────────────────────────────────
# Config pins engine=unity. The primary (minimal-valid) ships both
# unity and godot sections, so --engine godot stays on the primary and
# serves its godot catalog. This exercises the override filter on the
# same resolved manifest.
echo -e "\n${BOLD}Scenario 4: --engine override (same fixture)${NC}"

S4_DIR="$TMPDIR/s4-engine-override"
mkdir -p "$S4_DIR"
use_fake_registry "$S4_DIR" unity minimal-valid

assert_cmd_exit 0 "rules list --engine godot exits 0" "$TMPDIR/s4.log" -- \
    env -C "$S4_DIR" node "$CLI" rules list --engine godot --json

assert_json_field "$TMPDIR/s4.log" engine godot \
    "override engine wins over config.engine"
assert_json_array_length "$TMPDIR/s4.log" rules 1 \
    "override serves the fixture's godot section (1 rule)"
assert_json_field "$TMPDIR/s4.log" "rules.0.id" code-style \
    "godot section has the fixture's code-style rule"

# ─────────────────────────────────────────────
# Scenario 5: --engine override (unknown engine) → exit 1
# ─────────────────────────────────────────────
# The plan originally called out exit 3; real code paths through
# `rulesListCommand` return EXIT.NOT_FOUND (1) when the manifest has
# no such engine section (rules.ts:79).
echo -e "\n${BOLD}Scenario 5: --engine unknown (exit 1)${NC}"

S5_DIR="$TMPDIR/s5-engine-unknown"
mkdir -p "$S5_DIR"
use_fake_registry "$S5_DIR" unity minimal-valid

assert_cmd_exit 1 "rules list --engine unknown-xyz exits 1" "$TMPDIR/s5.log" -- \
    env -C "$S5_DIR" node "$CLI" rules list --engine unknown-xyz --json

assert_stdout_contains "$TMPDIR/s5.log" "not found in registry" \
    "error mentions the missing engine"

# ─────────────────────────────────────────────
# Scenario 6: multi-version v1 fixture
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 6: multi-version v1${NC}"

S6_DIR="$TMPDIR/s6-v1"
mkdir -p "$S6_DIR"
use_fake_registry "$S6_DIR" unity multi-version/v1

assert_cmd_exit 0 "rules list --json against v1" "$TMPDIR/s6.log" -- \
    env -C "$S6_DIR" node "$CLI" rules list --json

assert_json_array_length "$TMPDIR/s6.log" rules 2 "v1 fixture has 2 rules"
# Find unitask in the rules array: index 1 because core is listed first.
assert_json_field "$TMPDIR/s6.log" "rules.1.id" unitask "stack rule is unitask"
assert_json_field "$TMPDIR/s6.log" "rules.1.version" 1.0.0 "v1 fixture reports unitask v1.0.0"

# ─────────────────────────────────────────────
# Scenario 7: multi-version v2 fixture (version bump visible)
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 7: multi-version v2${NC}"

S7_DIR="$TMPDIR/s7-v2"
mkdir -p "$S7_DIR"
use_fake_registry "$S7_DIR" unity multi-version/v2

assert_cmd_exit 0 "rules list --json against v2" "$TMPDIR/s7.log" -- \
    env -C "$S7_DIR" node "$CLI" rules list --json

assert_json_field "$TMPDIR/s7.log" "rules.0.id" code-style "v2 core rule is code-style"
assert_json_field "$TMPDIR/s7.log" "rules.0.version" 1.1.0 "v2 fixture bumped code-style to 1.1.0"
assert_json_field "$TMPDIR/s7.log" "rules.1.id" unitask "v2 stack rule is unitask"
assert_json_field "$TMPDIR/s7.log" "rules.1.version" 2.0.0 "v2 fixture bumped unitask to 2.0.0"

# ─────────────────────────────────────────────
# Scenario 8: core vs stack partitioning in human output
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 8: core vs stack partitioning${NC}"

S8_DIR="$TMPDIR/s8-partitioning"
mkdir -p "$S8_DIR"
use_fake_registry "$S8_DIR" unity minimal-valid

assert_cmd_exit 0 "rules list exits 0 for partitioning check" "$TMPDIR/s8.log" -- \
    env -C "$S8_DIR" node "$CLI" rules list

assert_stdout_contains "$TMPDIR/s8.log" "Core rules:" \
    "human output has Core rules section header"
assert_stdout_contains "$TMPDIR/s8.log" "Stack rules:" \
    "human output has Stack rules section header"
assert_stdout_contains "$TMPDIR/s8.log" "1 core, 1 stack" \
    "footer reports exact 1/1 partition of the minimal fixture"

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
print_summary_and_exit "rules list Smoke Tests"
