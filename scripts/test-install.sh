#!/bin/bash
# Smoke tests: validates installation correctness across agents
# Tests: template substitution, Codex rewrite,
#        RULES_INDEX.md format, declined rules preservation,
#        engine templates, engine-specific rules, MCP configuration, backward compat
# Usage: ./scripts/test-install.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure the bundled rules snapshot exists (rules-registry/ is not tracked in
# git; it is cloned on demand by scripts/download-rules.sh).
if [ ! -f "$ROOT_DIR/rules-registry/manifest.json" ]; then
  bash "$SCRIPT_DIR/download-rules.sh"
fi

# Shared rule-id fixtures (canonical lowercase-hyphen).
# shellcheck source=./test-fixtures.sh
source "$SCRIPT_DIR/test-fixtures.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Ensure dist/ is up to date (skipped when a parent runner already built).
ensure_build

run_update() {
  local project="$1"
  (cd "$project" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)
}

# assert_contains / assert_not_contains / assert_exists / assert_not_exists /
# assert_file_content / seed_rule now live in test-fixtures.sh (sourced above).

# ─────────────────────────────────────────────────────
# Test 1: Template substitution (claude agent)
# ─────────────────────────────────────────────────────

CLAUDE_DIR="$TMPDIR/test-claude"
mkdir -p "$CLAUDE_DIR"

cat > "$CLAUDE_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit", "unikit-plan", "unikit-devcontext", "unikit-evolve",
                          "unikit-explore", "unikit-implement", "unikit-skills-context",
                          "unikit-verify"],
      "installedSubagents": ["unikit-architecture-sidecar"]
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] }
  }
}
EOF

# Seed rule files on disk so syncRulesState registers them and regenerates
# RULES_INDEX.md in Phase 3 (test 4 asserts on rule names in the index).
seed_rule "$CLAUDE_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"
seed_rule "$CLAUDE_DIR" unity core "$CORE_RULE_UNITY_DESIGN_PRINCIPLES"
seed_rule "$CLAUDE_DIR" unity stack "$STACK_RULE_UNITY_UNITASK"

run_update "$CLAUDE_DIR"

# Subagent files SHOULD be installed for claude (supportsSubagents: true)
assert_exists "$CLAUDE_DIR/.claude/agents/unikit-architecture-sidecar.md" "subagent files must be installed for claude"

# Check no template placeholders remain in installed skills
TEMPLATE_HITS=$(grep -r '{{skills_dir}}\|{{settings_file}}\|{{home_skills_dir}}\|{{skills_cli_agent_flag}}\|{{self_name}}' \
  "$CLAUDE_DIR/.claude/skills/" --include='*.md' 2>/dev/null | wc -l | tr -d ' ' || true)

if [[ "$TEMPLATE_HITS" -eq 0 ]]; then
  echo "  ✓ template substitution: no {{...}} placeholders in installed skills"
else
  echo "Assertion failed: found $TEMPLATE_HITS unresolved template placeholders"
  grep -r '{{skills_dir}}\|{{settings_file}}\|{{home_skills_dir}}\|{{skills_cli_agent_flag}}\|{{self_name}}' \
    "$CLAUDE_DIR/.claude/skills/" --include='*.md' | head -5
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 1b: dev-principles.md installed with substituted vars (system file)
# ─────────────────────────────────────────────────────
PRINCIPLES_PATH="$CLAUDE_DIR/.unikit/system/dev-principles.md"
assert_exists "$PRINCIPLES_PATH" "dev-principles.md created in .unikit/system/"
assert_not_contains "$PRINCIPLES_PATH" '\{\{engine_name\}\}' "no unsubstituted {{engine_name}}"
assert_not_contains "$PRINCIPLES_PATH" '\{\{engine_code_language\}\}' "no unsubstituted {{engine_code_language}}"
assert_not_contains "$PRINCIPLES_PATH" '\{\{engine_mcp_tool\}\}' "no unsubstituted {{engine_mcp_tool}}"
# Verify both engine vars are actually substituted by checking a phrase
# that ONLY exists after substitution (Core Principle 1 reads
# "well-documented C# code adhering to Unity best practices" post-substitution).
assert_contains "$PRINCIPLES_PATH" 'C# code adhering to Unity' \
  "engine_name + engine_code_language substituted in Core Principle 1"

# ─────────────────────────────────────────────────────
# Test 1c: supportsSubagents:false skip-path
# Even when a subagent is explicitly listed in installedSubagents,
# agents with supportsSubagents:false must not materialize the file on disk.
# ─────────────────────────────────────────────────────

NOSUB_DIR="$TMPDIR/test-nosub"
mkdir -p "$NOSUB_DIR"

cat > "$NOSUB_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "codex",
      "skillsDir": ".codex/skills",
      "subagentsDir": ".codex/agents",
      "installedSkills": ["unikit"],
      "installedSubagents": ["unikit-architecture-sidecar"]
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] }
  }
}
EOF

seed_rule "$NOSUB_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"
run_update "$NOSUB_DIR"

assert_exists "$NOSUB_DIR/.codex/skills/unikit/SKILL.md" \
  "codex must have unikit skill installed (sanity)"
