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
# The dump has to run BEFORE the cleanup: `set -e` aborts on the first failed assertion,
# and the assertion message alone cannot say what the engine-mcp tree contained.
trap 'AIF_EXIT_CODE=$?; if [[ $AIF_EXIT_CODE -ne 0 ]]; then dump_mcp_state "$TMPDIR"; fi; rm -rf "$TMPDIR"' EXIT

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
  "mcp": { "servers": {} },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit", "unikit-plan", "unikit-devcontext", "unikit-evolve",
                          "unikit-explore", "unikit-implement", "unikit-memory",
                          "unikit-skills-context", "unikit-verify",
                          "unikit-gd-recon", "unikit-gd-docs",
                          "unikit-gd-flow", "unikit-gd-content", "unikit-gd-verify"],
      "installedSubagents": ["unikit-architecture-sidecar"]
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } }
  }
}
EOF
inject_fake_registry "$CLAUDE_DIR"

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
# Test 1a-noref: default agents (claude) leave reference invocations verbatim
# ─────────────────────────────────────────────────────
# transformReference is undefined for DefaultTransformer, so references/*.md are
# copied verbatim for claude/cursor/opencode. unikit-plan's
# references/TASK-FORMAT.md must keep `/unikit-implement` — NOT $unikit-
# (codex) or /skills unikit- (qwen). A stray DefaultTransformer.transformReference
# would rewrite this and fail the assertion below.
CLAUDE_TASKFORMAT="$CLAUDE_DIR/.claude/skills/unikit-plan/references/TASK-FORMAT.md"
assert_exists "$CLAUDE_TASKFORMAT" "unikit-plan reference must be installed for claude"
assert_contains "$CLAUDE_TASKFORMAT" '/unikit-implement' \
  "claude references must keep /unikit-* verbatim (DefaultTransformer is no-op)"
assert_not_contains "$CLAUDE_TASKFORMAT" '\$unikit-implement' \
  "claude references must NOT be codex-rewritten"
echo "  ✓ claude reference no-op: /unikit-implement kept verbatim in references/"

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
# Test 1b-gd: gd-principles core + 6 shards installed as system assets under
# .unikit/system/gamedesign/ (flat copies, no engine vars). After the shard split
# installGamedesignSystemAssets copies every top-level data/gamedesign/*.md verbatim;
# the slim core keeps the always-loaded sections (e.g. Zone Ownership / Anti-patterns)
# while the moved sections (e.g. the Severity Rubric) live in their shards. The
# pre-split FLAT path (.unikit/system/gd-principles.md) must NOT survive on init.
# ─────────────────────────────────────────────────────
GD_SYS_DIR="$CLAUDE_DIR/.unikit/system/gamedesign"
GD_PRINCIPLES_PATH="$GD_SYS_DIR/gd-principles.md"
assert_exists "$GD_PRINCIPLES_PATH" "gd-principles.md (core) created in .unikit/system/gamedesign/"
assert_contains "$GD_PRINCIPLES_PATH" 'Zone Ownership' \
  "gd-principles.md (core) carries the always-loaded Zone Ownership section"
assert_contains "$GD_PRINCIPLES_PATH" 'Anti-patterns' \
  "gd-principles.md (core) carries the Anti-patterns section"
assert_not_contains "$GD_PRINCIPLES_PATH" '\{\{engine_name\}\}' \
  "gd-principles.md (core) has no engine vars (flat copy, unlike dev-principles.md)"
# The pre-split flat path is orphan-deleted by installGamedesignSystemAssets.
assert_not_exists "$CLAUDE_DIR/.unikit/system/gd-principles.md" \
  "pre-split flat .unikit/system/gd-principles.md NOT present on init (core lives under gamedesign/ now)"
# Per-shard delivery (mirror of 1b-dr) — each shard lands under gamedesign/, flat, no vars.
for shard in gd-authoring gd-lifecycle gd-flow-axis gd-content-axis gd-provenance gd-critique; do
  assert_exists "$GD_SYS_DIR/$shard.md" "$shard.md shard created in .unikit/system/gamedesign/"
  assert_not_contains "$GD_SYS_DIR/$shard.md" '\{\{engine_name\}\}' \
    "$shard.md shard has no engine vars (flat copy)"
done
# The Severity Rubric moved out of the slim core into the gd-critique shard.
assert_contains "$GD_SYS_DIR/gd-critique.md" 'Severity Rubric' \
  "gd-critique.md shard carries the shared severity rubric (moved out of the core)"

# ─────────────────────────────────────────────────────
# Test 1b-gen: genre profiles are SELECTIVE, not folder-copied. A bare init has
# an empty config.genres.installed, so installGenreProfiles delivers NOTHING —
# .unikit/system/gamedesign/genres/ is absent or empty. This is the negative
# invariant that distinguishes genres (selective, per-state) from the shards
# (which fold-copy ALL of data/gamedesign/*.md). Real delivery is exercised
# CLI-driven in test-genres-install.sh.
# ─────────────────────────────────────────────────────
GD_GENRES_DIR="$GD_SYS_DIR/genres"
if [[ -d "$GD_GENRES_DIR" ]]; then
  GENRE_FILE_COUNT=$(find "$GD_GENRES_DIR" -name '*.json' | wc -l | tr -d ' ')
  if [[ "$GENRE_FILE_COUNT" == "0" ]]; then
    echo "  ✓ bare init delivers no genre profiles (selective — dir present but empty)"
  else
    echo "Assertion failed: bare init delivered $GENRE_FILE_COUNT genre profile(s) — should be 0 (selective, not bulk)"
    exit 1
  fi
else
  echo "  ✓ bare init delivers no genre profiles (selective — genres dir absent)"
fi

# ─────────────────────────────────────────────────────
# Test 1b-gr: gate-result-contract.md installed as a system asset (flat copy, no vars)
# Engine-agnostic, modeled on installCliContract. unikit-verify + unikit-review read it
# on Bootstrap to emit/recompute the unikit-gate-result block. Must land in .unikit/system/.
# ─────────────────────────────────────────────────────
GATE_CONTRACT_PATH="$CLAUDE_DIR/.unikit/system/gate-result-contract.md"
assert_exists "$GATE_CONTRACT_PATH" "gate-result-contract.md created in .unikit/system/"
assert_contains "$GATE_CONTRACT_PATH" 'unikit-gate-result' \
  "gate-result-contract.md carries the unikit-gate-result fence name"

# ─────────────────────────────────────────────────────
# Test 1b-ur: ultra-plan-read.md installed as a system asset (flat copy, no vars)
# Engine- and agent-agnostic, modeled on installGateResultContract. It is a system asset
# rather than a skill reference because FOUR skills read it (implement/verify/improve/commit)
# and references/ is per-skill — the alternative is four copies, and a copy drifts.
# ─────────────────────────────────────────────────────
ULTRA_READ_PATH="$CLAUDE_DIR/.unikit/system/ultra-plan-read.md"
assert_exists "$ULTRA_READ_PATH" "ultra-plan-read.md created in .unikit/system/"
assert_contains "$ULTRA_READ_PATH" 'unikit:plan-mode:ultra' \
  "ultra-plan-read.md carries the bundle marker it tells consumers to look for"

