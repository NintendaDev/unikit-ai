#!/bin/bash
# Smoke tests: `unikit-ai genres list`.
#
# Scope:
#   - bundled catalog count matches data/gamedesign/genres/*.json (no registry,
#     no network — the catalog is bundled)
#   - --json shape + human⇄json parity (every human column is a JSON field)
#   - installed marker reflects config.genres.installed (a missing config is NOT
#     an error — list still works, all uninstalled, exit 0)
#
# Usage: ./scripts/test-genres-list.sh

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

echo -e "${BOLD}=== genres list Smoke Tests ===${NC}"

# ── Scenario 1: bundled catalog, no config (still exit 0) ──
echo -e "\n${BOLD}Scenario 1: list without config${NC}"
S1="$TMPDIR/s1-no-config"; mkdir -p "$S1"
assert_cmd_exit 0 "genres list without config exits 0" "$TMPDIR/s1.log" -- \
    env -C "$S1" node "$CLI" genres list --json

# count == number of bundled profile files
FILE_COUNT=$(find "$GENRES_DATA" -name '*.json' | wc -l | tr -d ' ')
( cd "$S1" && node "$CLI" genres list --json > "$TMPDIR/s1.json" 2>/dev/null )
assert_json_array_length "$TMPDIR/s1.json" "genres" "$FILE_COUNT" "list count == bundled file count"

# anchors present (strictly-from-matrix ids)
for id in tycoon match3 ccg roguelike; do
    assert_stdout_contains "$TMPDIR/s1.json" "\"id\": \"$id\"" "list contains '$id'"
done

# without config, every profile is uninstalled
if node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); process.exit(j.genres.every(g=>g.installed===false)?0:1)" "$TMPDIR/s1.json"; then
    pass "list without config marks every profile installed=false"
else
    fail "list without config has a profile marked installed=true"
fi

# ── Scenario 2: human⇄json parity ──
echo -e "\n${BOLD}Scenario 2: human/json parity${NC}"
( cd "$S1" && node "$CLI" genres list > "$TMPDIR/s1.human" 2>/dev/null )
# every JSON row field has a human column header
for col in Confidence Flow Installed; do
    assert_stdout_contains "$TMPDIR/s1.human" "$col" "human header has '$col' column"
done
assert_stdout_contains "$TMPDIR/s1.human" "tycoon" "human lists 'tycoon'"
# json rows carry the parity fields
if node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); const r=j.genres[0]; process.exit(['id','name','confidence','default_flow_mode','installed'].every(k=>k in r)?0:1)" "$TMPDIR/s1.json"; then
    pass "json rows carry id/name/confidence/default_flow_mode/installed (parity)"
else
    fail "json rows missing a parity field"
fi

# ── Scenario 3: installed marker from config ──
echo -e "\n${BOLD}Scenario 3: installed marker${NC}"
S3="$TMPDIR/s3-installed"
write_unikit_config_genres "$S3" "unity" "$(json_genre_entries tycoon)"
( cd "$S3" && node "$CLI" genres list --json > "$TMPDIR/s3.json" 2>/dev/null )
if node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); const t=j.genres.find(g=>g.id==='tycoon'); const m=j.genres.find(g=>g.id==='match3'); process.exit(t.installed===true && m.installed===false ?0:1)" "$TMPDIR/s3.json"; then
    pass "installed marker: tycoon=true, match3=false"
else
    fail "installed marker did not reflect config.genres.installed"
fi

print_summary_and_exit "genres list Smoke Tests"
