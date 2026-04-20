#!/bin/bash
# Test suite: validates rules registry CLI, types, and data integrity
# Usage: ./scripts/test-rules.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure the bundled rules snapshot exists (rules-registry/ is not tracked in
# git; it is cloned on demand by scripts/download-rules.sh).
if [ ! -f "$ROOT_DIR/rules-registry/manifest.json" ]; then
  bash "$SCRIPT_DIR/download-rules.sh"
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

PASSED=0
FAILED=0
TOTAL=0

pass() {
    PASSED=$((PASSED + 1))
    TOTAL=$((TOTAL + 1))
    echo -e "  ${GREEN}✓${NC} $1"
}

fail() {
    FAILED=$((FAILED + 1))
    TOTAL=$((TOTAL + 1))
    echo -e "  ${RED}✗${NC} $1"
}

echo -e "${BOLD}=== Rules Registry Tests ===${NC}"

# ─────────────────────────────────────────────
# Part 1: Registry module structure
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part 1: Registry module structure${NC}"

REGISTRY_DIR="$ROOT_DIR/src/core/registry"
for file in index.ts manifest-types.ts git-registry.ts fs-registry.ts api-registry.ts hybrid-registry.ts validator.ts; do
    if [[ -f "$REGISTRY_DIR/$file" ]]; then
        pass "registry/$file exists"
    else
        fail "registry/$file missing"
    fi
done

# ─────────────────────────────────────────────
# Part 2: Registry types validation
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part 2: Registry types validation${NC}"

# manifest-types.ts must export key types
for type in RegistryManifest RegistryRule EngineRules RuleCategory FetchedRule FetchedReference; do
    if grep -q "export interface $type\|export type $type" "$REGISTRY_DIR/manifest-types.ts" 2>/dev/null; then
        pass "manifest-types.ts exports $type"
    else
        fail "manifest-types.ts missing export: $type"
    fi
done

# index.ts must export interface + factory + constant
if grep -q "export interface RulesRegistry" "$REGISTRY_DIR/index.ts"; then
    pass "index.ts exports RulesRegistry interface"
else
    fail "index.ts missing RulesRegistry interface"
fi

if grep -q "export function createRegistry" "$REGISTRY_DIR/index.ts"; then
    pass "index.ts exports createRegistry factory"
else
    fail "index.ts missing createRegistry factory"
fi

if grep -q "OFFICIAL_REGISTRY_URL" "$REGISTRY_DIR/index.ts"; then
    pass "index.ts exports OFFICIAL_REGISTRY_URL"
else
    fail "index.ts missing OFFICIAL_REGISTRY_URL"
fi

# ─────────────────────────────────────────────
# Part 3: CLI contract
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part 3: CLI contract${NC}"

if [[ -f "$ROOT_DIR/src/core/cli-contract.ts" ]]; then
    pass "cli-contract.ts exists"
else
    fail "cli-contract.ts missing"
fi

if [[ -f "$ROOT_DIR/data/cli-contract.md" ]]; then
    pass "data/cli-contract.md exists"
else
    fail "data/cli-contract.md missing"
fi

if grep -q "Exit Codes" "$ROOT_DIR/data/cli-contract.md" 2>/dev/null; then
    pass "cli-contract.md contains exit codes"
else
    fail "cli-contract.md missing exit codes section"
fi

if grep -q "Rules Commands" "$ROOT_DIR/data/cli-contract.md" 2>/dev/null; then
    pass "cli-contract.md contains rules commands"
else
    fail "cli-contract.md missing rules commands section"
fi

# ─────────────────────────────────────────────
# Part 4: rules-manifest.json integrity
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part 4: rules-manifest.json integrity${NC}"

MANIFEST="$ROOT_DIR/data/rules-manifest.json"
if [[ -f "$MANIFEST" ]]; then
    pass "rules-manifest.json exists"
else
    fail "rules-manifest.json missing"
fi

# Must have requiredBy
if (cd "$ROOT_DIR" && node -e "const m=JSON.parse(require('fs').readFileSync('data/rules-manifest.json','utf8')); if(!m.requiredBy) process.exit(1)") 2>/dev/null; then
    pass "rules-manifest.json has requiredBy"
