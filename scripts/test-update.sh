#!/bin/bash
# Smoke tests: validates unikit-ai update status model and --force behavior
# Usage: ./scripts/test-update.sh
#
# Scope note — rules coverage:
# The detailed `rules install` / `rules sync` / `rules status` /
# `rules registry` assertions live in scripts/test-rules-*.sh. The
# rule-file assertions that remain in this file check that `update`
# correctly integrates with syncRulesState (seeded rules survive
# update, engine switch refreshes per-engine rules, zero-agent update
# still runs sync). Those are end-to-end update smoke, not duplicated
# `rules *` CLI coverage.

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

PROJECT_DIR="$TMPDIR/update-smoke"
mkdir -p "$PROJECT_DIR"

# Ensure dist/ is up to date for CLI smoke tests (skipped when parent built).
ensure_build

# seed_rule / assert_contains / assert_exists / assert_not_exists now live
# in test-fixtures.sh (sourced above).

# Seed a .unikit.json with some installed skills (including a nonexistent one)
cat > "$PROJECT_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": {
    "servers": []
  },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit", "unikit-plan", "unikit-nonexistent"],
      "installedSubagents": ["unikit-architecture-sidecar"]
    }
  ],
  "rules": {
    "installed": {
      "version": "1.0.0",
      "core": ["code-style", "design-principles", "folders-structure", "performance", "testing"],
      "stack": ["unitask", "r3"]
    }
  }
}
EOF
inject_fake_registry "$PROJECT_DIR"

run_update() {
  local mode="$1"
  local output_file="$2"
  if [[ "$mode" == "force" ]]; then
    (cd "$PROJECT_DIR" && node "$ROOT_DIR/dist/cli/index.js" update --force > "$output_file" 2>&1)
  else
    (cd "$PROJECT_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$output_file" 2>&1)
  fi
}

FIRST_OUTPUT="$TMPDIR/update-first.log"
SECOND_OUTPUT="$TMPDIR/update-second.log"
FORCE_OUTPUT="$TMPDIR/update-force.log"

# Seed core rule files so syncRulesState discovers them as source=local and
# regenerates RULES_INDEX.md. Without this, Phase 1 would scrub the config
# state (empty disk → empty entries) and the assertions below would fail.
seed_rule "$PROJECT_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"
seed_rule "$PROJECT_DIR" unity core "$CORE_RULE_UNITY_DESIGN_PRINCIPLES"
seed_rule "$PROJECT_DIR" unity stack "$STACK_RULE_UNITY_UNITASK"

# ─────────────────────────────────────────────
# Test 1: First update - repair missing managed state, remove nonexistent skill
# ─────────────────────────────────────────────
run_update normal "$FIRST_OUTPUT"
assert_contains "$FIRST_OUTPUT" "\[claude\] Skills status:" "status section must be printed"
assert_contains "$FIRST_OUTPUT" "changed: [0-9]+" "changed counter must be printed"
assert_contains "$FIRST_OUTPUT" "skipped: [0-9]+" "skipped counter must be printed"
assert_contains "$FIRST_OUTPUT" "removed: [0-9]+" "removed counter must be printed"
assert_contains "$FIRST_OUTPUT" "unikit-nonexistent .removed from package." "removed package skill must be reported"
assert_contains "$FIRST_OUTPUT" "WARN: managed state recovered" "managed state recovery warning expected on first run"

# Skills should be installed on disk
assert_exists "$PROJECT_DIR/.claude/skills/unikit/SKILL.md" "unikit skill must be installed"
assert_exists "$PROJECT_DIR/.claude/skills/unikit-plan/SKILL.md" "unikit-plan skill must be installed"

# Subagents SHOULD be installed for claude (supportsSubagents: true)
assert_exists "$PROJECT_DIR/.claude/agents/unikit-architecture-sidecar.md" "subagent files must be installed for claude"

# Rules should be installed
assert_exists "$PROJECT_DIR/.unikit/memory/core/${CORE_RULE_UNITY_CODE_STYLE}.md" "core rule must be installed"
assert_exists "$PROJECT_DIR/.unikit/memory/stack/${STACK_RULE_UNITY_UNITASK}.md" "stack rule must be installed"
assert_exists "$PROJECT_DIR/.unikit/memory/RULES_INDEX.md" "RULES_INDEX.md must be generated"

# Engine templates should be installed
assert_exists "$PROJECT_DIR/.claude/skills/unikit/references/ENGINE_RULES.md" "ENGINE_RULES.md must be installed for unikit"

# Managed state should be persisted
node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  const m = c.agents[0].managedSkills || {};
  if (!m['unikit'] || !m['unikit-plan']) { process.exit(1); }
" "$PROJECT_DIR/.unikit.json"

echo "  ✓ first update: status, removal, managed state, file installation, engine templates"

# ─────────────────────────────────────────────
# Test 2: Second update - should converge to unchanged
# ─────────────────────────────────────────────
run_update normal "$SECOND_OUTPUT"
assert_contains "$SECOND_OUTPUT" "unchanged: [0-9]+" "unchanged counter must be printed"
assert_contains "$SECOND_OUTPUT" "changed: 0" "second run should not report changed skills in steady state"

echo "  ✓ second update: idempotent (changed: 0)"

# ─────────────────────────────────────────────
# Test 3: Force update - should report force mode and changed entries
# ─────────────────────────────────────────────
run_update force "$FORCE_OUTPUT"
assert_contains "$FORCE_OUTPUT" "Force mode enabled" "force mode banner expected"
assert_contains "$FORCE_OUTPUT" "changed: [0-9]+" "force run should report changed skills"
assert_contains "$FORCE_OUTPUT" "force reinstall" "force reason should be visible"

