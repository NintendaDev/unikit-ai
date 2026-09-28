#!/bin/bash
# Test suite: skills/unikit-plan/scripts/plan-bundle.mjs — the integrity check of an ultra plan
# bundle and its move out of the planning working folder. Runs the real script with node over
# the fixture bundles in scripts/test-fixtures/plan-bundle/ and proves what it exists for: a
# correct bundle passes all 15 checks, each seeded defect fails its own numbered check, a
# legacy plan is exempt from check 13, and `finalize` moves only a bundle that passed, never
# over an existing plan and never removing a folder outside .unikit/code/.planning/.
# The CRLF case is built at run time — .gitattributes forces LF on checkout.
# Usage: ./scripts/test-plan-bundle.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUNDLE="$ROOT_DIR/skills/unikit-plan/scripts/plan-bundle.mjs"
PLAN_SKILL="$ROOT_DIR/skills/unikit-plan/SKILL.md"
FIXTURES="$SCRIPT_DIR/test-fixtures/plan-bundle"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'
PASSED=0
FAILED=0
TOTAL=0
pass() { PASSED=$((PASSED + 1)); TOTAL=$((TOTAL + 1)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { FAILED=$((FAILED + 1)); TOTAL=$((TOTAL + 1)); echo -e "  ${RED}✗${NC} $1"; }
check() { if eval "$2"; then pass "$1"; else fail "$1${3:+ — $3}"; fi; }
# run <args...> → LAST_OUT / LAST_CODE, never aborts the suite
run() { LAST_CODE=0; LAST_OUT="$(node "$BUNDLE" "$@" 2>&1)" || LAST_CODE=$?; }

echo -e "${BOLD}=== plan-bundle.mjs Tests ===${NC}"

echo -e "\n${BOLD}Part 1: check on fixture bundles${NC}"
run check "$FIXTURES/valid-ultra"
check "valid-ultra: all 15 checks pass" '[[ $LAST_CODE -eq 0 ]] && grep -qxF "OK 15 checks" <<< "$LAST_OUT"' "$LAST_OUT"
run check "$FIXTURES/valid-full"
check "valid-full: a full plan runs only the checks that apply (6, 9, 11, 12-15)" '[[ $LAST_CODE -eq 0 ]] && grep -qxF "OK 7 checks" <<< "$LAST_OUT"' "$LAST_OUT"
run check "$FIXTURES/underscore-anchor"
check "underscore-anchor: the slug keeps _ (a connector), so rules_layout passes" '[[ $LAST_CODE -eq 0 ]] && grep -qxF "OK 15 checks" <<< "$LAST_OUT"' "$LAST_OUT"
run check "$FIXTURES/legacy-skill-context"
check "legacy-skill-context: check 13 is not applied and says so" '[[ $LAST_CODE -eq 0 ]] && grep -qF "WARN 13 legacy plan" <<< "$LAST_OUT"' "$LAST_OUT"

expect_fail() { # <fixture> <check number>
    run check "$FIXTURES/$1"
    check "$1: FAIL $2, exit 2" '[[ $LAST_CODE -eq 2 ]] && grep -q "^FAIL '"$2"' " <<< "$LAST_OUT"' "$LAST_OUT"
}
expect_fail index-dotdot 2
expect_fail broken-anchor 3
expect_fail orphan-phase 5
expect_fail pr-not-last 13
expect_fail barrier-missing 14
expect_fail commit-crosses-module 15

run check "$TMP_ROOT/does-not-exist"
check "a missing folder is an I/O error, exit 1" '[[ $LAST_CODE -eq 1 ]] && grep -q "^ERROR " <<< "$LAST_OUT"' "$LAST_OUT"
run
check "no arguments prints the usage, exit 1" '[[ $LAST_CODE -eq 1 ]] && grep -qF "Usage:" <<< "$LAST_OUT"' "$LAST_OUT"

CRLF="$TMP_ROOT/crlf"
mkdir -p "$CRLF" && cp "$FIXTURES/valid-ultra/"* "$CRLF/"
for f in "$CRLF"/*.md; do sed -i 's/$/\r/' "$f"; done
run check "$CRLF"
check "CRLF: a CRLF bundle passes exactly as its LF original" '[[ $LAST_CODE -eq 0 ]] && grep -qxF "OK 15 checks" <<< "$LAST_OUT"' "$LAST_OUT"

echo -e "\n${BOLD}Part 2: finalize${NC}"
PROJ="$TMP_ROOT/project"
WORK="$PROJ/.unikit/code/.planning/demo"
PLANS="$PROJ/.unikit/code/plans"
mkdir -p "$WORK" "$PLANS"
cp "$FIXTURES/valid-ultra/"* "$WORK/"
printf '*\n' > "$WORK/.gitignore"
printf 'state\n' > "$WORK/STATE.md"
run finalize "$WORK" "$PLANS"
check "finalize: moves the manifest and the phase files, removes the working folder" \
    '[[ $LAST_CODE -eq 0 ]] && [[ -f "$PLANS/demo/PLAN.md" ]] && [[ -f "$PLANS/demo/phase-01-trade.md" ]] && [[ ! -e "$WORK" ]] && [[ ! -e "$PLANS/demo/STATE.md" ]] && [[ ! -e "$PLANS/demo/.gitignore" ]]' "$LAST_OUT"

mkdir -p "$WORK" && cp "$FIXTURES/valid-ultra/"* "$WORK/"
run finalize "$WORK" "$PLANS"
check "finalize over an existing plan: exit 3, nothing moved" '[[ $LAST_CODE -eq 3 ]] && [[ -f "$WORK/PLAN.md" ]] && grep -qF "target exists" <<< "$LAST_OUT"' "$LAST_OUT"
rm -rf "$WORK"

BAD_WORK="$PROJ/.unikit/code/.planning/broken"
mkdir -p "$BAD_WORK" && cp "$FIXTURES/broken-anchor/"* "$BAD_WORK/"
run finalize "$BAD_WORK" "$PLANS"
check "finalize of a failing bundle: exit 2, nothing moved" '[[ $LAST_CODE -eq 2 ]] && [[ -f "$BAD_WORK/PLAN.md" ]] && [[ ! -e "$PLANS/broken" ]]' "$LAST_OUT"

OUTSIDE="$TMP_ROOT/elsewhere/demo2"
mkdir -p "$OUTSIDE" && cp "$FIXTURES/valid-ultra/"* "$OUTSIDE/"
run finalize "$OUTSIDE" "$PLANS"
check "finalize outside .unikit/code/.planning: the folder is not removed, exit 1" \
    '[[ $LAST_CODE -eq 1 ]] && grep -qF "refusing to remove" <<< "$LAST_OUT" && [[ -d "$OUTSIDE" ]]' "$LAST_OUT"

echo -e "\n${BOLD}Part 3: wiring${NC}"
check "unikit-plan grants node" 'grep -qxF "  - Bash(node *)" "$PLAN_SKILL"'
check "plan-bundle.mjs stays within 500 lines" '[[ $(wc -l < "$BUNDLE") -le 500 ]]'
check "plan-bundle.mjs imports builtin node: modules only" '[[ -z "$(grep -E "^import .* from '"'"'" "$BUNDLE" | grep -v "from '"'"'node:")" ]]'

echo -e "\n${BOLD}=== Results ===${NC}"
echo -e "  Total:    $TOTAL"
echo -e "  Passed:   ${GREEN}$PASSED${NC}"
echo -e "  Failed:   ${RED}$FAILED${NC}"
if [[ $FAILED -gt 0 ]]; then
    echo -e "\n${RED}TESTS FAILED${NC}\n"
    exit 1
fi
echo -e "\n${GREEN}ALL TESTS PASSED${NC}\n"