# ─────────────────────────────────────────────────────
# Test 1b-mcp: engine-mcp shard EMPTY branch — this fixture selects zero MCP
# servers (mcp.servers = {}), so nothing contributes a shard and the directory
# must NOT be created. installEngineMcpShards treats an empty set as a normal
# path (an engine with no shard-carrying MCP), not a warning.
# The populated branch is Test 13b below.
# ─────────────────────────────────────────────────────
assert_not_exists "$CLAUDE_DIR/.unikit/system/engine-mcp" \
  "engine-mcp dir NOT created when no MCP server is selected (empty branch)"

# ─────────────────────────────────────────────────────
# Test 1b-dr: design-read.md installed as a system asset under .unikit/system/gamedesign/
# (flat copy, no engine vars — installGamedesignSystemAssets copies it alongside the
# gd-principles core + shards). The extracted mode references + plan design-context.md
# travel with their skills (non-flat copyDirectory).
# ─────────────────────────────────────────────────────
DESIGN_READ_PATH="$CLAUDE_DIR/.unikit/system/gamedesign/design-read.md"
assert_exists "$DESIGN_READ_PATH" "design-read.md created in .unikit/system/gamedesign/"
assert_contains "$DESIGN_READ_PATH" 'intent decides the door' \
  "design-read.md carries the flow-first resolution rule"
assert_not_contains "$DESIGN_READ_PATH" '\{\{engine_name\}\}' \
  "design-read.md has no engine vars (flat copy, like gd-principles.md)"
# unikit-plan is in this fixture's installedSkills; its extracted mode references +
# design-context.md travel with it (non-flat copyDirectory). unikit-gd-spec is NOT in
# this fixture, so its mode references are not asserted here.
assert_exists "$CLAUDE_DIR/.claude/skills/unikit-plan/references/mode-fast.md" \
  "unikit-plan mode reference (mode-fast.md) installed"
assert_exists "$CLAUDE_DIR/.claude/skills/unikit-plan/references/design-context.md" \
  "unikit-plan design-context.md reference installed"

# ─────────────────────────────────────────────────────
# Test 1b-brownfield: the two new brownfield/export skills (unikit-gd-recon,
# unikit-gd-docs) deliver on init — both are in this fixture's installedSkills.
# unikit-gd-recon's shared references/code-recon.md travels with it via the non-flat
# copyDirectory (no shard-cycle wiring needed). No hardcoded skill counter exists in
# these smokes (skills are auto-discovered by glob), so nothing else to bump.
# ─────────────────────────────────────────────────────
assert_exists "$CLAUDE_DIR/.claude/skills/unikit-gd-recon/SKILL.md" \
  "unikit-gd-recon SKILL.md installed (brownfield cold-start recon)"
assert_exists "$CLAUDE_DIR/.claude/skills/unikit-gd-recon/references/code-recon.md" \
  "unikit-gd-recon shared code-recon.md engine travels under references/ (non-flat copyDirectory)"
assert_exists "$CLAUDE_DIR/.claude/skills/unikit-gd-docs/SKILL.md" \
  "unikit-gd-docs SKILL.md installed (GDD → docs/design render)"

# ─────────────────────────────────────────────────────
# Test 1b-gd-refs: the context-cost refactor extracted per-mode bodies + axis-checks
# into NEW references/ subdirs for the zone/verify skills (gd-flow, gd-content,
# gd-verify previously had none). The non-flat copyDirectory delivers them with the
# skill — assert ≥1 extracted reference per new-dir skill (else a silent delivery
# regression; the SKILL switches point at these files via {{skills_dir}}/.../references/).
# ─────────────────────────────────────────────────────
assert_exists "$CLAUDE_DIR/.claude/skills/unikit-gd-flow/references/mode-author.md" \
  "unikit-gd-flow extracted mode reference (mode-author.md) travels under references/ (non-flat copyDirectory)"
assert_exists "$CLAUDE_DIR/.claude/skills/unikit-gd-content/references/mode-author.md" \
  "unikit-gd-content extracted mode reference (mode-author.md) travels under references/ (non-flat copyDirectory)"
assert_exists "$CLAUDE_DIR/.claude/skills/unikit-gd-verify/references/axis-checks.md" \
  "unikit-gd-verify extracted axis-checks.md travels under references/ (non-flat copyDirectory)"

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
  "mcp": { "servers": {} },
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
    "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } }
  }
}
EOF
inject_fake_registry "$NOSUB_DIR"

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
  "mcp": { "servers": {} },
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
    "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } }
  }
}
EOF
inject_fake_registry "$CODEX_DIR"

seed_rule "$CODEX_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"
run_update "$CODEX_DIR"

# No /unikit- invocations should remain in SKILL.md files (rewritten to $unikit-)
# SKILL.md is checked here; reference .md files are rewritten too (T3) and
# checked separately below — they are no longer copied verbatim.
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

# Reference .md files must ALSO have their invocations rewritten (T3): the
# installer runs transformReference over references/*.md, not just SKILL.md.
# Fixture coverage: unikit-plan ships references/TASK-FORMAT.md with a
# `/unikit-implement` invocation; unikit ships references/LANGUAGE_RULES_TEMPLATE.md
# with `/unikit-memory`. Non-.md references (e.g. config-template.yaml) stay
# verbatim by design — excluded here via `-name '*.md'`.
CODEX_REF_SLASH=$(find "$CODEX_DIR/.codex/skills/" -path '*/references/*' -name '*.md' -exec \
  grep -lE '(^|[[:space:]`"(>])/unikit-' {} \; 2>/dev/null \
  | while read -r f; do
      grep -E '(^|[[:space:]`"(>])/unikit-' "$f" \
        | grep -v '^name:' \
        | grep -v 'unikit-ai' \
        | grep -v '\.unikit/'
    done | wc -l | tr -d ' ' || true)

CODEX_REF_DOLLAR=$(find "$CODEX_DIR/.codex/skills/" -path '*/references/*' -name '*.md' -exec \
  grep -c '\$unikit-' {} \; 2>/dev/null \
  | awk '{s+=$1} END{print s+0}' || true)

if [[ "$CODEX_REF_SLASH" -eq 0 && "$CODEX_REF_DOLLAR" -gt 0 ]]; then
  echo "  ✓ codex reference rewrite: /unikit-* → \$unikit-* in references/ ($CODEX_REF_DOLLAR rewrites)"
else
  echo "Assertion failed: codex reference rewrite"
  echo "  Remaining /unikit- in references: $CODEX_REF_SLASH (expected 0)"
  echo "  Found \$unikit- in references: $CODEX_REF_DOLLAR (expected > 0)"
  if [[ "$CODEX_REF_SLASH" -gt 0 ]]; then
    echo "  --- remaining /unikit- in references ---"
    find "$CODEX_DIR/.codex/skills/" -path '*/references/*' -name '*.md' -exec \
      grep -HE '(^|[[:space:]`"(>])/unikit-' {} \; \
      | grep -v ':name:' | grep -v 'unikit-ai' | grep -v '\.unikit/' | head -5
    echo "  ---"
  fi
  exit 1
fi

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
  "mcp": { "servers": {} },
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
    "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } }
  }
}
EOF
inject_fake_registry "$QWEN_DIR"