else
    fail "rules-manifest.json missing requiredBy"
fi

# Must NOT have engine-keyed sections (they've been removed)
for engine in unity godot godot-net unreal-engine-5; do
    if (cd "$ROOT_DIR" && node -e "const m=JSON.parse(require('fs').readFileSync('data/rules-manifest.json','utf8')); if(m['$engine']) process.exit(1)") 2>/dev/null; then
        pass "rules-manifest.json has no '$engine' section (cleaned)"
    else
        fail "rules-manifest.json still has '$engine' section — should be removed"
    fi
done

# ─────────────────────────────────────────────
# Part 5: Bundled rules — snapshot cloned from registry repo
# ─────────────────────────────────────────────
# `memory/` is cloned on demand by scripts/download-rules.sh and ships in the
# npm tarball. It is no longer an opinionated subset — the clone mirrors the
# full rules repo so HybridRegistry's 3rd-level fallback can serve both core
# and stack rules when primary and official are unreachable. Stack directories
# may or may not exist per engine (the registry owns that decision).
echo -e "\n${BOLD}Part 5: Bundled rules snapshot${NC}"

for engine in unity godot godot-net unreal-engine-5; do
    CORE_DIR="$ROOT_DIR/rules-registry/$engine/core"

    if [[ -d "$CORE_DIR" ]]; then
        CORE_COUNT=$(find "$CORE_DIR" -name "*.md" | wc -l)
        if [[ $CORE_COUNT -gt 0 ]]; then
            pass "$engine/core/ has $CORE_COUNT bundled rules"
        else
            fail "$engine/core/ exists but has no .md files"
        fi
    else
        fail "$engine/core/ directory missing"
    fi
done

# ─────────────────────────────────────────────
# Part 6: Config schema — InstalledRuleEntry types
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part 6: Config schema — InstalledRuleEntry types${NC}"

CONFIG_TS="$ROOT_DIR/src/core/config.ts"

if grep -q "export interface InstalledRuleEntry" "$CONFIG_TS" 2>/dev/null; then
    pass "config.ts exports InstalledRuleEntry"
else
    fail "config.ts missing InstalledRuleEntry"
fi

if grep -q "rulesRegistry" "$CONFIG_TS" 2>/dev/null; then
    pass "config.ts has rulesRegistry field"
else
    fail "config.ts missing rulesRegistry field"
fi

if grep -q "RuleSource" "$CONFIG_TS" 2>/dev/null; then
    pass "config.ts exports RuleSource type"
else
    fail "config.ts missing RuleSource type"
fi

# ─────────────────────────────────────────────
# Part 7: CLI rules command registration
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part 7: CLI rules command registration${NC}"

CLI_INDEX="$ROOT_DIR/src/cli/index.ts"
if grep -q "command('rules')" "$CLI_INDEX" 2>/dev/null; then
    pass "CLI registers 'rules' command"
else
    fail "CLI missing 'rules' command registration"
fi

# Top-level rules subcommands — after the redesign:
#   list show install sync status registry
# and the nested `registry` group: show set reset init.
# `core-install` and `registry-init` are gone (merged into `install` and
# `registry init` respectively).
for sub in list show install sync status registry; do
    if grep -q "command('$sub" "$CLI_INDEX" 2>/dev/null; then
        pass "CLI registers 'rules $sub' subcommand"
    else
        fail "CLI missing 'rules $sub' subcommand"
    fi
done

# Nested registry subcommands. The assertion limits the grep to the part of
# the CLI index that follows `const registryCmd = rules` so it doesn't
# false-positive on the top-level `rules show <id>` / `rules sync` command
# registrations earlier in the file.
REGISTRY_BLOCK=$(awk '/const registryCmd = rules/,0 { print }' "$CLI_INDEX")
for sub in show set reset init; do
    if printf '%s\n' "$REGISTRY_BLOCK" | grep -qE "^[[:space:]]*\.command\('$sub(\b|')" 2>/dev/null; then
        pass "CLI registers 'rules registry $sub' nested subcommand"
    else
        fail "CLI missing 'rules registry $sub' nested subcommand"
    fi
done