echo "  ✓ force update: force mode reported, skills reinstalled"

# ─────────────────────────────────────────────
# Test 4: Nonexistent skill should be removed from config
# ─────────────────────────────────────────────
STILL_HAS_NONEXISTENT=$(node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  const skills = c.agents[0].installedSkills || [];
  console.log(skills.includes('unikit-nonexistent') ? 'yes' : 'no');
" "$PROJECT_DIR/.unikit.json")

if [[ "$STILL_HAS_NONEXISTENT" == "no" ]]; then
  echo "  ✓ nonexistent skill removed from config"
else
  echo "Assertion failed: unikit-nonexistent should be removed from installedSkills"
  exit 1
fi

# ─────────────────────────────────────────────
# Test 5: Drift detection - local modifications trigger warning and reinstall
# ─────────────────────────────────────────────
DRIFT_OUTPUT="$TMPDIR/update-drift.log"

# Modify installed skill to simulate local edits
echo "<!-- local edit -->" >> "$PROJECT_DIR/.claude/skills/unikit/SKILL.md"

run_update normal "$DRIFT_OUTPUT"
assert_contains "$DRIFT_OUTPUT" "Local modifications detected" "drift warning must be printed"
assert_contains "$DRIFT_OUTPUT" "unikit" "drifted skill name must appear in output"

# Verify the local edit was overwritten (file should not contain our marker)
if grep -q "<!-- local edit -->" "$PROJECT_DIR/.claude/skills/unikit/SKILL.md"; then
  echo "Assertion failed: drifted skill should be overwritten by update"
  exit 1
fi

echo "  ✓ drift detection: warning printed, skill restored"

# ─────────────────────────────────────────────
# Test 6: Engine template drift detection
# ─────────────────────────────────────────────
TEMPLATE_DRIFT_OUTPUT="$TMPDIR/update-template-drift.log"

# Modify the ENGINE_RULES.md to simulate template drift
echo "<!-- template drift -->" >> "$PROJECT_DIR/.claude/skills/unikit/references/ENGINE_RULES.md"

run_update normal "$TEMPLATE_DRIFT_OUTPUT"

# After update, the drifted template should be restored
if grep -q "<!-- template drift -->" "$PROJECT_DIR/.claude/skills/unikit/references/ENGINE_RULES.md"; then
  echo "Assertion failed: drifted ENGINE_RULES.md should be restored by update"
  exit 1
fi

echo "  ✓ engine template drift: ENGINE_RULES.md restored after modification"

# ─────────────────────────────────────────────
# Test 7: Backward compat update - old MCP format + missing engine
# ─────────────────────────────────────────────
COMPAT_DIR="$TMPDIR/update-compat"
mkdir -p "$COMPAT_DIR"

# Old config format: no engine, old MCP format
cat > "$COMPAT_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engineMcpKey": null,
  "mcp": {
    "servers": []
  },
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
    "installed": {
      "version": "1.0.0",
      "core": ["code-style"],
      "stack": []
    }
  }
}
EOF

seed_rule "$COMPAT_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"
COMPAT_OUTPUT="$TMPDIR/update-compat.log"
(cd "$COMPAT_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$COMPAT_OUTPUT" 2>&1)

# Should default to unity engine
assert_contains "$COMPAT_OUTPUT" "Engine: unity" "backward compat should show unity engine"

# Should preserve the seeded core rule (sync tags it as source=local).
assert_exists "$COMPAT_DIR/.unikit/memory/core/${CORE_RULE_UNITY_CODE_STYLE}.md" "backward compat: core rule present"

# Config should now have engine and new MCP format
COMPAT_ENGINE=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(c.engine || 'missing');
" "$COMPAT_DIR/.unikit.json")

COMPAT_MCP=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const mcp = c.mcp;
  if (!mcp || !Array.isArray(mcp.servers)) { console.log('old'); process.exit(0); }
  console.log('new-global');
" "$COMPAT_DIR/.unikit.json")

if [[ "$COMPAT_ENGINE" == "unity" && "$COMPAT_MCP" == "new-global" ]]; then
  echo "  ✓ backward compat: engine defaulted to unity, MCP normalized to global format"
else
  echo "Assertion failed: backward compat - engine=$COMPAT_ENGINE (expected unity), mcp=$COMPAT_MCP (expected new-global)"
  exit 1
fi

# ─────────────────────────────────────────────
# Test 8: Subagent hash-based update (claude agent)
# ─────────────────────────────────────────────
CLAUDE_DIR="$TMPDIR/update-claude"
mkdir -p "$CLAUDE_DIR"

cat > "$CLAUDE_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit"],
      "installedSubagents": ["unikit-architecture-sidecar"]
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": ["code-style"], "stack": [] }
  }
}
EOF
inject_fake_registry "$CLAUDE_DIR"

seed_rule "$CLAUDE_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"
CLAUDE_OUTPUT="$TMPDIR/update-claude.log"
(cd "$CLAUDE_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$CLAUDE_OUTPUT" 2>&1)

# Subagent files should be installed
assert_exists "$CLAUDE_DIR/.claude/agents/unikit-architecture-sidecar.md" "subagent must be installed for claude"

