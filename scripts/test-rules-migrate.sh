#!/bin/bash
# Smoke tests: validates `unikit-ai rules registry migrate [path]` — the
# maintainer on-disk schema:1 → schema:2 relocation.
#
# Scope:
#   - schema:1 local registry → relocated under code/<engine>/, manifest
#     rewritten to a clean schema:2 (modules-only, no top-level engines), exit 0
#   - idempotency: a 2nd migrate is a sha-stable no-op ("already at schema:2")
#   - an already-schema:2 registry → no-op, exit 0
#   - schema:99 (unmigratable) → exit 5 (VALIDATION_FAILED)
#   - missing target manifest → exit 1 (NOT_FOUND)
#   - no path + configured registry is remote/unset → exit 3 (INVALID_ARGS)
#   - no path + configured registry is local → resolves and migrates it
#
# Usage: ./scripts/test-rules-migrate.sh

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

# schema_of <manifest_file> — print the integer `schema` field.
schema_of() {
    grep -o '"schema"[^,]*' "$1" | head -1 | grep -o '[0-9]\+'
}

# Style-B path checks (count into PASS/FAIL instead of hard-exiting).
check_exists() { [[ -e "$1" ]] && pass "$2" || fail "$2 (missing: $1)"; }
check_absent() { [[ ! -e "$1" ]] && pass "$2" || fail "$2 (should not exist: $1)"; }

echo -e "${BOLD}=== rules registry migrate Smoke Tests ===${NC}"

# ─────────────────────────────────────────────
# Scenario 1: migrate a schema:1 local registry → schema:2 relocation
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 1: schema:1 → schema:2 relocation${NC}"

REG1="$TMPDIR/reg1"
cp -r "$ROOT_DIR/scripts/test-fixtures/minimal-valid" "$REG1"

check_exists "$REG1/unity/core/code-style.md" "pre: flat unity/ layout present"
[[ "$(schema_of "$REG1/manifest.json")" == "1" ]] && pass "pre: manifest schema:1" || fail "pre: manifest not schema:1"

capture_stdout_exit "$TMPDIR/m1.log" node "$CLI" rules registry migrate "$REG1"
assert_exit 0 "$CAPTURED_EXIT" "migrate schema:1 exits 0" "$TMPDIR/m1.log"
assert_stdout_contains "$TMPDIR/m1.log" "migrated to schema:2" "row1 reports migration"
assert_stdout_contains "$TMPDIR/m1.log" "registry-1-to-2-code-wrap" "row1 reports applied migration id"

check_exists "$REG1/code/unity/core/code-style.md" "post: unity relocated under code/"
check_exists "$REG1/code/godot/core/code-style.md" "post: godot relocated under code/"
check_absent "$REG1/unity" "post: flat unity/ removed"
[[ "$(schema_of "$REG1/manifest.json")" == "2" ]] && pass "post: manifest schema:2" || fail "post: manifest not schema:2"

# On-disk schema:2 is modules-only: no TOP-LEVEL `engines` sibling of `modules`
# (the engine map lives at modules.code.engines). Read via stdin so node does
# not have to resolve the bash temp path.
TOP_ENGINES=$(node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const m=JSON.parse(d);console.log(('engines' in m)?'yes':'no')})" < "$REG1/manifest.json")
[[ "$TOP_ENGINES" == "no" ]] && pass "post: no top-level engines (modules-only)" || fail "post: unexpected top-level engines in on-disk manifest"
CODE_ENGINES=$(node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const m=JSON.parse(d);console.log((m.modules&&m.modules.code&&m.modules.code.engines&&('unity' in m.modules.code.engines))?'yes':'no')})" < "$REG1/manifest.json")
[[ "$CODE_ENGINES" == "yes" ]] && pass "post: modules.code.engines.unity present" || fail "post: modules.code.engines.unity missing"

# ─────────────────────────────────────────────
# Scenario 2: idempotency — 2nd migrate is a sha-stable no-op
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 2: idempotent 2nd run${NC}"

SHA_BEFORE="$(sha_of "$REG1/manifest.json")"
capture_stdout_exit "$TMPDIR/m2.log" node "$CLI" rules registry migrate "$REG1"
assert_exit 0 "$CAPTURED_EXIT" "2nd migrate exits 0" "$TMPDIR/m2.log"
assert_stdout_contains "$TMPDIR/m2.log" "already at schema:2" "row2 reports no-op"
assert_file_unchanged "$REG1/manifest.json" "$SHA_BEFORE" "row2 manifest byte-stable"