assert_not_exists "$NOSUB_DIR/.codex/agents/unikit-architecture-sidecar.md" \
  "listed subagent must NOT be installed for supportsSubagents:false agent (codex)"

echo "  ✓ subagent skip-path: listed subagent not written for supportsSubagents:false agent"

# ─────────────────────────────────────────────────────
# Test 3: Codex invocation rewrite
# ─────────────────────────────────────────────────────

CODEX_DIR="$TMPDIR/test-codex"
mkdir -p "$CODEX_DIR"

cat > "$CODEX_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "codex",
      "skillsDir": ".codex/skills",
      "subagentsDir": ".codex/agents",
      "installedSkills": ["unikit", "unikit-plan", "unikit-devcontext",
                          "unikit-implement", "unikit-explore", "unikit-fix"],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] }
  }
}
EOF

seed_rule "$CODEX_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"
run_update "$CODEX_DIR"

# No /unikit- invocations should remain in SKILL.md files (rewritten to $unikit-)
# Only check SKILL.md files - reference files are copied verbatim by design.
# Exclude frontmatter name: field, package name unikit-ai, and .unikit/ paths
SLASH_INVOCATIONS=$(find "$CODEX_DIR/.codex/skills/" -name 'SKILL.md' -exec \
  grep -lE '(^|[[:space:]`"(>])/unikit-' {} \; 2>/dev/null \
  | while read -r f; do
      grep -E '(^|[[:space:]`"(>])/unikit-' "$f" \
        | grep -v '^name:' \
        | grep -v 'unikit-ai' \
        | grep -v '\.unikit/'
    done | wc -l | tr -d ' ' || true)

# $unikit- invocations should exist in SKILL.md files
DOLLAR_INVOCATIONS=$(find "$CODEX_DIR/.codex/skills/" -name 'SKILL.md' -exec \
  grep -c '\$unikit-' {} \; 2>/dev/null \
  | awk '{s+=$1} END{print s+0}' || true)

if [[ "$SLASH_INVOCATIONS" -eq 0 && "$DOLLAR_INVOCATIONS" -gt 0 ]]; then
  echo "  ✓ codex invocation rewrite: /unikit-* → \$unikit-* ($DOLLAR_INVOCATIONS rewrites)"
else
  echo "Assertion failed: codex rewrite"
  echo "  Remaining /unikit- invocations: $SLASH_INVOCATIONS (expected 0)"
  echo "  Found \$unikit- invocations: $DOLLAR_INVOCATIONS (expected > 0)"
  if [[ "$SLASH_INVOCATIONS" -gt 0 ]]; then
    echo "  --- remaining /unikit- ---"
    grep -rE '(^|[[:space:]`"(>])/unikit-' "$CODEX_DIR/.codex/skills/" --include='*.md' \
      | grep -v '^[^:]*:name:' | grep -v 'unikit-ai' | grep -v '\.unikit/' | head -5
    echo "  ---"
  fi
  exit 1
fi

# Codex keeps the guarded 'Subagent Delegation' block (include-list contains
# `codex`); the generic no-leak sweep across all agents runs at the end of
# this script (see "agent-filter markers must not leak into any install").
assert_contains "$CODEX_DIR/.codex/skills/unikit/SKILL.md" \
  "Subagent Delegation" "codex install: guarded 'Subagent Delegation' block must be kept for codex"

# ─────────────────────────────────────────────────────
# Test 3b: Qwen invocation rewrite
# ─────────────────────────────────────────────────────

QWEN_DIR="$TMPDIR/test-qwen"
mkdir -p "$QWEN_DIR"

cat > "$QWEN_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "qwen",
      "skillsDir": ".qwen/skills",
      "subagentsDir": ".qwen/agents",
      "installedSkills": ["unikit", "unikit-plan", "unikit-devcontext",
                          "unikit-implement", "unikit-explore", "unikit-fix"],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] }
  }
}
EOF

seed_rule "$QWEN_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"
run_update "$QWEN_DIR"

# No raw /unikit- invocations should remain in SKILL.md files (rewritten to "/skills unikit-")
# Only check SKILL.md files - reference files are copied verbatim by design.
# Exclude frontmatter name: field, package name unikit-ai, and .unikit/ paths
QWEN_RAW_SLASH=$(find "$QWEN_DIR/.qwen/skills/" -name 'SKILL.md' -exec \
  grep -lE '(^|[[:space:]`"(>])/unikit-' {} \; 2>/dev/null \
  | while read -r f; do
      grep -E '(^|[[:space:]`"(>])/unikit-' "$f" \
        | grep -v '^name:' \
        | grep -v 'unikit-ai' \
        | grep -v '\.unikit/'
    done | wc -l | tr -d ' ' || true)

# "/skills unikit-" invocations should exist in SKILL.md files
QWEN_SKILLS_INVOCATIONS=$(find "$QWEN_DIR/.qwen/skills/" -name 'SKILL.md' -exec \
  grep -c '/skills unikit-' {} \; 2>/dev/null \
  | awk '{s+=$1} END{print s+0}' || true)

