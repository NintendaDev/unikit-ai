#!/bin/bash
# Smoke tests: validates `unikit-ai rules show <id>` against fake registry
# fixtures.
#
# Scope:
#   - exit code matrix (0 / 1) across present/absent rules and missing config
#   - human output shows id, category, version, Scope, Load when
#   - stack rule with references header prints the References: line
#   - case-insensitive lookup (CODE-STYLE → code-style) via normalizeRuleId
#   - --references flag expands and dumps referenced doc files
#
# Note: the CLI intentionally does NOT register a `--engine` option on
# `rules show` (see src/cli/index.ts:82-86). The original plan listed it;
# the real surface is `show <id>` + `--references` only.
#
# Usage: ./scripts/test-rules-show.sh

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

echo -e "${BOLD}=== rules show Smoke Tests ===${NC}"

# ─────────────────────────────────────────────
# Scenario 1: missing .unikit.json → exit 1
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 1: missing .unikit.json${NC}"

S1_DIR="$TMPDIR/s1-no-config"
mkdir -p "$S1_DIR"

assert_cmd_exit 1 "rules show without config exits 1" "$TMPDIR/s1.log" -- \
    env -C "$S1_DIR" node "$CLI" rules show code-style

assert_stdout_contains "$TMPDIR/s1.log" "Not a UniKit project" \
    "missing config error message"

# ─────────────────────────────────────────────
# Scenario 2: show existing core rule from minimal-valid fixture
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 2: core rule from minimal-valid fixture${NC}"

S2_DIR="$TMPDIR/s2-core"
mkdir -p "$S2_DIR"
use_fake_registry "$S2_DIR" unity minimal-valid

assert_cmd_exit 0 "rules show code-style exits 0" "$TMPDIR/s2.log" -- \
    env -C "$S2_DIR" node "$CLI" rules show code-style

assert_stdout_contains "$TMPDIR/s2.log" "code-style (core) v1.0.0" \
    "human header shows id/category/version"
assert_stdout_contains "$TMPDIR/s2.log" "Description:" \
    "header prints Description label"
assert_stdout_contains "$TMPDIR/s2.log" "Load when:" \
    "header prints Load when label"
assert_stdout_contains "$TMPDIR/s2.log" "Minimal core rule used by rules-cli smoke tests" \
    "body contains the fixture's Scope text"

# ─────────────────────────────────────────────
# Scenario 3: show stack rule with References: header
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 3: stack rule with references header${NC}"

S3_DIR="$TMPDIR/s3-stack"
mkdir -p "$S3_DIR"
use_fake_registry "$S3_DIR" unity minimal-valid

assert_cmd_exit 0 "rules show sample-stack-rule exits 0" "$TMPDIR/s3.log" -- \
    env -C "$S3_DIR" node "$CLI" rules show sample-stack-rule

assert_stdout_contains "$TMPDIR/s3.log" "sample-stack-rule (stack) v1.0.0" \
    "stack rule header shows category=stack"
assert_stdout_contains "$TMPDIR/s3.log" "References:" \
    "stack rule header prints References label"
assert_stdout_contains "$TMPDIR/s3.log" "sample-stack-rule-quickref.md" \
    "references list contains the quickref filename"

# ─────────────────────────────────────────────
# Scenario 4: case-insensitive id normalization (CODE-STYLE → code-style)
# ─────────────────────────────────────────────
# The CLI runs rawId and every catalog id through normalizeRuleId
# (trim + lowercase) before comparing, so a legacy UPPER_CASE argument
# still resolves to the canonical rule in the registry.
echo -e "\n${BOLD}Scenario 4: case-insensitive id normalization${NC}"

S4_DIR="$TMPDIR/s4-case"
mkdir -p "$S4_DIR"
use_fake_registry "$S4_DIR" unity minimal-valid

assert_cmd_exit 0 "rules show CODE-STYLE (legacy upper case)" "$TMPDIR/s4.log" -- \
    env -C "$S4_DIR" node "$CLI" rules show CODE-STYLE

assert_stdout_contains "$TMPDIR/s4.log" "code-style (core)" \
    "legacy UPPER_CASE id normalizes to lowercase"

# ─────────────────────────────────────────────
# Scenario 5: unknown rule id → exit 1 NOT_FOUND
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 5: unknown rule id (exit 1)${NC}"

S5_DIR="$TMPDIR/s5-unknown"
mkdir -p "$S5_DIR"
use_fake_registry "$S5_DIR" unity minimal-valid

assert_cmd_exit 1 "rules show does-not-exist exits 1" "$TMPDIR/s5.log" -- \
    env -C "$S5_DIR" node "$CLI" rules show does-not-exist

assert_stdout_contains "$TMPDIR/s5.log" "not found in registry" \
    "error mentions missing rule"

# ─────────────────────────────────────────────
# Scenario 6: --references flag expands reference files
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 6: --references flag expands reference content${NC}"

S6_DIR="$TMPDIR/s6-refs"
mkdir -p "$S6_DIR"
use_fake_registry "$S6_DIR" unity minimal-valid

assert_cmd_exit 0 "rules show --references exits 0" "$TMPDIR/s6.log" -- \
    env -C "$S6_DIR" node "$CLI" rules show sample-stack-rule --references

assert_stdout_contains "$TMPDIR/s6.log" "--- Reference: sample-stack-rule-quickref.md ---" \
    "reference section header printed"
assert_stdout_contains "$TMPDIR/s6.log" "Sample Stack Rule — Quick Reference (fixture)" \
    "reference body printed inline"

# ─────────────────────────────────────────────
# Scenario 7: multi-version v2 fixture shows bumped version in header
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 7: multi-version v2 bumped version in header${NC}"

S7_DIR="$TMPDIR/s7-v2"
mkdir -p "$S7_DIR"
use_fake_registry "$S7_DIR" unity multi-version/v2

assert_cmd_exit 0 "rules show unitask (v2) exits 0" "$TMPDIR/s7.log" -- \
    env -C "$S7_DIR" node "$CLI" rules show unitask

assert_stdout_contains "$TMPDIR/s7.log" "unitask (stack) v2.0.0" \
    "v2 header shows version 2.0.0"
assert_stdout_contains "$TMPDIR/s7.log" "sentinel: v2" \
    "v2 body content reached show output"

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
print_summary_and_exit "rules show Smoke Tests"