# managedSubagents hash state should be persisted
node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  const m = c.agents[0].managedSubagents || {};
  if (!m['unikit-architecture-sidecar'] || !m['unikit-architecture-sidecar'].sourceHash || !m['unikit-architecture-sidecar'].installedHash) {
    console.error('managedSubagents missing for unikit-architecture-sidecar');
    process.exit(1);
  }
" "$CLAUDE_DIR/.unikit.json"

# Second update should be idempotent (no changes)
CLAUDE_SECOND="$TMPDIR/update-claude-second.log"
(cd "$CLAUDE_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$CLAUDE_SECOND" 2>&1)
assert_contains "$CLAUDE_SECOND" "Subagents updated" "subagent update confirmation expected"

echo "  ✓ subagent hash tracking: installed, hash persisted, idempotent"

# ─────────────────────────────────────────────
# Test 9: source-hash-changed triggers reinstall
# ─────────────────────────────────────────────
HASH_DIR="$TMPDIR/update-hash"
mkdir -p "$HASH_DIR"

cat > "$HASH_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit", "unikit-plan"],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": ["code-style"], "stack": [] }
  }
}
EOF
inject_fake_registry "$HASH_DIR"

# First run to build managed state
HASH_FIRST="$TMPDIR/update-hash-first.log"
(cd "$HASH_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$HASH_FIRST" 2>&1)

# Tamper sourceHash for unikit to simulate a package update
node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  c.agents[0].managedSkills['unikit'].sourceHash = 'fake-hash-000';
  fs.writeFileSync(process.argv[1], JSON.stringify(c, null, 2));
" "$HASH_DIR/.unikit.json"

HASH_OUTPUT="$TMPDIR/update-hash-changed.log"
(cd "$HASH_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$HASH_OUTPUT" 2>&1)

assert_contains "$HASH_OUTPUT" "source changed" "source-hash-changed must report 'source changed' reason"
assert_contains "$HASH_OUTPUT" "Changed:" "Changed section must be printed"
assert_contains "$HASH_OUTPUT" "unikit" "unikit skill must appear in changed list"

echo "  ✓ source-hash-changed: tampered hash triggers reinstall with 'source changed' reason"

# ─────────────────────────────────────────────
# Test 10: missing-installed-artifact recovery
# ─────────────────────────────────────────────
ARTIFACT_DIR="$TMPDIR/update-artifact"
mkdir -p "$ARTIFACT_DIR"

cat > "$ARTIFACT_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit", "unikit-plan"],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": ["code-style"], "stack": [] }
  }
}
EOF
inject_fake_registry "$ARTIFACT_DIR"

# First run to install and build managed state
ARTIFACT_FIRST="$TMPDIR/update-artifact-first.log"
(cd "$ARTIFACT_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$ARTIFACT_FIRST" 2>&1)
assert_exists "$ARTIFACT_DIR/.claude/skills/unikit/SKILL.md" "unikit must be installed before artifact test"

# Delete the skill directory to simulate missing artifact
rm -rf "$ARTIFACT_DIR/.claude/skills/unikit"

ARTIFACT_OUTPUT="$TMPDIR/update-artifact-recovery.log"
(cd "$ARTIFACT_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$ARTIFACT_OUTPUT" 2>&1)

assert_contains "$ARTIFACT_OUTPUT" "managed state recovered" "missing artifact must trigger recovery warning"
assert_contains "$ARTIFACT_OUTPUT" "artifact missing" "missing artifact reason text must appear"
assert_exists "$ARTIFACT_DIR/.claude/skills/unikit/SKILL.md" "unikit must be reinstalled after artifact recovery"

echo "  ✓ missing-installed-artifact: deleted skill recovered with 'artifact missing' reason"

# ─────────────────────────────────────────────
# Test 11: subagent drift detection
# ─────────────────────────────────────────────
SA_DRIFT_DIR="$TMPDIR/update-sa-drift"
mkdir -p "$SA_DRIFT_DIR"

cat > "$SA_DRIFT_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit"],
      "installedSubagents": ["unikit-architecture-sidecar"]
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": ["code-style"], "stack": [] }
  }
}
EOF
inject_fake_registry "$SA_DRIFT_DIR"

# First run to install subagent and build managed state
SA_DRIFT_FIRST="$TMPDIR/update-sa-drift-first.log"
(cd "$SA_DRIFT_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$SA_DRIFT_FIRST" 2>&1)
assert_exists "$SA_DRIFT_DIR/.claude/agents/unikit-architecture-sidecar.md" "subagent must be installed before drift test"

# Save original content for comparison
ORIGINAL_SA_CONTENT=$(cat "$SA_DRIFT_DIR/.claude/agents/unikit-architecture-sidecar.md")

# Modify the subagent file to simulate local edits
echo "<!-- local subagent edit -->" >> "$SA_DRIFT_DIR/.claude/agents/unikit-architecture-sidecar.md"

SA_DRIFT_OUTPUT="$TMPDIR/update-sa-drift.log"
(cd "$SA_DRIFT_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$SA_DRIFT_OUTPUT" 2>&1)

# Verify warning was printed (console.warn goes to stderr, captured via 2>&1)
assert_contains "$SA_DRIFT_OUTPUT" "Local modifications detected in subagent" "subagent drift warning must be printed"

# Verify the file was restored (local edit overwritten)
if grep -q "<!-- local subagent edit -->" "$SA_DRIFT_DIR/.claude/agents/unikit-architecture-sidecar.md"; then
  echo "Assertion failed: drifted subagent should be overwritten by update"
  exit 1
fi

echo "  ✓ subagent drift: warning printed, subagent file restored"