if [[ "$QWEN_RAW_SLASH" -eq 0 && "$QWEN_SKILLS_INVOCATIONS" -gt 0 ]]; then
  echo "  ✓ qwen invocation rewrite: /unikit-* → /skills unikit-* ($QWEN_SKILLS_INVOCATIONS rewrites)"
else
  echo "Assertion failed: qwen rewrite"
  echo "  Remaining /unikit- invocations: $QWEN_RAW_SLASH (expected 0)"
  echo "  Found /skills unikit- invocations: $QWEN_SKILLS_INVOCATIONS (expected > 0)"
  if [[ "$QWEN_RAW_SLASH" -gt 0 ]]; then
    echo "  --- remaining /unikit- ---"
    grep -rE '(^|[[:space:]`"(>])/unikit-' "$QWEN_DIR/.qwen/skills/" --include='*.md' \
      | grep -v '^[^:]*:name:' | grep -v 'unikit-ai' | grep -v '\.unikit/' | head -5
    echo "  ---"
  fi
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 4: RULES_INDEX.md end-to-end smoke after `unikit-ai update`
# ─────────────────────────────────────────────────────
# Update should drive syncRulesState which regenerates the index. The
# detailed index format assertions (section headers, lowercase-hyphen
# guard, Required By/Load When columns, whitelist bootstrap, aggregated
# install report) now live in scripts/test-rules-install.sh and
# scripts/test-rules-sync.sh — this block only keeps the end-to-end
# smoke that catches "update flow forgot to call sync".

RULES_INDEX="$CLAUDE_DIR/.unikit/memory/RULES_INDEX.md"
assert_exists "$RULES_INDEX" "RULES_INDEX.md should exist after update"
assert_contains "$RULES_INDEX" "## Core" "RULES_INDEX should have Core section"
assert_contains "$RULES_INDEX" "code-style" "RULES_INDEX should contain seeded core rule"

# ─────────────────────────────────────────────────────
# Test 5: (removed)
# Legacy settings preservation test was removed during the config.yaml
# port. The old settings artifact and its language field are no longer
# produced or read by the TS pipeline — language config now lives in
# .unikit/config.yaml, bootstrapped by the /unikit skill at first run.
# ─────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────
# Test 6: Local rule preservation (replaces the declined test)
# ─────────────────────────────────────────────────────
# The `declined` field was removed with the registry refactor. Local
# modifications are now protected by the syncRulesState local-modification
# guard (installed_hash check in Phase 2). Without --force, a rule tagged
# `source: local` is never overwritten by the registry, even if an entry of
# the same id exists in the remote catalog.

LOCAL_DIR="$TMPDIR/test-local-pres"
mkdir -p "$LOCAL_DIR/.unikit/memory/stack"

CUSTOM_CONTENT="# My custom rngneeds rules
This file was manually edited by the user."
echo "$CUSTOM_CONTENT" > "$LOCAL_DIR/.unikit/memory/stack/${STACK_RULE_UNITY_RNGNEEDS}.md"

cat > "$LOCAL_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit"],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] }
  }
}
EOF

seed_rule "$LOCAL_DIR" unity stack "$STACK_RULE_UNITY_UNITASK"
run_update "$LOCAL_DIR"

# Custom rngneeds.md content must survive the update (syncRulesState Phase 1
# tags it as `source: local`; Phase 2 skips it because origin != registry).
assert_exists "$LOCAL_DIR/.unikit/memory/stack/${STACK_RULE_UNITY_RNGNEEDS}.md" "local rule file should not be deleted"
assert_file_content "$LOCAL_DIR/.unikit/memory/stack/${STACK_RULE_UNITY_RNGNEEDS}.md" "$CUSTOM_CONTENT" \
  "local rule should preserve user content, not be overwritten by registry"
assert_exists "$LOCAL_DIR/.unikit/memory/stack/${STACK_RULE_UNITY_UNITASK}.md" "seeded rule should be present"

# Config should no longer carry the legacy `declined` field after save.
DECLINED_FIELD=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(c.rules.declined === undefined ? 'absent' : 'present');
" "$LOCAL_DIR/.unikit.json")
if [[ "$DECLINED_FIELD" == "absent" ]]; then
  echo "  ✓ local rules: user content preserved; config has no legacy declined field"
else
  echo "Assertion failed: config still carries a 'declined' field after update"
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 7: ENGINE_RULES.md installation for Unity
# ─────────────────────────────────────────────────────

# The claude dir was already updated with engine: "unity"
# Check that ENGINE_RULES.md was installed for unikit skill
assert_exists "$CLAUDE_DIR/.claude/skills/unikit/references/ENGINE_RULES.md" \
  "ENGINE_RULES.md should be installed for unikit (unity)"
assert_exists "$CLAUDE_DIR/.claude/skills/unikit-verify/references/ENGINE_RULES.md" \
  "ENGINE_RULES.md should be installed for unikit-verify (unity)"
assert_contains "$CLAUDE_DIR/.claude/skills/unikit-verify/references/ENGINE_RULES.md" \
  "Engine Rules: Unity" "unikit-verify ENGINE_RULES.md should have Unity header"

