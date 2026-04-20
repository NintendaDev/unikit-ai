#!/bin/bash
# Smoke tests: validates `unikit-ai rules status` output shape and exit
# codes.
#
# Scope:
#   - missing config → exit 1 (NOT_FOUND)
#   - empty state → exit 0 + empty rules array
#   - populated state → exit 0 + rules array matches installed entries
#   - --json fields: engine, registry, registryKind, registryConfigured, rules[]
#   - rulesRegistry null (legacy) → registryConfigured=false, registryKind=url
#   - rulesRegistry local path → registryConfigured=true, registryKind=local
#   - --check-updates is documented but unimplemented — must NOT introduce
#     an `updateAvailable` field (regression guard for the day it lands)
#   - Unknown engine in .unikit.json → pass-through, exit 0 (the command
#     never validates engine against the registry)
#
# Usage: ./scripts/test-rules-status.sh

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

echo -e "${BOLD}=== rules status Smoke Tests ===${NC}"

# ─────────────────────────────────────────────
# Scenario 1: missing .unikit.json → exit 1
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 1: missing .unikit.json${NC}"

S1_DIR="$TMPDIR/s1-no-config"
mkdir -p "$S1_DIR"

assert_cmd_exit 1 "rules status without config exits 1" "$TMPDIR/s1.log" -- \
    env -C "$S1_DIR" node "$CLI" rules status

assert_stdout_contains "$TMPDIR/s1.log" "Not a UniKit project" \
    "missing config error"

# ─────────────────────────────────────────────
# Scenario 2: empty state → exit 0 + empty rules array
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 2: empty state${NC}"

S2_DIR="$TMPDIR/s2-empty"
mkdir -p "$S2_DIR"
use_fake_registry "$S2_DIR" unity minimal-valid

assert_cmd_exit 0 "rules status --json on empty state" "$TMPDIR/s2.log" -- \
    env -C "$S2_DIR" node "$CLI" rules status --json

assert_json_field "$TMPDIR/s2.log" engine unity "engine=unity"
assert_json_array_length "$TMPDIR/s2.log" rules 0 "rules array is empty"

# ─────────────────────────────────────────────
# Scenario 3: populated state → rules[] reflects installed entries
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 3: populated state${NC}"

S3_DIR="$TMPDIR/s3-populated"
mkdir -p "$S3_DIR/.unikit/memory/core" "$S3_DIR/.unikit/memory/stack"
cat > "$S3_DIR/.unikit.json" <<EOF
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [],
  "rulesRegistry": "$(fake_registry_path minimal-valid)",
  "rules": {
    "installed": {
      "version": "1.0.0",
      "core": [
        { "name": "code-style", "source": "registry", "origin": "primary", "version": "1.0.0", "installed_hash": "deadbeef" }
      ],
      "stack": [
        { "name": "sample-stack-rule", "source": "registry", "origin": "primary", "version": "1.0.0", "installed_hash": "cafef00d" }
      ]
    }
  }
}
EOF

assert_cmd_exit 0 "rules status --json with populated state" "$TMPDIR/s3.log" -- \
    env -C "$S3_DIR" node "$CLI" rules status --json

assert_json_array_length "$TMPDIR/s3.log" rules 2 "rules array has 2 entries"
assert_json_field "$TMPDIR/s3.log" "rules.0.name" code-style "first rule is code-style"
assert_json_field "$TMPDIR/s3.log" "rules.0.category" core "first rule category is core"
assert_json_field "$TMPDIR/s3.log" "rules.0.source" registry "first rule source is registry"
assert_json_field "$TMPDIR/s3.log" "rules.0.origin" primary "first rule origin is primary"
assert_json_field "$TMPDIR/s3.log" "rules.1.name" sample-stack-rule "second rule is sample-stack-rule"
assert_json_field "$TMPDIR/s3.log" "rules.1.category" stack "second rule category is stack"

# ─────────────────────────────────────────────
# Scenario 4: --json shape — registry/registryKind/registryConfigured
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 4: --json registry metadata (local fixture)${NC}"

S4_DIR="$TMPDIR/s4-registry-meta"
mkdir -p "$S4_DIR"
use_fake_registry "$S4_DIR" unity minimal-valid