# ─────────────────────────────────────────────
# Test 12: multi-agent update
# ─────────────────────────────────────────────
MULTI_DIR="$TMPDIR/update-multi"
mkdir -p "$MULTI_DIR"

cat > "$MULTI_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit", "unikit-plan"],
      "installedSubagents": ["unikit-architecture-sidecar"]
    },
    {
      "id": "codex",
      "skillsDir": ".codex/skills",
      "subagentsDir": ".codex/agents",
      "installedSkills": ["unikit", "unikit-plan"],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": ["code-style"], "stack": [] }
  }
}
EOF
inject_fake_registry "$MULTI_DIR"

MULTI_OUTPUT="$TMPDIR/update-multi.log"
(cd "$MULTI_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$MULTI_OUTPUT" 2>&1)

# Both agents must have per-agent status sections
assert_contains "$MULTI_OUTPUT" "\[claude\] Skills status:" "claude agent status section must be printed"
assert_contains "$MULTI_OUTPUT" "\[codex\] Skills status:" "codex agent status section must be printed"

# Both agents must have skills installed on disk
assert_exists "$MULTI_DIR/.claude/skills/unikit/SKILL.md" "claude must have unikit skill installed"
assert_exists "$MULTI_DIR/.codex/skills/unikit/SKILL.md" "codex must have unikit skill installed"

# Claude should also have subagent installed
assert_exists "$MULTI_DIR/.claude/agents/unikit-architecture-sidecar.md" "claude must have subagent installed"

# Codex should NOT have subagents (supportsSubagents: false)
assert_not_exists "$MULTI_DIR/.codex/agents/unikit-architecture-sidecar.md" "codex must not have subagent files"

echo "  ✓ multi-agent update: both agents get skills, per-agent status sections printed"

# ─────────────────────────────────────────────
# Test 13: update with no config - error path
# ─────────────────────────────────────────────
NOCONFIG_DIR="$TMPDIR/update-noconfig"
mkdir -p "$NOCONFIG_DIR"

NOCONFIG_OUTPUT="$TMPDIR/update-noconfig.log"
EXIT_CODE=0
(cd "$NOCONFIG_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$NOCONFIG_OUTPUT" 2>&1) || EXIT_CODE=$?

if [[ "$EXIT_CODE" -eq 0 ]]; then
  echo "Assertion failed: update without .unikit.json should exit non-zero"
  exit 1
fi

assert_contains "$NOCONFIG_OUTPUT" "No .unikit.json found" "missing config error message expected"

echo "  ✓ no-config error path: non-zero exit + 'No .unikit.json found' message"

# ─────────────────────────────────────────────
# Test 14: engine switch triggers full reinstall
# ─────────────────────────────────────────────
ENGINE_DIR="$TMPDIR/update-engine"
mkdir -p "$ENGINE_DIR"

cat > "$ENGINE_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit", "unikit-plan"],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": ["code-style"], "stack": [] }
  }
}
EOF
inject_fake_registry "$ENGINE_DIR"

# Seed unity rule, run first update, then switch engine and verify only skills
# reinstall — rules are now engine-scoped via the registry, not via bundled
# per-engine directories. The sync pass will drop unity-specific rules if they
# no longer match the new engine's registry, but seeded local rules are kept.
seed_rule "$ENGINE_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"

# First run with unity engine to build managed state
ENGINE_FIRST="$TMPDIR/update-engine-first.log"
(cd "$ENGINE_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$ENGINE_FIRST" 2>&1)

# Switch engine to godot
node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  c.engine = 'godot';
  fs.writeFileSync(process.argv[1], JSON.stringify(c, null, 2));
" "$ENGINE_DIR/.unikit.json"

# Re-seed code-style from the godot engine snapshot so it survives the switch.
seed_rule "$ENGINE_DIR" godot core "$CORE_RULE_GODOT_CODE_STYLE"

ENGINE_OUTPUT="$TMPDIR/update-engine-switch.log"
(cd "$ENGINE_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$ENGINE_OUTPUT" 2>&1)

# Engine switch should trigger reinstall (source hash includes engine ID)
assert_contains "$ENGINE_OUTPUT" "Engine: godot" "engine must be reported as godot"
assert_contains "$ENGINE_OUTPUT" "changed: [1-9]" "engine switch must trigger at least 1 changed skill"

# ENGINE_RULES.md should reflect Godot (not Unity)
assert_exists "$ENGINE_DIR/.claude/skills/unikit/references/ENGINE_RULES.md" "ENGINE_RULES.md must exist after engine switch"
if grep -q "Godot" "$ENGINE_DIR/.claude/skills/unikit/references/ENGINE_RULES.md"; then
  :  # expected
else
  echo "Assertion failed: ENGINE_RULES.md should contain 'Godot' after engine switch"
  exit 1
fi

# Godot core rule must be present after the seed + sync cycle.
assert_exists "$ENGINE_DIR/.unikit/memory/core/${CORE_RULE_GODOT_CODE_STYLE}.md" "godot core rule present after switch"

echo "  ✓ engine switch: unity->godot triggers reinstall, ENGINE_RULES shows Godot, core rule preserved"

# ─────────────────────────────────────────────
# Test 15: new skill in package - per-skill output
# ─────────────────────────────────────────────
NEWSKILL_DIR="$TMPDIR/update-newskill"
mkdir -p "$NEWSKILL_DIR"