echo "  ✓ ENGINE_RULES.md: installed for unity engine (unikit + unikit-verify)"

# ─────────────────────────────────────────────────────
# Test 8: ENGINE_RULES.md installation for Godot
# ─────────────────────────────────────────────────────

GODOT_DIR="$TMPDIR/test-godot"
mkdir -p "$GODOT_DIR"

cat > "$GODOT_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "engine": "godot",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit", "unikit-architecture"],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] }
  }
}
EOF

seed_rule "$GODOT_DIR" godot core "$CORE_RULE_GODOT_CODE_STYLE"
run_update "$GODOT_DIR"

assert_exists "$GODOT_DIR/.claude/skills/unikit/references/ENGINE_RULES.md" \
  "ENGINE_RULES.md should be installed for unikit (godot)"
assert_exists "$GODOT_DIR/.claude/skills/unikit-architecture/references/ENGINE_RULES.md" \
  "ENGINE_RULES.md should be installed for unikit-architecture (godot)"

# Verify Godot rules are from the Godot template, not Unity
assert_contains "$GODOT_DIR/.claude/skills/unikit/references/ENGINE_RULES.md" \
  "Engine Rules: Godot" "Godot ENGINE_RULES.md should have Godot header"

echo "  ✓ ENGINE_RULES.md: installed for godot engine (both skills)"

# ─────────────────────────────────────────────────────
# Test 9: Engine-specific rules paths
# ─────────────────────────────────────────────────────

# Godot core rules should be installed from memory/godot/core/
assert_exists "$GODOT_DIR/.unikit/memory/core/${CORE_RULE_GODOT_CODE_STYLE}.md" "godot core rule should be installed"

echo "  ✓ engine-specific rules: godot core rules installed"

# ─────────────────────────────────────────────────────
# Test 10: MCP configuration writes correct server configs
# ─────────────────────────────────────────────────────

MCP_DIR="$TMPDIR/test-mcp"
mkdir -p "$MCP_DIR/.claude"

cat > "$MCP_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": "EngineMCP",
  "mcp": { "servers": ["unity-mcp", "context7"] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit"],
      "installedSubagents": ["unikit-architecture-sidecar",
                              "unikit-implement-coordinator", "unikit-plan-coordinator",
                              "unikit-implement-worker", "unikit-plan-polisher",
                              "unikit-commit-sidecar",
                              "unikit-docs-sidecar", "unikit-review-sidecar"]
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] }
  }
}
EOF

seed_rule "$MCP_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"
run_update "$MCP_DIR"

# Note: MCP config is written during init, not update. Just verify skills installed.
assert_exists "$MCP_DIR/.claude/skills/unikit/SKILL.md" "claude skill should be installed"

# Claude must cut the codex-only guarded block (exclude path); the generic
# no-leak sweep for markers runs at the end of this script.
assert_not_contains "$MCP_DIR/.claude/skills/unikit/SKILL.md" \
  "Subagent Delegation" "claude install: codex-only 'Subagent Delegation' block must be cut"

# Subagent files should be installed for claude (supportsSubagents: true)
assert_exists "$MCP_DIR/.claude/agents/unikit-architecture-sidecar.md" "subagent files must be installed for claude"
assert_exists "$MCP_DIR/.claude/agents/unikit-implement-coordinator.md" "unikit-implement-coordinator subagent must be installed for claude"
assert_exists "$MCP_DIR/.claude/agents/unikit-plan-coordinator.md" "unikit-plan-coordinator subagent must be installed for claude"

# managedSubagents hash tracking should be persisted after update
node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  const m = c.agents[0].managedSubagents || {};
  if (!m['unikit-architecture-sidecar']) { process.exit(1); }
  if (!m['unikit-architecture-sidecar'].sourceHash || !m['unikit-architecture-sidecar'].installedHash) { process.exit(1); }
" "$MCP_DIR/.unikit.json"

echo "  ✓ MCP config: claude agent setup works with servers array"
echo "  ✓ managedSubagents: hash tracking persisted for claude subagents"

# Check no template placeholders remain in installed subagents
SUBAGENT_TEMPLATE_HITS=$(grep -r '{{self_name}}\|{{engine_name}}\|{{engine_code_language}}\|{{engine_mcp_tool}}' \
  "$MCP_DIR/.claude/agents/" --include='*.md' 2>/dev/null | wc -l | tr -d ' ' || true)

if [[ "$SUBAGENT_TEMPLATE_HITS" -eq 0 ]]; then
  echo "  ✓ template substitution: no {{...}} placeholders in installed subagents"
else
  echo "Assertion failed: found $SUBAGENT_TEMPLATE_HITS unresolved template placeholders in subagents"
  grep -r '{{self_name}}\|{{engine_name}}\|{{engine_code_language}}\|{{engine_mcp_tool}}' \
    "$MCP_DIR/.claude/agents/" --include='*.md' | head -5
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 11: Backward compat - no engine field defaults to unity
# ─────────────────────────────────────────────────────

COMPAT_DIR="$TMPDIR/test-compat"
mkdir -p "$COMPAT_DIR"

