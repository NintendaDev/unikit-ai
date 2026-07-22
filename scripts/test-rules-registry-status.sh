#!/bin/bash
# Smoke tests: validates `unikit-ai rules registry status [target] [--json]`.
#
# A 6-row matrix over (physical schema) × (local | remote) + unreachable:
#
#   #  target              kind    schema  verdict                              exit
#   1  local fixture       local   1       ⚠ run `rules registry migrate`        0
#   2  local fixture       local   2       ✓ up to date and writable             0
#   3  local fixture       local   99      ✗ unsupported schema 99               5
#   4  http (refused)      remote  null    ✗ unreachable                         2
#   5  http (served)       remote  2       • remote, read-only via CLI           0
#   6  http (served)       remote  1       ⚠ remote — migrate can't write        0
#
# Rows 5/6 serve a fixture over a local Node HTTP server (GitRegistry fetches
# `<url>/manifest.json`). The raw physical schema is asserted — NOT a normalized
# one — because the command reads a single-source transport with no fallback.
#
# The JSON shape is exactly 6 facts: target, kind, schema, isLatestSchema,
# readable, writable. Derived hints (a `migrate?` flag, action strings) are the
# consumer's job and must NOT appear in the JSON.
#
# Usage: ./scripts/test-rules-registry-status.sh

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

# ─────────────────────────────────────────────
# Local Node static file server for the remote rows. GitRegistry fetches
# `<baseUrl>/manifest.json`; serving the fixture root over HTTP makes the
# command treat it as a reachable remote registry. Killed on EXIT.
# ─────────────────────────────────────────────
SERVER_PID=""
SERVER_SCRIPT="$TMPDIR/serve.cjs"
cat > "$SERVER_SCRIPT" <<'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
const port = parseInt(process.argv[3], 10);
http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const p = path.join(root, rel);
  fs.readFile(p, (err, data) => {
    if (err) { res.statusCode = 404; res.end('not found'); }
    else { res.statusCode = 200; res.end(data); }
  });
}).listen(port, '127.0.0.1', () => console.log('LISTENING ' + port));
EOF

