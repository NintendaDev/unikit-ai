#!/bin/bash
# Test suite: skills/unikit-plan/scripts/plan-bundle.mjs — the integrity check of an ultra plan
# bundle, `finalize` in place and `discard`. Runs the real script with node over the fixture
# bundles in scripts/test-fixtures/plan-bundle/ and proves what it exists for: a correct bundle
# passes all 16 checks, each seeded defect fails its own numbered check, a legacy plan is exempt
# from check 13, a recon file the plan names but does not hold is a warning (check 16), never a
# failure; `finalize` keeps `.planning/recon/` as the plan's `recon/` and removes the rest of
# `.planning/` only of a bundle that passed, never over a differing recon file; and `discard`
# removes only an unfinished plan folder — never one holding PLAN.md, and neither command removes
# anything outside .unikit/code/plans/<name>.
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
check "valid-ultra: all 16 checks pass" '[[ $LAST_CODE -eq 0 ]] && grep -qxF "OK 16 checks" <<< "$LAST_OUT"' "$LAST_OUT"
run check "$FIXTURES/valid-full"
check "valid-full: a full plan runs only the checks that apply (6, 9, 11, 12-15)" '[[ $LAST_CODE -eq 0 ]] && grep -qxF "OK 7 checks" <<< "$LAST_OUT"' "$LAST_OUT"
run check "$FIXTURES/underscore-anchor"
check "underscore-anchor: the slug keeps _ (a connector), so rules_layout passes" '[[ $LAST_CODE -eq 0 ]] && grep -qxF "OK 16 checks" <<< "$LAST_OUT"' "$LAST_OUT"
run check "$FIXTURES/legacy-skill-context"
check "legacy-skill-context: check 13 is not applied and says so" '[[ $LAST_CODE -eq 0 ]] && grep -qF "WARN 13 legacy plan" <<< "$LAST_OUT"' "$LAST_OUT"

run check "$FIXTURES/recon-named"
check "recon-named: the plan names recon/draft.md and holds it — 16 checks, no WARN 16" \
    '[[ $LAST_CODE -eq 0 ]] && grep -qxF "OK 16 checks" <<< "$LAST_OUT" && ! grep -q "^WARN 16" <<< "$LAST_OUT"' "$LAST_OUT"
run check "$FIXTURES/recon-missing"
check "recon-missing: a named recon file that is not there is WARN 16, exit 0 — recon is supplementary" \
    '[[ $LAST_CODE -eq 0 ]] && grep -qF "WARN 16 recon file named in PLAN.md is missing: recon/draft.md" <<< "$LAST_OUT" && grep -qF "WARN 16 recon file named in phase-01-trade.md is missing" <<< "$LAST_OUT" && grep -qxF "OK 16 checks" <<< "$LAST_OUT"' "$LAST_OUT"

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
check "CRLF: a CRLF bundle passes exactly as its LF original" '[[ $LAST_CODE -eq 0 ]] && grep -qxF "OK 16 checks" <<< "$LAST_OUT"' "$LAST_OUT"

# with_planning <dir> — a plan folder of the protocol with saved state: its .planning/ subfolder
with_planning() { mkdir -p "$1/.planning" && printf '*\n' > "$1/.planning/.gitignore" && printf 'state\n' > "$1/.planning/STATE.md"; }

echo -e "\n${BOLD}Part 2: finalize${NC}"
PROJ="$TMP_ROOT/project"
PLANS="$PROJ/.unikit/code/plans"
DEMO="$PLANS/demo"
mkdir -p "$DEMO" && cp "$FIXTURES/valid-ultra/"* "$DEMO/" && with_planning "$DEMO"
run check "$DEMO"
check "check: a .planning/ subfolder does not disturb the 16 checks" '[[ $LAST_CODE -eq 0 ]] && grep -qxF "OK 16 checks" <<< "$LAST_OUT"' "$LAST_OUT"
# the plan names recon/a.md; during assembly it is still in .planning/recon/
mkdir -p "$DEMO/.planning/recon" && printf 'answer a\n' > "$DEMO/.planning/recon/a.md"
printf '\n## Recon\n- recon/a.md · HEAD abc1234 · a question → phases 1\n' >> "$DEMO/PLAN.md"
run check "$DEMO"
check "check during assembly: a recon file still in .planning/recon/ is found — no WARN 16" \
    '[[ $LAST_CODE -eq 0 ]] && ! grep -q "^WARN 16" <<< "$LAST_OUT"' "$LAST_OUT"
