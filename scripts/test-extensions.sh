#!/bin/bash
# Smoke tests: validates extension system
# Tests: manifest validation, name validation, extension add/remove,
#        injection markers, extension skills/subagents installation
# Usage: ./scripts/test-extensions.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF

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
  "engineMcpKey": null,
  "mcp": { "servers": [] },
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
    "declined": []
  }
}
EOF

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
  "engineMcpKey": null,
  "mcp": { "servers": [] },
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
    "declined": []
  }
}
EOF

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
    version: '1.0.0', language: 'en', engine: 'unity', engineMcpKey: null,
    mcp: { servers: [] },
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
    "declined": []
  }
}
EOF

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
    "declined": []
  }
}
EOF

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
    "declined": []
  }
}
EOF

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
    "declined": []
  }
}
EOF

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
  "engineMcpKey": null,
  "mcp": { "servers": [] },
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
    "declined": []
  }
}
EOF

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
    "declined": []
  }
}
EOF

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
    "declined": []
  }
}
EOF

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
    "declined": []
  }
}
EOF

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
    "declined": []
  }
}
EOF

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
  "engineMcpKey": null,
  "mcp": { "servers": [] },
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
  "engineMcpKey": null,
  "mcp": { "servers": [] },
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
    "declined": []
  }
}
EOF

# Install base skills first
(cd "$PREPEND_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)

# Add prepend extension
(cd "$PREPEND_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$PREPEND_EXT" > /dev/null 2>&1)

# Verify injected content is present
assert_contains "$PREPEND_PROJECT/.claude/skills/unikit/SKILL.md" \
  "PREPENDED CONTENT FROM EXTENSION" \
  "prepend injection content must be present"

# Verify it's at the top (first non-empty line should be the injection marker)
FIRST_LINE=$(head -1 "$PREPEND_PROJECT/.claude/skills/unikit/SKILL.md")
if [[ "$FIRST_LINE" == *"unikit-ext:unikit-ext-prepend:unikit:prepend:start"* ]]; then
  :  # expected
else
  echo "Assertion failed: prepend injection must be at the top of the file"
  echo "First line: $FIRST_LINE"
  exit 1
fi

echo "  ✓ injection prepend: content injected at top of target file"

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
  "engineMcpKey": null,
  "mcp": { "servers": [] },
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
    "installed": { "version": "1.0.0", "core": [], "stack": [] },
    "declined": []
  }
}
EOF

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
    "declined": []
  }
}
EOF

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
  "engineMcpKey": "UnityMCP",
  "mcp": { "servers": ["unity-mcp-coplay"] },
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

# Install base skills + MCP injection
(cd "$MCP_INJECT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" update > /dev/null 2>&1)

# Verify base unikit-fix has MCP tools
assert_contains "$MCP_INJECT_PROJECT/.claude/skills/unikit-fix/SKILL.md" \
  "mcp__UnityMCP__read_console" \
  "base unikit-fix must have MCP tools before replacement"

# Add replace extension
(cd "$MCP_INJECT_PROJECT" && node "$ROOT_DIR/dist/cli/index.js" extension add "$MCP_INJECT_EXT" > /dev/null 2>&1)

# Replaced skill must have MCP tools injected
assert_contains "$MCP_INJECT_PROJECT/.claude/skills/unikit-fix/SKILL.md" \
  "mcp__UnityMCP__read_console" \
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
  "mcp__UnityMCP__read_console" \
  "restored base skill must have MCP tools after ext remove"

assert_not_contains "$MCP_INJECT_PROJECT/.claude/skills/unikit-fix/SKILL.md" \
  "Custom Fix.*from extension" \
  "restored base skill must not have extension content"

echo "  ✓ MCP injection: restored base skill has MCP tools after ext remove"

echo ""
echo "extension smoke tests passed"
