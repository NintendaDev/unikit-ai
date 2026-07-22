#!/bin/bash
# Smoke tests: `unikit-ai genres show <id|alias>`.
#
# Scope:
#   - show a valid profile (--json = the full profile object) + human⇄json parity
#   - resolve by alias (case-insensitive id OR alias)
#   - unresolvable id → exit 1; empty arg → exit 3
#   - bundled read needs NO .unikit.json
#
# Usage: ./scripts/test-genres-show.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=./test-fixtures.sh
source "$SCRIPT_DIR/test-fixtures.sh"
ensure_build

CLI="$ROOT_DIR/dist/cli/index.js"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo -e "${BOLD}=== genres show Smoke Tests ===${NC}"

S="$TMPDIR/proj"; mkdir -p "$S"

# ── Scenario 1: valid profile, --json is the full object ──
echo -e "\n${BOLD}Scenario 1: show tycoon --json${NC}"
assert_cmd_exit 0 "show tycoon exits 0" "$TMPDIR/show.log" -- \
    env -C "$S" node "$CLI" genres show tycoon --json
( cd "$S" && node "$CLI" genres show tycoon --json > "$TMPDIR/tycoon.json" 2>/dev/null )
assert_json_field "$TMPDIR/tycoon.json" "id" "tycoon" "show --json id"
assert_json_field "$TMPDIR/tycoon.json" "confidence" "high" "show --json confidence"
assert_json_field "$TMPDIR/tycoon.json" "default_flow_mode" "emergent" "show --json flow"
assert_json_field "$TMPDIR/tycoon.json" "schema_version" "1" "show --json schema_version"
# full object carries every required field
if node -e "const p=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); const req=['schema_version','version','id','name','aliases','summary','confidence','default_flow_mode','default_packs','seed_systems','seed_content_types','seed_entities','seed_resources','critical_sections','review_emphasis']; process.exit(req.every(k=>k in p)?0:1)" "$TMPDIR/tycoon.json"; then
    pass "show --json carries every required field"
else
    fail "show --json missing a required field"
fi

# ── Scenario 2: human⇄json parity ──
echo -e "\n${BOLD}Scenario 2: human/json parity${NC}"
( cd "$S" && node "$CLI" genres show tycoon > "$TMPDIR/tycoon.human" 2>/dev/null )
# human surfaces the same facts the json object carries
assert_stdout_contains "$TMPDIR/tycoon.human" "tycoon" "human shows id"
assert_stdout_contains "$TMPDIR/tycoon.human" "high" "human shows confidence"
assert_stdout_contains "$TMPDIR/tycoon.human" "emergent" "human shows flow"
assert_stdout_contains "$TMPDIR/tycoon.human" "Critical sections" "human shows critical_sections"
assert_stdout_contains "$TMPDIR/tycoon.human" "Review emphasis" "human shows review_emphasis"
assert_stdout_contains "$TMPDIR/tycoon.human" "Seed systems" "human shows seed_systems"

# ── Scenario 3: alias resolution ──
echo -e "\n${BOLD}Scenario 3: alias resolution${NC}"
( cd "$S" && node "$CLI" genres show management --json > "$TMPDIR/alias.json" 2>/dev/null )
assert_json_field "$TMPDIR/alias.json" "id" "tycoon" "alias 'management' resolves to tycoon"
# case-insensitive id
( cd "$S" && node "$CLI" genres show MATCH-3 --json > "$TMPDIR/ci.json" 2>/dev/null )
assert_json_field "$TMPDIR/ci.json" "id" "match3" "case-insensitive id 'MATCH-3' resolves"

# ── Scenario 4: exit codes ──
echo -e "\n${BOLD}Scenario 4: exit codes${NC}"
assert_cmd_exit 1 "show unknown id exits 1" "$TMPDIR/unk.log" -- \
    env -C "$S" node "$CLI" genres show unknownxyz
assert_cmd_exit 3 "show empty arg exits 3" "$TMPDIR/empty.log" -- \
    env -C "$S" node "$CLI" genres show ""

print_summary_and_exit "genres show Smoke Tests"
