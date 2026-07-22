#!/bin/bash
# Test suite: genre-profile catalog (accessor, CLI, config state, bundled JSON).
# Mirror of test-rules.sh. Usage: ./scripts/test-genres.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

PASSED=0
FAILED=0
TOTAL=0

pass() { PASSED=$((PASSED + 1)); TOTAL=$((TOTAL + 1)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { FAILED=$((FAILED + 1)); TOTAL=$((TOTAL + 1)); echo -e "  ${RED}✗${NC} $1"; }

echo -e "${BOLD}=== Genre Profile Tests ===${NC}"

# ─────────────────────────────────────────────
# Part 1: accessor + CLI + config + contract surface
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part 1: genre surface${NC}"

GENRES_TS="$ROOT_DIR/src/core/genres.ts"
for sym in "interface GenreProfile" "function loadGenreProfile" "function listGenreProfiles" "function resolveGenre"; do
    if grep -q "$sym" "$GENRES_TS" 2>/dev/null; then
        pass "genres.ts has $sym"
    else
        fail "genres.ts missing $sym"
    fi
done

CONFIG_TS="$ROOT_DIR/src/core/config.ts"
if grep -q "interface GenreInstallEntry" "$CONFIG_TS" && grep -q "getInstalledGenres" "$CONFIG_TS"; then
    pass "config.ts has GenreInstallEntry + getInstalledGenres"
else
    fail "config.ts missing GenreInstallEntry or getInstalledGenres"
fi

SYSTEM_ASSETS_TS="$ROOT_DIR/src/core/installer/system-assets.ts"
if grep -q "function installGenreProfiles" "$SYSTEM_ASSETS_TS"; then
    pass "system-assets.ts has installGenreProfiles"
else
    fail "system-assets.ts missing installGenreProfiles"
fi

CONSTANTS_TS="$ROOT_DIR/src/core/constants.ts"
if grep -q "systemGamedesignGenresDir" "$CONSTANTS_TS"; then
    pass "constants.ts has systemGamedesignGenresDir"
else
    fail "constants.ts missing systemGamedesignGenresDir"
fi

CLI_INDEX="$ROOT_DIR/src/cli/index.ts"
if grep -q "command('genres')" "$CLI_INDEX"; then
    pass "CLI registers 'genres' command group"
else
    fail "CLI missing 'genres' command group"
fi
for sub in list show install; do
    if grep -qE "command\('$sub" "$CLI_INDEX"; then
        pass "CLI registers 'genres $sub' subcommand"
    else
        fail "CLI missing 'genres $sub' subcommand"
    fi
done

# cli-contract.md (generated) carries the Genres Commands section
CLI_CONTRACT="$ROOT_DIR/data/cli-contract.md"
if grep -q "Genres Commands" "$CLI_CONTRACT" && grep -q "genres install" "$CLI_CONTRACT"; then
    pass "cli-contract.md carries the Genres Commands section"
else
    fail "cli-contract.md missing Genres Commands section"
fi

# init.ts + update.ts wire the selective delivery
for f in init update; do
    if grep -q "installGenreProfiles" "$ROOT_DIR/src/cli/commands/$f.ts"; then
        pass "$f.ts wires installGenreProfiles"
    else
        fail "$f.ts missing installGenreProfiles wiring"
    fi
done

# ─────────────────────────────────────────────
# Part 2: profile-schema validation (structural, NOT cross-ref)
# ─────────────────────────────────────────────
# Every data/gamedesign/genres/*.json carries the required fields with valid
# enum values, id == basename, and exact key order. Structural ONLY — it does
# NOT cross-ref the existence of referenced packs/CTs (forward-refs to not-yet-
# built P1 packs / narrative CTs are legitimate), so the catalog can grow safely.
echo -e "\n${BOLD}Part 2: bundled profile schema${NC}"

if node "$SCRIPT_DIR/genres-validate.mjs" "$ROOT_DIR/data/gamedesign/genres" > "$ROOT_DIR/.genres-validate.log" 2>&1; then
    COUNT=$(grep -oE '[0-9]+ profiles checked' "$ROOT_DIR/.genres-validate.log" | grep -oE '^[0-9]+')
    pass "all ${COUNT:-?} bundled profiles pass structural schema validation"
else
    fail "bundled profile schema validation FAILED:"
    cat "$ROOT_DIR/.genres-validate.log"
fi
rm -f "$ROOT_DIR/.genres-validate.log"

# ─────────────────────────────────────────────
# Part 3-5: CLI smoke tests
# ─────────────────────────────────────────────
run_nested_test() {
    local label="$1"; local file="$2"
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

run_nested_test "Part 3: genres list smoke tests" "$SCRIPT_DIR/test-genres-list.sh"
run_nested_test "Part 4: genres show smoke tests" "$SCRIPT_DIR/test-genres-show.sh"
run_nested_test "Part 5: genres install smoke tests" "$SCRIPT_DIR/test-genres-install.sh"

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
