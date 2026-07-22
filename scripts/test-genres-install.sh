#!/bin/bash
# Smoke tests: `unikit-ai genres install <id|alias...>`.
#
# This is the CLI-driven install→deliver→refresh smoke (the bare init/update
# smoke can't exercise it — delivery is selective on config.genres.installed, so
# a bare init delivers nothing). Scope:
#   - no .unikit.json → exit 1; no args → exit 3; every id unknown → exit 1
#   - install copies the profile into .unikit/system/gamedesign/genres/<id>.json
#     (NO engine-var substitution) and records state (canonical id)
#   - idempotent (↻ already installed) + --force re-copies
#   - alias resolution records the canonical id
#   - tamper + --force refreshes the on-disk file from the bundled source
#   - orphan-delete: a profile dropped from state is removed on next delivery
#
# Usage: ./scripts/test-genres-install.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=./test-fixtures.sh
source "$SCRIPT_DIR/test-fixtures.sh"
ensure_build

CLI="$ROOT_DIR/dist/cli/index.js"
GENRES_DATA="$ROOT_DIR/data/gamedesign/genres"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo -e "${BOLD}=== genres install Smoke Tests ===${NC}"

GENRES_DEST=".unikit/system/gamedesign/genres"

# ── Scenario 1: error exits ──
echo -e "\n${BOLD}Scenario 1: error exits${NC}"
S1="$TMPDIR/s1-no-config"; mkdir -p "$S1"
assert_cmd_exit 1 "install without .unikit.json exits 1" "$TMPDIR/s1.log" -- \
    env -C "$S1" node "$CLI" genres install tycoon
S1B="$TMPDIR/s1b"; write_unikit_config_genres "$S1B" "unity"
assert_cmd_exit 3 "install no args exits 3" "$TMPDIR/s1b.log" -- \
    env -C "$S1B" node "$CLI" genres install
assert_cmd_exit 1 "install only-unknown id exits 1" "$TMPDIR/s1c.log" -- \
    env -C "$S1B" node "$CLI" genres install unknownxyz

# ── Scenario 2: install delivers + records state ──
echo -e "\n${BOLD}Scenario 2: install delivers + records state${NC}"
S2="$TMPDIR/s2"; write_unikit_config_genres "$S2" "unity"
assert_cmd_exit 0 "install tycoon exits 0" "$TMPDIR/s2.log" -- \
    env -C "$S2" node "$CLI" genres install tycoon
assert_exists "$S2/$GENRES_DEST/tycoon.json" "tycoon.json delivered to system dir"
# delivered file byte-equal to the bundled source (flat copy, no substitution)
if [[ "$(sha_of "$S2/$GENRES_DEST/tycoon.json")" == "$(sha_of "$GENRES_DATA/tycoon.json")" ]]; then
    pass "delivered tycoon.json is byte-equal to bundled source"
else
    fail "delivered tycoon.json differs from bundled source"
fi
assert_not_contains "$S2/$GENRES_DEST/tycoon.json" '\{\{' "delivered profile carries no engine-var tokens"
# state recorded
( cd "$S2" && node "$CLI" genres list --json > "$TMPDIR/s2.json" 2>/dev/null )
if node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); process.exit(j.genres.find(g=>g.id==='tycoon').installed?0:1)" "$TMPDIR/s2.json"; then
    pass "tycoon recorded in state (installed=true)"
else
    fail "tycoon not recorded in state"
fi

# ── Scenario 3: idempotency + --force ──
echo -e "\n${BOLD}Scenario 3: idempotency + --force${NC}"
( cd "$S2" && node "$CLI" genres install tycoon > "$TMPDIR/idem.log" 2>&1 )
assert_stdout_contains "$TMPDIR/idem.log" "already installed" "re-install prints '↻ already installed'"
assert_cmd_exit 0 "install --force exits 0" "$TMPDIR/force.log" -- \
    env -C "$S2" node "$CLI" genres install tycoon --force
assert_stdout_contains "$TMPDIR/force.log" "installed tycoon" "--force re-installs"

# ── Scenario 4: alias records canonical id ──
echo -e "\n${BOLD}Scenario 4: alias install${NC}"
S4="$TMPDIR/s4"; write_unikit_config_genres "$S4" "unity"
( cd "$S4" && node "$CLI" genres install management > /dev/null 2>&1 )
assert_exists "$S4/$GENRES_DEST/tycoon.json" "alias 'management' delivers tycoon.json (canonical id)"

# ── Scenario 5: tamper + --force refreshes ──
echo -e "\n${BOLD}Scenario 5: tamper-refresh${NC}"
echo 'CORRUPT' > "$S2/$GENRES_DEST/tycoon.json"
( cd "$S2" && node "$CLI" genres install tycoon --force > /dev/null 2>&1 )
if [[ "$(sha_of "$S2/$GENRES_DEST/tycoon.json")" == "$(sha_of "$GENRES_DATA/tycoon.json")" ]]; then
    pass "tampered tycoon.json refreshed from bundled source on --force"
else
    fail "tampered tycoon.json NOT refreshed"
fi

# ── Scenario 6: orphan-delete ──
echo -e "\n${BOLD}Scenario 6: orphan-delete${NC}"
S6="$TMPDIR/s6"; write_unikit_config_genres "$S6" "unity"
( cd "$S6" && node "$CLI" genres install tycoon match3 > /dev/null 2>&1 )
assert_exists "$S6/$GENRES_DEST/match3.json" "match3.json delivered"
# drop match3 from state, then force a re-delivery → installGenreProfiles orphan-deletes it
CONFIG="$S6/.unikit.json" node -e "
    const fs=require('fs'); const f=process.env.CONFIG;
    const c=JSON.parse(fs.readFileSync(f,'utf8'));
    c.genres.installed = c.genres.installed.filter(e=>e.id!=='match3');
    fs.writeFileSync(f, JSON.stringify(c,null,2));
"
( cd "$S6" && node "$CLI" genres install tycoon --force > /dev/null 2>&1 )
assert_not_exists "$S6/$GENRES_DEST/match3.json" "match3.json orphan-deleted after dropped from state"
assert_exists "$S6/$GENRES_DEST/tycoon.json" "tycoon.json retained (still in state)"

print_summary_and_exit "genres install Smoke Tests"