seed_rule "$QWEN_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"
run_update "$QWEN_DIR"

# No raw /unikit- invocations should remain in SKILL.md files (rewritten to "/skills unikit-")
# SKILL.md is checked here; reference .md files are rewritten too (T3) and
# checked separately below — they are no longer copied verbatim.
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

# Reference .md files must ALSO have their invocations rewritten (T3) for qwen
# (/unikit-* → /skills unikit-*). Same fixture coverage as codex Test 3.
QWEN_REF_RAW_SLASH=$(find "$QWEN_DIR/.qwen/skills/" -path '*/references/*' -name '*.md' -exec \
  grep -lE '(^|[[:space:]`"(>])/unikit-' {} \; 2>/dev/null \
  | while read -r f; do
      grep -E '(^|[[:space:]`"(>])/unikit-' "$f" \
        | grep -v '^name:' \
        | grep -v 'unikit-ai' \
        | grep -v '\.unikit/'
    done | wc -l | tr -d ' ' || true)

QWEN_REF_SKILLS=$(find "$QWEN_DIR/.qwen/skills/" -path '*/references/*' -name '*.md' -exec \
  grep -c '/skills unikit-' {} \; 2>/dev/null \
  | awk '{s+=$1} END{print s+0}' || true)

if [[ "$QWEN_REF_RAW_SLASH" -eq 0 && "$QWEN_REF_SKILLS" -gt 0 ]]; then
  echo "  ✓ qwen reference rewrite: /unikit-* → /skills unikit-* in references/ ($QWEN_REF_SKILLS rewrites)"
else
  echo "Assertion failed: qwen reference rewrite"
  echo "  Remaining /unikit- in references: $QWEN_REF_RAW_SLASH (expected 0)"
  echo "  Found /skills unikit- in references: $QWEN_REF_SKILLS (expected > 0)"
  if [[ "$QWEN_REF_RAW_SLASH" -gt 0 ]]; then
    echo "  --- remaining /unikit- in references ---"
    find "$QWEN_DIR/.qwen/skills/" -path '*/references/*' -name '*.md' -exec \
      grep -HE '(^|[[:space:]`"(>])/unikit-' {} \; \
      | grep -v ':name:' | grep -v 'unikit-ai' | grep -v '\.unikit/' | head -5
    echo "  ---"
  fi
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 3c: Antigravity (skills-only — no subagents, local MCP config, postInstall rules)
# ─────────────────────────────────────────────────────
# Antigravity (IDE + CLI share one .agents/ workspace). Skills install as
# directories under .agents/skills/ (no workflows-split). supportsSubagents:false
# → no .agents/agents/ file. supportsMcp:true + settingsFile:'.agents/mcp_config.json',
# but configureMcp is only invoked from init.ts (not run_update here), so no MCP
# file is asserted in this block — the writer's output shape is covered by Test 12d.
# postInstall writes .agents/rules/unikit.md guardrails — it fires because ≥1 skill
# is (re)installed here (installSkills calls it after the skill loop). /unikit-* are
# NOT rewritten (skills triggered by description), so references stay verbatim.

ANTIGRAVITY_DIR="$TMPDIR/test-antigravity"
mkdir -p "$ANTIGRAVITY_DIR"

cat > "$ANTIGRAVITY_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": {} },
  "agents": [
    {
      "id": "antigravity",
      "skillsDir": ".agents/skills",
      "subagentsDir": ".agents/agents",
      "installedSkills": ["unikit", "unikit-plan"],
      "installedSubagents": ["unikit-architecture-sidecar"]
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } }
  }
}
EOF
inject_fake_registry "$ANTIGRAVITY_DIR"

seed_rule "$ANTIGRAVITY_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"
run_update "$ANTIGRAVITY_DIR"

# Skills install as .agents/skills/<name>/SKILL.md directories (skills-only)
assert_exists "$ANTIGRAVITY_DIR/.agents/skills/unikit/SKILL.md" \
  "antigravity: unikit skill installed as .agents/skills/<name>/SKILL.md"
# Reference-heavy skills keep their references/ (the reason we did NOT port the
# workflows-split — a flat branch would collapse same-named reference files).
assert_exists "$ANTIGRAVITY_DIR/.agents/skills/unikit/references/LANGUAGE_RULES_TEMPLATE.md" \
  "antigravity: unikit skill references/ delivered (non-flat, no workflows-split)"
# /unikit-* invocations are left verbatim (skills-only, no slash rewrite), same as
# DefaultTransformer — unikit-plan ships references/TASK-FORMAT.md with one.
assert_contains "$ANTIGRAVITY_DIR/.agents/skills/unikit-plan/references/TASK-FORMAT.md" '/unikit-implement' \
  "antigravity: references keep /unikit-* verbatim (skills-only, no invocation rewrite)"

# postInstall guardrails written (fires because ≥1 skill (re)installed)
assert_exists "$ANTIGRAVITY_DIR/.agents/rules/unikit.md" \
  "antigravity: postInstall wrote .agents/rules/unikit.md guardrails"
assert_contains "$ANTIGRAVITY_DIR/.agents/rules/unikit.md" '.agents/mcp_config.json' \
  "antigravity: rules file points at the local, automatically-configured .agents/mcp_config.json"

# supportsSubagents:false → listed subagent must NOT materialize
assert_not_exists "$ANTIGRAVITY_DIR/.agents/agents/unikit-architecture-sidecar.md" \
  "antigravity: listed subagent NOT installed (supportsSubagents:false)"

# No {{...}} template tokens leak into skills or the rules file. {{settings_file}}
# now renders to the literal '.agents/mcp_config.json' (settingsFile is no longer
# null); {{skills_cli_agent_flag}} → "--agent antigravity". None stay raw.
ANTIGRAVITY_TOKEN_HITS=$(grep -r '{{skills_dir}}\|{{settings_file}}\|{{home_skills_dir}}\|{{skills_cli_agent_flag}}\|{{self_name}}' \
  "$ANTIGRAVITY_DIR/.agents/skills/" "$ANTIGRAVITY_DIR/.agents/rules/" --include='*.md' 2>/dev/null | wc -l | tr -d ' ' || true)

if [[ "$ANTIGRAVITY_TOKEN_HITS" -eq 0 ]]; then
  echo "  ✓ antigravity: skills-only install (references kept), postInstall rules, no subagents, no {{...}} leak"
else
  echo "Assertion failed: antigravity install leaked $ANTIGRAVITY_TOKEN_HITS template placeholder(s)"
  grep -r '{{skills_dir}}\|{{settings_file}}\|{{home_skills_dir}}\|{{skills_cli_agent_flag}}\|{{self_name}}' \
    "$ANTIGRAVITY_DIR/.agents/skills/" "$ANTIGRAVITY_DIR/.agents/rules/" --include='*.md' | head -5
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

RULES_INDEX="$CLAUDE_DIR/.unikit/memory/code/RULES_INDEX.md"
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
mkdir -p "$LOCAL_DIR/.unikit/memory/code/stack"

CUSTOM_CONTENT="# My custom rngneeds rules
This file was manually edited by the user."
echo "$CUSTOM_CONTENT" > "$LOCAL_DIR/.unikit/memory/code/stack/${STACK_RULE_UNITY_RNGNEEDS}.md"