run finalize "$DEMO"
check "finalize: keeps .planning/recon/ as recon/, removes the rest of .planning/, keeps the manifest and the phase files" \
    '[[ $LAST_CODE -eq 0 ]] && grep -qF "recon kept: 1" <<< "$LAST_OUT" && [[ "$(cat "$DEMO/recon/a.md")" == "answer a" ]] && [[ ! -e "$DEMO/.planning" ]] && [[ -f "$DEMO/PLAN.md" ]] && [[ -f "$DEMO/phase-01-trade.md" ]]' "$LAST_OUT"
run finalize "$DEMO"
check "finalize again (the standard protocol has no .planning/): nothing to clean, exit 0, recon/ kept" \
    '[[ $LAST_CODE -eq 0 ]] && grep -qxF "OK nothing to clean" <<< "$LAST_OUT" && [[ -f "$DEMO/PLAN.md" ]] && [[ -f "$DEMO/recon/a.md" ]]' "$LAST_OUT"

with_planning "$DEMO" && mkdir -p "$DEMO/.planning/recon" && printf 'answer a\n' > "$DEMO/.planning/recon/a.md"
run finalize "$DEMO"
check "finalize over an identical recon file: it is skipped, exit 0" \
    '[[ $LAST_CODE -eq 0 ]] && grep -qF "recon kept: 1" <<< "$LAST_OUT" && [[ ! -e "$DEMO/.planning" ]]' "$LAST_OUT"
with_planning "$DEMO" && mkdir -p "$DEMO/.planning/recon" && printf 'another answer\n' > "$DEMO/.planning/recon/a.md"
run finalize "$DEMO"
check "finalize over a differing recon file: exit 1, already exists and differs, nothing removed" \
    '[[ $LAST_CODE -eq 1 ]] && grep -qF "recon/a.md already exists and differs" <<< "$LAST_OUT" && [[ -f "$DEMO/.planning/recon/a.md" ]] && [[ -f "$DEMO/.planning/STATE.md" ]] && [[ "$(cat "$DEMO/recon/a.md")" == "answer a" ]]' "$LAST_OUT"
rm -rf "$DEMO/.planning"

BROKEN="$PLANS/broken"
mkdir -p "$BROKEN" && cp "$FIXTURES/broken-anchor/"* "$BROKEN/" && with_planning "$BROKEN"
run finalize "$BROKEN"
check "finalize of a failing bundle: exit 2, .planning/ kept" \
    '[[ $LAST_CODE -eq 2 ]] && [[ -f "$BROKEN/.planning/STATE.md" ]] && [[ -f "$BROKEN/PLAN.md" ]]' "$LAST_OUT"

OUTSIDE="$TMP_ROOT/elsewhere/demo2"
mkdir -p "$OUTSIDE" && cp "$FIXTURES/valid-ultra/"* "$OUTSIDE/" && with_planning "$OUTSIDE"
run finalize "$OUTSIDE"
check "finalize outside .unikit/code/plans: refusing to clean, exit 1, nothing removed" \
    '[[ $LAST_CODE -eq 1 ]] && grep -qF "refusing to clean" <<< "$LAST_OUT" && [[ -f "$OUTSIDE/.planning/STATE.md" ]]' "$LAST_OUT"

