#!/bin/bash
# Smoke tests: validates extension system
# Tests: manifest validation, name validation, extension add/remove,
#        injection markers, extension skills/subagents installation
# Usage: ./scripts/test-extensions.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=./test-fixtures.sh
source "$SCRIPT_DIR/test-fixtures.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Ensure dist/ is up to date unless a parent runner already built.
if [[ "${UNIKIT_TEST_SKIP_BUILD:-0}" != "1" ]]; then
    (cd "$ROOT_DIR" && npm run build > /dev/null 2>&1)
fi

assert_contains() {
  local file="$1"
  local pattern="$2"
  local hint="$3"
  if ! grep -qE "$pattern" "$file"; then
    echo "Assertion failed: $hint"
    echo "Pattern: $pattern"
    echo "File: $file"
    exit 1
  fi
}

assert_not_contains() {
  local file="$1"
  local pattern="$2"
  local hint="$3"
  if grep -qE "$pattern" "$file"; then
    echo "Assertion failed: $hint"
    echo "Pattern: $pattern"
    echo "File: $file"
    exit 1
  fi
}

assert_exists() {
  local path="$1"
  local hint="$2"
  if [[ ! -e "$path" ]]; then
    echo "Assertion failed: $hint"
    echo "Missing path: $path"
    exit 1
  fi
}

assert_not_exists() {
  local path="$1"
  local hint="$2"
  if [[ -e "$path" ]]; then
    echo "Assertion failed: $hint"
    echo "Path should not exist: $path"
    exit 1
  fi
}

# ─────────────────────────────────────────────────────
# Test 1: Manifest validation (inline via node)
# ─────────────────────────────────────────────────────

