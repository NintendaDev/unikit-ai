#!/bin/bash
# Smoke tests: guard matrix over the `unikit-ai rules *` exit code
# surface.
#
# Walks the per-command test files added by the test-rules coverage
# plan, extracts every `assert_exit <code>` / `assert_cmd_exit <code>`
# call, and asserts that every documented exit code in cli-contract.md
# (0-7) is exercised by at least one test.
#
# Two codes are intentionally exempt from the strict check:
#   - 2 (NETWORK_ERROR) — requires disabling the whole registry
#     fallback chain; cannot be reproduced deterministically on a
#     developer machine without network isolation. Covered by manual
#     smoke tests when the network is known bad.
#   - 4 (NOT_PERMITTED) — the EXIT enum reserves this slot but rules.ts
#     does NOT currently wire any code path to it (the variadic install
#     absorbs "already installed" into the report as ↻, so the legacy
#     single-id handler's exit-4 branch is gone). The check prints a
#     note but does not fail while the reservation is unused.
#
# When NET_WORK/NOT_PERMITTED start being used, extend the strict
# covered set and remove the exemptions.
#
# Usage: ./scripts/test-exit-codes.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=./test-fixtures.sh
source "$SCRIPT_DIR/test-fixtures.sh"

echo -e "${BOLD}=== rules CLI exit-code matrix ===${NC}"

RULES_TEST_FILES=(
    "$SCRIPT_DIR/test-rules-list.sh"
    "$SCRIPT_DIR/test-rules-show.sh"
    "$SCRIPT_DIR/test-rules-status.sh"
    "$SCRIPT_DIR/test-rules-install.sh"
    "$SCRIPT_DIR/test-rules-sync.sh"
    "$SCRIPT_DIR/test-rules-registry.sh"
    "$SCRIPT_DIR/test-rules-registry-init.sh"
)

# Extract the set of exit codes referenced by the rules test suite.
# Matches two idioms that coexist while init.sh keeps its imperative style:
#   - `assert_exit N` / `assert_cmd_exit N` (helper-based)
#   - `if [[ $CODE -eq N ]]` (imperative capture)
COVERED_CODES_HELPER=$(grep -hE "^[[:space:]]*(assert_exit|assert_cmd_exit)[[:space:]]+[0-9]+" \
    "${RULES_TEST_FILES[@]}" 2> /dev/null \
    | awk '{ for (i=1; i<=NF; i++) { if ($i ~ /^(assert_exit|assert_cmd_exit)$/) { print $(i+1); break } } }')

COVERED_CODES_IMPERATIVE=$(grep -hoE "\\\$CODE[[:space:]]+-eq[[:space:]]+[0-9]+" \
    "${RULES_TEST_FILES[@]}" 2> /dev/null \
    | awk '{ print $NF }')

COVERED_CODES=$(printf '%s\n%s\n' "$COVERED_CODES_HELPER" "$COVERED_CODES_IMPERATIVE" \
    | grep -E '^[0-9]+$' | sort -u)

echo "Exit codes exercised by test-rules-*.sh:"
for code in $COVERED_CODES; do
    echo "  - $code"
done

# Exit codes the contract requires tests for. Keep in sync with the
# EXIT enum in src/cli/commands/rules.ts and the table in
# data/cli-contract.md.
REQUIRED_CODES=(0 1 3 5 6 7)
# Exempt codes — documented but not deterministically reachable.
EXEMPT_CODES=(2 4)

echo -e "\nStrict check: codes ${REQUIRED_CODES[*]} must each have at least one test"

for code in "${REQUIRED_CODES[@]}"; do
    if echo "$COVERED_CODES" | grep -q "^${code}$"; then
        pass "exit code $code is exercised"
    else
        fail "exit code $code has NO corresponding assert_exit / assert_cmd_exit call in the rules test files"
    fi
done

echo -e "\nExemption audit: codes ${EXEMPT_CODES[*]} (documented, not deterministically reachable)"

for code in "${EXEMPT_CODES[@]}"; do
    if echo "$COVERED_CODES" | grep -q "^${code}$"; then
        pass "exit code $code is EXERCISED — consider promoting to required"
    else
        # Exempt and not exercised — print a note but do not fail.
        echo -e "  ${YELLOW}!${NC} exit code $code is exempt and not exercised (see header comment in this file)"
    fi
done

# Sanity check: no rogue exit codes (> 7) should appear in tests.
for code in $COVERED_CODES; do
    if [[ "$code" -gt 7 ]]; then
        fail "test files reference exit code $code which is not in the contract (0-7)"
    fi
done

# Cross-check that src/cli/commands/rules.ts defines the same EXIT enum
# constants the contract documents. This catches drift between the
# TypeScript source and the markdown contract.
RULES_CMD="$ROOT_DIR/src/cli/commands/rules.ts"

check_enum_constant() {
    local name="$1"
    local expected="$2"
    if grep -qE "^\s*${name}:\s*${expected}," "$RULES_CMD"; then
        pass "EXIT.$name = $expected matches contract"
    else
        fail "EXIT.$name not found or mismatched in rules.ts"
    fi
}

echo -e "\nEXIT enum cross-check against src/cli/commands/rules.ts"
check_enum_constant SUCCESS 0
check_enum_constant NOT_FOUND 1
check_enum_constant NETWORK_ERROR 2
check_enum_constant INVALID_ARGS 3
check_enum_constant NOT_PERMITTED 4
check_enum_constant VALIDATION_FAILED 5
check_enum_constant REGISTRY_ALREADY_INITIALIZED 6
check_enum_constant PATH_OCCUPIED 7

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
print_summary_and_exit "rules CLI exit-code matrix"