# Config with only one skill installed - all other package skills should appear as "new in package"
cat > "$NEWSKILL_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
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
    "installed": { "version": "1.0.0", "core": ["code-style"], "stack": [] }
  }
}
EOF
inject_fake_registry "$NEWSKILL_DIR"

NEWSKILL_OUTPUT="$TMPDIR/update-newskill.log"
(cd "$NEWSKILL_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$NEWSKILL_OUTPUT" 2>&1)

assert_contains "$NEWSKILL_OUTPUT" "Skipped:" "Skipped section must be printed for new-in-package skills"
assert_contains "$NEWSKILL_OUTPUT" "new in package" "new-in-package reason text must appear"
assert_contains "$NEWSKILL_OUTPUT" "unikit-plan" "specific skill name (unikit-plan) must appear in skipped list"

echo "  ✓ new skill in package: per-skill name + 'new in package' reason in Skipped section"

# ─────────────────────────────────────────────
# Test 16: legacy declined field is silently dropped on load
# ─────────────────────────────────────────────
# The `declined` field was removed from UniKitConfig in the registry refactor.
# Existing .unikit.json files containing `declined` must still load without
# errors — the field is silently ignored by normalizeRulesInstallation and
# omitted from the saved output.
LEGACY_DIR="$TMPDIR/update-legacy-declined"
mkdir -p "$LEGACY_DIR"

cat > "$LEGACY_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": ["FOO", "BAR"]
  }
}
EOF
inject_fake_registry "$LEGACY_DIR"

LEGACY_OUTPUT="$TMPDIR/update-legacy-declined.log"
LEGACY_EXIT=0
(cd "$LEGACY_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$LEGACY_OUTPUT" 2>&1) || LEGACY_EXIT=$?

if [[ "$LEGACY_EXIT" -ne 0 ]]; then
  echo "Assertion failed: legacy .unikit.json with 'declined' must not break update"
  cat "$LEGACY_OUTPUT"
  exit 1
fi

# After save, the declined field must be gone from the config.
LEGACY_HAS_DECLINED=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(c.rules && c.rules.declined !== undefined ? 'yes' : 'no');
" "$LEGACY_DIR/.unikit.json")

if [[ "$LEGACY_HAS_DECLINED" == "no" ]]; then
  echo "  ✓ legacy declined: field silently dropped on load, absent after save"
else
  echo "Assertion failed: legacy 'declined' field must be dropped after update"
  cat "$LEGACY_DIR/.unikit.json"
  exit 1
fi

# ─────────────────────────────────────────────
# Test 17: subagent removed from package
# ─────────────────────────────────────────────
SA_REMOVED_DIR="$TMPDIR/update-sa-removed"
mkdir -p "$SA_REMOVED_DIR"

cat > "$SA_REMOVED_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit"],
      "installedSubagents": ["unikit-architecture-sidecar", "unikit-nonexistent-sa"]
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": ["code-style"], "stack": [] }
  }
}
EOF
inject_fake_registry "$SA_REMOVED_DIR"

SA_REMOVED_OUTPUT="$TMPDIR/update-sa-removed.log"
(cd "$SA_REMOVED_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$SA_REMOVED_OUTPUT" 2>&1)

# Verify the nonexistent subagent was removed from config (no CLI output for subagent entries)
SA_STILL_HAS=$(node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  const subs = c.agents[0].installedSubagents || [];
  console.log(subs.includes('unikit-nonexistent-sa') ? 'yes' : 'no');
" "$SA_REMOVED_DIR/.unikit.json")

if [[ "$SA_STILL_HAS" == "no" ]]; then
  :  # expected
else
  echo "Assertion failed: unikit-nonexistent-sa should be removed from installedSubagents"
  exit 1
fi

# Valid subagent should still be in the list
SA_HAS_VALID=$(node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  const subs = c.agents[0].installedSubagents || [];
  console.log(subs.includes('unikit-architecture-sidecar') ? 'yes' : 'no');
" "$SA_REMOVED_DIR/.unikit.json")

if [[ "$SA_HAS_VALID" == "yes" ]]; then
  :  # expected
else
  echo "Assertion failed: unikit-architecture-sidecar should still be in installedSubagents"
  exit 1
fi

echo "  ✓ subagent removed from package: nonexistent subagent removed from config, valid retained"

# ─────────────────────────────────────────────
# Test 18: skill-context warning on changed skill
# ─────────────────────────────────────────────
SKILLCTX_DIR="$TMPDIR/update-skillctx"
mkdir -p "$SKILLCTX_DIR"

cat > "$SKILLCTX_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
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
    "installed": { "version": "1.0.0", "core": ["code-style"], "stack": [] }
  }
}
EOF
inject_fake_registry "$SKILLCTX_DIR"

# First run to build managed state
SKILLCTX_FIRST="$TMPDIR/update-skillctx-first.log"
(cd "$SKILLCTX_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$SKILLCTX_FIRST" 2>&1)

# Create skill-context override for unikit
mkdir -p "$SKILLCTX_DIR/.unikit/skill-context/unikit"
echo "# Custom skill-context override" > "$SKILLCTX_DIR/.unikit/skill-context/unikit/SKILL.md"

# Tamper sourceHash to force a "changed" entry for unikit
node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  c.agents[0].managedSkills['unikit'].sourceHash = 'fake-hash-ctx';
  fs.writeFileSync(process.argv[1], JSON.stringify(c, null, 2));
" "$SKILLCTX_DIR/.unikit.json"

SKILLCTX_OUTPUT="$TMPDIR/update-skillctx.log"
(cd "$SKILLCTX_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$SKILLCTX_OUTPUT" 2>&1)