VALIDATE_RESULT=$(node --input-type=module -e "
  const { validateManifest, validateExtensionName } = await import('./dist/core/extensions.js');

  const valid = validateManifest({
    name: 'unikit-ext-test', version: '1.0.0',
    skills: ['skills/my-skill'], subagents: ['subagents/my-agent.md'],
    injections: [{ target: 'unikit', targetType: 'skill', position: 'append', file: './inj.md' }]
  });
  if (!valid.valid) { console.error('valid manifest rejected:', valid.error); process.exit(1); }

  if (validateExtensionName('my-extension')) { console.error('valid name rejected: my-extension'); process.exit(1); }
  if (validateExtensionName('unikit-ext-hello')) { console.error('valid name rejected: unikit-ext-hello'); process.exit(1); }
  if (validateExtensionName('@scope/my-ext')) { console.error('valid name rejected: @scope/my-ext'); process.exit(1); }
  if (!validateExtensionName('../hack')) { console.error('path traversal name accepted: ../hack'); process.exit(1); }
  if (!validateExtensionName('')) { console.error('empty name accepted'); process.exit(1); }

  const noVersion = validateManifest({ name: 'unikit-ext-test' });
  if (noVersion.valid) { console.error('no-version accepted'); process.exit(1); }

  const badTarget = validateManifest({
    name: 'unikit-ext-test', version: '1.0.0',
    injections: [{ target: 'x', targetType: 'invalid', position: 'append', file: 'f' }]
  });
  if (badTarget.valid) { console.error('bad targetType accepted'); process.exit(1); }

  console.log('ok');
" 2>&1)

if [[ "$VALIDATE_RESULT" == "ok" ]]; then
  echo "  ✓ manifest validation: valid/invalid manifests handled correctly"
else
  echo "Assertion failed: manifest validation"
  echo "$VALIDATE_RESULT"
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 2: Source classification
# ─────────────────────────────────────────────────────

CLASSIFY_RESULT=$(node --input-type=module -e "
  const { classifySource } = await import('./dist/core/extensions.js');

  const local = classifySource('./my-ext');
  if (local.type !== 'local') { console.error('local misclassified as', local.type); process.exit(1); }

  const github = classifySource('owner/repo');
  if (github.type !== 'github') { console.error('github misclassified as', github.type); process.exit(1); }

  const githubRef = classifySource('owner/repo#v2');
  if (githubRef.type !== 'github') { console.error('github#ref misclassified'); process.exit(1); }
  if (!githubRef.resolved.includes('#v2')) { console.error('ref not preserved'); process.exit(1); }

  const git = classifySource('https://github.com/user/repo.git');
  if (git.type !== 'git') { console.error('git URL misclassified as', git.type); process.exit(1); }

  console.log('ok');
" 2>&1)

if [[ "$CLASSIFY_RESULT" == "ok" ]]; then
  echo "  ✓ source classification: local, github, git URLs classified correctly"
else
  echo "Assertion failed: source classification"
  echo "$CLASSIFY_RESULT"
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 3: Example extension manifest is valid
# ─────────────────────────────────────────────────────

EXAMPLE_DIR="$ROOT_DIR/examples/extensions/unikit-ext-hello"

EXAMPLE_RESULT=$(node --input-type=module -e "
  import fs from 'fs';
  const { validateManifest } = await import('./dist/core/extensions.js');
  const raw = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  const result = validateManifest(raw);
  if (!result.valid) { console.error(result.error); process.exit(1); }
  console.log('ok');
" "$EXAMPLE_DIR/extension.json" 2>&1)

if [[ "$EXAMPLE_RESULT" == "ok" ]]; then
  echo "  ✓ example extension: manifest is valid"
else
  echo "Assertion failed: example extension manifest"
  echo "$EXAMPLE_RESULT"
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 4: Extension add (local) and verify artifacts
# ─────────────────────────────────────────────────────

EXT_PROJECT="$TMPDIR/test-ext-project"
mkdir -p "$EXT_PROJECT"

cat > "$EXT_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
  "mcp": { "servers": {} },
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$EXT_PROJECT"

# First install base skills so injection targets exist
(cd "$EXT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)

# Add extension
ADD_OUTPUT="$TMPDIR/ext-add.log"
(cd "$EXT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$EXAMPLE_DIR" > "$ADD_OUTPUT" 2>&1)

# Verify extension storage
assert_exists "$EXT_PROJECT/.unikit/extensions/unikit-ext-hello/extension.json" \
  "extension manifest must be stored"

# Verify extension skill installed
assert_exists "$EXT_PROJECT/.claude/skills/hello-world/SKILL.md" \
  "extension skill must be installed"

# Verify extension subagent installed
assert_exists "$EXT_PROJECT/.claude/agents/hello-agent.md" \
  "extension subagent must be installed"

# Verify injection markers in target skill
assert_contains "$EXT_PROJECT/.claude/skills/unikit/SKILL.md" \
  "unikit-ext:unikit-ext-hello:unikit:append:start" \
  "injection start marker must be present"

assert_contains "$EXT_PROJECT/.claude/skills/unikit/SKILL.md" \
  "Extra Rules.*from extension" \
  "injected content must be present"

# Verify config updated
CONFIG_CHECK=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const ext = (c.extensions || []).find(e => e.name === 'unikit-ext-hello');
  console.log(ext ? ext.version : 'missing');
" "$EXT_PROJECT/.unikit.json")

if [[ "$CONFIG_CHECK" == "1.0.0" ]]; then
  echo "  ✓ extension add: installed skills, subagents, injections, config updated"
else
  echo "Assertion failed: extension add config check"
  echo "Got: $CONFIG_CHECK (expected 1.0.0)"
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 5: Extension list
# ─────────────────────────────────────────────────────

LIST_OUTPUT="$TMPDIR/ext-list.log"
(cd "$EXT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension list > "$LIST_OUTPUT" 2>&1)

assert_contains "$LIST_OUTPUT" "unikit-ext-hello" "extension list must show installed extension"

echo "  ✓ extension list: shows installed extension"

# ─────────────────────────────────────────────────────
# Test 6: Extension remove and verify cleanup
# ─────────────────────────────────────────────────────

REMOVE_OUTPUT="$TMPDIR/ext-remove.log"
(cd "$EXT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension remove unikit-ext-hello > "$REMOVE_OUTPUT" 2>&1)

# Extension storage should be removed
assert_not_exists "$EXT_PROJECT/.unikit/extensions/unikit-ext-hello" \
  "extension storage must be removed"

# Extension skill should be removed
assert_not_exists "$EXT_PROJECT/.claude/skills/hello-world" \
  "extension skill must be removed"

# Extension subagent should be removed
assert_not_exists "$EXT_PROJECT/.claude/agents/hello-agent.md" \
  "extension subagent must be removed"

# Injection markers should be stripped
assert_not_contains "$EXT_PROJECT/.claude/skills/unikit/SKILL.md" \
  "unikit-ext:unikit-ext-hello" \
  "injection markers must be stripped"

# Config should be cleaned
REMOVE_CHECK=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const ext = (c.extensions || []).find(e => e.name === 'unikit-ext-hello');
  console.log(ext ? 'still-present' : 'removed');
" "$EXT_PROJECT/.unikit.json")

if [[ "$REMOVE_CHECK" == "removed" ]]; then
  echo "  ✓ extension remove: skills, subagents, injections, storage, config all cleaned"
else
  echo "Assertion failed: extension remove - config still has extension"
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 7: Conflict detection
# ─────────────────────────────────────────────────────

CONFLICT_RESULT=$(node --input-type=module -e "
  const { checkReplacementConflicts } = await import('./dist/core/extensions.js');
  const existing = [{ name: 'ext-a', source: '.', version: '1.0.0', replacedSkills: { 'unikit-commit': 'skills/my-commit' } }];
  const newManifest = { name: 'ext-b', version: '1.0.0', replaces: { 'skills/other-commit': 'unikit-commit' } };
  const conflicts = checkReplacementConflicts(existing, newManifest);
  console.log(conflicts.length > 0 ? 'conflict-detected' : 'no-conflict');
" 2>&1)

if [[ "$CONFLICT_RESULT" == "conflict-detected" ]]; then
  echo "  ✓ conflict detection: replacement conflicts detected correctly"
else
  echo "Assertion failed: conflict detection"
  echo "Got: $CONFLICT_RESULT"
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 8: Replaces - extension replaces base skill
# ─────────────────────────────────────────────────────

REPLACE_DIR="$ROOT_DIR/examples/extensions/unikit-ext-replace"
REPLACE_PROJECT="$TMPDIR/test-replace-project"
mkdir -p "$REPLACE_PROJECT"

cat > "$REPLACE_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
  "mcp": { "servers": {} },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit", "unikit-commit"],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$REPLACE_PROJECT"

# Install base skills first
(cd "$REPLACE_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)

# Verify base unikit-commit exists
assert_exists "$REPLACE_PROJECT/.claude/skills/unikit-commit/SKILL.md" \
  "base unikit-commit must exist before replace"

# Add replace extension
(cd "$REPLACE_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$REPLACE_DIR" > /dev/null 2>&1)

# Replaced skill should contain custom content
assert_contains "$REPLACE_PROJECT/.claude/skills/unikit-commit/SKILL.md" \
  "Custom Commit.*from extension" \
  "replaced skill must have extension content"

# Config should track the replacement
REPLACE_CHECK=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const ext = (c.extensions || []).find(e => e.name === 'unikit-ext-replace');
  console.log(ext && ext.replacedSkills ? 'has-replaces' : 'no-replaces');
" "$REPLACE_PROJECT/.unikit.json")

if [[ "$REPLACE_CHECK" == "has-replaces" ]]; then
  echo "  ✓ replaces: extension replaces base skill, config tracks replacement"
else
  echo "Assertion failed: replaces config check"
  echo "Got: $REPLACE_CHECK"
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 9: Replaced skill skipped during update
# ─────────────────────────────────────────────────────

REPLACE_UPDATE_OUTPUT="$TMPDIR/replace-update.log"
(cd "$REPLACE_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > "$REPLACE_UPDATE_OUTPUT" 2>&1)

# After update, replaced skill should still have extension content (NOT restored to base)
assert_contains "$REPLACE_PROJECT/.claude/skills/unikit-commit/SKILL.md" \
  "Custom Commit.*from extension" \
  "replaced skill must survive base update"

echo "  ✓ replaces: replaced skill survives base update"

# ─────────────────────────────────────────────────────
# Test 10: Remove replace extension restores base skill
# ─────────────────────────────────────────────────────

(cd "$REPLACE_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension remove unikit-ext-replace > /dev/null 2>&1)

# Base skill should be restored (NOT contain extension content)
assert_not_contains "$REPLACE_PROJECT/.claude/skills/unikit-commit/SKILL.md" \
  "Custom Commit.*from extension" \
  "base skill must be restored after extension removal"

echo "  ✓ replaces: base skill restored after extension removal"

# ─────────────────────────────────────────────────────
# Test 11: MCP servers from extension
# ─────────────────────────────────────────────────────

MCP_EXT_PROJECT="$TMPDIR/test-mcp-ext"
mkdir -p "$MCP_EXT_PROJECT"

cat > "$MCP_EXT_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$MCP_EXT_PROJECT"

(cd "$MCP_EXT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)
(cd "$MCP_EXT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$REPLACE_DIR" > /dev/null 2>&1)

# MCP server should be written to .mcp.json
assert_exists "$MCP_EXT_PROJECT/.mcp.json" "MCP settings file must exist after ext add"
assert_contains "$MCP_EXT_PROJECT/.mcp.json" "ext-test-server" \
  "extension MCP server key must be in settings"

# Remove extension - MCP server should be cleaned up
(cd "$MCP_EXT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension remove unikit-ext-replace > /dev/null 2>&1)
assert_not_contains "$MCP_EXT_PROJECT/.mcp.json" "ext-test-server" \
  "extension MCP server must be removed from settings"

echo "  ✓ MCP servers: extension adds and removes MCP server config"

# ─────────────────────────────────────────────────────
# Test 11b: MCP servers from extension (codex TOML)
# ─────────────────────────────────────────────────────
# Mirror of Test 11 but with codex agent — verifies extension add/remove
# also writes/cleans up .codex/config.toml and preserves third-party
# sections that the user added manually.

MCP_EXT_CODEX_PROJECT="$TMPDIR/test-mcp-ext-codex"
mkdir -p "$MCP_EXT_CODEX_PROJECT"

cat > "$MCP_EXT_CODEX_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
  "mcp": { "servers": {} },
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$MCP_EXT_CODEX_PROJECT"

(cd "$MCP_EXT_CODEX_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)

# Seed a hand-written third-party section before extension add — it must
# survive both the add and the remove passes.
mkdir -p "$MCP_EXT_CODEX_PROJECT/.codex"
cat > "$MCP_EXT_CODEX_PROJECT/.codex/config.toml" << 'EOF'
[mcp_servers.manual]
command = "noop"
EOF

(cd "$MCP_EXT_CODEX_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$REPLACE_DIR" > /dev/null 2>&1)

assert_exists "$MCP_EXT_CODEX_PROJECT/.codex/config.toml" "codex TOML must exist after ext add"
assert_contains "$MCP_EXT_CODEX_PROJECT/.codex/config.toml" 'ext-test-server' \
  "extension MCP server key must be in codex TOML settings"
assert_contains "$MCP_EXT_CODEX_PROJECT/.codex/config.toml" '^\[mcp_servers\.manual\]' \
  "hand-written mcp_servers.manual section must survive extension add"

(cd "$MCP_EXT_CODEX_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension remove unikit-ext-replace > /dev/null 2>&1)
assert_not_contains "$MCP_EXT_CODEX_PROJECT/.codex/config.toml" 'ext-test-server' \
  "extension MCP server must be removed from codex TOML settings"
assert_contains "$MCP_EXT_CODEX_PROJECT/.codex/config.toml" '^\[mcp_servers\.manual\]' \
  "hand-written mcp_servers.manual section must survive extension remove"

echo "  ✓ codex MCP servers: extension adds and removes codex TOML config (preserves third-party sections)"

# ─────────────────────────────────────────────────────
# Test 12: Injection idempotency - add same extension twice
# ─────────────────────────────────────────────────────

IDEMP_PROJECT="$TMPDIR/test-idempotent"
mkdir -p "$IDEMP_PROJECT"

cat > "$IDEMP_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$IDEMP_PROJECT"

(cd "$IDEMP_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)

# Add extension twice (second is an upgrade to same version)
(cd "$IDEMP_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$EXAMPLE_DIR" > /dev/null 2>&1)
(cd "$IDEMP_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$EXAMPLE_DIR" > /dev/null 2>&1)

# Count injection markers - should be exactly 1 start marker, not 2
MARKER_COUNT=$(grep -c "unikit-ext:unikit-ext-hello:unikit:append:start" \
  "$IDEMP_PROJECT/.claude/skills/unikit/SKILL.md" || true)

if [[ "$MARKER_COUNT" -eq 1 ]]; then
  echo "  ✓ idempotency: re-adding extension produces exactly 1 injection marker"
else
  echo "Assertion failed: idempotency - expected 1 marker, found $MARKER_COUNT"
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 13: Update flow - injections survive base skill update
# ─────────────────────────────────────────────────────

# Use the idempotent project (already has extension installed)
UPDATE_EXT_OUTPUT="$TMPDIR/update-ext-flow.log"
(cd "$IDEMP_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > "$UPDATE_EXT_OUTPUT" 2>&1)
assert_not_contains "$UPDATE_EXT_OUTPUT" "Local modifications detected" \
  "update right after extension add must not report drift on a skill that only carries an extension block"

# Injection should still be present after update
assert_contains "$IDEMP_PROJECT/.claude/skills/unikit/SKILL.md" \
  "unikit-ext:unikit-ext-hello:unikit:append:start" \
  "injection markers must survive base update"

assert_contains "$IDEMP_PROJECT/.claude/skills/unikit/SKILL.md" \
  "Extra Rules.*from extension" \
  "injected content must survive base update"

# Extension skill should still exist
assert_exists "$IDEMP_PROJECT/.claude/skills/hello-world/SKILL.md" \
  "extension skill must survive base update"

echo "  ✓ update flow: injections and ext skills survive base skill update"

# ─────────────────────────────────────────────────────
# Test 14: Extension upgrade (version bump)
# ─────────────────────────────────────────────────────

V2_DIR="$ROOT_DIR/examples/extensions/unikit-ext-hello-v2"

# Upgrade from v1 to v2 using the idempotent project
(cd "$IDEMP_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$V2_DIR" > /dev/null 2>&1)

# Version should be updated in config
UPGRADE_CHECK=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const ext = (c.extensions || []).find(e => e.name === 'unikit-ext-hello');
  console.log(ext ? ext.version : 'missing');
" "$IDEMP_PROJECT/.unikit.json")

if [[ "$UPGRADE_CHECK" == "2.0.0" ]]; then
  echo "  ✓ extension upgrade: v1 -> v2, config shows 2.0.0"
else
  echo "Assertion failed: extension upgrade version"
  echo "Got: $UPGRADE_CHECK (expected 2.0.0)"
  exit 1
fi

# v2 content should be installed
assert_contains "$IDEMP_PROJECT/.claude/skills/hello-world/SKILL.md" \
  "v2" "upgraded skill must have v2 content"

echo "  ✓ extension upgrade: v2 content installed correctly"

# ─────────────────────────────────────────────────────
# Test 15: Backward compat - config without extensions field
# ─────────────────────────────────────────────────────

COMPAT_EXT_RESULT=$(node --input-type=module -e "
  import fs from 'fs';
  import os from 'os';
  import path from 'path';
  const { loadConfig } = await import('./dist/core/config.js');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-compat-'));
  fs.writeFileSync(path.join(tmpDir, '.unikit.json'), JSON.stringify({
    version: '1.0.0', language: 'en', engine: 'unity',
    mcp: { servers: {} }, engineBridges: { selected: {} },
    agents: [{ id: 'claude', skillsDir: '.claude/skills', subagentsDir: '.claude/agents',
               installedSkills: [], installedSubagents: [] }],
    rules: { installed: { version: '1.0.0', core: [], stack: [] }, declined: [] }
  }));

  const config = await loadConfig(tmpDir);
  const ok = Array.isArray(config.extensions) && config.extensions.length === 0
    && config.agents[0].extensionSkills === undefined
    && config.agents[0].extensionSubagents === undefined;
  fs.rmSync(tmpDir, { recursive: true });
  console.log(ok ? 'ok' : 'fail');
" 2>&1)

if [[ "$COMPAT_EXT_RESULT" == "ok" ]]; then
  echo "  ✓ backward compat: config without extensions normalizes to empty arrays"
else
  echo "Assertion failed: backward compat"
  echo "Got: $COMPAT_EXT_RESULT"
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 16: extension remove nonexistent
# ─────────────────────────────────────────────────────

REMOVE_NX_PROJECT="$TMPDIR/test-ext-remove-nx"
mkdir -p "$REMOVE_NX_PROJECT"

cat > "$REMOVE_NX_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$REMOVE_NX_PROJECT"

REMOVE_NX_OUTPUT="$TMPDIR/ext-remove-nx.log"
EXIT_CODE=0
(cd "$REMOVE_NX_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension remove unknown-ext > "$REMOVE_NX_OUTPUT" 2>&1) || EXIT_CODE=$?

if [[ "$EXIT_CODE" -eq 0 ]]; then
  echo "Assertion failed: extension remove nonexistent should exit non-zero"
  exit 1
fi

assert_contains "$REMOVE_NX_OUTPUT" 'Extension "unknown-ext" is not installed' \
  "remove nonexistent must show 'not installed' error"

echo "  ✓ extension remove nonexistent: non-zero exit + error message"

# ─────────────────────────────────────────────────────
# Test 17: extension add minimal manifest (name + version only)
# ─────────────────────────────────────────────────────

MINIMAL_EXT="$TMPDIR/unikit-ext-minimal"
mkdir -p "$MINIMAL_EXT"
cat > "$MINIMAL_EXT/extension.json" << 'EOF'
{
  "name": "unikit-ext-minimal",
  "version": "0.1.0"
}
EOF

MINIMAL_PROJECT="$TMPDIR/test-ext-minimal"
mkdir -p "$MINIMAL_PROJECT"

cat > "$MINIMAL_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$MINIMAL_PROJECT"

MINIMAL_OUTPUT="$TMPDIR/ext-minimal.log"
EXIT_CODE=0
(cd "$MINIMAL_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$MINIMAL_EXT" > "$MINIMAL_OUTPUT" 2>&1) || EXIT_CODE=$?

if [[ "$EXIT_CODE" -ne 0 ]]; then
  echo "Assertion failed: extension add with minimal manifest should succeed (got exit $EXIT_CODE)"
  cat "$MINIMAL_OUTPUT"
  exit 1
fi

# Extension should be in config
MINIMAL_CHECK=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const ext = (c.extensions || []).find(e => e.name === 'unikit-ext-minimal');
  console.log(ext ? ext.version : 'missing');
" "$MINIMAL_PROJECT/.unikit.json")

if [[ "$MINIMAL_CHECK" == "0.1.0" ]]; then
  :  # expected
else
  echo "Assertion failed: minimal extension should be in config (got: $MINIMAL_CHECK)"
  exit 1
fi

# Extension storage should exist
assert_exists "$MINIMAL_PROJECT/.unikit/extensions/unikit-ext-minimal/extension.json" \
  "minimal extension manifest must be stored"

echo "  ✓ extension add minimal: name+version only manifest accepted"

# ─────────────────────────────────────────────────────
# Test 18: extension list empty
# ─────────────────────────────────────────────────────

LIST_EMPTY_PROJECT="$TMPDIR/test-ext-list-empty"
mkdir -p "$LIST_EMPTY_PROJECT"

cat > "$LIST_EMPTY_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$LIST_EMPTY_PROJECT"

LIST_EMPTY_OUTPUT="$TMPDIR/ext-list-empty.log"
(cd "$LIST_EMPTY_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension list > "$LIST_EMPTY_OUTPUT" 2>&1)

assert_contains "$LIST_EMPTY_OUTPUT" "No extensions installed" \
  "extension list with no extensions must show empty-state message"

echo "  ✓ extension list empty: 'No extensions installed.' message"

# ─────────────────────────────────────────────────────
# Test 19: injection target not found
# ─────────────────────────────────────────────────────

INJ_NF_EXT="$TMPDIR/unikit-ext-badinject"
mkdir -p "$INJ_NF_EXT/injections"
cat > "$INJ_NF_EXT/extension.json" << 'EOF'
{
  "name": "unikit-ext-badinject",
  "version": "1.0.0",
  "injections": [
    {
      "target": "nonexistent-skill-xyz",
      "targetType": "skill",
      "position": "append",
      "file": "./injections/extra.md"
    }
  ]
}
EOF
echo "# Injected content" > "$INJ_NF_EXT/injections/extra.md"

INJ_NF_PROJECT="$TMPDIR/test-ext-badinject"
mkdir -p "$INJ_NF_PROJECT"

cat > "$INJ_NF_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$INJ_NF_PROJECT"

# Install base skills first
(cd "$INJ_NF_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)

INJ_NF_OUTPUT="$TMPDIR/ext-badinject.log"
EXIT_CODE=0
(cd "$INJ_NF_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$INJ_NF_EXT" > "$INJ_NF_OUTPUT" 2>&1) || EXIT_CODE=$?

if [[ "$EXIT_CODE" -ne 0 ]]; then
  echo "Assertion failed: extension add with bad injection target should succeed (got exit $EXIT_CODE)"
  cat "$INJ_NF_OUTPUT"
  exit 1
fi

# Extension should be in config (install succeeds even if injection fails silently)
INJ_NF_CHECK=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const ext = (c.extensions || []).find(e => e.name === 'unikit-ext-badinject');
  console.log(ext ? 'found' : 'missing');
" "$INJ_NF_PROJECT/.unikit.json")

if [[ "$INJ_NF_CHECK" == "found" ]]; then
  :  # expected
else
  echo "Assertion failed: extension with bad injection target should still be in config"
  exit 1
fi

# Extension storage should exist
assert_exists "$INJ_NF_PROJECT/.unikit/extensions/unikit-ext-badinject/extension.json" \
  "extension with bad injection target must still be stored"

# The nonexistent skill directory should NOT have been created
assert_not_exists "$INJ_NF_PROJECT/.claude/skills/nonexistent-skill-xyz" \
  "nonexistent injection target must not create skill directory"

echo "  ✓ injection target not found: install succeeds, injection silently skipped"

# ─────────────────────────────────────────────────────
# Test 20: multi-agent + multi-extension
# ─────────────────────────────────────────────────────

MULTI_EXT_PROJECT="$TMPDIR/test-multi-ext"
mkdir -p "$MULTI_EXT_PROJECT"

cat > "$MULTI_EXT_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
  "mcp": { "servers": {} },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit"],
      "installedSubagents": ["unikit-architecture-sidecar"]
    },
    {
      "id": "cursor",
      "skillsDir": ".cursor/skills",
      "subagentsDir": ".cursor/agents",
      "installedSkills": ["unikit"],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$MULTI_EXT_PROJECT"

# Install base skills for both agents
(cd "$MULTI_EXT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)

# Add two extensions
(cd "$MULTI_EXT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$EXAMPLE_DIR" > /dev/null 2>&1)
(cd "$MULTI_EXT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$MINIMAL_EXT" > /dev/null 2>&1)

# Both agents should have ext-hello skills
assert_exists "$MULTI_EXT_PROJECT/.claude/skills/hello-world/SKILL.md" \
  "claude must have ext-hello skill"
assert_exists "$MULTI_EXT_PROJECT/.cursor/skills/hello-world/SKILL.md" \
  "cursor must have ext-hello skill"

# Both extensions should be in config
MULTI_EXT_COUNT=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log((c.extensions || []).length);
" "$MULTI_EXT_PROJECT/.unikit.json")

if [[ "$MULTI_EXT_COUNT" -eq 2 ]]; then
  :  # expected
else
  echo "Assertion failed: multi-ext config should have 2 extensions (got $MULTI_EXT_COUNT)"
  exit 1
fi

echo "  ✓ multi-agent + multi-extension: both agents get both extensions' skills"

# ─────────────────────────────────────────────────────
# Test 21: extension upgrade with corrupted storage
# ─────────────────────────────────────────────────────

CORRUPT_EXT_PROJECT="$TMPDIR/test-ext-corrupt"
mkdir -p "$CORRUPT_EXT_PROJECT"

cat > "$CORRUPT_EXT_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$CORRUPT_EXT_PROJECT"

# Install base skills and add v1 extension
(cd "$CORRUPT_EXT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)
(cd "$CORRUPT_EXT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$EXAMPLE_DIR" > /dev/null 2>&1)

assert_exists "$CORRUPT_EXT_PROJECT/.claude/skills/hello-world/SKILL.md" \
  "v1 extension skill must be installed before corruption test"

# Corrupt storage: delete the skills directory from extension storage
rm -rf "$CORRUPT_EXT_PROJECT/.unikit/extensions/unikit-ext-hello/skills"

# Upgrade to v2 - should succeed even with corrupted v1 storage
V2_DIR="$ROOT_DIR/examples/extensions/unikit-ext-hello-v2"
CORRUPT_UPGRADE_OUTPUT="$TMPDIR/ext-corrupt-upgrade.log"
EXIT_CODE=0
(cd "$CORRUPT_EXT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$V2_DIR" > "$CORRUPT_UPGRADE_OUTPUT" 2>&1) || EXIT_CODE=$?

if [[ "$EXIT_CODE" -ne 0 ]]; then
  echo "Assertion failed: extension upgrade with corrupted storage should succeed (got exit $EXIT_CODE)"
  cat "$CORRUPT_UPGRADE_OUTPUT"
  exit 1
fi

# v2 skill should be installed
assert_exists "$CORRUPT_EXT_PROJECT/.claude/skills/hello-world/SKILL.md" \
  "v2 skill must be installed after upgrade with corrupted storage"

assert_contains "$CORRUPT_EXT_PROJECT/.claude/skills/hello-world/SKILL.md" \
  "v2" "upgraded skill must have v2 content after corrupted storage upgrade"

# Version should be 2.0.0
CORRUPT_VER=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const ext = (c.extensions || []).find(e => e.name === 'unikit-ext-hello');
  console.log(ext ? ext.version : 'missing');
" "$CORRUPT_EXT_PROJECT/.unikit.json")

if [[ "$CORRUPT_VER" == "2.0.0" ]]; then
  :  # expected
else
  echo "Assertion failed: corrupted storage upgrade should produce v2.0.0 (got $CORRUPT_VER)"
  exit 1
fi

echo "  ✓ extension upgrade corrupted storage: v2 installed from fresh source"

# ─────────────────────────────────────────────────────
# Test 22: extension update - empty list (no extensions)
# ─────────────────────────────────────────────────────

UPDATE_EMPTY_PROJECT="$TMPDIR/test-ext-update-empty"
mkdir -p "$UPDATE_EMPTY_PROJECT"

cat > "$UPDATE_EMPTY_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$UPDATE_EMPTY_PROJECT"

UPDATE_EMPTY_OUTPUT="$TMPDIR/ext-update-empty.log"
(cd "$UPDATE_EMPTY_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension update > "$UPDATE_EMPTY_OUTPUT" 2>&1)

assert_contains "$UPDATE_EMPTY_OUTPUT" "No extensions installed" \
  "extension update with no extensions must show empty-state message"

echo "  ✓ extension update empty: 'No extensions installed.' message"

# ─────────────────────────────────────────────────────
# Test 23: extension update - all up to date
# ─────────────────────────────────────────────────────

UPDATE_UTD_PROJECT="$TMPDIR/test-ext-update-utd"
mkdir -p "$UPDATE_UTD_PROJECT"

cat > "$UPDATE_UTD_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$UPDATE_UTD_PROJECT"

# Install base skills, then add extension
(cd "$UPDATE_UTD_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)
(cd "$UPDATE_UTD_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$EXAMPLE_DIR" > /dev/null 2>&1)

# Run extension update - source unchanged, should be up to date
UPDATE_UTD_OUTPUT="$TMPDIR/ext-update-utd.log"
(cd "$UPDATE_UTD_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension update > "$UPDATE_UTD_OUTPUT" 2>&1)

assert_contains "$UPDATE_UTD_OUTPUT" "All extensions are up to date" \
  "extension update with no changes must show up-to-date message"

echo "  ✓ extension update up-to-date: 'All extensions are up to date.' message"

# ─────────────────────────────────────────────────────
# Test 24: extension update --force reinstall
# ─────────────────────────────────────────────────────

# Reuse the up-to-date project from test 23
UPDATE_FORCE_OUTPUT="$TMPDIR/ext-update-force.log"
(cd "$UPDATE_UTD_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension update --force > "$UPDATE_FORCE_OUTPUT" 2>&1)

assert_contains "$UPDATE_FORCE_OUTPUT" "Updated:.*unikit-ext-hello" \
  "extension update --force must show updated extension name"

echo "  ✓ extension update --force: reinstalls even when up to date"

# ─────────────────────────────────────────────────────
# Test 25: extension update - version change detected
# ─────────────────────────────────────────────────────

UPDATE_VER_PROJECT="$TMPDIR/test-ext-update-ver"
mkdir -p "$UPDATE_VER_PROJECT"

cat > "$UPDATE_VER_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$UPDATE_VER_PROJECT"

# Copy example extension to TMPDIR so we can modify it
UPDATE_VER_EXT="$TMPDIR/unikit-ext-vertest"
cp -r "$EXAMPLE_DIR" "$UPDATE_VER_EXT"

# Install base skills and add extension at v1.0.0
(cd "$UPDATE_VER_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)
(cd "$UPDATE_VER_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$UPDATE_VER_EXT" > /dev/null 2>&1)

# Bump version in the source extension
node -e "
  const fs = require('fs');
  const p = require('path').join(process.argv[1], 'extension.json');
  const m = JSON.parse(fs.readFileSync(p, 'utf8'));
  m.version = '1.1.0';
  fs.writeFileSync(p, JSON.stringify(m, null, 2));
" "$UPDATE_VER_EXT"

# Run extension update - should detect version change
UPDATE_VER_OUTPUT="$TMPDIR/ext-update-ver.log"
(cd "$UPDATE_VER_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension update > "$UPDATE_VER_OUTPUT" 2>&1)

assert_contains "$UPDATE_VER_OUTPUT" "Updated:.*unikit-ext-hello" \
  "extension update must detect version change and show updated name"

# Verify version updated in config
UPDATE_VER_CHECK=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const ext = (c.extensions || []).find(e => e.name === 'unikit-ext-hello');
  console.log(ext ? ext.version : 'missing');
" "$UPDATE_VER_PROJECT/.unikit.json")

if [[ "$UPDATE_VER_CHECK" == "1.1.0" ]]; then
  :  # expected
else
  echo "Assertion failed: extension update version should be 1.1.0 (got $UPDATE_VER_CHECK)"
  exit 1
fi

echo "  ✓ extension update version change: detected and updated to 1.1.0"

# ─────────────────────────────────────────────────────
# Test 26: extension update - partial failure (corrupted source)
# ─────────────────────────────────────────────────────

UPDATE_FAIL_PROJECT="$TMPDIR/test-ext-update-fail"
mkdir -p "$UPDATE_FAIL_PROJECT"

cat > "$UPDATE_FAIL_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$UPDATE_FAIL_PROJECT"

# Install base skills and add extension
(cd "$UPDATE_FAIL_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)
(cd "$UPDATE_FAIL_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$EXAMPLE_DIR" > /dev/null 2>&1)

# Corrupt the source path in config to point to nonexistent directory
node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  const ext = c.extensions.find(e => e.name === 'unikit-ext-hello');
  ext.source = '/nonexistent/path/that/does/not/exist';
  fs.writeFileSync(process.argv[1], JSON.stringify(c, null, 2));
" "$UPDATE_FAIL_PROJECT/.unikit.json"

# Run extension update - should report failure
UPDATE_FAIL_OUTPUT="$TMPDIR/ext-update-fail.log"
(cd "$UPDATE_FAIL_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension update > "$UPDATE_FAIL_OUTPUT" 2>&1)

assert_contains "$UPDATE_FAIL_OUTPUT" "Failed to update:.*unikit-ext-hello" \
  "extension update with corrupted source must show failure message"

echo "  ✓ extension update partial failure: 'Failed to update: <name>' shown"

# ─────────────────────────────────────────────────────
# Test 27: extension update - no config
# ─────────────────────────────────────────────────────

UPDATE_NOCONF_DIR="$TMPDIR/test-ext-update-noconf"
mkdir -p "$UPDATE_NOCONF_DIR"

UPDATE_NOCONF_OUTPUT="$TMPDIR/ext-update-noconf.log"
EXIT_CODE=0
(cd "$UPDATE_NOCONF_DIR" && node "$ROOT_DIR/dist/cli/index.js" extension update > "$UPDATE_NOCONF_OUTPUT" 2>&1) || EXIT_CODE=$?

if [[ "$EXIT_CODE" -eq 0 ]]; then
  echo "Assertion failed: extension update without .unikit.json should exit non-zero"
  exit 1
fi

assert_contains "$UPDATE_NOCONF_OUTPUT" "No .unikit.json found" \
  "extension update without config must show error message"

echo "  ✓ extension update no-config: non-zero exit + error message"

# ─────────────────────────────────────────────────────
# Test 28: extension list - replaces display
# ─────────────────────────────────────────────────────

LIST_REPL_PROJECT="$TMPDIR/test-ext-list-repl"
mkdir -p "$LIST_REPL_PROJECT"

cat > "$LIST_REPL_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
  "mcp": { "servers": {} },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit", "unikit-commit"],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$LIST_REPL_PROJECT"

# Install base skills and add replace extension
(cd "$LIST_REPL_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)
(cd "$LIST_REPL_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$REPLACE_DIR" > /dev/null 2>&1)

LIST_REPL_OUTPUT="$TMPDIR/ext-list-repl.log"
(cd "$LIST_REPL_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension list > "$LIST_REPL_OUTPUT" 2>&1)

assert_contains "$LIST_REPL_OUTPUT" "Replaces:" \
  "extension list must show 'Replaces:' for extension with replacements"

echo "  ✓ extension list replaces: 'Replaces:' shown for replace extension"

# ─────────────────────────────────────────────────────
# Test 29: extension subagents skipped for no-support agent
# ─────────────────────────────────────────────────────

NOSUB_PROJECT="$TMPDIR/test-ext-nosub"
mkdir -p "$NOSUB_PROJECT"

cat > "$NOSUB_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
  "mcp": { "servers": {} },
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$NOSUB_PROJECT"

# Install base skills and add extension that has subagents
(cd "$NOSUB_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)
(cd "$NOSUB_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$EXAMPLE_DIR" > /dev/null 2>&1)

# Extension skill should be installed
assert_exists "$NOSUB_PROJECT/.codex/skills/hello-world/SKILL.md" \
  "extension skill must be installed for codex agent"

# Extension subagent should NOT be installed (codex doesn't support subagents)
assert_not_exists "$NOSUB_PROJECT/.codex/agents/hello-agent.md" \
  "extension subagent must NOT be installed for codex agent (supportsSubagents: false)"

echo "  ✓ subagent skip: codex agent skips extension subagents"

# ─────────────────────────────────────────────────────
# Test 30: injection prepend position
# ─────────────────────────────────────────────────────

PREPEND_EXT="$TMPDIR/unikit-ext-prepend"
mkdir -p "$PREPEND_EXT/injections"
cat > "$PREPEND_EXT/extension.json" << 'EOF'
{
  "name": "unikit-ext-prepend",
  "version": "1.0.0",
  "injections": [
    {
      "target": "unikit",
      "targetType": "skill",
      "position": "prepend",
      "file": "./injections/top-content.md"
    }
  ]
}
EOF
echo "# PREPENDED CONTENT FROM EXTENSION" > "$PREPEND_EXT/injections/top-content.md"

PREPEND_PROJECT="$TMPDIR/test-ext-prepend"
mkdir -p "$PREPEND_PROJECT"

cat > "$PREPEND_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$PREPEND_PROJECT"

# Install base skills first
(cd "$PREPEND_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)

# The base skill as `update` left it — what `extension remove` must give back byte for byte
SKILL_FILE_P="$PREPEND_PROJECT/.claude/skills/unikit/SKILL.md"
PREPEND_SHA_BEFORE=$(sha_of "$SKILL_FILE_P")

# Add prepend extension
(cd "$PREPEND_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$PREPEND_EXT" > /dev/null 2>&1)

# Verify injected content is present
assert_contains "$SKILL_FILE_P" \
  "PREPENDED CONTENT FROM EXTENSION" \
  "prepend injection content must be present"

# The frontmatter fence stays the first line; the block follows the closing fence
FIRST_LINE=$(head -1 "$SKILL_FILE_P")
if [[ "$FIRST_LINE" != "---" ]]; then
  echo "Assertion failed: prepend must keep the frontmatter fence as the first line"
  echo "First line: $FIRST_LINE"
  exit 1
fi
FENCE_END=$(awk '/^---$/ { n++; if (n == 2) { print NR; exit } }' "$SKILL_FILE_P")
AFTER_FENCE=$(sed -n "$((FENCE_END + 1))p" "$SKILL_FILE_P")
if [[ "$AFTER_FENCE" != *"unikit-ext:unikit-ext-prepend:unikit:prepend:start"* ]]; then
  echo "Assertion failed: prepend block must follow the frontmatter"
  echo "Line after fence: $AFTER_FENCE"
  exit 1
fi

# Removal gives the file back byte for byte
(cd "$PREPEND_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension remove unikit-ext-prepend > /dev/null 2>&1)
assert_same_sha "$SKILL_FILE_P" "$PREPEND_SHA_BEFORE" \
  "prepend removal must restore the file byte for byte"

echo "  ✓ injection prepend: block sits right after the frontmatter, file still starts with the fence"

# ─────────────────────────────────────────────────────
# Test 31: commands field accepted in manifest validation
# ─────────────────────────────────────────────────────

CMD_VALIDATE=$(node --input-type=module -e "
  const { validateManifest } = await import('./dist/core/extensions.js');

  const result = validateManifest({
    name: 'unikit-ext-test', version: '1.0.0',
    commands: [
      { name: 'hello', description: 'Say hello', module: './commands/hello.js' }
    ]
  });
  if (!result.valid) { console.error('valid commands rejected:', result.error); process.exit(1); }
  if (!result.manifest.commands || result.manifest.commands.length !== 1) {
    console.error('commands not preserved in manifest'); process.exit(1);
  }
  if (result.manifest.commands[0].name !== 'hello') {
    console.error('command name not preserved'); process.exit(1);
  }
  console.log('ok');
" 2>&1)

if [[ "$CMD_VALIDATE" == "ok" ]]; then
  echo "  ✓ commands validation: valid commands field accepted and preserved"
else
  echo "Assertion failed: commands validation"
  echo "$CMD_VALIDATE"
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 32: commands validation rejects invalid entries
# ─────────────────────────────────────────────────────

CMD_INVALID=$(node --input-type=module -e "
  const { validateManifest } = await import('./dist/core/extensions.js');

  // commands must be array
  const r1 = validateManifest({ name: 'unikit-ext-test', version: '1.0.0', commands: 'bad' });
  if (r1.valid) { console.error('non-array commands accepted'); process.exit(1); }

  // command missing name
  const r2 = validateManifest({
    name: 'unikit-ext-test', version: '1.0.0',
    commands: [{ description: 'x', module: './x.js' }]
  });
  if (r2.valid) { console.error('missing name accepted'); process.exit(1); }

  // command missing module
  const r3 = validateManifest({
    name: 'unikit-ext-test', version: '1.0.0',
    commands: [{ name: 'x', description: 'x' }]
  });
  if (r3.valid) { console.error('missing module accepted'); process.exit(1); }

  // command missing description
  const r4 = validateManifest({
    name: 'unikit-ext-test', version: '1.0.0',
    commands: [{ name: 'x', module: './x.js' }]
  });
  if (r4.valid) { console.error('missing description accepted'); process.exit(1); }

  console.log('ok');
" 2>&1)

if [[ "$CMD_INVALID" == "ok" ]]; then
  echo "  ✓ commands validation: invalid entries correctly rejected"
else
  echo "Assertion failed: commands invalid validation"
  echo "$CMD_INVALID"
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 33: command module file existence check at install
# ─────────────────────────────────────────────────────

CMD_MISSING_EXT="$TMPDIR/unikit-ext-badcmd"
mkdir -p "$CMD_MISSING_EXT"
cat > "$CMD_MISSING_EXT/extension.json" << 'EOF'
{
  "name": "unikit-ext-badcmd",
  "version": "1.0.0",
  "commands": [
    { "name": "broken", "description": "Broken command", "module": "./commands/nonexistent.js" }
  ]
}
EOF

CMD_MISSING_PROJECT="$TMPDIR/test-ext-cmdmissing"
mkdir -p "$CMD_MISSING_PROJECT"

cat > "$CMD_MISSING_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
  "mcp": { "servers": {} },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": [],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$CMD_MISSING_PROJECT"

CMD_MISSING_OUTPUT="$TMPDIR/ext-cmdmissing.log"
EXIT_CODE=0
(cd "$CMD_MISSING_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$CMD_MISSING_EXT" > "$CMD_MISSING_OUTPUT" 2>&1) || EXIT_CODE=$?

if [[ "$EXIT_CODE" -ne 0 ]]; then
  :  # expected failure
else
  echo "Assertion failed: extension add should fail for missing command module"
  exit 1
fi

if grep -q "missing module" "$CMD_MISSING_OUTPUT"; then
  echo "  ✓ command module validation: missing module detected at install time"
else
  echo "Assertion failed: error message should mention missing module"
  cat "$CMD_MISSING_OUTPUT"
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 34: example extension with commands installs cleanly
# ─────────────────────────────────────────────────────

CMD_INSTALL_PROJECT="$TMPDIR/test-ext-cmdinstall"
mkdir -p "$CMD_INSTALL_PROJECT"

cat > "$CMD_INSTALL_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
  "mcp": { "servers": {} },
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$CMD_INSTALL_PROJECT"

# Install base skills first
(cd "$CMD_INSTALL_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)

# Add example extension (now with commands)
CMD_INSTALL_OUTPUT="$TMPDIR/ext-cmdinstall.log"
(cd "$CMD_INSTALL_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$EXAMPLE_DIR" > "$CMD_INSTALL_OUTPUT" 2>&1)

# Verify command module is in extension storage
assert_exists "$CMD_INSTALL_PROJECT/.unikit/extensions/unikit-ext-hello/commands/hello.js" \
  "command module must be copied to extension storage"

# Verify install output mentions commands
if grep -q "Commands:" "$CMD_INSTALL_OUTPUT"; then
  echo "  ✓ commands install: example extension with commands installs cleanly"
else
  echo "Assertion failed: install output should show Commands"
  cat "$CMD_INSTALL_OUTPUT"
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 35: extension storage manifest includes commands
# ─────────────────────────────────────────────────────

CMD_MANIFEST_CHECK=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  if (!c.commands || !Array.isArray(c.commands)) { console.log('no-commands'); process.exit(0); }
  if (c.commands.length !== 1) { console.log('wrong-count'); process.exit(0); }
  if (c.commands[0].name !== 'hello') { console.log('wrong-name'); process.exit(0); }
  if (c.commands[0].module !== './commands/hello.js') { console.log('wrong-module'); process.exit(0); }
  console.log('ok');
" "$CMD_INSTALL_PROJECT/.unikit/extensions/unikit-ext-hello/extension.json")

if [[ "$CMD_MANIFEST_CHECK" == "ok" ]]; then
  echo "  ✓ commands storage: manifest in storage includes commands field"
else
  echo "Assertion failed: stored manifest commands check"
  echo "Got: $CMD_MANIFEST_CHECK"
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 36: ext add same extension twice → no duplicates in config.extensions
# ─────────────────────────────────────────────────────

DEDUP_PROJECT="$TMPDIR/test-ext-dedup"
mkdir -p "$DEDUP_PROJECT"

cat > "$DEDUP_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$DEDUP_PROJECT"

(cd "$DEDUP_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)
(cd "$DEDUP_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$EXAMPLE_DIR" > /dev/null 2>&1)
(cd "$DEDUP_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$EXAMPLE_DIR" > /dev/null 2>&1)

DEDUP_CHECK=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const count = (c.extensions || []).filter(e => e.name === 'unikit-ext-hello').length;
  console.log(count);
" "$DEDUP_PROJECT/.unikit.json")

if [[ "$DEDUP_CHECK" == "1" ]]; then
  echo "  ✓ dedup: adding same extension twice produces exactly 1 config entry"
else
  echo "Assertion failed: extension dedup check"
  echo "Got: $DEDUP_CHECK entries (expected 1)"
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 37: path traversal name ../hack rejected
# ─────────────────────────────────────────────────────

TRAVERSAL_EXT="$TMPDIR/traversal-ext"
mkdir -p "$TRAVERSAL_EXT"
cat > "$TRAVERSAL_EXT/extension.json" << 'EOF'
{
  "name": "../hack",
  "version": "1.0.0"
}
EOF

TRAVERSAL_RESULT=$(node --input-type=module -e "
  const { validateManifest } = await import('./dist/core/extensions.js');
  const result = validateManifest({ name: '../hack', version: '1.0.0' });
  console.log(result.valid ? 'accepted' : 'rejected');
" 2>&1)

if [[ "$TRAVERSAL_RESULT" == "rejected" ]]; then
  echo "  ✓ name validation: path traversal name ../hack rejected"
else
  echo "Assertion failed: path traversal name should be rejected"
  echo "Got: $TRAVERSAL_RESULT"
  exit 1
fi

# ─────────────────────────────────────────────────────
# Test 38: MCP injection into replacement skills after ext add
# ─────────────────────────────────────────────────────

MCP_INJECT_EXT="$TMPDIR/unikit-ext-mcp-replace"
mkdir -p "$MCP_INJECT_EXT/skills/custom-fix"

cat > "$MCP_INJECT_EXT/extension.json" << 'EOF'
{
  "name": "unikit-ext-mcp-replace",
  "version": "1.0.0",
  "replaces": { "skills/custom-fix": "unikit-fix" }
}
EOF

cat > "$MCP_INJECT_EXT/skills/custom-fix/SKILL.md" << 'EOF'
---
name: unikit-fix
description: Custom fix skill from extension
allowed-tools:
  - Read
  - Write
---

# Custom Fix (from extension)
EOF

MCP_INJECT_PROJECT="$TMPDIR/test-ext-mcp-inject"
mkdir -p "$MCP_INJECT_PROJECT"

cat > "$MCP_INJECT_PROJECT/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "mcp": { "servers": {} },
  "engineBridges": { "selected": { "coplay-unity-mcp": "UnityMCP" } },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit", "unikit-fix"],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$MCP_INJECT_PROJECT"

# Install base skills + MCP injection
(cd "$MCP_INJECT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)

# Verify base unikit-fix has MCP tools.
# Coplay grants executors a wildcard, so the probe is the wildcard entry itself — there is
# no coplay-only tool NAME left to look for. The escape is load-bearing: assert_contains
# feeds the pattern to `grep -qE`, and a bare `*` would read as "zero or more `_`" and match
# any member of the family, passing vacuously.
assert_contains "$MCP_INJECT_PROJECT/.claude/skills/unikit-fix/SKILL.md" \
  "mcp__UnityMCP__\*" \
  "base unikit-fix must have MCP tools before replacement"

# Add replace extension
(cd "$MCP_INJECT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$MCP_INJECT_EXT" > /dev/null 2>&1)

# Replaced skill must have MCP tools injected
assert_contains "$MCP_INJECT_PROJECT/.claude/skills/unikit-fix/SKILL.md" \
  "mcp__UnityMCP__\*" \
  "replaced skill must have MCP tools after ext add"

assert_contains "$MCP_INJECT_PROJECT/.claude/skills/unikit-fix/SKILL.md" \
  "Custom Fix.*from extension" \
  "replaced skill must have extension content"

echo "  ✓ MCP injection: replacement skill gets MCP tools after ext add"

# ─────────────────────────────────────────────────────
# Test 39: MCP injection restored after ext remove
# ─────────────────────────────────────────────────────

(cd "$MCP_INJECT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension remove unikit-ext-mcp-replace > /dev/null 2>&1)

# Restored base skill must have MCP tools
assert_contains "$MCP_INJECT_PROJECT/.claude/skills/unikit-fix/SKILL.md" \
  "mcp__UnityMCP__\*" \
  "restored base skill must have MCP tools after ext remove"

assert_not_contains "$MCP_INJECT_PROJECT/.claude/skills/unikit-fix/SKILL.md" \
  "Custom Fix.*from extension" \
  "restored base skill must not have extension content"

echo "  ✓ MCP injection: restored base skill has MCP tools after ext remove"

# ─────────────────────────────────────────────────────
# Test 40: an extension subagent that dispatches others goes through the same adapter
# ─────────────────────────────────────────────────────
# installExtensionSubagents is the third place a subagent source becomes an installed file
# (after `init` and `update`). All three render through renderSubagent, so an extension
# orchestrator carrying `Agent(...)` must come out in Kimi's format on a Kimi project and
# stay byte-for-byte Claude-style on a Claude one — and disappear with the extension.

KEXT_DIR="$TMPDIR/unikit-ext-kimi-agent"
mkdir -p "$KEXT_DIR/subagents"
cat > "$KEXT_DIR/extension.json" << 'EOF'
{"name":"unikit-ext-kimi-agent","version":"1.0.0","description":"Orchestrator subagent for adapter tests","subagents":["subagents/ext-orchestrator.md"]}
EOF
cat > "$KEXT_DIR/subagents/ext-orchestrator.md" << 'EOF'
---
name: ext-orchestrator
description: "Orchestrate helpers. Use via `claude --agent ext-orchestrator`."
tools:
  - Agent(ext-helper)
  - Read
model: inherit
---

You are the extension orchestrator.
EOF

KEXT_KIMI="$TMPDIR/test-ext-agent-kimi"
mkdir -p "$KEXT_KIMI"
cat > "$KEXT_KIMI/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
  "mcp": { "servers": {} },
  "agents": [
    {
      "id": "kimi",
      "skillsDir": ".kimi-code/skills",
      "subagentsDir": ".kimi-code/agents",
      "installedSkills": ["unikit"],
      "installedSubagents": []
    }
  ],
  "rules": {
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$KEXT_KIMI"

KEXT_CLAUDE="$TMPDIR/test-ext-agent-claude"
mkdir -p "$KEXT_CLAUDE"
cat > "$KEXT_CLAUDE/.unikit.json" << 'EOF'
{
  "version": "1.0.0",
  "language": "en",
  "engine": "unity",
  "engineBridges": {"selected": {}},
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF
inject_fake_registry "$KEXT_CLAUDE"

for KEXT_PROJECT in "$KEXT_KIMI" "$KEXT_CLAUDE"; do
  (cd "$KEXT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)
  (cd "$KEXT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$KEXT_DIR" > /dev/null 2>&1)
done

# Kimi: Agent(ext-helper) → Agent + subagents:, ${base_prompt} first, kimi --agent
KEXT_KIMI_FILE="$KEXT_KIMI/.kimi-code/agents/ext-orchestrator.md"
assert_exists "$KEXT_KIMI_FILE" "extension subagent must be installed into .kimi-code/agents"
frontmatter_of "$KEXT_KIMI_FILE" > "$TMPDIR/kimi-ext.fm"
assert_contains "$TMPDIR/kimi-ext.fm" '^  - Agent$' "kimi: extension orchestrator carries the plain Agent tool"
assert_not_contains "$TMPDIR/kimi-ext.fm" 'Agent\(' "kimi: no Agent(...) entry left in the extension orchestrator"
assert_contains "$TMPDIR/kimi-ext.fm" '^subagents:$' "kimi: extension orchestrator has a subagents: list"
assert_contains "$TMPDIR/kimi-ext.fm" '^  - ext-helper$' "kimi: the dispatched name moved into subagents:"
if [[ "$(body_first_line_of "$KEXT_KIMI_FILE")" != '${base_prompt}' ]]; then
  echo "Assertion failed: kimi: the first body line of the extension orchestrator must be \${base_prompt}"
  exit 1
fi
assert_contains "$KEXT_KIMI_FILE" 'kimi --agent ext-orchestrator' "kimi: launch command rewritten"
assert_not_contains "$KEXT_KIMI_FILE" 'claude --agent' "kimi: no claude launch command left"

# Claude: untouched (the adapter is Kimi-only)
KEXT_CLAUDE_FILE="$KEXT_CLAUDE/.claude/agents/ext-orchestrator.md"
assert_exists "$KEXT_CLAUDE_FILE" "extension subagent must be installed into .claude/agents"
assert_contains "$KEXT_CLAUDE_FILE" 'Agent\(ext-helper\)' "claude: the Agent(...) entry is kept"
assert_contains "$KEXT_CLAUDE_FILE" 'claude --agent ext-orchestrator' "claude: the launch command is kept"
assert_not_contains "$KEXT_CLAUDE_FILE" 'subagents:' "claude: no subagents: list is added"
assert_not_contains "$KEXT_CLAUDE_FILE" 'base_prompt' "claude: no \${base_prompt} is added"

# Removing the extension removes the adapted file
(cd "$KEXT_KIMI" && node "$ROOT_DIR/dist/cli/index.js" extension remove unikit-ext-kimi-agent > /dev/null 2>&1)
assert_not_exists "$KEXT_KIMI_FILE" "extension remove must delete the adapted subagent from .kimi-code/agents"

echo "  ✓ extension subagent: adapted for Kimi, untouched for Claude, removed with the extension"

# ─────────────────────────────────────────────────────
# Test 41: extension points — block under the anchor, reference files,
#          order independence, byte-exact removal, no false drift, explained skips
# ─────────────────────────────────────────────────────

make_points_project() {   # <dir> <agent id> <skills dir> <subagents dir>
  local dir="$1" agent="$2" skills="$3" agents="$4"
  mkdir -p "$dir"
  cat > "$dir/.unikit.json" << EOF
{
  "version": "1.0.0", "language": "en", "engine": "unity", "engineBridges": {"selected": {}},
  "mcp": { "servers": {} },
  "agents": [ { "id": "$agent", "skillsDir": "$skills", "subagentsDir": "$agents",
                "installedSkills": ["unikit"], "installedSubagents": [] } ],
  "rules": { "installed": { "version": "1.0.0", "core": [], "stack": [] }, "declined": [] }
}
EOF
  inject_fake_registry "$dir"
  (cd "$dir" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)
}

make_points_extension() {  # <dir> <name> <version> <id> [body] [reference body]
  local dir="$1" name="$2" version="$3" id="$4"
  # Defaults live in variables: a `}` inside a ${5:-...} default would close the expansion early.
  local default_body='When a spec is attached, read {{ext_reference:notes.md}} first, then run /unikit-plan.'
  local default_ref='Skills dir: {{skills_dir}}; owner: {{self_name}}. Then /unikit-implement.'
  local body="${5:-$default_body}"
  local ref="${6:-$default_ref}"
  mkdir -p "$dir/injections" "$dir/references"
  printf '%s\n' "$body" > "$dir/injections/$id.md"
  printf '%s\n' "$ref" > "$dir/references/notes.md"
  cat > "$dir/extension.json" << EOF
{ "name": "$name", "version": "$version",
  "injections": [ { "id": "$id", "target": "unikit", "targetType": "skill", "point": "bootstrap",
                    "file": "./injections/$id.md", "references": ["./references/notes.md"] } ] }
EOF
}

ext_add() {   # <project> <ext dir> <log>
  (cd "$1" && node "$ROOT_DIR/dist/cli/index.js" extension add "$2" > "$3" 2>&1)
}

count_lines() {   # <pattern> <file>  — fixed-string count of matching lines
  { grep -cF -- "$1" "$2" || true; }
}

ANCHOR_LINE='<!-- unikit:extension-point:bootstrap -->'

# 41a — lifecycle on Claude: add → update → extension update → remove
P41A="$TMPDIR/points-a"
make_points_project "$P41A" claude .claude/skills .claude/agents
SKILL41A="$P41A/.claude/skills/unikit/SKILL.md"
EXT41A="$TMPDIR/unikit-ext-points-a"
make_points_extension "$EXT41A" unikit-ext-points-a 1.0.0 spec-line
SHA_41A_BEFORE=$(sha_of "$SKILL41A")

ext_add "$P41A" "$EXT41A" "$TMPDIR/p41a-add.log"
assert_contains "$TMPDIR/p41a-add.log" 'Injections: 1 of 1 applied' "41a: the report says one applied"
assert_contains "$TMPDIR/p41a-add.log" '1 reference file' "41a: the report counts the reference file"

if [[ "$(count_lines "$ANCHOR_LINE" "$SKILL41A")" != "1" ]]; then
  echo "Assertion failed: 41a: the anchor must stay in the file exactly once"; exit 1
fi
ANCHOR_AT=$(grep -nF -- "$ANCHOR_LINE" "$SKILL41A" | head -1 | cut -d: -f1)
NEXT_LINE=$(sed -n "$((ANCHOR_AT + 1))p" "$SKILL41A")
if [[ "$NEXT_LINE" != '<!-- unikit-ext:unikit-ext-points-a:unikit:bootstrap:spec-line:start -->' ]]; then
  echo "Assertion failed: 41a: the block must start on the line right under the anchor"
  echo "Line under the anchor: $NEXT_LINE"; exit 1
fi
assert_contains "$SKILL41A" '\.claude/skills/unikit/references/ext/unikit-ext-points-a/notes\.md' "41a: the placeholder is the delivered path"
assert_contains "$SKILL41A" '/unikit-plan' "41a: Claude keeps /unikit-plan"
assert_not_contains "$SKILL41A" '\{\{ext_reference' "41a: no placeholder is left"
REF41A="$P41A/.claude/skills/unikit/references/ext/unikit-ext-points-a/notes.md"
assert_exists "$REF41A" "41a: the reference file is delivered"
assert_contains "$REF41A" 'Skills dir: \.claude/skills; owner: unikit' "41a: the reference is rendered"
assert_not_contains "$REF41A" '\{\{' "41a: no variable is left in the reference"

(cd "$P41A" && node "$ROOT_DIR/dist/cli/index.js" update > "$TMPDIR/p41a-update.log" 2>&1)
assert_not_contains "$TMPDIR/p41a-update.log" 'Local modifications detected' "41a: update right after add reports no drift"
if [[ "$(count_lines 'unikit-ext:unikit-ext-points-a:unikit:bootstrap:spec-line:start' "$SKILL41A")" != "1" ]]; then
  echo "Assertion failed: 41a: exactly one block after update"; cat "$TMPDIR/p41a-update.log"; exit 1
fi
assert_exists "$REF41A" "41a: the reference survives update"

SHA_41A_WITH=$(sha_of "$SKILL41A")
(cd "$P41A" && node "$ROOT_DIR/dist/cli/index.js" extension update > "$TMPDIR/p41a-extupdate.log" 2>&1)
assert_contains "$TMPDIR/p41a-extupdate.log" 'up to date' "41a: extension update finds nothing to do"
assert_same_sha "$SKILL41A" "$SHA_41A_WITH" "41a: extension update leaves the file as it is"

(cd "$P41A" && node "$ROOT_DIR/dist/cli/index.js" extension remove unikit-ext-points-a > "$TMPDIR/p41a-remove.log" 2>&1)
assert_same_sha "$SKILL41A" "$SHA_41A_BEFORE" "41a: removal gives the file back byte for byte"
assert_not_exists "$P41A/.claude/skills/unikit/references/ext" "41a: the reference directory is gone"

echo "  ✓ extension points: block under the anchor, reference delivered, update without drift, removal byte-exact"

# 41b — installation order does not change the result
P41B1="$TMPDIR/points-b1"
P41B2="$TMPDIR/points-b2"
EXT41B_A="$TMPDIR/unikit-ext-order-a"
EXT41B_B="$TMPDIR/unikit-ext-order-b"
make_points_extension "$EXT41B_A" unikit-ext-order-a 1.0.0 aaa "Line from extension A."
make_points_extension "$EXT41B_B" unikit-ext-order-b 1.0.0 bbb "Line from extension B."
make_points_project "$P41B1" claude .claude/skills .claude/agents
make_points_project "$P41B2" claude .claude/skills .claude/agents
ext_add "$P41B1" "$EXT41B_A" "$TMPDIR/p41b1-a.log"
ext_add "$P41B1" "$EXT41B_B" "$TMPDIR/p41b1-b.log"
ext_add "$P41B2" "$EXT41B_B" "$TMPDIR/p41b2-b.log"
ext_add "$P41B2" "$EXT41B_A" "$TMPDIR/p41b2-a.log"
SKILL41B1="$P41B1/.claude/skills/unikit/SKILL.md"
SKILL41B2="$P41B2/.claude/skills/unikit/SKILL.md"
assert_same_sha "$SKILL41B2" "$(sha_of "$SKILL41B1")" "41b: both installation orders give the same file"
LINE_A=$(grep -nF 'unikit-ext:unikit-ext-order-a:unikit:bootstrap:aaa:start' "$SKILL41B1" | head -1 | cut -d: -f1)
LINE_B=$(grep -nF 'unikit-ext:unikit-ext-order-b:unikit:bootstrap:bbb:start' "$SKILL41B1" | head -1 | cut -d: -f1)
if [[ -z "$LINE_A" || -z "$LINE_B" || "$LINE_A" -ge "$LINE_B" ]]; then
  echo "Assertion failed: 41b: the block of A must come before the block of B"
  echo "A at: $LINE_A, B at: $LINE_B"; exit 1
fi
assert_exists "$P41B1/.claude/skills/unikit/references/ext/unikit-ext-order-a" "41b: reference directory of A"
assert_exists "$P41B1/.claude/skills/unikit/references/ext/unikit-ext-order-b" "41b: reference directory of B"
(cd "$P41B1" && node "$ROOT_DIR/dist/cli/index.js" extension remove unikit-ext-order-a > "$TMPDIR/p41b1-rm.log" 2>&1)
assert_not_contains "$SKILL41B1" 'unikit-ext-order-a' "41b: the block of A is gone"
assert_contains "$SKILL41B1" 'Line from extension B\.' "41b: the block of B stays"
assert_not_exists "$P41B1/.claude/skills/unikit/references/ext/unikit-ext-order-a" "41b: the reference directory of A is gone"
assert_exists "$P41B1/.claude/skills/unikit/references/ext/unikit-ext-order-b" "41b: the reference directory of B stays"

echo "  ✓ extension points: two extensions in one point give one result in any installation order"

# 41c — Codex rewrites invocations in the block and in the reference
P41C="$TMPDIR/points-c"
EXT41C="$TMPDIR/unikit-ext-points-c"
make_points_project "$P41C" codex .codex/skills .codex/agents
make_points_extension "$EXT41C" unikit-ext-points-c 1.0.0 spec-line
ext_add "$P41C" "$EXT41C" "$TMPDIR/p41c-add.log"
SKILL41C="$P41C/.codex/skills/unikit/SKILL.md"
BLOCK41C=$(awk '/unikit-ext-points-c:unikit:bootstrap:spec-line:start -->/{f=1;next} /unikit-ext-points-c:unikit:bootstrap:spec-line:end -->/{f=0} f' "$SKILL41C")
if [[ "$BLOCK41C" != *'$unikit-plan'* || "$BLOCK41C" == *'/unikit-plan'* ]]; then
  echo "Assertion failed: 41c: Codex must see \$unikit-plan, not /unikit-plan, in the block"
  echo "Block: $BLOCK41C"; exit 1
fi
if [[ "$BLOCK41C" != *'.codex/skills/unikit/references/ext/'* ]]; then
  echo "Assertion failed: 41c: the path in the block must be the Codex skills directory"
  echo "Block: $BLOCK41C"; exit 1
fi
REF41C="$P41C/.codex/skills/unikit/references/ext/unikit-ext-points-c/notes.md"
assert_exists "$REF41C" "41c: the reference is delivered for Codex"
if ! grep -qF '$unikit-implement' "$REF41C" || grep -qF '/unikit-implement' "$REF41C"; then
  echo "Assertion failed: 41c: the reference must carry \$unikit-implement for Codex"
  cat "$REF41C"; exit 1
fi

echo "  ✓ extension points: Codex gets \$unikit-* in the block and in the reference"

# 41d — a version change inside `update`
P41D="$TMPDIR/points-d"
EXT41D="$TMPDIR/unikit-ext-points-d"
make_points_project "$P41D" claude .claude/skills .claude/agents
make_points_extension "$EXT41D" unikit-ext-points-d 1.0.0 spec-line "Old line from extension."
ext_add "$P41D" "$EXT41D" "$TMPDIR/p41d-add.log"
make_points_extension "$EXT41D" unikit-ext-points-d 1.1.0 spec-line "New line from extension."
(cd "$P41D" && node "$ROOT_DIR/dist/cli/index.js" update > "$TMPDIR/p41d-update.log" 2>&1)
SKILL41D="$P41D/.claude/skills/unikit/SKILL.md"
assert_contains "$TMPDIR/p41d-update.log" 'Extensions updated' "41d: update refreshed the extension"
assert_not_contains "$TMPDIR/p41d-update.log" 'Local modifications detected' "41d: a version change is no drift"
assert_contains "$SKILL41D" 'New line from extension' "41d: the new text is in place"
assert_not_contains "$SKILL41D" 'Old line from extension' "41d: the old text is gone"
if [[ "$(count_lines 'unikit-ext:unikit-ext-points-d:unikit:bootstrap:spec-line:start' "$SKILL41D")" != "1" ]]; then
  echo "Assertion failed: 41d: exactly one block after the version change"; exit 1
fi

echo "  ✓ extension points: a new version inside update replaces the block without drift"

# 41e — invalid manifests are refused before anything is written
P41E="$TMPDIR/points-e"
make_points_project "$P41E" claude .claude/skills .claude/agents
run_bad_manifest() {   # <label> <regex> <injection json>
  local label="$1" regex="$2" injection="$3"
  local dir="$TMPDIR/unikit-ext-bad-$label" log="$TMPDIR/p41e-$label.log" code=0
  mkdir -p "$dir/injections"
  printf 'x\n' > "$dir/injections/x.md"
  printf '{ "name": "unikit-ext-bad-%s", "version": "1.0.0", "injections": [ %s ] }\n' "$label" "$injection" > "$dir/extension.json"
  ext_add "$P41E" "$dir" "$log" || code=$?
  if [[ "$code" -eq 0 ]]; then
    echo "Assertion failed: 41e: $label must be refused (exit code was 0)"; cat "$log"; exit 1
  fi
  assert_contains "$log" "$regex" "41e: $label gives the expected message"
  assert_not_exists "$P41E/.unikit/extensions/unikit-ext-bad-$label" "41e: $label leaves nothing in the extensions directory"
}
run_bad_manifest both 'exactly one' '{ "id": "x", "target": "unikit", "position": "append", "point": "bootstrap", "file": "./injections/x.md" }'
run_bad_manifest noid 'id is required' '{ "target": "unikit", "point": "bootstrap", "file": "./injections/x.md" }'
run_bad_manifest escape 'relative path inside the extension directory' '{ "id": "x", "target": "unikit", "point": "bootstrap", "file": "../x.md" }'
run_bad_manifest missingref 'missing file' '{ "id": "x", "target": "unikit", "point": "bootstrap", "file": "./injections/x.md", "references": ["./references/none.md"] }'

echo "  ✓ extension points: both forms at once, no id, an escaping path and a missing reference are refused"

# 41f — a skipped entry is explained, not silent
P41F="$TMPDIR/points-f"
EXT41F="$TMPDIR/unikit-ext-points-f"
make_points_project "$P41F" claude .claude/skills .claude/agents
mkdir -p "$EXT41F/injections"
printf 'text\n' > "$EXT41F/injections/t.md"
cat > "$EXT41F/extension.json" << 'EOF'
{ "name": "unikit-ext-points-f", "version": "1.0.0",
  "injections": [
    { "id": "help-line", "target": "unikit-help", "point": "bootstrap", "file": "./injections/t.md" },
    { "id": "wrong-point", "target": "unikit", "point": "before-tasks", "file": "./injections/t.md" },
    { "id": "plan-line", "target": "unikit-plan", "point": "bootstrap", "file": "./injections/t.md" }
  ] }
EOF
ext_add "$P41F" "$EXT41F" "$TMPDIR/p41f-add.log"
assert_contains "$TMPDIR/p41f-add.log" 'Injections: 0 of 3 applied' "41f: nothing applied"
assert_contains "$TMPDIR/p41f-add.log" 'offers no such point' "41f: an unknown point is explained"
assert_contains "$TMPDIR/p41f-add.log" 'not installed for this agent' "41f: a skill that is not installed is explained"
assert_contains "$P41F/.unikit.json" 'unikit-ext-points-f' "41f: the extension is still recorded"
assert_not_exists "$P41F/.claude/skills/unikit/references/ext" "41f: no reference directory appears"

echo "  ✓ extension points: skipped entries are reported with a reason and the install still succeeds"

# 41g — a missing anchor is repaired by update
P41G="$TMPDIR/points-g"
EXT41G="$TMPDIR/unikit-ext-points-g"
make_points_project "$P41G" claude .claude/skills .claude/agents
SKILL41G="$P41G/.claude/skills/unikit/SKILL.md"
grep -v 'unikit:extension-point:bootstrap' "$SKILL41G" > "$SKILL41G.tmp" && mv "$SKILL41G.tmp" "$SKILL41G"
make_points_extension "$EXT41G" unikit-ext-points-g 1.0.0 spec-line
ext_add "$P41G" "$EXT41G" "$TMPDIR/p41g-add.log"
assert_contains "$TMPDIR/p41g-add.log" 'run "unikit-ai update"' "41g: the hint names the repair"
assert_contains "$TMPDIR/p41g-add.log" 'Injections: 0 of 1 applied' "41g: nothing applied without the anchor"
(cd "$P41G" && node "$ROOT_DIR/dist/cli/index.js" update > "$TMPDIR/p41g-update.log" 2>&1)
assert_contains "$TMPDIR/p41g-update.log" 'Local modifications detected' "41g: removing the anchor by hand is a real local edit"
assert_contains "$SKILL41G" 'unikit-ext:unikit-ext-points-g:unikit:bootstrap:spec-line:start' "41g: the block lands once the anchor is back"
ANCHOR_AT_G=$(grep -nF -- "$ANCHOR_LINE" "$SKILL41G" | head -1 | cut -d: -f1)
if [[ -z "$ANCHOR_AT_G" ]]; then
  echo "Assertion failed: 41g: update must restore the anchor"; exit 1
fi

echo "  ✓ extension points: a missing anchor is explained and repaired by update"

# 41h — an original append entry and a point entry together
P41H="$TMPDIR/points-h"
EXT41H="$TMPDIR/unikit-ext-points-h"
make_points_project "$P41H" claude .claude/skills .claude/agents
SKILL41H="$P41H/.claude/skills/unikit/SKILL.md"
mkdir -p "$EXT41H/injections" "$EXT41H/references"
printf 'Tail line from extension.\n' > "$EXT41H/injections/tail.md"
printf 'Boot line, see {{ext_reference:notes.md}}.\n' > "$EXT41H/injections/boot-line.md"
printf 'Notes.\n' > "$EXT41H/references/notes.md"
cat > "$EXT41H/extension.json" << 'EOF'
{ "name": "unikit-ext-points-h", "version": "1.0.0",
  "injections": [
    { "target": "unikit", "targetType": "skill", "position": "append", "file": "./injections/tail.md" },
    { "id": "boot-line", "target": "unikit", "targetType": "skill", "point": "bootstrap",
      "file": "./injections/boot-line.md", "references": ["./references/notes.md"] }
  ] }
EOF
SHA_41H_BEFORE=$(sha_of "$SKILL41H")
ext_add "$P41H" "$EXT41H" "$TMPDIR/p41h-add.log"
assert_contains "$SKILL41H" 'unikit-ext:unikit-ext-points-h:unikit:append:start' "41h: the append block is present"
assert_contains "$SKILL41H" 'unikit-ext:unikit-ext-points-h:unikit:bootstrap:boot-line:start' "41h: the point block is present"
(cd "$P41H" && node "$ROOT_DIR/dist/cli/index.js" update > "$TMPDIR/p41h-update.log" 2>&1)
assert_not_contains "$TMPDIR/p41h-update.log" 'Local modifications detected' "41h: update reports no drift"
(cd "$P41H" && node "$ROOT_DIR/dist/cli/index.js" extension remove unikit-ext-points-h > "$TMPDIR/p41h-remove.log" 2>&1)
assert_same_sha "$SKILL41H" "$SHA_41H_BEFORE" "41h: removing both forms gives the file back byte for byte"

echo "  ✓ extension points: append and point entries coexist and both come out byte-exact"

# ─────────────────────────────────────────────────────
# Test 42: system-file path variables in the text of an extension
# ─────────────────────────────────────────────────────
# The order that asked for {{user_questions_contract}}: an extension names a framework file by a
# variable instead of writing `.unikit/system/…` out. The value does not depend on the agent, so the
# same text must come out the same in an injection block, in a reference file of an extension point,
# in a skill an extension adds and in a subagent it adds — and the rewrite Codex applies to
# `/unikit-…` invocations must not touch it.

SV42_QUESTIONS='.unikit/system/user-questions.md'
SV42_PRINCIPLES='.unikit/system/gamedesign/gd-principles.md'
SV42_SYSTEM_DIR='.unikit/system'

# The paths as regular expressions: assert_contains takes `grep -E`, where a bare `.` matches anything.
re_escape() { printf '%s' "$1" | sed 's/[.[\*^$]/\\&/g'; }
SV42_QUESTIONS_RE=$(re_escape "$SV42_QUESTIONS")
SV42_PRINCIPLES_RE=$(re_escape "$SV42_PRINCIPLES")

# The text between the markers of one point block: <skill file> <extension name> <injection id>.
block_of() {
  awk -v s="unikit-ext:$2:unikit:bootstrap:$3:start -->" -v e="unikit-ext:$2:unikit:bootstrap:$3:end -->" \
    'index($0, s) { f = 1; next } index($0, e) { f = 0 } f' "$1"
}

# 42a / 42b — the block and the reference of an extension point, lifecycle included
check_sysvar_point() {   # <label> <agent id> <skills dir> <subagents dir>
  local label="$1" agent="$2" skills="$3" agents="$4"
  local name="unikit-ext-sysvars-$agent"
  local project="$TMPDIR/sysvars-$agent" ext="$TMPDIR/$name"
  local body='Contract: {{user_questions_contract}}'
  local ref='{{user_questions_contract}} · {{gd_principles}} · {{system_dir}}'
  make_points_project "$project" "$agent" "$skills" "$agents"
  make_points_extension "$ext" "$name" 1.0.0 contract-line "$body" "$ref"
  local skill="$project/$skills/unikit/SKILL.md"
  local sha_before
  sha_before=$(sha_of "$skill")

  ext_add "$project" "$ext" "$TMPDIR/$label-add.log"
  local block
  block=$(block_of "$skill" "$name" contract-line)
  if [[ "$block" != *"Contract: $SV42_QUESTIONS"* || "$block" == *'{{'* ]]; then
    echo "Assertion failed: $label: the block must carry the path of the contract and no variable"
    echo "Block: $block"; exit 1
  fi
  local ref_file="$project/$skills/unikit/references/ext/$name/notes.md"
  assert_exists "$ref_file" "$label: the reference file is delivered"
  if ! grep -qxF "$SV42_QUESTIONS · $SV42_PRINCIPLES · $SV42_SYSTEM_DIR" "$ref_file"; then
    echo "Assertion failed: $label: the reference must hold the three paths on one line"
    cat "$ref_file"; exit 1
  fi
  assert_not_contains "$ref_file" '\{\{' "$label: no variable is left in the reference"

  (cd "$project" && node "$ROOT_DIR/dist/cli/index.js" update > "$TMPDIR/$label-update.log" 2>&1)
  assert_not_contains "$TMPDIR/$label-update.log" 'Local modifications detected' "$label: update right after add reports no drift"
  if [[ "$(block_of "$skill" "$name" contract-line)" != "$block" ]]; then
    echo "Assertion failed: $label: update must render the block the same way"; exit 1
  fi

  (cd "$project" && node "$ROOT_DIR/dist/cli/index.js" extension remove "$name" > "$TMPDIR/$label-remove.log" 2>&1)
  assert_same_sha "$skill" "$sha_before" "$label: removal gives the file back byte for byte"
  assert_not_exists "$project/$skills/unikit/references/ext" "$label: the reference directory is gone"
}

check_sysvar_point 42a claude .claude/skills .claude/agents
echo "  ✓ system variables: Claude gets the paths in the block and the reference, no drift, byte-exact removal"

check_sysvar_point 42b codex .codex/skills .codex/agents
echo "  ✓ system variables: Codex gets the same paths (its invocation rewrite leaves them alone)"

# 42c — a skill an extension adds: SKILL.md and its references/
P42C="$TMPDIR/sysvars-skill"
EXT42C="$TMPDIR/unikit-ext-sysvars-skill"
make_points_project "$P42C" claude .claude/skills .claude/agents
mkdir -p "$EXT42C/skills/sysvars-skill/references"
cat > "$EXT42C/extension.json" << 'EOF'
{ "name": "unikit-ext-sysvars-skill", "version": "1.0.0", "skills": ["skills/sysvars-skill"] }
EOF
cat > "$EXT42C/skills/sysvars-skill/SKILL.md" << 'EOF'
---
name: sysvars-skill
description: A skill from an extension that points at a system file
---

Read {{user_questions_contract}} before you ask the user.
EOF
printf 'Contracts: {{user_questions_contract}} and {{gd_principles}}.\n' > "$EXT42C/skills/sysvars-skill/references/notes.md"
ext_add "$P42C" "$EXT42C" "$TMPDIR/p42c-add.log"
SKILL42C="$P42C/.claude/skills/sysvars-skill/SKILL.md"
REF42C="$P42C/.claude/skills/sysvars-skill/references/notes.md"
assert_exists "$SKILL42C" "42c: the extension skill is installed"
assert_contains "$SKILL42C" "^Read ${SV42_QUESTIONS_RE} before you ask the user\.$" "42c: SKILL.md of the extension skill carries the path"
assert_exists "$REF42C" "42c: the reference of the extension skill is installed"
assert_contains "$REF42C" "^Contracts: ${SV42_QUESTIONS_RE} and ${SV42_PRINCIPLES_RE}\.$" "42c: the reference of the extension skill carries both paths"
assert_not_contains "$SKILL42C" '\{\{' "42c: no variable is left in SKILL.md"
assert_not_contains "$REF42C" '\{\{' "42c: no variable is left in the reference"

echo "  ✓ system variables: a skill an extension adds gets the paths in SKILL.md and in references/"

# 42d — a subagent an extension adds, on Claude and on Kimi (its adapter runs after the substitution)
EXT42D="$TMPDIR/unikit-ext-sysvars-agent"
mkdir -p "$EXT42D/subagents"
cat > "$EXT42D/extension.json" << 'EOF'
{ "name": "unikit-ext-sysvars-agent", "version": "1.0.0", "subagents": ["subagents/sysvars-agent.md"] }
EOF
cat > "$EXT42D/subagents/sysvars-agent.md" << 'EOF'
---
name: sysvars-agent
description: A subagent from an extension that points at a system file
tools:
  - Read
model: inherit
---

Read {{user_questions_contract}} before you ask the user.
EOF
P42D_CLAUDE="$TMPDIR/sysvars-agent-claude"
P42D_KIMI="$TMPDIR/sysvars-agent-kimi"
make_points_project "$P42D_CLAUDE" claude .claude/skills .claude/agents
make_points_project "$P42D_KIMI" kimi .kimi-code/skills .kimi-code/agents
ext_add "$P42D_CLAUDE" "$EXT42D" "$TMPDIR/p42d-claude-add.log"
ext_add "$P42D_KIMI" "$EXT42D" "$TMPDIR/p42d-kimi-add.log"
for AGENT42D in "$P42D_CLAUDE/.claude/agents/sysvars-agent.md" "$P42D_KIMI/.kimi-code/agents/sysvars-agent.md"; do
  assert_exists "$AGENT42D" "42d: the extension subagent is installed ($AGENT42D)"
  assert_contains "$AGENT42D" "^Read ${SV42_QUESTIONS_RE} before you ask the user\.$" "42d: the subagent file carries the path ($AGENT42D)"
  assert_not_contains "$AGENT42D" '\{\{' "42d: no variable is left in the subagent file ($AGENT42D)"
done

echo "  ✓ system variables: a subagent an extension adds gets the path, on Claude and on Kimi"

# 42e — a name this build does not know: left as written in the installed text, and NOT a warning —
# a runtime slot of the extension's own templates looks the same, so the note (file and name, no content)
# is printed at INFO level, under --verbose only, on every pass over the extensions; never for a known variable
P42E="$TMPDIR/sysvars-unknown"
EXT42E="$TMPDIR/unikit-ext-sysvars-unknown"
make_points_project "$P42E" claude .claude/skills .claude/agents
mkdir -p "$EXT42E/injections" "$EXT42E/references" "$EXT42E/skills/unknown-skill/references" "$EXT42E/subagents"
printf 'Contract: {{user_questions_contract}} and {{no_such_variable}}.\n' > "$EXT42E/injections/unknown-line.md"
printf 'Notes: {{other_missing_name}}.\n' > "$EXT42E/references/notes.md"
cat > "$EXT42E/skills/unknown-skill/SKILL.md" << 'EOF'
---
name: unknown-skill
description: A skill from an extension that uses a name this build does not know
---

Skill body: {{skill_missing_name}}
EOF
printf 'Skill reference: {{skill_ref_missing_name}}\n' > "$EXT42E/skills/unknown-skill/references/notes.md"
cat > "$EXT42E/subagents/unknown-agent.md" << 'EOF'
---
name: unknown-agent
description: A subagent from an extension that uses a name this build does not know
tools:
  - Read
model: inherit
---

Agent body: {{agent_missing_name}}
EOF
write_42e_manifest() {   # <version> — a new version is what makes `extension update` run its pass
  cat > "$EXT42E/extension.json" << EOF
{ "name": "unikit-ext-sysvars-unknown", "version": "$1",
  "skills": ["skills/unknown-skill"], "subagents": ["subagents/unknown-agent.md"],
  "injections": [ { "id": "unknown-line", "target": "unikit", "targetType": "skill", "point": "bootstrap",
                    "file": "./injections/unknown-line.md", "references": ["./references/notes.md"] } ] }
EOF
}

# Under --verbose each unknown name is named in an [INFO] line together with the file that holds it and
# the reason; the known contract name is named in none. Never a [WARN] line (see assert_no_unknown_var_noise).
assert_unknown_var_notes() {   # <label> <log of a --verbose run>
  local label="$1" log="$2" pair file name
  for pair in "injections/unknown-line.md:no_such_variable" "references/notes.md:other_missing_name" \
              "skills/unknown-skill/SKILL.md:skill_missing_name" "skills/unknown-skill/references/notes.md:skill_ref_missing_name" \
              "subagents/unknown-agent.md:agent_missing_name"; do
    file="${pair%%:*}"; name="${pair##*:}"
    if ! { grep -F '[INFO]' "$log" || true; } | grep -F "$file uses" | grep -F "{{$name}}" | grep -qF 'not template variables of this build'; then
      echo "Assertion failed: $label: a verbose note must name $file and {{$name}}"
      cat "$log"; exit 1
    fi
  done
  if { grep -F '[INFO]' "$log" || true; } | grep -F 'not template variables of this build' | grep -qF '{{user_questions_contract}}'; then
    echo "Assertion failed: $label: a known variable must not be named in a note"
    cat "$log"; exit 1
  fi
  if { grep -F '[WARN]' "$log" || true; } | grep -qF 'not template variables of this build'; then
    echo "Assertion failed: $label: an unknown name must not be a warning"
    cat "$log"; exit 1
  fi
}

# Without --verbose the same pass prints nothing about unknown names — no warning, no note.
assert_no_unknown_var_noise() {   # <label> <log of a run without --verbose>
  assert_not_contains "$2" 'not template variables of this build' "$1: nothing is printed about unknown names without --verbose"
  assert_not_contains "$2" 'and [0-9]+ more file\(s\) with names this build does not substitute' "$1: no closing line either"
}

ext_add_verbose() {   # <project> <ext dir> <log> [extra flags…]
  local project="$1" ext="$2" log="$3"; shift 3
  (cd "$project" && node "$ROOT_DIR/dist/cli/index.js" --verbose extension add "$ext" "$@" > "$log" 2>&1)
}

write_42e_manifest 1.0.0
if ! ext_add_verbose "$P42E" "$EXT42E" "$TMPDIR/p42e-add.log"; then
  echo "Assertion failed: 42e: extension add must succeed although the text holds unknown names"
  cat "$TMPDIR/p42e-add.log"; exit 1
fi
assert_unknown_var_notes "42e (extension add --verbose)" "$TMPDIR/p42e-add.log"

SKILL42E="$P42E/.claude/skills/unikit/SKILL.md"
BLOCK42E=$(block_of "$SKILL42E" unikit-ext-sysvars-unknown unknown-line)
if [[ "$BLOCK42E" != *"Contract: $SV42_QUESTIONS and {{no_such_variable}}."* ]]; then
  echo "Assertion failed: 42e: the known name must be replaced and the unknown one left as written"
  echo "Block: $BLOCK42E"; exit 1
fi
assert_contains "$P42E/.claude/skills/unknown-skill/SKILL.md" '\{\{skill_missing_name\}\}' "42e: the unknown name stays in the installed skill"
assert_contains "$P42E/.claude/agents/unknown-agent.md" '\{\{agent_missing_name\}\}' "42e: the unknown name stays in the installed subagent"

# The same pass without --verbose (the default) says nothing about unknown names. The positive control is
# the verbose run right after it on the same, unchanged project.
(cd "$P42E" && node "$ROOT_DIR/dist/cli/index.js" update > "$TMPDIR/p42e-update-quiet.log" 2>&1)
assert_no_unknown_var_noise "42e (plain update)" "$TMPDIR/p42e-update-quiet.log"
(cd "$P42E" && node "$ROOT_DIR/dist/cli/index.js" --verbose update > "$TMPDIR/p42e-update.log" 2>&1)
assert_unknown_var_notes "42e (plain update --verbose, extension unchanged)" "$TMPDIR/p42e-update.log"

write_42e_manifest 1.1.0
(cd "$P42E" && node "$ROOT_DIR/dist/cli/index.js" --verbose extension update > "$TMPDIR/p42e-extupdate.log" 2>&1)
assert_contains "$TMPDIR/p42e-extupdate.log" 'Updated: unikit-ext-sysvars-unknown' "42e: extension update took the new version, so its pass ran"
assert_unknown_var_notes "42e (extension update --verbose to a new version)" "$TMPDIR/p42e-extupdate.log"

# A quiet `extension add` of the same extension says nothing either.
P42E_QUIET="$TMPDIR/sysvars-unknown-quiet"
make_points_project "$P42E_QUIET" claude .claude/skills .claude/agents
ext_add "$P42E_QUIET" "$EXT42E" "$TMPDIR/p42e-quiet-add.log"
assert_no_unknown_var_noise "42e (extension add)" "$TMPDIR/p42e-quiet-add.log"
assert_contains "$P42E_QUIET/.claude/skills/unknown-skill/SKILL.md" '\{\{skill_missing_name\}\}' "42e: the quiet install still leaves the unknown name as written"

# Items the user switched off are not scanned: the skill and the subagent stay out of the notes
# while the enabled injection and its reference are still named (the lines above are the positive control).
P42E_SKIP="$TMPDIR/sysvars-unknown-skip"
make_points_project "$P42E_SKIP" claude .claude/skills .claude/agents
ext_add_verbose "$P42E_SKIP" "$EXT42E" "$TMPDIR/p42e-skip-add.log" --skip-skills unknown-skill --skip-subagents unknown-agent
assert_contains "$TMPDIR/p42e-skip-add.log" 'injections/unknown-line\.md uses \{\{no_such_variable\}\}' "42e: the enabled injection is still scanned"
assert_contains "$TMPDIR/p42e-skip-add.log" 'references/notes\.md uses \{\{other_missing_name\}\}' "42e: the enabled reference is still scanned"
assert_not_contains "$TMPDIR/p42e-skip-add.log" 'skills/unknown-skill/' "42e: a skill the user switched off is not scanned"
assert_not_contains "$TMPDIR/p42e-skip-add.log" 'subagents/unknown-agent' "42e: a subagent the user switched off is not scanned"
assert_not_exists "$P42E_SKIP/.claude/skills/unknown-skill" "42e: the switched-off skill is not installed either"

echo "  ✓ system variables: an unknown name stays as written; it is named in an INFO note (file and name) under --verbose only, never as a warning, and a known variable never is"

echo ""
echo "extension smoke tests passed"