# Old surface must be gone entirely.
if grep -q "command('core-install" "$CLI_INDEX" 2>/dev/null; then
    fail "CLI still registers obsolete 'rules core-install' subcommand"
else
    pass "CLI no longer registers 'rules core-install' (merged into 'install')"
fi

if grep -q "command('registry-init" "$CLI_INDEX" 2>/dev/null; then
    fail "CLI still registers obsolete 'rules registry-init' subcommand"
else
    pass "CLI no longer registers 'rules registry-init' (moved under 'registry init')"
fi

# Variadic install — signature must accept ids..., not a single <id>.
if grep -qE "command\('install \[ids\.\.\.\]" "$CLI_INDEX" 2>/dev/null; then
    pass "rules install registers variadic [ids...] signature"
else
    fail "rules install missing variadic [ids...] signature"
fi

# Registry kind detection helper
REGISTRY_INDEX="$ROOT_DIR/src/core/registry/index.ts"
if grep -q "detectRegistryKind" "$REGISTRY_INDEX" 2>/dev/null; then
    pass "registry/index.ts exports detectRegistryKind"
else
    fail "registry/index.ts missing detectRegistryKind export"
fi

# rules registry show --json GET mode exposes kind field
RULES_CMD="$ROOT_DIR/src/cli/commands/rules.ts"
if grep -q "configured:" "$RULES_CMD" 2>/dev/null && grep -q "kind:" "$RULES_CMD" 2>/dev/null; then
    pass "rules registry show --json exposes kind field"
else
    fail "rules registry show --json missing kind field"
fi

# rules status --json exposes registryKind sibling
if grep -q "registryKind:" "$RULES_CMD" 2>/dev/null; then
    pass "rules status --json exposes registryKind sibling"
else
    fail "rules status --json missing registryKind sibling"
fi

# rules status --json exposes registryConfigured boolean (lets callers
# distinguish "user set this" from "default official fallback").
if grep -q "registryConfigured" "$RULES_CMD" 2>/dev/null; then
    pass "rules status --json exposes registryConfigured sibling"
else
    fail "rules status --json missing registryConfigured sibling"
fi

# rules install registers --force option for per-rule force re-fetch.
if grep -qE "command\('install \[ids\.\.\.\]'" "$CLI_INDEX" && grep -qE "option\('--force'" "$CLI_INDEX"; then
    pass "rules install registers --force option"
else
    fail "rules install missing --force option registration"
fi

# rules show registers --references option for inline reference dumping.
if grep -qE "command\('show <id>'" "$CLI_INDEX" && grep -qE "option\('--references'" "$CLI_INDEX"; then
    pass "rules show registers --references option"
else
    fail "rules show missing --references option registration"
fi

# rules sync must register the new composable flags (--replace / --prune) and
# NOT the old --force / --no-sync / --replace-existing.
if grep -q "'--replace'" "$CLI_INDEX" 2>/dev/null && grep -q "'--prune'" "$CLI_INDEX" 2>/dev/null; then
    pass "rules sync registers --replace and --prune flags"
else
    fail "rules sync missing --replace or --prune flags"
fi

if grep -qE "'--no-sync'|'--replace-existing'" "$CLI_INDEX" 2>/dev/null; then
    fail "CLI still registers obsolete --no-sync or --replace-existing flags"
else
    pass "CLI no longer registers --no-sync / --replace-existing"
fi

# `rules registry set` / `reset` descriptions must document the
# no-auto-sync contract so the CLI help output stays aligned with the
# data/cli-contract.md promise.
if grep -q "Does NOT sync rules" "$CLI_INDEX" 2>/dev/null; then
    pass "rules registry set/reset advertise 'Does NOT sync rules' in help"
else
    fail "rules registry set/reset help text missing 'Does NOT sync rules'"
fi

# ─────────────────────────────────────────────
# Part 8: unikit-memory skill has Bash tool and registry steps
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part 8: unikit-memory skill registry integration${NC}"

MEMORY_SKILL="$ROOT_DIR/skills/unikit-memory/SKILL.md"
if grep -q "Bash" "$MEMORY_SKILL" 2>/dev/null; then
    pass "unikit-memory SKILL.md has Bash in allowed-tools"