# Config WITHOUT engine field (old format)
cat > "$COMPAT_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit"],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] }
  }
}
EOF

seed_rule "$COMPAT_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"
seed_rule "$COMPAT_DIR" unity stack "$STACK_RULE_UNITY_UNITASK"
run_update "$COMPAT_DIR"

# Seeded rules must survive the update (sync registers them as local).
assert_exists "$COMPAT_DIR/.unikit/memory/core/${CORE_RULE_UNITY_CODE_STYLE}.md" "backward compat: core rule present after sync"
assert_exists "$COMPAT_DIR/.unikit/memory/stack/${STACK_RULE_UNITY_UNITASK}.md" "backward compat: stack rule present after sync"

# Engine templates should be installed (defaults to unity)
assert_exists "$COMPAT_DIR/.claude/skills/unikit/references/ENGINE_RULES.md" \
  "backward compat: ENGINE_RULES.md installed with default unity"

# Config should now have engine field after update
SAVED_ENGINE=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(c.engine || 'missing');
" "$COMPAT_DIR/.unikit.json")

if [[ "$SAVED_ENGINE" == "unity" ]]; then
  echo "  ✓ backward compat: no engine field -> unity (rules, templates, config all correct)"
else
  echo "Assertion failed: backward compat engine should be 'unity', got '$SAVED_ENGINE'"
  exit 1
fi

# The following rules-specific tests were removed during the dedicated
# test-rules coverage refactor. Their assertions moved into:
#   - test-rules-install.sh  — stack rule references / aspid-mvvm install
#   - test-rules-sync.sh      — empty-project sync, stale RULES_INDEX removal
#   - test-rules-status.sh    — null rulesRegistry → official URL resolution
#   - test-rules-registry.sh  — registry --json null resolution, text mode
# Run those files directly (or via `npm test`) to cover the rules surface.

# ─────────────────────────────────────────────────────
# Test 12: Codex MCP config via direct call (stdio + HTTP)
# ─────────────────────────────────────────────────────
# Drives configureMcp('codex') directly because the init wizard is
# interactive (no non-TTY driver). Verifies TOML output shape and
# idempotency of a repeated call.

CODEX_MCP_DIR="$TMPDIR/test-codex-mcp"
mkdir -p "$CODEX_MCP_DIR"