# ─────────────────────────────────────────────
# Scenario 3: already-schema:2 registry → no-op
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 3: already schema:2${NC}"

REG2="$TMPDIR/reg2"
cp -r "$ROOT_DIR/scripts/test-fixtures/schema2-valid" "$REG2"
capture_stdout_exit "$TMPDIR/m3.log" node "$CLI" rules registry migrate "$REG2"
assert_exit 0 "$CAPTURED_EXIT" "migrate already-schema:2 exits 0" "$TMPDIR/m3.log"
assert_stdout_contains "$TMPDIR/m3.log" "already at schema:2" "row3 reports no-op"
check_exists "$REG2/code/unity/core/code-style.md" "row3 code/ layout untouched"

# ─────────────────────────────────────────────
# Scenario 4: schema:99 → exit 5 (VALIDATION_FAILED)
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 4: unsupported schema:99${NC}"

REG99="$TMPDIR/reg99"
cp -r "$ROOT_DIR/scripts/test-fixtures/unsupported-schema" "$REG99"
capture_stdout_exit "$TMPDIR/m4.log" node "$CLI" rules registry migrate "$REG99"
assert_exit 5 "$CAPTURED_EXIT" "migrate schema:99 exits 5" "$TMPDIR/m4.log"
assert_stdout_contains "$TMPDIR/m4.log" "schema" "row4 reports a schema error"

# ─────────────────────────────────────────────
# Scenario 5: missing target manifest → exit 1 (NOT_FOUND)
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 5: missing manifest${NC}"

EMPTY="$TMPDIR/empty"
mkdir -p "$EMPTY"
capture_stdout_exit "$TMPDIR/m5.log" node "$CLI" rules registry migrate "$EMPTY"
assert_exit 1 "$CAPTURED_EXIT" "migrate with no manifest exits 1 (NOT_FOUND)" "$TMPDIR/m5.log"

# ─────────────────────────────────────────────
# Scenario 6: no path + remote configured registry → exit 3 (INVALID_ARGS)
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 6: no-path against a remote registry${NC}"

PROJ_REMOTE="$TMPDIR/proj-remote"
mkdir -p "$PROJ_REMOTE/.unikit/memory/code/core" "$PROJ_REMOTE/.unikit/memory/code/stack"
cat > "$PROJ_REMOTE/.unikit.json" <<JSON
{
  "version": "1.0.0",
  "engine": "unity",
  "agents": [{"id":"claude","installedSkills":[],"installedSubagents":[]}],
  "rulesRegistry": "https://github.com/NintendaDev/unikit-ai-rules",
  "rules": { "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } } },
  "managedSkills": {}
}
JSON
capture_stdout_exit "$TMPDIR/m6.log" env -C "$PROJ_REMOTE" node "$CLI" rules registry migrate
assert_exit 3 "$CAPTURED_EXIT" "no-path remote registry exits 3 (INVALID_ARGS)" "$TMPDIR/m6.log"
assert_stdout_contains "$TMPDIR/m6.log" "No local registry to migrate" "row6 explains remote can't migrate"

# ─────────────────────────────────────────────
# Scenario 7: no path + LOCAL configured registry → migrates it
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 7: no-path against a local registry (config-resolved)${NC}"

REG7="$TMPDIR/reg7"
cp -r "$ROOT_DIR/scripts/test-fixtures/minimal-valid" "$REG7"
REG7_JSON="$(normalize_path_for_json "$REG7")"
PROJ_LOCAL="$TMPDIR/proj-local"
mkdir -p "$PROJ_LOCAL/.unikit/memory/code/core" "$PROJ_LOCAL/.unikit/memory/code/stack"
cat > "$PROJ_LOCAL/.unikit.json" <<JSON
{
  "version": "1.0.0",
  "engine": "unity",
  "agents": [{"id":"claude","installedSkills":[],"installedSubagents":[]}],
  "rulesRegistry": "$REG7_JSON",
  "rules": { "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } } },
  "managedSkills": {}
}
JSON
capture_stdout_exit "$TMPDIR/m7.log" env -C "$PROJ_LOCAL" node "$CLI" rules registry migrate
assert_exit 0 "$CAPTURED_EXIT" "no-path local registry exits 0" "$TMPDIR/m7.log"
assert_stdout_contains "$TMPDIR/m7.log" "migrated to schema:2" "row7 migrated the configured local registry"
check_exists "$REG7/code/unity/core/code-style.md" "row7 configured registry relocated under code/"

print_summary_and_exit "rules registry migrate Smoke Tests"