cleanup() {
    [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID" 2> /dev/null
    rm -rf "$TMPDIR"
}
trap cleanup EXIT

# start_server <fixture_root> <port> — backgrounds the static server and polls
# until the manifest is fetchable (or gives up after ~4s, leaving the row to
# fail loudly rather than hang).
start_server() {
    local root="$1"
    local port="$2"
    node "$SERVER_SCRIPT" "$root" "$port" > "$TMPDIR/server.log" 2>&1 &
    SERVER_PID=$!
    local i
    for i in $(seq 1 20); do
        if node -e "fetch('http://127.0.0.1:$port/manifest.json').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2> /dev/null; then
            return 0
        fi
        sleep 0.2
    done
    return 1
}

stop_server() {
    [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID" 2> /dev/null
    SERVER_PID=""
}

# run_status_json <target> <out_json> — captures stdout-only JSON (stderr holds
# GitRegistry warnings that would otherwise corrupt the JSON file) and the exit
# code into RC.
run_status_json() {
    set +e
    node "$CLI" rules registry status "$1" --json > "$2" 2> "$TMPDIR/status.err"
    RC=$?
    set -e
}

# run_status_human <target> <out_txt> — NO_COLOR so chalk emits plain verdict
# strings the asserts can grep without ANSI noise.
run_status_human() {
    set +e
    NO_COLOR=1 node "$CLI" rules registry status "$1" > "$2" 2> /dev/null
    set -e
}

FIX_S1="$(fake_registry_path minimal-valid)"
FIX_S2="$(fake_registry_path schema2-valid)"
FIX_S99="$(fake_registry_path unsupported-schema)"

echo -e "${BOLD}=== rules registry status Smoke Tests ===${NC}"

# ─────────────────────────────────────────────
# Row 1: local schema:1 → readable, not writable, exit 0, ⚠ migrate
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Row 1: local schema:1${NC}"
run_status_json "$FIX_S1" "$TMPDIR/r1.json"
assert_exit 0 "$RC" "local schema:1 exits 0"
assert_json_field "$TMPDIR/r1.json" kind local "row1 kind"
assert_json_field "$TMPDIR/r1.json" schema 1 "row1 schema"
assert_json_field "$TMPDIR/r1.json" isLatestSchema false "row1 isLatestSchema"
assert_json_field "$TMPDIR/r1.json" readable true "row1 readable"
assert_json_field "$TMPDIR/r1.json" writable false "row1 writable"
run_status_human "$FIX_S1" "$TMPDIR/r1.txt"
assert_stdout_contains "$TMPDIR/r1.txt" "rules registry migrate" "row1 verdict suggests migrate"

# ─────────────────────────────────────────────
# Row 2: local schema:2 → writable, exit 0, ✓ up to date
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Row 2: local schema:2${NC}"
run_status_json "$FIX_S2" "$TMPDIR/r2.json"
assert_exit 0 "$RC" "local schema:2 exits 0"
assert_json_field "$TMPDIR/r2.json" kind local "row2 kind"
assert_json_field "$TMPDIR/r2.json" schema 2 "row2 schema"
assert_json_field "$TMPDIR/r2.json" isLatestSchema true "row2 isLatestSchema"
assert_json_field "$TMPDIR/r2.json" readable true "row2 readable"
assert_json_field "$TMPDIR/r2.json" writable true "row2 writable"
run_status_human "$FIX_S2" "$TMPDIR/r2.txt"
assert_stdout_contains "$TMPDIR/r2.txt" "up to date and writable" "row2 verdict up to date"

# Derived-hint regression guard: JSON carries ONLY the 6 facts.
echo -e "\n${BOLD}JSON shape guard (6 facts only)${NC}"
for forbidden in message state action migratable verdict; do
    if grep -q "\"$forbidden\"" "$TMPDIR/r2.json"; then
        fail "JSON must not carry derived field '$forbidden'"
    else
        pass "JSON omits derived field '$forbidden'"
    fi
done

# ─────────────────────────────────────────────
# Row 3: local schema:99 → unsupported, exit 5
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Row 3: local schema:99${NC}"
run_status_json "$FIX_S99" "$TMPDIR/r3.json"
assert_exit 5 "$RC" "local schema:99 exits 5 (VALIDATION_FAILED)"
assert_json_field "$TMPDIR/r3.json" schema 99 "row3 schema"
assert_json_field "$TMPDIR/r3.json" readable false "row3 readable"
assert_json_field "$TMPDIR/r3.json" writable false "row3 writable"
run_status_human "$FIX_S99" "$TMPDIR/r3.txt"
assert_stdout_contains "$TMPDIR/r3.txt" "unsupported schema 99" "row3 verdict unsupported"

# ─────────────────────────────────────────────
# Row 4: remote unreachable → schema null, exit 2
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Row 4: remote unreachable${NC}"
run_status_json "http://127.0.0.1:1" "$TMPDIR/r4.json"
assert_exit 2 "$RC" "remote unreachable exits 2 (NETWORK_ERROR)"
assert_json_field "$TMPDIR/r4.json" kind remote "row4 kind"
assert_json_field "$TMPDIR/r4.json" schema null "row4 schema null"
assert_json_field "$TMPDIR/r4.json" readable false "row4 readable"
run_status_human "http://127.0.0.1:1" "$TMPDIR/r4.txt"
assert_stdout_contains "$TMPDIR/r4.txt" "unreachable" "row4 verdict unreachable"

# ─────────────────────────────────────────────
# Row 5: remote reachable schema:2 → read-only, exit 0
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Row 5: remote schema:2 (served)${NC}"
if start_server "$ROOT_DIR/scripts/test-fixtures/schema2-valid" 18731; then
    run_status_json "http://127.0.0.1:18731" "$TMPDIR/r5.json"
    assert_exit 0 "$RC" "remote schema:2 exits 0"
    assert_json_field "$TMPDIR/r5.json" kind remote "row5 kind"
    assert_json_field "$TMPDIR/r5.json" schema 2 "row5 schema"
    assert_json_field "$TMPDIR/r5.json" isLatestSchema true "row5 isLatestSchema"
    assert_json_field "$TMPDIR/r5.json" writable false "row5 writable (remote never writable)"
    run_status_human "http://127.0.0.1:18731" "$TMPDIR/r5.txt"
    assert_stdout_contains "$TMPDIR/r5.txt" "remote, read-only via CLI" "row5 verdict remote read-only"
    stop_server
else
    stop_server
    fail "row5: could not start local HTTP server on :18731 (remote schema:2 not exercised)"
fi

# ─────────────────────────────────────────────
# Row 6: remote reachable schema:1 → behind, exit 0, ⚠ clone/upstream
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Row 6: remote schema:1 (served)${NC}"
if start_server "$ROOT_DIR/scripts/test-fixtures/minimal-valid" 18732; then
    run_status_json "http://127.0.0.1:18732" "$TMPDIR/r6.json"
    assert_exit 0 "$RC" "remote schema:1 exits 0"
    assert_json_field "$TMPDIR/r6.json" kind remote "row6 kind"
    assert_json_field "$TMPDIR/r6.json" schema 1 "row6 schema"
    assert_json_field "$TMPDIR/r6.json" isLatestSchema false "row6 isLatestSchema"
    assert_json_field "$TMPDIR/r6.json" writable false "row6 writable false"
    run_status_human "http://127.0.0.1:18732" "$TMPDIR/r6.txt"
    assert_stdout_contains "$TMPDIR/r6.txt" "migrate can't write" "row6 verdict remote can't migrate"
    stop_server
else
    stop_server
    fail "row6: could not start local HTTP server on :18732 (remote schema:1 not exercised)"
fi

print_summary_and_exit "rules registry status Smoke Tests"