assert_contains "$SKILLCTX_OUTPUT" "skill-context override may need review" "skill-context warning must be printed"
assert_contains "$SKILLCTX_OUTPUT" "unikit" "skill name must appear in skill-context warning"

echo "  ✓ skill-context warning: changed skill with skill-context triggers review warning"

# ─────────────────────────────────────────────
# Test 19: corrupted .unikit.json - error path
# ─────────────────────────────────────────────
CORRUPT_DIR="$TMPDIR/update-corrupt"
mkdir -p "$CORRUPT_DIR"

# Write invalid JSON
echo "{ this is not valid json !!!" > "$CORRUPT_DIR/.unikit.json"

CORRUPT_OUTPUT="$TMPDIR/update-corrupt.log"
EXIT_CODE=0
(cd "$CORRUPT_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$CORRUPT_OUTPUT" 2>&1) || EXIT_CODE=$?

if [[ "$EXIT_CODE" -eq 0 ]]; then
  echo "Assertion failed: update with corrupted .unikit.json should exit non-zero"
  exit 1
fi

assert_contains "$CORRUPT_OUTPUT" "No .unikit.json found" "corrupted config must produce 'No .unikit.json found' error"

echo "  ✓ corrupted config: non-zero exit + error message"

# ─────────────────────────────────────────────
# Test 20: subagent source-hash-changed triggers reinstall
# ─────────────────────────────────────────────
SA_HASH_DIR="$TMPDIR/update-sa-hash"
mkdir -p "$SA_HASH_DIR"

cat > "$SA_HASH_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit"],
      "installedSubagents": ["unikit-architecture-sidecar"]
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": ["code-style"], "stack": [] }
  }
}
EOF
inject_fake_registry "$SA_HASH_DIR"

# First run to build managed state
SA_HASH_FIRST="$TMPDIR/update-sa-hash-first.log"
(cd "$SA_HASH_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$SA_HASH_FIRST" 2>&1)
assert_exists "$SA_HASH_DIR/.claude/agents/unikit-architecture-sidecar.md" "subagent must be installed before hash test"

# Tamper managedSubagents sourceHash
node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  c.agents[0].managedSubagents['unikit-architecture-sidecar'].sourceHash = 'fake-sa-hash-000';
  fs.writeFileSync(process.argv[1], JSON.stringify(c, null, 2));
" "$SA_HASH_DIR/.unikit.json"

SA_HASH_OUTPUT="$TMPDIR/update-sa-hash-changed.log"
(cd "$SA_HASH_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$SA_HASH_OUTPUT" 2>&1)

# Verify subagent file still exists (was reinstalled)
assert_exists "$SA_HASH_DIR/.claude/agents/unikit-architecture-sidecar.md" "subagent must be reinstalled after hash tamper"

# Verify managedSubagents hash was updated (no longer fake)
node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  const m = c.agents[0].managedSubagents || {};
  if (!m['unikit-architecture-sidecar']) { console.error('managedSubagents missing'); process.exit(1); }
  if (m['unikit-architecture-sidecar'].sourceHash === 'fake-sa-hash-000') {
    console.error('sourceHash was not updated after reinstall');
    process.exit(1);
  }
" "$SA_HASH_DIR/.unikit.json"

echo "  ✓ subagent source-hash-changed: tampered hash triggers reinstall"

# ─────────────────────────────────────────────
# Test 21: subagent missing-installed-artifact recovery
# ─────────────────────────────────────────────
SA_ARTIFACT_DIR="$TMPDIR/update-sa-artifact"
mkdir -p "$SA_ARTIFACT_DIR"

cat > "$SA_ARTIFACT_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit"],
      "installedSubagents": ["unikit-architecture-sidecar"]
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": ["code-style"], "stack": [] }
  }
}
EOF
inject_fake_registry "$SA_ARTIFACT_DIR"

# First run to install subagent and build managed state
SA_ARTIFACT_FIRST="$TMPDIR/update-sa-artifact-first.log"
(cd "$SA_ARTIFACT_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$SA_ARTIFACT_FIRST" 2>&1)
assert_exists "$SA_ARTIFACT_DIR/.claude/agents/unikit-architecture-sidecar.md" "subagent must be installed before artifact test"

# Delete the subagent file to simulate missing artifact
rm "$SA_ARTIFACT_DIR/.claude/agents/unikit-architecture-sidecar.md"

SA_ARTIFACT_OUTPUT="$TMPDIR/update-sa-artifact-recovery.log"
(cd "$SA_ARTIFACT_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$SA_ARTIFACT_OUTPUT" 2>&1)

# Verify subagent file was restored
assert_exists "$SA_ARTIFACT_DIR/.claude/agents/unikit-architecture-sidecar.md" "subagent must be reinstalled after deletion"

echo "  ✓ subagent missing-installed-artifact: deleted subagent file recovered"

# ─────────────────────────────────────────────
# Test 22: zero agents in config
# ─────────────────────────────────────────────
ZERO_DIR="$TMPDIR/update-zero-agents"
mkdir -p "$ZERO_DIR"

cat > "$ZERO_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [],
  "rules": {
    "installed": { "version": "1.0.0", "core": ["code-style", "design-principles"], "stack": [] }
  }
}
EOF
inject_fake_registry "$ZERO_DIR"