echo -e "\n${BOLD}Part 3: discard${NC}"
UNFINISHED="$PLANS/unfinished"
mkdir -p "$UNFINISHED" && cp "$FIXTURES/valid-ultra/phase-01-trade.md" "$UNFINISHED/" && with_planning "$UNFINISHED"
mkdir -p "$UNFINISHED/.planning/recon" && printf 'answer
' > "$UNFINISHED/.planning/recon/a.md"
run discard "$UNFINISHED"
check "discard: a plan folder without PLAN.md is removed with its recon, exit 0" \
    '[[ $LAST_CODE -eq 0 ]] && grep -q "^DISCARDED " <<< "$LAST_OUT" && [[ ! -e "$UNFINISHED" ]]' "$LAST_OUT"
run discard "$DEMO"
check "discard of a finished plan: holds a finished plan, exit 3, nothing removed" \
    '[[ $LAST_CODE -eq 3 ]] && grep -qF "holds a finished plan" <<< "$LAST_OUT" && [[ -f "$DEMO/PLAN.md" ]] && [[ -f "$DEMO/phase-01-trade.md" ]]' "$LAST_OUT"

OUTSIDE_UNFINISHED="$TMP_ROOT/elsewhere/unfinished2"
mkdir -p "$OUTSIDE_UNFINISHED" && with_planning "$OUTSIDE_UNFINISHED"
run discard "$OUTSIDE_UNFINISHED"
check "discard outside .unikit/code/plans: refusing to discard, exit 1, nothing removed" \
    '[[ $LAST_CODE -eq 1 ]] && grep -qF "refusing to discard" <<< "$LAST_OUT" && [[ -f "$OUTSIDE_UNFINISHED/.planning/STATE.md" ]]' "$LAST_OUT"
run discard "$PLANS"
check "discard of the plans folder itself: refusing to discard, exit 1, nothing removed" \
    '[[ $LAST_CODE -eq 1 ]] && grep -qF "refusing to discard" <<< "$LAST_OUT" && [[ -f "$DEMO/PLAN.md" ]]' "$LAST_OUT"
mkdir -p "$DEMO/nested" && with_planning "$DEMO/nested"
run discard "$DEMO/nested"
check "discard of a folder nested inside a plan: refusing to discard, exit 1, nothing removed" \
    '[[ $LAST_CODE -eq 1 ]] && grep -qF "refusing to discard" <<< "$LAST_OUT" && [[ -f "$DEMO/nested/.planning/STATE.md" ]]' "$LAST_OUT"
run discard "$PLANS/missing"
check "discard of a missing folder: not a directory, exit 1" \
    '[[ $LAST_CODE -eq 1 ]] && grep -qF "not a directory" <<< "$LAST_OUT"' "$LAST_OUT"
run discard
check "discard without an argument prints the usage, exit 1" '[[ $LAST_CODE -eq 1 ]] && grep -qF "Usage:" <<< "$LAST_OUT"' "$LAST_OUT"

echo -e "\n${BOLD}Part 4: wiring${NC}"
check "unikit-plan grants node" 'grep -qxF "  - Bash(node *)" "$PLAN_SKILL"'
check "plan-bundle.mjs stays within 500 lines" '[[ $(wc -l < "$BUNDLE") -le 500 ]]'
check "plan-bundle.mjs imports builtin node: modules only" '[[ -z "$(grep -E "^import .* from '"'"'" "$BUNDLE" | grep -v "from '"'"'node:")" ]]'
check "USAGE names finalize <plan-dir> | discard <plan-dir>" 'grep -qF "finalize <plan-dir> | discard <plan-dir>" "$BUNDLE"'
check "NEGATIVE: no .unikit/code/.planning literal left in plan-bundle.mjs" '! grep -qF ".unikit/code/.planning" "$BUNDLE"'

echo -e "\n${BOLD}=== Results ===${NC}"
echo -e "  Total:    $TOTAL"
echo -e "  Passed:   ${GREEN}$PASSED${NC}"
echo -e "  Failed:   ${RED}$FAILED${NC}"
if [[ $FAILED -gt 0 ]]; then
    echo -e "\n${RED}TESTS FAILED${NC}\n"
    exit 1
fi
echo -e "\n${GREEN}ALL TESTS PASSED${NC}\n"