(cd "$ROOT_DIR" && node --input-type=module -e "
  const target = process.argv[1];
  const { discoverMcpServers, configureMcp } = await import('./dist/core/mcp.js');
  const servers = await discoverMcpServers('unity');
  await configureMcp(target, servers, ['context7', 'unity-mcp-coplay'], 'codex');
  await configureMcp(target, servers, ['context7', 'unity-mcp-coplay'], 'codex');
" "$CODEX_MCP_DIR" > /dev/null 2>&1)

CODEX_TOML="$CODEX_MCP_DIR/.codex/config.toml"
assert_exists "$CODEX_TOML" ".codex/config.toml should exist after configureMcp"
assert_contains "$CODEX_TOML" '^\[mcp_servers\.context7\]$' \
  "codex toml should contain [mcp_servers.context7] section"
assert_contains "$CODEX_TOML" 'command = "npx"' \
  "codex stdio server should have command = \"npx\""
assert_contains "$CODEX_TOML" '^\[mcp_servers\.UnityMCP\]$' \
  "codex toml should contain [mcp_servers.UnityMCP] section"
assert_contains "$CODEX_TOML" 'url = "http://localhost:8085/mcp"' \
  "codex http server should have url = \"http://localhost:8085/mcp\""
assert_not_contains "$CODEX_TOML" 'mcpServers' \
  "codex toml must not contain camelCase mcpServers token"

CONTEXT7_SECTIONS=$(grep -cE '^\[mcp_servers\.context7\]$' "$CODEX_TOML")
if [[ "$CONTEXT7_SECTIONS" -ne 1 ]]; then
  echo "Assertion failed: idempotency — expected 1 [mcp_servers.context7] section, got $CONTEXT7_SECTIONS"
  exit 1
fi

echo "  ✓ codex MCP config: stdio + HTTP servers written to .codex/config.toml (idempotent)"

# Claude regression: same discoveredServers must still produce valid JSON
# with camelCase mcpServers.<key>.command field.
CLAUDE_MCP_REGRESS_DIR="$TMPDIR/test-claude-mcp-regress"
mkdir -p "$CLAUDE_MCP_REGRESS_DIR"

(cd "$ROOT_DIR" && node --input-type=module -e "
  const target = process.argv[1];
  const { discoverMcpServers, configureMcp } = await import('./dist/core/mcp.js');
  const servers = await discoverMcpServers('unity');
  await configureMcp(target, servers, ['context7', 'unity-mcp-coplay'], 'claude');
" "$CLAUDE_MCP_REGRESS_DIR" > /dev/null 2>&1)

assert_exists "$CLAUDE_MCP_REGRESS_DIR/.mcp.json" "claude .mcp.json must exist (regression check)"

CLAUDE_REGRESS_CMD=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log((c.mcpServers && c.mcpServers.context7 && c.mcpServers.context7.command) || 'missing');
" "$CLAUDE_MCP_REGRESS_DIR/.mcp.json")

if [[ "$CLAUDE_REGRESS_CMD" != "npx" ]]; then
  echo "Assertion failed: claude .mcp.json regression — expected mcpServers.context7.command = \"npx\", got \"$CLAUDE_REGRESS_CMD\""
  exit 1
fi

echo "  ✓ claude MCP config regression: .mcp.json stays camelCase JSON with mcpServers.context7.command"

# ─────────────────────────────────────────────────────
# Test 12b: OpenCode MCP config shape (mcp container, local type, command array, environment)
# ─────────────────────────────────────────────────────
# Drives configureMcp('opencode') directly, verifies the OpenCode JSON shape:
#   - top-level container `mcp` (not `mcpServers`)
#   - each server: type === 'local', command === [cmd, ...args]
#   - environment preserved only when source `env` is non-empty
#   - existing non-mcp top-level keys survive the write (merge, not rewrite)
# Uses engine=godot so we can assert both the no-env path (context7) and the
# with-env path (godot-mcp-coding-solo).

OPENCODE_MCP_DIR="$TMPDIR/test-opencode-mcp"
mkdir -p "$OPENCODE_MCP_DIR"
OPENCODE_JSON="$OPENCODE_MCP_DIR/opencode.json"

# Pre-seed opencode.json with a non-mcp top-level key to assert preservation
# through configureMcp's upsert path.
cat > "$OPENCODE_JSON" << 'EOF'
{
  "theme": "dark",
  "customField": { "nested": "value" }
}
EOF

(cd "$ROOT_DIR" && node --input-type=module -e "
  const target = process.argv[1];
  const { discoverMcpServers, configureMcp } = await import('./dist/core/mcp.js');
  const servers = await discoverMcpServers('godot');
  await configureMcp(target, servers, ['context7', 'godot-mcp-coding-solo'], 'opencode');
  await configureMcp(target, servers, ['context7', 'godot-mcp-coding-solo'], 'opencode');
" "$OPENCODE_MCP_DIR" > /dev/null 2>&1)

assert_exists "$OPENCODE_JSON" "opencode.json should exist after configureMcp"

node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  const errors = [];

  if (!c.mcp) errors.push('missing top-level mcp container');
  if ('mcpServers' in c) errors.push('mcpServers container must not exist for opencode');

  // Non-mcp top-level keys must survive the upsert
  if (c.theme !== 'dark') errors.push('top-level \"theme\" lost: ' + JSON.stringify(c.theme));
  if (!c.customField || c.customField.nested !== 'value')
    errors.push('top-level \"customField\" lost or mutated: ' + JSON.stringify(c.customField));

  const ctx = c.mcp && c.mcp.context7;
  if (!ctx) errors.push('context7 server missing');
  else {
    if (ctx.type !== 'local') errors.push('context7.type expected local, got ' + JSON.stringify(ctx.type));
    if (!Array.isArray(ctx.command)) errors.push('context7.command must be array');
    else if (JSON.stringify(ctx.command) !== JSON.stringify(['npx', '-y', '@upstash/context7-mcp@latest']))
      errors.push('context7.command wrong shape: ' + JSON.stringify(ctx.command));
    if ('environment' in ctx) errors.push('context7.environment must be absent when source env is empty');
  }

  const godot = c.mcp && c.mcp.GodotMCP;
  if (!godot) errors.push('GodotMCP server missing');
  else {
    if (godot.type !== 'local') errors.push('GodotMCP.type expected local, got ' + JSON.stringify(godot.type));
    if (JSON.stringify(godot.command) !== JSON.stringify(['npx', '@coding-solo/godot-mcp']))
      errors.push('GodotMCP.command wrong shape: ' + JSON.stringify(godot.command));

    // Per-key environment check (order-independent): ensures the writer preserves
    // every source env entry verbatim and does not inject or drop keys.
    const expectedEnv = { GODOT_PATH: '/path/to/godot', DEBUG: 'true' };
    if (!godot.environment || typeof godot.environment !== 'object' || Array.isArray(godot.environment)) {
      errors.push('GodotMCP.environment missing or wrong type: ' + JSON.stringify(godot.environment));
    } else {
      const actualKeys = Object.keys(godot.environment).sort();
      const expectedKeys = Object.keys(expectedEnv).sort();
      if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
        errors.push('GodotMCP.environment keys mismatch: expected ' + JSON.stringify(expectedKeys) + ', got ' + JSON.stringify(actualKeys));
      }
      for (const k of expectedKeys) {
        if (godot.environment[k] !== expectedEnv[k]) {
          errors.push('GodotMCP.environment.' + k + ' mismatch: expected ' + JSON.stringify(expectedEnv[k]) + ', got ' + JSON.stringify(godot.environment[k]));
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error('opencode mcp shape assertion failed:');
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
" "$OPENCODE_JSON"

# Idempotency: second configureMcp call above should leave exactly one context7 entry.
CTX_COUNT=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(Object.keys(c.mcp || {}).filter(k => k === 'context7').length);
" "$OPENCODE_JSON")
if [[ "$CTX_COUNT" -ne 1 ]]; then
  echo "Assertion failed: opencode idempotency — expected 1 context7 entry, got $CTX_COUNT"
  exit 1
fi

echo "  ✓ opencode MCP config: mcp container, local type, command array, per-key environment, top-level preserved (idempotent)"

# ─────────────────────────────────────────────────────
# Test 12c: OpenCode MCP config skips non-stdio (HTTP) servers
# ─────────────────────────────────────────────────────
# UnityMCP is HTTP-only (type: 'http', url: ...). OpenCode's on-disk shape is
# stdio-only (type: 'local', command: [...]). Rather than silently degrading
# HTTP to an empty-command local server, the writer must skip the entry with
# a warning. This test pins that contract.

OPENCODE_HTTP_DIR="$TMPDIR/test-opencode-mcp-http-skip"
mkdir -p "$OPENCODE_HTTP_DIR"

(cd "$ROOT_DIR" && node --input-type=module -e "
  const target = process.argv[1];
  const { discoverMcpServers, configureMcp } = await import('./dist/core/mcp.js');
  const servers = await discoverMcpServers('unity');
  await configureMcp(target, servers, ['context7', 'unity-mcp-coplay'], 'opencode');
" "$OPENCODE_HTTP_DIR" > /dev/null 2>&1)

OPENCODE_HTTP_JSON="$OPENCODE_HTTP_DIR/opencode.json"
assert_exists "$OPENCODE_HTTP_JSON" "opencode.json should exist after unity+opencode configureMcp"

node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const errors = [];

  if (!c.mcp) errors.push('missing top-level mcp container');
  if (!c.mcp.context7) errors.push('stdio context7 must still be written');
  if (c.mcp.UnityMCP) errors.push('HTTP UnityMCP must be skipped, not written as local');

  if (errors.length > 0) {
    console.error('opencode http-skip assertion failed:');
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
" "$OPENCODE_HTTP_JSON"

echo "  ✓ opencode MCP config: HTTP servers (UnityMCP) skipped; stdio servers (context7) still written"

# ─────────────────────────────────────────────────────
# Test 13: Codex MCP rules injection (skill frontmatter)
# ─────────────────────────────────────────────────────
# Uses a dedicated project dir (NOT the Test 3 CODEX_DIR, which is pinned
# to mcp.servers = [] and carries the Codex-rewrite assertions). Here we
# enable context7 in the config and verify collectMcpRules +
# injectToolsIntoSkillFrontmatter work format-agnostically for codex.

CODEX_MCP_RULES_DIR="$TMPDIR/test-codex-mcp-rules"
mkdir -p "$CODEX_MCP_RULES_DIR"

cat > "$CODEX_MCP_RULES_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": ["context7"] },
  "agents": [
    {
      "id": "codex",
      "skillsDir": ".codex/skills",
      "subagentsDir": ".codex/agents",
      "installedSkills": ["unikit"],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] }
  }
}
EOF

seed_rule "$CODEX_MCP_RULES_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"
run_update "$CODEX_MCP_RULES_DIR"

CODEX_UNIKIT_SKILL="$CODEX_MCP_RULES_DIR/.codex/skills/unikit/SKILL.md"
assert_exists "$CODEX_UNIKIT_SKILL" "codex unikit SKILL.md should exist after update"
assert_contains "$CODEX_UNIKIT_SKILL" 'mcp__context7__resolve-library-id' \
  "codex unikit frontmatter should include context7 resolve-library-id tool"
assert_contains "$CODEX_UNIKIT_SKILL" 'mcp__context7__query-docs' \
  "codex unikit frontmatter should include context7 query-docs tool"

echo "  ✓ codex MCP rules: context7 tool ids injected into .codex/skills/unikit/SKILL.md"

# ─────────────────────────────────────────────────────
# Test 14: resolveExistingEngine verdict matrix (wizard engine reuse)
# ─────────────────────────────────────────────────────
# Pure-function contract for the init wizard Step 2 skip: the exported
# helper must return 'use' for known engine ids, 'reselect' for unknown
# ids (with an ASCII-dashed warning the user can recognize), and 'prompt'
# for fresh inits. We import from ./dist/cli/wizard/prompts.js via
# `node --input-type=module -e` and capture JSON on stdout; stderr is
# suppressed because the module side-effects (inquirer / chalk / mcp.js)
# are not part of this contract. Pattern mirrors Test 10 / 12.

RESOLVE_USE=$(cd "$ROOT_DIR" && node --input-type=module -e "
  const { resolveExistingEngine } = await import('./dist/cli/wizard/prompts.js');
  process.stdout.write(JSON.stringify(resolveExistingEngine('unity')));
" 2>/dev/null)

if [[ "$RESOLVE_USE" != *'"action":"use"'* ]] || [[ "$RESOLVE_USE" != *'"engine":"unity"'* ]]; then
  echo "Assertion failed: resolveExistingEngine('unity') should be {action:'use', engine:'unity'}, got: $RESOLVE_USE"
  exit 1
fi

echo "  ✓ resolveExistingEngine('unity') -> action=use, engine=unity"

# The ASCII-only regex check runs inside node because JSON.stringify does
# NOT escape BMP characters (e.g. an em-dash stays as raw UTF-8, NOT as
# '\u2014'), so a bash pattern match against '\u2014' would never fire.
# The node script sets a sentinel prefix on failure; bash then detects it.
RESOLVE_RESELECT=$(cd "$ROOT_DIR" && node --input-type=module -e "
  const { resolveExistingEngine } = await import('./dist/cli/wizard/prompts.js');
  const r = resolveExistingEngine('does-not-exist');
  if (r.action === 'reselect' && /[^\x00-\x7F]/.test(r.warning)) {
    process.stdout.write('NON_ASCII_WARNING:' + JSON.stringify(r));
  } else {
    process.stdout.write(JSON.stringify(r));
  }
" 2>/dev/null)

if [[ "$RESOLVE_RESELECT" == NON_ASCII_WARNING:* ]]; then
  echo "Assertion failed: reselect warning contains non-ASCII characters (em-dash regression?): $RESOLVE_RESELECT"
  exit 1
fi
if [[ "$RESOLVE_RESELECT" != *'"action":"reselect"'* ]]; then
  echo "Assertion failed: resolveExistingEngine('does-not-exist') should have action='reselect', got: $RESOLVE_RESELECT"
  exit 1
fi
if [[ "$RESOLVE_RESELECT" != *'Unknown engine'* ]]; then
  echo "Assertion failed: reselect warning should contain 'Unknown engine', got: $RESOLVE_RESELECT"
  exit 1
fi
if [[ "$RESOLVE_RESELECT" != *'--'* ]]; then
  echo "Assertion failed: reselect warning should contain ASCII '--' separator, got: $RESOLVE_RESELECT"
  exit 1
fi

echo "  ✓ resolveExistingEngine('does-not-exist') -> action=reselect, ASCII-only warning, contains 'Unknown engine' + '--'"

RESOLVE_PROMPT=$(cd "$ROOT_DIR" && node --input-type=module -e "
  const { resolveExistingEngine } = await import('./dist/cli/wizard/prompts.js');
  process.stdout.write(JSON.stringify(resolveExistingEngine(null)));
" 2>/dev/null)

if [[ "$RESOLVE_PROMPT" != *'"action":"prompt"'* ]]; then
  echo "Assertion failed: resolveExistingEngine(null) should be {action:'prompt'}, got: $RESOLVE_PROMPT"
  exit 1
fi

echo "  ✓ resolveExistingEngine(null) -> action=prompt (fresh init)"

# Whitespace tolerance: loadConfig does not trim .unikit.json.engine, so the
# resolver must accept ' unity ' and normalize it to the trimmed id.
RESOLVE_TRIMMED=$(cd "$ROOT_DIR" && node --input-type=module -e "
  const { resolveExistingEngine } = await import('./dist/cli/wizard/prompts.js');
  process.stdout.write(JSON.stringify(resolveExistingEngine(' unity ')));
" 2>/dev/null)

if [[ "$RESOLVE_TRIMMED" != *'"action":"use"'* ]] || [[ "$RESOLVE_TRIMMED" != *'"engine":"unity"'* ]]; then
  echo "Assertion failed: resolveExistingEngine(' unity ') should be {action:'use', engine:'unity'} after trim, got: $RESOLVE_TRIMMED"
  exit 1
fi

echo "  ✓ resolveExistingEngine(' unity ') -> action=use, engine=unity (trim applied)"

# ─────────────────────────────────────────────────────
# Final sweep: agent-filter markers must not leak into any install
# ─────────────────────────────────────────────────────
# Every installed SKILL.md and subagent .md across every test scenario in
# this script (codex / claude / godot / backward-
# compat) must have its <!-- unikit:agents ... --> / <!-- unikit:end -->
# markers stripped — both when the guarded block is kept for the target
# agent and when it is cut for a non-listed agent. A single leaked marker
# here means installSkillWithTransformer (or one of the subagent install
# paths) reintroduced the raw source after copyDirectory.

LEAK_FILES=$(grep -rlE 'unikit:agents|unikit:end' "$TMPDIR" \
  --include='SKILL.md' --include='*.md' 2>/dev/null || true)

if [[ -n "$LEAK_FILES" ]]; then
  echo "Assertion failed: agent-filter markers leaked into installed files"
  echo "--- leaked files ---"
  while IFS= read -r leak; do
    echo "  $leak"
    grep -nE 'unikit:agents|unikit:end' "$leak" | head -3 | sed 's/^/    /'
  done <<< "$LEAK_FILES"
  echo "  ---"
  exit 1
fi

SWEPT_FILE_COUNT=$(find "$TMPDIR" \( -name 'SKILL.md' -o -path '*/agents/*.md' \) -type f 2>/dev/null | wc -l | tr -d ' ')
echo "  ✓ agent-filter no-leak sweep: 0 leaks across $SWEPT_FILE_COUNT installed files"

echo ""
echo "install smoke tests passed"
