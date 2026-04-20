#!/bin/bash
# Smoke tests: validates `unikit-ai rules registry init` scaffold command
# Usage: ./scripts/test-rules-registry-init.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure the bundled rules snapshot exists (rules-registry/ is not tracked in
# git; it is cloned on demand by scripts/download-rules.sh).
if [ ! -f "$ROOT_DIR/rules-registry/manifest.json" ]; then
  bash "$SCRIPT_DIR/download-rules.sh"
fi

# Shared pass/fail counters + color codes.
# shellcheck source=./test-fixtures.sh
source "$SCRIPT_DIR/test-fixtures.sh"

# Ensure dist/ is up to date (skipped when parent runner already built).
ensure_build

CLI="$ROOT_DIR/dist/cli/index.js"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Local Style B asserts — these differ from the shared assert_exists
# (which aborts the run on failure) by calling pass/fail and embedding
# the TMPDIR-relative path in the label.
assert_exists() {
  if [[ -e "$1" ]]; then
    pass "exists: ${1#"$TMPDIR/"}"
  else
    fail "missing: ${1#"$TMPDIR/"} ($2)"
  fi
}

assert_not_exists() {
  if [[ ! -e "$1" ]]; then
    pass "absent: ${1#"$TMPDIR/"}"
  else
    fail "present but should be absent: ${1#"$TMPDIR/"} ($2)"
  fi
}

echo -e "${BOLD}=== rules registry init Smoke Tests ===${NC}"

# ─────────────────────────────────────────────
# Scenario 1: Empty tmp, no .unikit.json in CWD → all 4 engines
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 1: fresh scaffold, no .unikit.json (all engines)${NC}"

SCENARIO1="$TMPDIR/s1"
CWD1="$TMPDIR/s1-cwd"
mkdir -p "$CWD1"

set +e
(cd "$CWD1" && node "$CLI" rules registry init "$SCENARIO1" > $TMPDIR/registry-init-s1.log 2>&1)
CODE=$?
set -e

if [[ $CODE -eq 0 ]]; then
  pass "exit 0 on fresh scaffold"
else
  fail "expected exit 0, got $CODE — see $TMPDIR/registry-init-s1.log"
  cat $TMPDIR/registry-init-s1.log
fi

assert_exists "$SCENARIO1/manifest.json" "manifest.json must be generated"
assert_exists "$SCENARIO1/package.json" "package.json copied from bundled snapshot"
assert_exists "$SCENARIO1/RULE_TEMPLATE.md" "RULE_TEMPLATE.md copied"
assert_exists "$SCENARIO1/scripts/build-manifest.js" "build-manifest.js copied"

for engine in unity godot godot-net unreal-engine-5; do
  assert_exists "$SCENARIO1/$engine/core" "core dir for $engine"
  assert_exists "$SCENARIO1/$engine/stack" "stack dir for $engine"
done

# Files that must NOT be copied
assert_not_exists "$SCENARIO1/LICENSE" "LICENSE must not be copied"
assert_not_exists "$SCENARIO1/README.md" "README.md must not be copied"
assert_not_exists "$SCENARIO1/CONTRIBUTING.md" "CONTRIBUTING.md must not be copied"
assert_not_exists "$SCENARIO1/.github" ".github must not be copied"

# ─────────────────────────────────────────────
# Scenario 2: CWD has .unikit.json with engine=unity → only unity
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 2: scaffold with .unikit.json (single engine)${NC}"

SCENARIO2="$TMPDIR/s2"
CWD2="$TMPDIR/s2-cwd"
mkdir -p "$CWD2"

cat > "$CWD2/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] }
  }
}
EOF

set +e
(cd "$CWD2" && node "$CLI" rules registry init "$SCENARIO2" > $TMPDIR/registry-init-s2.log 2>&1)
CODE=$?
set -e

if [[ $CODE -eq 0 ]]; then
  pass "exit 0 with engine=unity in caller .unikit.json"
else
  fail "expected exit 0, got $CODE — see $TMPDIR/registry-init-s2.log"
  cat $TMPDIR/registry-init-s2.log
fi

assert_exists "$SCENARIO2/unity/core" "unity/core created"
assert_exists "$SCENARIO2/unity/stack" "unity/stack created"
assert_not_exists "$SCENARIO2/godot" "godot must NOT be created when caller pins engine=unity"
assert_not_exists "$SCENARIO2/godot-net" "godot-net must NOT be created"
assert_not_exists "$SCENARIO2/unreal-engine-5" "unreal-engine-5 must NOT be created"

# ─────────────────────────────────────────────
# Scenario 3: Directory already contains manifest.json → exit 6
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 3: already initialized (exit 6)${NC}"

SCENARIO3="$TMPDIR/s3"
mkdir -p "$SCENARIO3"
echo '{"engines":{}}' > "$SCENARIO3/manifest.json"

set +e
(cd "$TMPDIR" && node "$CLI" rules registry init "$SCENARIO3" > $TMPDIR/registry-init-s3.log 2>&1)
CODE=$?
set -e

if [[ $CODE -eq 6 ]]; then
  pass "exit 6 when manifest.json already exists"
else
  fail "expected exit 6, got $CODE — see $TMPDIR/registry-init-s3.log"
  cat $TMPDIR/registry-init-s3.log
fi

# ─────────────────────────────────────────────
# Scenario 4: Non-empty dir with unrelated files → exit 7
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 4: path occupied (exit 7)${NC}"

SCENARIO4="$TMPDIR/s4"
mkdir -p "$SCENARIO4"
echo "hello" > "$SCENARIO4/random-file.txt"

set +e
(cd "$TMPDIR" && node "$CLI" rules registry init "$SCENARIO4" > $TMPDIR/registry-init-s4.log 2>&1)
CODE=$?
set -e

if [[ $CODE -eq 7 ]]; then
  pass "exit 7 when target is occupied by non-registry files"
else
  fail "expected exit 7, got $CODE — see $TMPDIR/registry-init-s4.log"
  cat $TMPDIR/registry-init-s4.log
fi

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
echo -e "\n${BOLD}=== Results ===${NC}"
echo -e "  Passed:   ${GREEN}$PASSED${NC}"
echo -e "  Failed:   ${RED}$FAILED${NC}"

if [[ $FAILED -gt 0 ]]; then
    echo -e "\n${RED}registry-init smoke tests FAILED${NC}\n"
    exit 1
else
    echo -e "\n${GREEN}registry-init smoke tests PASSED${NC}\n"
    exit 0
fi
