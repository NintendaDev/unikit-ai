#!/bin/bash
# Smoke tests: legacy flat `.unikit/memory/{core,stack}` layout migrates to the
# module-keyed `.unikit/memory/code/{core,stack}` layout on `unikit-ai update`.
#
# Scope:
#   - on-disk relocation: flat core/stack subtrees (incl. references/) + the
#     top-level RULES_INDEX.md move under code/, non-destructively
#   - state normalization: legacy flat `rules.installed.{core,stack}` is wrapped
#     under `rules.installed.modules.code.{core,stack}` on load
#   - disk reconciliation: a relocated hand-written rule is rediscovered as
#     `source: local`
#   - index regeneration under code/
#   - idempotency: a second `update` is a no-op (sha-stable, no flat dir resurrection)
#
# Uses the minimal-valid fake registry so the run is fully offline.
#
# Usage: ./scripts/test-memory-migration.sh

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

echo -e "${BOLD}=== memory migration Smoke Tests ===${NC}"

# ─────────────────────────────────────────────
# Seed a project in the LEGACY flat layout
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Setup: seed legacy flat .unikit/memory layout${NC}"

MIG_DIR="$TMPDIR/mig-legacy"
mkdir -p "$MIG_DIR/.unikit/memory/core" \
         "$MIG_DIR/.unikit/memory/stack/references"

# A registry-tracked core rule: copy the fixture content so its on-disk hash
# matches the registry and the post-migration sync leaves it untouched.
cp "$ROOT_DIR/scripts/test-fixtures/minimal-valid/unity/core/code-style.md" \
   "$MIG_DIR/.unikit/memory/core/code-style.md"

# A hand-written local stack rule plus its reference doc — both must relocate
# with the stack subtree and the rule must be reconciled as source=local.
cat > "$MIG_DIR/.unikit/memory/stack/my-local-rule.md" << 'EOF'
---
version: 1.0.0
---
# Local stack rule (migration fixture)

> **Scope**: hand-written local rule that must survive the flat→code/ migration.
> **Load when**: exercising the memory migration smoke test.
EOF
cat > "$MIG_DIR/.unikit/memory/stack/references/my-local-rule-ref.md" << 'EOF'
# Reference doc for my-local-rule

Must relocate together with the stack subtree, never separately.
EOF

# A stale top-level index that must be relocated under code/ (then regenerated).
echo "# stale top-level RULES_INDEX" > "$MIG_DIR/.unikit/memory/RULES_INDEX.md"

CODE_STYLE_HASH="$(sha_of "$MIG_DIR/.unikit/memory/core/code-style.md")"

# Legacy FLAT state (no `modules` key) — normalizeRulesInstallation must wrap it.
cat > "$MIG_DIR/.unikit.json" << EOF
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    { "id": "claude", "skillsDir": ".claude/skills", "subagentsDir": ".claude/agents", "installedSkills": ["unikit"], "installedSubagents": [] }
  ],
  "rules": {
    "installed": {
      "version": "1.0.0",
      "core": [
        { "name": "code-style", "source": "registry", "origin": "primary", "version": "1.0.0", "installed_hash": "$CODE_STYLE_HASH" }
      ],
      "stack": []
    }
  }
}
EOF
inject_fake_registry "$MIG_DIR" minimal-valid

# ─────────────────────────────────────────────
# Scenario 1 — first update runs the migration
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 1: first update migrates flat → code/${NC}"

set +e
(cd "$MIG_DIR" && node "$CLI" update > "$TMPDIR/mig-1.log" 2>&1)
MIG1_EXIT=$?
set -e
assert_exit 0 "$MIG1_EXIT" "first update (with migration) exits 0" "$TMPDIR/mig-1.log"

# Layout — relocated under code/
assert_exists "$MIG_DIR/.unikit/memory/code/core/code-style.md" \
    "core rule relocated under code/"
assert_exists "$MIG_DIR/.unikit/memory/code/stack/my-local-rule.md" \
    "local stack rule relocated under code/"
assert_exists "$MIG_DIR/.unikit/memory/code/stack/references/my-local-rule-ref.md" \
    "stack reference relocated with the subtree"
assert_exists "$MIG_DIR/.unikit/memory/code/RULES_INDEX.md" \
    "RULES_INDEX.md present under code/"

# Layout — flat layout fully gone
assert_not_exists "$MIG_DIR/.unikit/memory/core" \
    "flat core dir removed after migration"
assert_not_exists "$MIG_DIR/.unikit/memory/stack" \
    "flat stack dir removed after migration"
assert_not_exists "$MIG_DIR/.unikit/memory/RULES_INDEX.md" \
    "top-level RULES_INDEX.md removed after migration"

# State normalization — legacy flat entry wrapped under modules.code
assert_json_field "$MIG_DIR/.unikit.json" "rules.installed.modules.code.core.0.name" code-style \
    "legacy core entry wrapped under modules.code"
assert_json_array_length "$MIG_DIR/.unikit.json" "rules.installed.modules.code.core" 1 \
    "exactly one core entry after normalization"

# Disk reconciliation — relocated hand-written rule discovered as local
assert_json_field "$MIG_DIR/.unikit.json" "rules.installed.modules.code.stack.0.name" my-local-rule \
    "relocated local stack file reconciled into state"
assert_json_field "$MIG_DIR/.unikit.json" "rules.installed.modules.code.stack.0.source" local \
    "discovered stack rule tagged source=local"

# Regenerated index references both rules
assert_stdout_contains "$MIG_DIR/.unikit/memory/code/RULES_INDEX.md" "code-style" \
    "regenerated index lists the core rule"
assert_stdout_contains "$MIG_DIR/.unikit/memory/code/RULES_INDEX.md" "my-local-rule" \
    "regenerated index lists the local stack rule"

# ─────────────────────────────────────────────
# Scenario 2 — second update is a no-op (sha-stable)
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 2: second update is idempotent${NC}"

SHA_CORE="$(sha_of "$MIG_DIR/.unikit/memory/code/core/code-style.md")"
SHA_LOCAL="$(sha_of "$MIG_DIR/.unikit/memory/code/stack/my-local-rule.md")"
SHA_INDEX="$(sha_of "$MIG_DIR/.unikit/memory/code/RULES_INDEX.md")"

set +e
(cd "$MIG_DIR" && node "$CLI" update > "$TMPDIR/mig-2.log" 2>&1)
MIG2_EXIT=$?
set -e
assert_exit 0 "$MIG2_EXIT" "second update exits 0" "$TMPDIR/mig-2.log"

assert_file_unchanged "$MIG_DIR/.unikit/memory/code/core/code-style.md" "$SHA_CORE" \
    "core rule sha-stable on 2nd update"
assert_file_unchanged "$MIG_DIR/.unikit/memory/code/stack/my-local-rule.md" "$SHA_LOCAL" \
    "local stack rule sha-stable on 2nd update"
assert_file_unchanged "$MIG_DIR/.unikit/memory/code/RULES_INDEX.md" "$SHA_INDEX" \
    "regenerated index sha-stable on 2nd update"
assert_not_exists "$MIG_DIR/.unikit/memory/core" \
    "no flat core dir resurrected on 2nd update"
assert_not_exists "$MIG_DIR/.unikit/memory/stack" \
    "no flat stack dir resurrected on 2nd update"

print_summary_and_exit "memory migration smoke"