seed_rule "$ZERO_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"
seed_rule "$ZERO_DIR" unity core "$CORE_RULE_UNITY_DESIGN_PRINCIPLES"
ZERO_OUTPUT="$TMPDIR/update-zero-agents.log"
EXIT_CODE=0
(cd "$ZERO_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$ZERO_OUTPUT" 2>&1) || EXIT_CODE=$?

if [[ "$EXIT_CODE" -ne 0 ]]; then
  echo "Assertion failed: update with zero agents should exit 0 (got $EXIT_CODE)"
  cat "$ZERO_OUTPUT"
  exit 1
fi

# Seeded rules must survive the update (sync tags them source=local).
assert_exists "$ZERO_DIR/.unikit/memory/core/${CORE_RULE_UNITY_CODE_STYLE}.md" "core rule present with zero agents"
assert_exists "$ZERO_DIR/.unikit/memory/core/${CORE_RULE_UNITY_DESIGN_PRINCIPLES}.md" "second core rule present with zero agents"
assert_exists "$ZERO_DIR/.unikit/memory/RULES_INDEX.md" "RULES_INDEX.md must be generated with zero agents"

echo "  ✓ zero agents: no crash, seeded rules preserved"

# Test 23 removed: the "New rules available" notification was produced by the
# legacy updateRules() → RuleUpdateEntry flow. The new syncRulesState approach
# only reports updates for rules that are already in state (source=registry)
# or when --force promotes everything. New-rule discovery is now the job of
# `unikit-ai rules list` and the /unikit Step 9 registry lookup.

# ─────────────────────────────────────────────
# Test 24: extension missing manifest in update
# ─────────────────────────────────────────────
EXTMISSING_DIR="$TMPDIR/update-ext-missing"
mkdir -p "$EXTMISSING_DIR"

EXAMPLE_EXT_DIR="$ROOT_DIR/examples/extensions/unikit-ext-hello"

cat > "$EXTMISSING_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit"],
      "installedSubagents": ["unikit-architecture-sidecar"]
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": ["code-style"], "stack": [] }
  }
}
EOF
inject_fake_registry "$EXTMISSING_DIR"

# Install base skills first
(cd "$EXTMISSING_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)

# Add extension via CLI
(cd "$EXTMISSING_DIR" && node "$ROOT_DIR/dist/cli/index.js" extension add "$EXAMPLE_EXT_DIR" > /dev/null 2>&1)

# Verify extension was installed
assert_exists "$EXTMISSING_DIR/.unikit/extensions/unikit-ext-hello/extension.json" \
  "extension manifest must exist before deletion test"

# Delete extension.json from storage to simulate corrupted extension
rm "$EXTMISSING_DIR/.unikit/extensions/unikit-ext-hello/extension.json"

# Run update - should not crash (loadInstalledManifest returns null -> skip)
EXTMISSING_OUTPUT="$TMPDIR/update-ext-missing.log"
EXIT_CODE=0
(cd "$EXTMISSING_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$EXTMISSING_OUTPUT" 2>&1) || EXIT_CODE=$?

if [[ "$EXIT_CODE" -ne 0 ]]; then
  echo "Assertion failed: update with missing extension manifest should not crash (got exit $EXIT_CODE)"
  cat "$EXTMISSING_OUTPUT"
  exit 1
fi

# Base skills should still be updated successfully
assert_exists "$EXTMISSING_DIR/.claude/skills/unikit/SKILL.md" "base skill must survive extension manifest deletion"

echo "  ✓ extension missing manifest: update completes without crash, base skills intact"

# ─────────────────────────────────────────────
# Test 25: engine switch with extensions
# ─────────────────────────────────────────────
ENGEXT_DIR="$TMPDIR/update-eng-ext"
mkdir -p "$ENGEXT_DIR"

cat > "$ENGEXT_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit"],
      "installedSubagents": ["unikit-architecture-sidecar"]
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": ["code-style"], "stack": [] }
  }
}
EOF
inject_fake_registry "$ENGEXT_DIR"

# Install base skills with unity engine
(cd "$ENGEXT_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)

# Add extension
(cd "$ENGEXT_DIR" && node "$ROOT_DIR/dist/cli/index.js" extension add "$EXAMPLE_EXT_DIR" > /dev/null 2>&1)
assert_exists "$ENGEXT_DIR/.claude/skills/hello-world/SKILL.md" "extension skill must be installed before engine switch"

# Switch engine to godot
node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  c.engine = 'godot';
  fs.writeFileSync(process.argv[1], JSON.stringify(c, null, 2));
" "$ENGEXT_DIR/.unikit.json"

ENGEXT_OUTPUT="$TMPDIR/update-eng-ext.log"
(cd "$ENGEXT_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$ENGEXT_OUTPUT" 2>&1)

# Verify engine switched
assert_contains "$ENGEXT_OUTPUT" "Engine: godot" "engine must be reported as godot after switch"

# ENGINE_RULES.md should reflect Godot
assert_exists "$ENGEXT_DIR/.claude/skills/unikit/references/ENGINE_RULES.md" "ENGINE_RULES.md must exist after engine switch"
if grep -q "Godot" "$ENGEXT_DIR/.claude/skills/unikit/references/ENGINE_RULES.md"; then
  :  # expected
else
  echo "Assertion failed: ENGINE_RULES.md should contain 'Godot' after engine switch with extensions"
  exit 1
fi

# Extension skill should still exist (reinstalled during update)
assert_exists "$ENGEXT_DIR/.claude/skills/hello-world/SKILL.md" "extension skill must survive engine switch"

echo "  ✓ engine switch + extensions: Godot engine applied, extension skill preserved"

# ─────────────────────────────────────────────
# Test 26: subagent force reinstall
# ─────────────────────────────────────────────
SAFRC_DIR="$TMPDIR/update-sa-force"
mkdir -p "$SAFRC_DIR"

cat > "$SAFRC_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit"],
      "installedSubagents": ["unikit-architecture-sidecar"]
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] }
  }
}
EOF
inject_fake_registry "$SAFRC_DIR"