cat > "$LOCAL_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": {} },
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
    "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } }
  }
}
EOF
inject_fake_registry "$LOCAL_DIR"

seed_rule "$LOCAL_DIR" unity stack "$STACK_RULE_UNITY_UNITASK"
run_update "$LOCAL_DIR"

# Custom rngneeds.md content must survive the update (syncRulesState Phase 1
# tags it as `source: local`; Phase 2 skips it because origin != registry).
assert_exists "$LOCAL_DIR/.unikit/memory/code/stack/${STACK_RULE_UNITY_RNGNEEDS}.md" "local rule file should not be deleted"
assert_file_content "$LOCAL_DIR/.unikit/memory/code/stack/${STACK_RULE_UNITY_RNGNEEDS}.md" "$CUSTOM_CONTENT" \
  "local rule should preserve user content, not be overwritten by registry"
assert_exists "$LOCAL_DIR/.unikit/memory/code/stack/${STACK_RULE_UNITY_UNITASK}.md" "seeded rule should be present"

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

# unikit-plan gained a planning vocabulary in phase 2. Part 4 of test-skills.sh asserts the
# template exists in the SOURCE tree; this asserts it actually reaches the project. The
# Test 7 fixture has unikit-plan in installedSkills (see the config at the top of this file).
assert_exists "$CLAUDE_DIR/.claude/skills/unikit-plan/references/ENGINE_RULES.md" \
  "ENGINE_RULES.md should be installed for unikit-plan (unity)"
assert_contains "$CLAUDE_DIR/.claude/skills/unikit-plan/references/ENGINE_RULES.md" \
  "Engine Rules: Unity" "unikit-plan ENGINE_RULES.md should have Unity header"

echo "  ✓ ENGINE_RULES.md: installed for unity engine (unikit + unikit-verify + unikit-plan)"

# unikit-memory ships a scripts/ subdir (the single self-contained material-prep.py) — the
# first skill to do so. The non-flat transformer copies the whole skill dir, but nothing
# else asserts the scripts/ subdir actually lands in an installed project; guard the
# delivery here (PLAN.md T10 load-bearing (b), install half).
assert_exists "$CLAUDE_DIR/.claude/skills/unikit-memory/scripts/material-prep.py" \
  "material-prep.py should be delivered into the installed unikit-memory skill (scripts/ subdir)"
echo "  ✓ unikit-memory: scripts/material-prep.py delivered on install"

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
  "mcp": { "servers": {} },
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
    "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } }
  }
}
EOF
inject_fake_registry "$GODOT_DIR"

seed_rule "$GODOT_DIR" godot core "$CORE_RULE_GODOT_CODE_STYLE"
run_update "$GODOT_DIR"

assert_exists "$GODOT_DIR/.claude/skills/unikit/references/ENGINE_RULES.md" \
  "ENGINE_RULES.md should be installed for unikit (godot)"
assert_exists "$GODOT_DIR/.claude/skills/unikit-architecture/references/ENGINE_RULES.md" \
  "ENGINE_RULES.md should be installed for unikit-architecture (godot)"

# Verify Godot rules are from the Godot template, not Unity
assert_contains "$GODOT_DIR/.claude/skills/unikit/references/ENGINE_RULES.md" \
  "Engine Rules: Godot" "Godot ENGINE_RULES.md should have Godot header"

# The graceful-degradation half: no Godot planning vocabulary ships until phases 3-4, so
# installEngineTemplates must fall through its `continue` branch and stay silent.
#
# DO NOT DELETE AS "checking the absence of something that was never there". The fixture
# above lists only unikit + unikit-architecture in installedSkills, so this looks vacuous —
# it is not. installEngineTemplates iterates engineConfig.skillTemplates from engines.ts and
# NEVER consults installedSkills; it creates the skill directory itself. The unikit-plan slot
# IS declared for godot, so the moment GODOT_RULES.md lands in
# data/engine-templates/skills/unikit-plan/ this assertion fires — even in this fixture.
# That is the point: phase 3 must flip it deliberately rather than discover it already green.
assert_not_exists "$GODOT_DIR/.claude/skills/unikit-plan/references/ENGINE_RULES.md" \
  "unikit-plan ENGINE_RULES.md must NOT exist for godot (no vocabulary until phases 3-4)"

echo "  ✓ ENGINE_RULES.md: installed for godot engine (both skills), unikit-plan absent as expected"

# ─────────────────────────────────────────────────────
# Test 9: Engine-specific rules paths
# ─────────────────────────────────────────────────────

# Godot core rules should be installed from memory/godot/core/
assert_exists "$GODOT_DIR/.unikit/memory/code/core/${CORE_RULE_GODOT_CODE_STYLE}.md" "godot core rule should be installed"

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
  "mcp": { "servers": { "unity-mcp": "EngineMCP", "context7": "context7" } },
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
    "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } }
  }
}
EOF
inject_fake_registry "$MCP_DIR"

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

echo "  ✓ MCP config: claude agent setup works with the key→code servers map"
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
  "mcp": { "servers": {} },
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
    "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } }
  }
}
EOF

seed_rule "$COMPAT_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"
seed_rule "$COMPAT_DIR" unity stack "$STACK_RULE_UNITY_UNITASK"
run_update "$COMPAT_DIR"

# Seeded rules must survive the update (sync registers them as local).
assert_exists "$COMPAT_DIR/.unikit/memory/code/core/${CORE_RULE_UNITY_CODE_STYLE}.md" "backward compat: core rule present after sync"
assert_exists "$COMPAT_DIR/.unikit/memory/code/stack/${STACK_RULE_UNITY_UNITASK}.md" "backward compat: stack rule present after sync"

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
  const { discoverMcpServers } = await import('./dist/core/mcp.js');
  const { configureMcp } = await import('./dist/core/mcp-reconcile.js');
  const servers = await discoverMcpServers('unity');
  await configureMcp(target, servers, ['context7', 'coplay-unity-mcp', 'unity-biome-mcp'], 'codex');
  await configureMcp(target, servers, ['context7', 'coplay-unity-mcp', 'unity-biome-mcp'], 'codex');
" "$CODEX_MCP_DIR" > /dev/null 2>&1)

CODEX_TOML="$CODEX_MCP_DIR/.codex/config.toml"
assert_exists "$CODEX_TOML" ".codex/config.toml should exist after configureMcp"
assert_contains "$CODEX_TOML" '^\[mcp_servers\.context7\]$' \
  "codex toml should contain [mcp_servers.context7] section"
assert_contains "$CODEX_TOML" 'command = "uvx"' \
  "codex stdio server should have command = \"uvx\""
assert_contains "$CODEX_TOML" 'url = "https://mcp.context7.com/mcp"' \
  "codex http server context7 should have url = \"https://mcp.context7.com/mcp\""
assert_contains "$CODEX_TOML" '^\[mcp_servers\.UnityMCP\]$' \
  "codex toml should contain [mcp_servers.UnityMCP] section"
assert_contains "$CODEX_TOML" 'url = "http://127.0.0.1:8085/mcp"' \
  "codex http server should have url = \"http://127.0.0.1:8085/mcp\""
assert_not_contains "$CODEX_TOML" 'mcpServers' \
  "codex toml must not contain camelCase mcpServers token"