else
    fail "unikit-memory SKILL.md missing Bash in allowed-tools"
fi

if grep -q "rules list --json" "$MEMORY_SKILL" 2>/dev/null; then
    pass "unikit-memory has registry list step"
else
    fail "unikit-memory missing registry list step"
fi

if grep -q "rules status --json" "$MEMORY_SKILL" 2>/dev/null; then
    pass "unikit-memory has registry status step"
else
    fail "unikit-memory missing registry status step"
fi

if grep -q "Semantic matching\|semantic match" "$MEMORY_SKILL" 2>/dev/null; then
    pass "unikit-memory has semantic matching step"
else
    fail "unikit-memory missing semantic matching step"
fi

# ─────────────────────────────────────────────
# Part 9: rules registry init smoke tests
# ─────────────────────────────────────────────
# `rules registry init` (previously the top-level `rules registry-init`
# command) is exercised via its own smoke-test script. The script was updated
# to invoke the new nested subcommand path.
echo -e "\n${BOLD}Part 9: rules registry init smoke tests${NC}"
bash "$SCRIPT_DIR/test-rules-registry-init.sh"

# Part 10 (`rules registry switch/kind smoke tests`) has been retired.
# Its scenarios were migrated into scripts/test-rules-registry.sh
# (registry show/set/reset + origin fold guard) and
# scripts/test-rules-sync.sh (sync --replace --prune hard guard). The
# dedicated per-command files are wired below.

run_nested_test() {
    local label="$1"
    local file="$2"
    echo -e "\n${BOLD}${label}${NC}"
    set +e
    bash "$file"
    local exit_code=$?
    set -e
    if [[ $exit_code -eq 0 ]]; then
        pass "$(basename "$file") passed"
    else
        fail "$(basename "$file") failed (exit $exit_code)"
    fi
}

# ─────────────────────────────────────────────
# Part 11: `rules list` smoke tests
# ─────────────────────────────────────────────
run_nested_test "Part 11: rules list smoke tests" "$SCRIPT_DIR/test-rules-list.sh"

# ─────────────────────────────────────────────
# Part 12: `rules show` smoke tests
# ─────────────────────────────────────────────
run_nested_test "Part 12: rules show smoke tests" "$SCRIPT_DIR/test-rules-show.sh"

# ─────────────────────────────────────────────
# Part 13: `rules status` smoke tests
# ─────────────────────────────────────────────
run_nested_test "Part 13: rules status smoke tests" "$SCRIPT_DIR/test-rules-status.sh"

# ─────────────────────────────────────────────
# Part 14: `rules install` smoke tests
# ─────────────────────────────────────────────
run_nested_test "Part 14: rules install smoke tests" "$SCRIPT_DIR/test-rules-install.sh"

# ─────────────────────────────────────────────
# Part 15: `rules sync` smoke tests
# ─────────────────────────────────────────────
run_nested_test "Part 15: rules sync smoke tests" "$SCRIPT_DIR/test-rules-sync.sh"

# ─────────────────────────────────────────────
# Part 16: `rules registry` show/set/reset smoke tests
# ─────────────────────────────────────────────
run_nested_test "Part 16: rules registry smoke tests" "$SCRIPT_DIR/test-rules-registry.sh"

# ─────────────────────────────────────────────
# Part 17: rules CLI exit-code matrix guard
# ─────────────────────────────────────────────
# Must run last: parses the other test-rules-*.sh files for
# assert_exit / assert_cmd_exit / `if [[ $CODE -eq N ]]` patterns and
# confirms every contract-documented exit code is covered by at least
# one assertion.
run_nested_test "Part 17: rules CLI exit-code matrix" "$SCRIPT_DIR/test-exit-codes.sh"

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== Results ===${NC}"
echo -e "  Total:    $TOTAL"
echo -e "  Passed:   ${GREEN}$PASSED${NC}"
echo -e "  Failed:   ${RED}$FAILED${NC}"

if [[ $FAILED -gt 0 ]]; then
    echo -e "\n${RED}TESTS FAILED${NC}\n"
    exit 1
else
    echo -e "\n${GREEN}ALL TESTS PASSED${NC}\n"
    exit 0
fi