# Install base state with subagents
(cd "$SAFRC_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)

assert_exists "$SAFRC_DIR/.claude/agents/unikit-architecture-sidecar.md" "subagent must be installed before force test"

# Tamper with subagent file (add marker to detect reinstall)
echo "<!-- tampered -->" >> "$SAFRC_DIR/.claude/agents/unikit-architecture-sidecar.md"

# Run update --force
SAFRC_OUTPUT="$TMPDIR/update-sa-force.log"
(cd "$SAFRC_DIR" && node "$ROOT_DIR/dist/cli/index.js" update --force > "$SAFRC_OUTPUT" 2>&1)

# After force reinstall, tamper marker should be gone
if grep -q "<!-- tampered -->" "$SAFRC_DIR/.claude/agents/unikit-architecture-sidecar.md"; then
  echo "Assertion failed: subagent must be reinstalled after --force (tamper marker still present)"
  exit 1
fi

echo "  ✓ subagent force reinstall: --force overwrites tampered subagent file"

# ─────────────────────────────────────────────
# Test 27: subagent missing-managed-state triggers reinstall
# ─────────────────────────────────────────────
SAMMS_DIR="$TMPDIR/update-sa-mms"
mkdir -p "$SAMMS_DIR"

cat > "$SAMMS_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit"],
      "installedSubagents": ["unikit-architecture-sidecar"]
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] }
  }
}
EOF
inject_fake_registry "$SAMMS_DIR"

# Install base state to build managedSubagents
(cd "$SAMMS_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)

# Verify managedSubagents was created
SAMMS_HAS_MANAGED=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const agent = c.agents[0];
  console.log(agent.managedSubagents && Object.keys(agent.managedSubagents).length > 0 ? 'yes' : 'no');
" "$SAMMS_DIR/.unikit.json")

if [[ "$SAMMS_HAS_MANAGED" != "yes" ]]; then
  echo "Assertion failed: managedSubagents must exist after first update"
  exit 1
fi

# Delete managedSubagents from config and tamper the subagent file
node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  delete c.agents[0].managedSubagents;
  fs.writeFileSync(process.argv[1], JSON.stringify(c, null, 2));
" "$SAMMS_DIR/.unikit.json"

echo "<!-- tampered-mms -->" >> "$SAMMS_DIR/.claude/agents/unikit-architecture-sidecar.md"

# Run update - missing managed state should trigger reinstall
SAMMS_OUTPUT="$TMPDIR/update-sa-mms.log"
(cd "$SAMMS_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$SAMMS_OUTPUT" 2>&1)

# After reinstall, tamper marker should be gone
if grep -q "<!-- tampered-mms -->" "$SAMMS_DIR/.claude/agents/unikit-architecture-sidecar.md"; then
  echo "Assertion failed: subagent must be reinstalled when managedSubagents is missing"
  exit 1
fi

# managedSubagents should be rebuilt
SAMMS_RESTORED=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const agent = c.agents[0];
  console.log(agent.managedSubagents && Object.keys(agent.managedSubagents).length > 0 ? 'yes' : 'no');
" "$SAMMS_DIR/.unikit.json")

if [[ "$SAMMS_RESTORED" != "yes" ]]; then
  echo "Assertion failed: managedSubagents must be restored after update"
  exit 1
fi

echo "  ✓ subagent missing-managed-state: reinstalled and state restored"

# Test 28 removed: the `declined` field was removed from UniKitConfig in the
# registry refactor. The legacy migration path is covered by the "legacy
# declined field silently dropped" test (Test 16 in this file).

# ─────────────────────────────────────────────
# Test 29: dev-principles.md is refreshed on every update (not hash-tracked)
# ─────────────────────────────────────────────
DEVPRIN_DIR="$TMPDIR/update-test-dev-principles"
mkdir -p "$DEVPRIN_DIR"
cat > "$DEVPRIN_DIR/.unikit.json" << 'EOF'
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
  "rules": { "installed": { "version": "1.0.0", "core": [], "stack": [] } }
}
EOF
inject_fake_registry "$DEVPRIN_DIR"

DEVPRIN_OUT1="$TMPDIR/update-dev-principles-1.log"
(cd "$DEVPRIN_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$DEVPRIN_OUT1" 2>&1)
PRINCIPLES="$DEVPRIN_DIR/.unikit/system/dev-principles.md"
assert_exists "$PRINCIPLES" "dev-principles.md must be installed on first update"

echo "TAMPERED_BY_TEST" >> "$PRINCIPLES"

DEVPRIN_OUT2="$TMPDIR/update-dev-principles-2.log"
(cd "$DEVPRIN_DIR" && node "$ROOT_DIR/dist/cli/index.js" update > "$DEVPRIN_OUT2" 2>&1)

if grep -q "TAMPERED_BY_TEST" "$PRINCIPLES"; then
    echo "Assertion failed: update did NOT refresh dev-principles.md from data/ (tamper marker still present)"
    exit 1
fi

echo "  ✓ dev-principles.md: update refreshes from data/ (tamper marker removed)"

echo ""
echo "update smoke tests passed"