assert_cmd_exit 0 "rules status --json metadata" "$TMPDIR/s4.log" -- \
    env -C "$S4_DIR" node "$CLI" rules status --json

assert_json_field "$TMPDIR/s4.log" registryConfigured true \
    "rulesRegistry set → registryConfigured=true"
assert_json_field "$TMPDIR/s4.log" registryKind local \
    "local fixture → registryKind=local"

# ─────────────────────────────────────────────
# Scenario 5: null rulesRegistry → registryConfigured=false + official URL
# ─────────────────────────────────────────────
# Legacy .unikit.json files shipped `rulesRegistry: null` before the
# reset-writes-literal-URL fix. `resolveRegistryUrl` must still fold null
# to the official URL while reporting `registryConfigured=false`.
echo -e "\n${BOLD}Scenario 5: null rulesRegistry (legacy)${NC}"

S5_DIR="$TMPDIR/s5-null-registry"
mkdir -p "$S5_DIR/.unikit/memory/core" "$S5_DIR/.unikit/memory/stack"
cat > "$S5_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [],
  "rulesRegistry": null,
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] }
  }
}
EOF

assert_cmd_exit 0 "rules status --json on legacy null registry" "$TMPDIR/s5.log" -- \
    env -C "$S5_DIR" node "$CLI" rules status --json

assert_json_field "$TMPDIR/s5.log" registryConfigured false \
    "null rulesRegistry → registryConfigured=false"
assert_json_field "$TMPDIR/s5.log" registryKind url \
    "official URL → registryKind=url"
assert_json_field "$TMPDIR/s5.log" registry \
    https://raw.githubusercontent.com/NintendaDev/unikit-ai-rules/main \
    "registry resolves to OFFICIAL_REGISTRY_URL"

# ─────────────────────────────────────────────
# Scenario 6: --check-updates is accepted but must not add updateAvailable
# ─────────────────────────────────────────────
# Regression guard: the flag is registered in src/cli/index.ts and
# consumed by rulesStatusCommand but the handler never sets
# `updateAvailable` on the JSON payload. This test asserts the current
# no-op state; if someone lands the real implementation it must add a
# new guard AND update this test deliberately.
echo -e "\n${BOLD}Scenario 6: --check-updates is a no-op guard${NC}"

S6_DIR="$TMPDIR/s6-check-updates"
mkdir -p "$S6_DIR"
use_fake_registry "$S6_DIR" unity minimal-valid

assert_cmd_exit 0 "rules status --json --check-updates exits 0" "$TMPDIR/s6.log" -- \
    env -C "$S6_DIR" node "$CLI" rules status --json --check-updates

if grep -q "updateAvailable" "$TMPDIR/s6.log"; then
    fail "--check-updates unexpectedly introduced updateAvailable field — update this test if the feature landed"
    echo "--- /tmp/s6.log ---"
    cat "$TMPDIR/s6.log"
    echo "-------------------"
else
    pass "--check-updates did not add updateAvailable field (no-op confirmed)"
fi

# ─────────────────────────────────────────────
# Scenario 7: unknown engine in .unikit.json → exit 0 pass-through
# ─────────────────────────────────────────────
# `rules status` does NOT validate engine against the registry catalog
# — it only reads .unikit.json. A bogus `engine: "unknown-xyz"` must
# still produce exit 0 with the recorded engine echoed back in --json.
echo -e "\n${BOLD}Scenario 7: unknown engine pass-through${NC}"

S7_DIR="$TMPDIR/s7-unknown-engine"
mkdir -p "$S7_DIR/.unikit/memory/core" "$S7_DIR/.unikit/memory/stack"
cat > "$S7_DIR/.unikit.json" <<EOF
{
  "version": "1.0.0",
  "engine": "unknown-xyz",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [],
  "rulesRegistry": "$(fake_registry_path minimal-valid)",
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] }
  }
}
EOF

assert_cmd_exit 0 "rules status --json with bogus engine exits 0" "$TMPDIR/s7.log" -- \
    env -C "$S7_DIR" node "$CLI" rules status --json

assert_json_field "$TMPDIR/s7.log" engine unknown-xyz \
    "status echoes the bogus engine without validating it"

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
print_summary_and_exit "rules status Smoke Tests"