CONTEXT7_SECTIONS=$(grep -cE '^\[mcp_servers\.context7\]$' "$CODEX_TOML")
if [[ "$CONTEXT7_SECTIONS" -ne 1 ]]; then
  echo "Assertion failed: idempotency — expected 1 [mcp_servers.context7] section, got $CONTEXT7_SECTIONS"
  exit 1
fi

echo "  ✓ codex MCP config: stdio (unity-biome-mcp) + HTTP (context7, UnityMCP) written to .codex/config.toml (idempotent)"

# Claude regression: same discoveredServers must still produce valid JSON
# with camelCase mcpServers.<key>.command field.
CLAUDE_MCP_REGRESS_DIR="$TMPDIR/test-claude-mcp-regress"
mkdir -p "$CLAUDE_MCP_REGRESS_DIR"

(cd "$ROOT_DIR" && node --input-type=module -e "
  const target = process.argv[1];
  const { discoverMcpServers } = await import('./dist/core/mcp.js');
  const { configureMcp } = await import('./dist/core/mcp-reconcile.js');
  const servers = await discoverMcpServers('unity');
  await configureMcp(target, servers, ['context7', 'coplay-unity-mcp'], 'claude');
" "$CLAUDE_MCP_REGRESS_DIR" > /dev/null 2>&1)

assert_exists "$CLAUDE_MCP_REGRESS_DIR/.mcp.json" "claude .mcp.json must exist (regression check)"

node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const errors = [];

  const ctx = c.mcpServers && c.mcpServers.context7;
  if (!ctx) errors.push('mcpServers.context7 missing — camelCase container or entry lost');
  else {
    if (ctx.type !== 'http') errors.push('context7.type expected \"http\", got ' + JSON.stringify(ctx.type));
    if (ctx.url !== 'https://mcp.context7.com/mcp')
      errors.push('context7.url expected \"https://mcp.context7.com/mcp\", got ' + JSON.stringify(ctx.url));
    if (!('_comment' in ctx)) errors.push('context7._comment missing — the API-key hint must reach the settings file');
  }

  if (errors.length > 0) {
    console.error('claude .mcp.json regression assertion failed:');
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
" "$CLAUDE_MCP_REGRESS_DIR/.mcp.json"

echo "  ✓ claude MCP config regression: .mcp.json stays camelCase JSON with mcpServers.context7 as http + hint"

# ─────────────────────────────────────────────────────
# Test 12b: OpenCode MCP config shape (mcp container, local type, command array, environment)
# ─────────────────────────────────────────────────────
# Drives configureMcp('opencode') directly, verifies the OpenCode JSON shape:
#   - top-level container `mcp` (not `mcpServers`)
#   - a local server: type === 'local', command === [cmd, ...args]
#   - a remote server: type === 'remote', url, no `command`, no `environment`
#   - environment preserved only when source `env` is non-empty
#   - existing non-mcp top-level keys survive the write (merge, not rewrite)
# Uses engine=godot so we can assert both the remote path (context7) and the
# local with-env path (coding-solo-godot-mcp).

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
  const { discoverMcpServers } = await import('./dist/core/mcp.js');
  const { configureMcp } = await import('./dist/core/mcp-reconcile.js');
  const servers = await discoverMcpServers('godot');
  await configureMcp(target, servers, ['context7', 'coding-solo-godot-mcp'], 'opencode');
  await configureMcp(target, servers, ['context7', 'coding-solo-godot-mcp'], 'opencode');
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
    if (ctx.type !== 'remote') errors.push('context7.type expected remote, got ' + JSON.stringify(ctx.type));
    if ('command' in ctx) errors.push('context7.command must be absent on a remote entry, got ' + JSON.stringify(ctx.command));
    if (ctx.url !== 'https://mcp.context7.com/mcp')
      errors.push('context7.url expected https://mcp.context7.com/mcp, got ' + JSON.stringify(ctx.url));
    if (!('_comment' in ctx)) errors.push('context7._comment missing — the named passthrough must carry the hint through');
    if ('environment' in ctx) errors.push('context7.environment must be absent on a remote entry (no process to configure), got ' + JSON.stringify(ctx.environment));
  }

  const godot = c.mcp && c.mcp.godot;
  if (!godot) errors.push('godot server missing');
  else {
    if (godot.type !== 'local') errors.push('godot.type expected local, got ' + JSON.stringify(godot.type));
    if (JSON.stringify(godot.command) !== JSON.stringify(['npx', '@coding-solo/godot-mcp']))
      errors.push('godot.command wrong shape: ' + JSON.stringify(godot.command));

    // Per-key environment check (order-independent): ensures the writer preserves
    // every source env entry verbatim and does not inject or drop keys.
    const expectedEnv = { GODOT_PATH: '/path/to/godot', DEBUG: 'true' };
    if (!godot.environment || typeof godot.environment !== 'object' || Array.isArray(godot.environment)) {
      errors.push('godot.environment missing or wrong type: ' + JSON.stringify(godot.environment));
    } else {
      const actualKeys = Object.keys(godot.environment).sort();
      const expectedKeys = Object.keys(expectedEnv).sort();
      if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
        errors.push('godot.environment keys mismatch: expected ' + JSON.stringify(expectedKeys) + ', got ' + JSON.stringify(actualKeys));
      }
      for (const k of expectedKeys) {
        if (godot.environment[k] !== expectedEnv[k]) {
          errors.push('godot.environment.' + k + ' mismatch: expected ' + JSON.stringify(expectedEnv[k]) + ', got ' + JSON.stringify(godot.environment[k]));
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

echo "  ✓ opencode MCP config: mcp container, remote + local types, command array, per-key environment, top-level preserved (idempotent)"

# ─────────────────────────────────────────────────────
# Test 12c: OpenCode MCP config writes HTTP servers as remote
# ─────────────────────────────────────────────────────
# UnityMCP is HTTP-only (type: 'http', url: ...). The writer now distinguishes
# two transports and translates an HTTP source into OpenCode's own remote shape
# (type: 'remote', url: ...) instead of declining to emit anything. There is no
# degradation in either direction: a remote entry never acquires an empty
# `command`, and a local entry is still built from `command`/`args`/`env`.
# This test pins the translation and, through the `command` absence check,
# keeps the original point of the block — HTTP must not become a broken local.

OPENCODE_HTTP_DIR="$TMPDIR/test-opencode-mcp-http-remote"
mkdir -p "$OPENCODE_HTTP_DIR"

(cd "$ROOT_DIR" && node --input-type=module -e "
  const target = process.argv[1];
  const { discoverMcpServers } = await import('./dist/core/mcp.js');
  const { configureMcp } = await import('./dist/core/mcp-reconcile.js');
  const servers = await discoverMcpServers('unity');
  await configureMcp(target, servers, ['context7', 'coplay-unity-mcp'], 'opencode');
" "$OPENCODE_HTTP_DIR" > /dev/null 2>&1)

OPENCODE_HTTP_JSON="$OPENCODE_HTTP_DIR/opencode.json"
assert_exists "$OPENCODE_HTTP_JSON" "opencode.json should exist after unity+opencode configureMcp"

node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const errors = [];

  if (!c.mcp) errors.push('missing top-level mcp container');

  const unity = c.mcp && c.mcp.UnityMCP;
  if (!unity) errors.push('HTTP UnityMCP must be written as remote, not skipped');
  else {
    if (unity.type !== 'remote') errors.push('UnityMCP.type expected remote, got ' + JSON.stringify(unity.type));
    if (unity.url !== 'http://127.0.0.1:8085/mcp')
      errors.push('UnityMCP.url expected http://127.0.0.1:8085/mcp, got ' + JSON.stringify(unity.url));
    if ('command' in unity)
      errors.push('UnityMCP.command must be absent — HTTP must not degrade into a local entry, got ' + JSON.stringify(unity.command));
  }

  const ctx = c.mcp && c.mcp.context7;
  if (!ctx) errors.push('context7 must be written as remote, not skipped');
  else {
    if (ctx.type !== 'remote') errors.push('context7.type expected remote, got ' + JSON.stringify(ctx.type));
    if ('command' in ctx)
      errors.push('context7.command must be absent on a remote entry, got ' + JSON.stringify(ctx.command));
  }

  if (errors.length > 0) {
    console.error('opencode http-remote assertion failed:');
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
" "$OPENCODE_HTTP_JSON"

echo "  ✓ opencode MCP config: HTTP servers (UnityMCP, context7) written as remote, never as local with an empty command"

# ─────────────────────────────────────────────────────
# Test 12d: Antigravity MCP config shape (serverUrl transform, type stripped)
# ─────────────────────────────────────────────────────
# Drives configureMcp('antigravity') directly, verifies the AntigravityMcpWriter
# transform: naive JSON passthrough (mcpServers container, same as Claude/Cursor)
# except HTTP servers get `type` stripped and `url` renamed to `serverUrl` (the
# only schema Antigravity's client understands is `{ command, args, env }` stdio
# or `{ serverUrl }` remote — never `{ type, url }`).
# Uses engine=unity for the type/url→serverUrl case (UnityMCP), engine=godot for
# the env-passthrough case (coding-solo, code "godot"), same split as the
# OpenCode block above.

ANTIGRAVITY_MCP_DIR="$TMPDIR/test-antigravity-mcp"
mkdir -p "$ANTIGRAVITY_MCP_DIR/.agents"
ANTIGRAVITY_MCP_JSON="$ANTIGRAVITY_MCP_DIR/.agents/mcp_config.json"

# Pre-seed with a non-mcpServers top-level key to assert preservation through
# configureMcp's upsert path (merge, not overwrite — the invariant the OpenCode
# regression patch 2026-04-19-11.25.md exists to guard against).
cat > "$ANTIGRAVITY_MCP_JSON" << 'EOF'
{
  "theme": "dark",
  "customField": { "nested": "value" }
}
EOF

(cd "$ROOT_DIR" && node --input-type=module -e "
  const target = process.argv[1];
  const { discoverMcpServers } = await import('./dist/core/mcp.js');
  const { configureMcp } = await import('./dist/core/mcp-reconcile.js');
  const servers = await discoverMcpServers('unity');
  await configureMcp(target, servers, ['context7', 'coplay-unity-mcp'], 'antigravity');
  await configureMcp(target, servers, ['context7', 'coplay-unity-mcp'], 'antigravity');
" "$ANTIGRAVITY_MCP_DIR" > /dev/null 2>&1)

assert_exists "$ANTIGRAVITY_MCP_JSON" ".agents/mcp_config.json should exist after configureMcp"

node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  const errors = [];

  if (!c.mcpServers) errors.push('missing top-level mcpServers container');

  // Non-mcpServers top-level keys must survive the upsert
  if (c.theme !== 'dark') errors.push('top-level \"theme\" lost: ' + JSON.stringify(c.theme));
  if (!c.customField || c.customField.nested !== 'value')
    errors.push('top-level \"customField\" lost or mutated: ' + JSON.stringify(c.customField));

  const ctx = c.mcpServers && c.mcpServers.context7;
  if (!ctx) errors.push('context7 server missing');
  else {
    if (ctx.serverUrl !== 'https://mcp.context7.com/mcp')
      errors.push('context7.serverUrl expected https://mcp.context7.com/mcp, got ' + JSON.stringify(ctx.serverUrl));
    if ('type' in ctx) errors.push('context7.type must be stripped, got ' + JSON.stringify(ctx.type));
    if ('url' in ctx) errors.push('context7.url must be renamed to serverUrl, not left in place');
    if (!('_comment' in ctx)) errors.push('context7._comment missing — the passthrough writer must carry the hint through verbatim');
    if ('env' in ctx) errors.push('context7.env must be absent when source has no env');
  }

  const unity = c.mcpServers && c.mcpServers.UnityMCP;
  if (!unity) errors.push('UnityMCP server missing');
  else {
    if (unity.serverUrl !== 'http://127.0.0.1:8085/mcp')
      errors.push('UnityMCP.serverUrl wrong: ' + JSON.stringify(unity.serverUrl));
    if ('type' in unity) errors.push('UnityMCP.type must be stripped');
    if ('url' in unity) errors.push('UnityMCP.url must be renamed to serverUrl, not left in place');
  }

  if (errors.length > 0) {
    console.error('antigravity mcp shape assertion failed:');
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
" "$ANTIGRAVITY_MCP_JSON"

# Idempotency: second configureMcp call above should leave exactly one context7 entry.
ANTIGRAVITY_CTX_COUNT=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(Object.keys(c.mcpServers || {}).filter(k => k === 'context7').length);
" "$ANTIGRAVITY_MCP_JSON")
if [[ "$ANTIGRAVITY_CTX_COUNT" -ne 1 ]]; then
  echo "Assertion failed: antigravity idempotency — expected 1 context7 entry, got $ANTIGRAVITY_CTX_COUNT"
  exit 1
fi

echo "  ✓ antigravity MCP config: mcpServers container, serverUrl transform, type/url stripped, top-level preserved (idempotent)"

# Separate engine=godot run: neither context7 nor coding-solo-godot-mcp carries a
# `type`/`url` field, so this exercises naive env passthrough (no key renaming,
# unlike toml-writer.ts's sanitizeEnv/http_headers rename).
ANTIGRAVITY_MCP_DIR2="$TMPDIR/test-antigravity-mcp-env"
mkdir -p "$ANTIGRAVITY_MCP_DIR2"

(cd "$ROOT_DIR" && node --input-type=module -e "
  const target = process.argv[1];
  const { discoverMcpServers } = await import('./dist/core/mcp.js');
  const { configureMcp } = await import('./dist/core/mcp-reconcile.js');
  const servers = await discoverMcpServers('godot');
  await configureMcp(target, servers, ['context7', 'coding-solo-godot-mcp'], 'antigravity');
" "$ANTIGRAVITY_MCP_DIR2" > /dev/null 2>&1)

ANTIGRAVITY_MCP_JSON2="$ANTIGRAVITY_MCP_DIR2/.agents/mcp_config.json"
assert_exists "$ANTIGRAVITY_MCP_JSON2" ".agents/mcp_config.json should exist after godot+antigravity configureMcp"

node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const errors = [];

  const godot = c.mcpServers && c.mcpServers.godot;
  if (!godot) errors.push('godot server missing');
  else {
    const expectedEnv = { GODOT_PATH: '/path/to/godot', DEBUG: 'true' };
    if (!godot.env || typeof godot.env !== 'object' || Array.isArray(godot.env)) {
      errors.push('godot.env missing or wrong type: ' + JSON.stringify(godot.env));
    } else {
      const actualKeys = Object.keys(godot.env).sort();
      const expectedKeys = Object.keys(expectedEnv).sort();
      if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
        errors.push('godot.env keys mismatch: expected ' + JSON.stringify(expectedKeys) + ', got ' + JSON.stringify(actualKeys));
      }
      for (const k of expectedKeys) {
        if (godot.env[k] !== expectedEnv[k]) {
          errors.push('godot.env.' + k + ' mismatch: expected ' + JSON.stringify(expectedEnv[k]) + ', got ' + JSON.stringify(godot.env[k]));
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error('antigravity env passthrough assertion failed:');
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
" "$ANTIGRAVITY_MCP_JSON2"

echo "  ✓ antigravity MCP config: env passthrough (no key renaming) for the godot server"

# ─────────────────────────────────────────────────────
# Test 13: Codex MCP rules injection (skill frontmatter)
# ─────────────────────────────────────────────────────
# Uses a dedicated project dir (NOT the Test 3 CODEX_DIR, which is pinned
# to mcp.servers = {} and carries the Codex-rewrite assertions). Here we
# enable context7 in the config and verify collectMcpRules +
# injectToolsIntoSkillFrontmatter work format-agnostically for codex.

CODEX_MCP_RULES_DIR="$TMPDIR/test-codex-mcp-rules"
mkdir -p "$CODEX_MCP_RULES_DIR"

cat > "$CODEX_MCP_RULES_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": { "context7": "context7" } },
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
    "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } }
  }
}
EOF
inject_fake_registry "$CODEX_MCP_RULES_DIR"

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
# Test 13b: engine-mcp rules-tree delivery (populated selection)
# ─────────────────────────────────────────────────────
# The two smoke fixtures above both pin mcp.servers = {}, so they only exercise the
# no-selection branch (Test 1b-mcp). This fixture selects unity-biome-mcp — the one
# server carrying a `rules` pointer — and asserts the whole delivery contract: the
# tree arrives, every file carries the provenance stamp, and nothing about the
# server's capabilities rides along with it.
#
# The stamp assertions are the load-bearing ones. `server:` is what a skill compares
# the MCP-RECHECK-NOTES header against to tell a finding about the configured server
# from one inherited from another, so a stamp that silently stops being written turns
# that check into a no-op rather than a failure. It is also the WHOLE stamp: `version:`
# and `delivered:` were removed, and the negative asserts below are what keep them out.
# NOTE: this project is installed via run_update, so the branch under test is the
# update.ts wiring; the init.ts call site is covered by the static grep guard in
# test-skills.sh Part 6.

MCP_SHARDS_DIR="$TMPDIR/test-mcp-shards"
mkdir -p "$MCP_SHARDS_DIR"

cat > "$MCP_SHARDS_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": "UnityMCP",
  "mcp": { "servers": { "unity-biome-mcp": "UnityMCP" } },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit-implement", "unikit-verify"],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } }
  }
}
EOF
inject_fake_registry "$MCP_SHARDS_DIR"

seed_rule "$MCP_SHARDS_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"
run_update "$MCP_SHARDS_DIR"

MCP_RULES_BASE="$MCP_SHARDS_DIR/.unikit/system/engine-mcp"
MCP_RULES_INDEX="$MCP_RULES_BASE/INDEX.md"

assert_exists "$MCP_RULES_INDEX" \
  "engine-mcp/INDEX.md delivered for the selected server's rules tree"
assert_exists "$MCP_RULES_BASE/verification.md" \
  "engine-mcp/verification.md delivered alongside the INDEX"

# The stamp: provenance of THIS copy, and nothing else.
assert_contains "$MCP_RULES_INDEX" '^server: unity-biome-mcp$' \
  "delivered rules file carries the server id it came from"
assert_contains "$MCP_RULES_INDEX" 'not here' \
  "delivered rules file says where to fix it (the source tree, not this copy)"

# The negative half. The retired shard header shipped both banned genres into every
# project: a count of how many servers share a defect, and a doctrine about tool-name
# lists. Neither may come back through the stamp.
assert_not_contains "$MCP_RULES_BASE/verification.md" '[0-9]+ of (the )?[0-9]+' \
  "no server counter in a delivered rules file"

# `version:` and `delivered:` are guarded by their ABSENCE, which is stricter than any
# assert on their contents and is the only thing that stops either coming back silently
# in a later commit. Both were removed for reasons a future reader will not have in
# front of them: the version fed a comparison whose two sides came from the same package
# constant, and the delivery date was the one field that changed on every run, producing
# a one-line diff on every file of the tree that nothing read. Their absence is also what
# makes a delivered file byte-identical between runs, so an unexpected diff is a signal.
assert_not_contains "$MCP_RULES_INDEX" '^version:' \
  "no version line in the delivery stamp"
assert_not_contains "$MCP_RULES_INDEX" '^delivered:' \
  "no delivery date in the delivery stamp"

echo "  ✓ engine-mcp: biome rules tree delivered (INDEX + verification), stamped with the server id alone, no counters"

# ─────────────────────────────────────────────────────
# Test 13c: an engine MCP that ships NO rules tree — nothing degrades
# ─────────────────────────────────────────────────────
# Invariant 3 at the install layer: no rules ≠ no rights. Exactly one of the six engine
# servers carries a rules tree today, so this is the MAJORITY case and not an edge one,
# and its whole contract is to be indistinguishable from a well-behaved install except
# for one absent directory. The failure it guards is a plausible one: a delivery step
# that reads "no tree" as "misconfigured server" and drops the MCP config, the grants, or
# both. That would look like a clean install and silently disable editor work on five of
# the six servers — the exact shape of degradation the rules architecture forbids.
#
# coplay-unity-mcp is the fixture because it is the same ENGINE as biome: an assertion
# that passed only because the engine had no MCP at all would prove nothing.

MCP_NOTREE_DIR="$TMPDIR/test-mcp-no-rules-tree"
mkdir -p "$MCP_NOTREE_DIR"

cat > "$MCP_NOTREE_DIR/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": "UnityMCP",
  "mcp": { "servers": { "coplay-unity-mcp": "UnityMCP" } },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit-implement", "unikit-verify", "unikit-memory"],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } }
  }
}
EOF
inject_fake_registry "$MCP_NOTREE_DIR"

seed_rule "$MCP_NOTREE_DIR" unity core "$CORE_RULE_UNITY_CODE_STYLE"
run_update "$MCP_NOTREE_DIR"

# The one visible difference: no tree to deliver, so no directory. Absent, not empty —
# an empty directory would read to a skill as a tree whose files failed to arrive.
assert_not_exists "$MCP_NOTREE_DIR/.unikit/system/engine-mcp" \
  "no rules tree for the selected server leaves the engine-mcp dir absent (not empty)"

# ...and nothing else differs. The selection is still live, and the mechanical evidence
# of that is the GRANTS: `update` never rewrites the MCP config itself (configureMcp is
# driven by the init wizard, covered separately in Test 12), but it does re-run the
# frontmatter injection from `mcp.servers` on every run. A server the delivery step had
# written off would inject nothing, and its tools would be unreachable no matter what
# .mcp.json still said.
assert_contains "$MCP_NOTREE_DIR/.claude/skills/unikit-implement/SKILL.md" 'mcp__UnityMCP__' \
  "tool grants are injected for a server that ships no rules tree"
assert_contains "$MCP_NOTREE_DIR/.claude/skills/unikit-verify/SKILL.md" 'mcp__UnityMCP__' \
  "the verify skill keeps its grants too (both sides of the pipeline stay live)"

# ...layer A still arrives, and it is what carries the obligations when a tree does not:
assert_exists "$MCP_NOTREE_DIR/.unikit/system/dev-principles.md" \
  "dev-principles.md is delivered regardless of whether the server has a rules tree"

# ...and the unrelated per-skill assets are untouched by the rules-tree cutover. The
# scripts/ subdir is the one non-markdown payload any skill ships, so it is the first
# thing a change to the delivery loop would break.
assert_exists "$MCP_NOTREE_DIR/.claude/skills/unikit-memory/scripts/material-prep.py" \
  "the scripts/ subdir still ships (the rules-tree cutover did not touch skill assets)"

echo "  ✓ engine-mcp: a server with no rules tree degrades nothing (grants, layer A, skill assets)"

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
# Test 14b: MCP picker pre-selection (wizard remembers the previous choice)
# ─────────────────────────────────────────────────────
# The wizard is interactive and never runs in this smoke, so the contract is
# tested through the three exported pure helpers instead of the prompt:
#   sortMcpChoices        — order asc, missing order last, ties by fileId
#   isMcpPreselected      — checkbox: null = fresh (all checked), array = mirror
#   resolveMcpGroupDefault— radio: INDEX of the restored entry, or undefined
# The regression this guards: once two servers share one key (Unity ships biome
# + coplay) the picker becomes a radio, and a radio has no notion of "already
# installed" — a blind Enter on re-init would silently swap the engine MCP.

MCP_DEFAULTS=$(cd "$ROOT_DIR" && node --input-type=module -e "
  const { sortMcpChoices, isMcpPreselected, resolveMcpGroupDefault } =
    await import('./dist/cli/wizard/prompts.js');

  // Deliberately supplied out of order, with one entry carrying no \`order\`.
  const group = sortMcpChoices([
    { fileId: 'coplay-unity-mcp', displayName: 'Coplay', isEngine: true, order: 2 },
    { fileId: 'zz-no-order',      displayName: 'NoOrder', isEngine: true },
    { fileId: 'unity-biome-mcp',  displayName: 'Biome',  isEngine: true, order: 1 },
  ]);

  process.stdout.write(JSON.stringify({
    sorted:        group.map(e => e.fileId),
    freshDefault:  resolveMcpGroupDefault(group, null),
    reinitDefault: resolveMcpGroupDefault(group, ['coplay-unity-mcp']),
    absentDefault: resolveMcpGroupDefault(group, ['not-in-this-group']),
    freshChecked:  isMcpPreselected('context7', null),
    reinitChecked: isMcpPreselected('context7', ['context7']),
    reinitUnchecked: isMcpPreselected('context7', ['something-else']),
  }));
" 2>/dev/null)

if [[ "$MCP_DEFAULTS" != *'"sorted":["unity-biome-mcp","coplay-unity-mcp","zz-no-order"]'* ]]; then
  echo "Assertion failed: sortMcpChoices should order by order asc with missing last, got: $MCP_DEFAULTS"
  exit 1
fi
# A fresh install must NOT pin a default — inquirer then pre-selects choice 0,
# which is the order:1 recommendation.
if [[ "$MCP_DEFAULTS" == *'"freshDefault"'* ]]; then
  echo "Assertion failed: resolveMcpGroupDefault(group, null) must be undefined (omitted from JSON), got: $MCP_DEFAULTS"
  exit 1
fi
if [[ "$MCP_DEFAULTS" != *'"reinitDefault":1'* ]]; then
  echo "Assertion failed: re-init with coplay installed should default to index 1, got: $MCP_DEFAULTS"
  exit 1
fi
if [[ "$MCP_DEFAULTS" == *'"absentDefault"'* ]]; then
  echo "Assertion failed: nothing from the group installed -> default must be undefined (never pre-select Skip), got: $MCP_DEFAULTS"
  exit 1
fi
if [[ "$MCP_DEFAULTS" != *'"freshChecked":true'* ]] \
   || [[ "$MCP_DEFAULTS" != *'"reinitChecked":true'* ]] \
   || [[ "$MCP_DEFAULTS" != *'"reinitUnchecked":false'* ]]; then
  echo "Assertion failed: isMcpPreselected contract broken (null=all checked, array=mirror), got: $MCP_DEFAULTS"
  exit 1
fi

echo "  ✓ MCP picker pre-selection: sorted by order, re-init restores prior choice, fresh falls back to order:1"

# ─────────────────────────────────────────────────────
# Test 14c: configByPlatform resolution writes a token-free command
# ─────────────────────────────────────────────────────
# Fennara is the only config shipping configByPlatform and NO plain `config`:
# its binary lives at a different absolute path on each OS. Two things must hold
# after configureMcp — the server appears at all (the scanMcpDirectory relaxation
# that stopped requiring `config`), and the persisted command carries no
# unexpanded `{{...}}` token.
# The assertion is deliberately platform-agnostic: it checks for the ABSENCE of
# tokens, never for a concrete path, so it holds on all three platforms.

FENNARA_MCP_DIR="$TMPDIR/test-fennara-mcp"
mkdir -p "$FENNARA_MCP_DIR"

(cd "$ROOT_DIR" && node --input-type=module -e "
  const target = process.argv[1];
  const { discoverMcpServers } = await import('./dist/core/mcp.js');
  const { configureMcp } = await import('./dist/core/mcp-reconcile.js');
  const servers = await discoverMcpServers('godot');
  await configureMcp(target, servers, ['fennara-godot-mcp'], 'claude');
" "$FENNARA_MCP_DIR" > /dev/null 2>&1)

FENNARA_JSON="$FENNARA_MCP_DIR/.mcp.json"
assert_exists "$FENNARA_JSON" "fennara (configByPlatform-only) must reach the writer and produce .mcp.json"
assert_contains "$FENNARA_JSON" 'fennara' "fennara must be written under its vendor code"
assert_not_contains "$FENNARA_JSON" '\{\{' \
  "resolved fennara config must contain no unexpanded {{...}} token"

FENNARA_CMD=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const s = c.mcpServers && c.mcpServers.fennara;
  console.log(s && s.command ? s.command : 'missing');
" "$FENNARA_JSON")

if [[ "$FENNARA_CMD" == "missing" ]] || [[ "$FENNARA_CMD" != *"fennara-mcp"* ]]; then
  echo "Assertion failed: fennara resolved command should point at a fennara-mcp binary, got \"$FENNARA_CMD\""
  exit 1
fi

echo "  ✓ configByPlatform: fennara resolves to a token-free absolute command for $(node -p 'process.platform')"

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
