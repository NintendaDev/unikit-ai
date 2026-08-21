#!/bin/bash
# Smoke tests: the project migration chain and the MCP settings reconciliation.
# Usage: ./scripts/test-migrations.sh
#
# Two mechanisms land together in 1.2.0 and only make sense read together:
#
#   - the chain gained a VERSION anchor (`since`) ORed with `detect`, so a step
#     fires either because the project predates it or because the state it looks
#     for is on disk. The OR is what the version matrix below pins: each row is a
#     project whose `config.version` and disk state disagree in a different way.
#   - `configureMcp` gained rules — create-if-absent, bounded normalisation, the
#     `env` overlay, orphan removal on a code change — and a second caller
#     (`update`), where before it ran only from `init`.
#
# What is NOT here, deliberately:
#   - the interactive `init` wizard has no non-TTY driver, so the init-side wiring
#     is covered by the static grep guards in test-skills.sh Part 6 and by driving
#     the exported functions directly, exactly as test-install.sh Test 12 does.
#   - extension grant injection across the schema change is already exercised by
#     test-extensions.sh (its fixture carries a `key → code` map and asserts
#     `mcp__UnityMCP__*` survives); duplicating it here would test the fixture.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure the bundled rules snapshot exists (rules-registry/ is not tracked in
# git; it is cloned on demand by scripts/download-rules.sh).
if [ ! -f "$ROOT_DIR/rules-registry/manifest.json" ]; then
  bash "$SCRIPT_DIR/download-rules.sh"
fi

# shellcheck source=./test-fixtures.sh
source "$SCRIPT_DIR/test-fixtures.sh"

TMPDIR=$(mktemp -d)

# One scenario doctors a package MCP config in place (the code-change reinstall
# check). Restoring it belongs in the trap, not next to the test: `set -e` aborts
# on the first failed assertion, and a run that leaves a doctored config behind
# poisons every later run and the repository besides.
BIOME_JSON="$ROOT_DIR/mcp/unity/unity-biome-mcp.json"
BIOME_JSON_BACKUP=""
restore_package_state() {
    if [[ -n "$BIOME_JSON_BACKUP" && -f "$BIOME_JSON_BACKUP" ]]; then
        cp "$BIOME_JSON_BACKUP" "$BIOME_JSON"
    fi
    rm -rf "$TMPDIR"
}
trap restore_package_state EXIT INT TERM

ensure_build

CLI="$ROOT_DIR/dist/cli/index.js"

run_update() {
    local project="$1"
    local log="${2:-/dev/null}"
    (cd "$project" && node "$CLI" update > "$log" 2>&1)
}

# Run the project chain against a directory and print the applied step ids, in
# apply order, one per line. Drives the exported function rather than the CLI so
# a row of the matrix is a statement about the CHAIN and not about everything
# else `update` happens to do.
plan_chain() {
    local project="$1"
    local version="$2"   # a semver string, or the literal `null`
    (cd "$ROOT_DIR" && PROJECT="$project" VERSION="$version" node --input-type=module -e "
      const { runProjectMemoryMigrations } = await import('./dist/core/memory-migrations/index.js');
      const version = process.env.VERSION === 'null' ? null : process.env.VERSION;
      const result = await runProjectMemoryMigrations(process.env.PROJECT, version);
      process.stdout.write(result.applied.join(','));
    " 2>/dev/null)
}

# A pre-1.2.0 config: `mcp.servers` is still a bare array of file ids, and the
# engine server's vendor code lives in `engineMcpKey`.
write_legacy_config() {
    local project="$1"
    local version_line="$2"   # e.g. '"version": "1.0.0",' or empty
    cat > "$project/.unikit.json" << EOF
{
  $version_line
  "engine": "unity",
  "engineMcpKey": "UnityMCP",
  "mcp": { "servers": ["unity-mcp-biome", "context7"] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit-implement"],
      "installedSubagents": []
    }
  ],
  "rules": { "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } } }
}
EOF
}

# `key → code` map form, i.e. a config the MCP steps have already converted.
write_map_config() {
    local project="$1"
    local version="$2"
    local code="${3:-UnityMCP}"
    cat > "$project/.unikit.json" << EOF
{
  "version": "$version",
  "engine": "unity",
  "engineMcpKey": "$code",
  "mcp": { "servers": { "unity-biome-mcp": "$code" } },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": ["unikit-implement"],
      "installedSubagents": []
    }
  ],
  "rules": { "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } } }
}
EOF
}

# The pre-modular memory layout: `.unikit/memory/{core,stack}` at the flat root.
seed_flat_memory() {
    local project="$1"
    mkdir -p "$project/.unikit/memory/core" "$project/.unikit/memory/stack"
    echo "# flat core rule" > "$project/.unikit/memory/core/legacy-rule.md"
}

# The modular layout the 1.1.0 steps produce.
seed_modular_memory() {
    local project="$1"
    mkdir -p "$project/.unikit/memory/code/core" "$project/.unikit/memory/code/stack"
    mkdir -p "$project/.unikit/code"
    echo "# modular core rule" > "$project/.unikit/memory/code/core/legacy-rule.md"
}

echo -e "\n${BOLD}=== Migration chain + MCP reconciliation smoke ===${NC}\n"

# ─────────────────────────────────────────────────────
# Section 1: version matrix
# ─────────────────────────────────────────────────────
# Each row disagrees between `config.version` and disk state in a different way.
# The OR is the whole point: neither half alone answers all five.

echo -e "${BOLD}Section 1: version matrix${NC}"

# Row 1 — 1.0.0, flat memory + array. Every group of steps, in `since` order.
# The plan merge is carried by the version half and applies as a no-op (this
# project has no plan folders) — which is the contract every step owes since
# the runner started ORing the halves, and the reason the row lists it.
M1="$TMPDIR/matrix-1.0.0"; mkdir -p "$M1"
write_legacy_config "$M1" '"version": "1.0.0",'
seed_flat_memory "$M1"
M1_APPLIED=$(plan_chain "$M1" "1.0.0")
if [[ "$M1_APPLIED" == "memory-1-to-2-code-wrap,workspace-1-to-2-code-relocate,mcp-servers-map,mcp-fileid-rename,plan-1-to-2-manifest-merge" ]]; then
    pass "matrix 1.0.0: every step group applied, ordered by since ($M1_APPLIED)"
else
    fail "matrix 1.0.0: expected all five steps in since order, got '$M1_APPLIED'"
fi

# Row 2 — 1.1.0, modular memory + array. The 1.1.0 steps are quiet; every 1.2.0
# step — the two MCP ones and the plan merge — is above the stamp.
M2="$TMPDIR/matrix-1.1.0"; mkdir -p "$M2"
write_legacy_config "$M2" '"version": "1.1.0",'
seed_modular_memory "$M2"
M2_APPLIED=$(plan_chain "$M2" "1.1.0")
if [[ "$M2_APPLIED" == "mcp-servers-map,mcp-fileid-rename,plan-1-to-2-manifest-merge" ]]; then
    pass "matrix 1.1.0: only the steps anchored above the stamp applied ($M2_APPLIED)"
else
    fail "matrix 1.1.0: expected the MCP steps + the plan merge, got '$M2_APPLIED'"
fi

# Row 3 — 1.2.0, modular memory + array. The version half is quiet for the whole
# 1.2.0 group (the project is stamped with the very version they are anchored
# at), so this row is carried by `detect` alone. It is the regression that
# matters most: every dev project running `npm link` before publication is
# stamped this way. The plan merge is absent here on purpose — its `detect`
# finds no plan folder on this project, and with the version half quiet that is
# the whole signal.
M3="$TMPDIR/matrix-1.2.0"; mkdir -p "$M3"
write_legacy_config "$M3" '"version": "1.2.0",'
seed_modular_memory "$M3"
M3_APPLIED=$(plan_chain "$M3" "1.2.0")
if [[ "$M3_APPLIED" == "mcp-servers-map,mcp-fileid-rename" ]]; then
    pass "matrix 1.2.0: detect carries the MCP steps when the version half is quiet ($M3_APPLIED)"
else
    fail "matrix 1.2.0: expected the MCP steps via detect, got '$M3_APPLIED'"
fi

# Row 4 — no `version` field at all. `readConfigVersion` answers null, the version
# half is off entirely, and `detect` still has to fire. This is the oldest config
# shape in existence and the one `loadConfig` would misreport as freshly stamped.
M4="$TMPDIR/matrix-no-version"; mkdir -p "$M4"
write_legacy_config "$M4" ''
seed_modular_memory "$M4"
M4_APPLIED=$(plan_chain "$M4" "null")
if [[ "$M4_APPLIED" == "mcp-servers-map,mcp-fileid-rename" ]]; then
    pass "matrix no-version: detect fires with the version half disabled ($M4_APPLIED)"
else
    fail "matrix no-version: expected the MCP steps via detect, got '$M4_APPLIED'"
fi

# Row 5 — a fresh project: no config, no `.unikit/`. The chain must be a no-op,
# not a set of steps that "helpfully" create the shapes they migrate.
M5="$TMPDIR/matrix-fresh"; mkdir -p "$M5"
M5_APPLIED=$(plan_chain "$M5" "null")
if [[ -z "$M5_APPLIED" ]]; then
    pass "matrix fresh: chain is a no-op on a project with nothing on disk"
else
    fail "matrix fresh: expected no applied steps, got '$M5_APPLIED'"
fi

# ─────────────────────────────────────────────────────
# Section 2: apply is safe when the version half fires alone
# ─────────────────────────────────────────────────────
# The contract the OR broke. Before it, `apply` ran only behind a true `detect`,
# so a step always saw state it knew how to read. Now a 1.1.0 project whose
# `update` died between the chain and `saveConfig` reports versionPending=true
# with detect=false — and an unguarded `mcp-servers-map` would rebuild the map
# from an object, producing an EMPTY selection: the whole MCP choice, erased.
#
# The state is reproduced the way it actually arises — run the chain, do not
# write the version stamp — rather than by hand-writing a config.

echo -e "\n${BOLD}Section 2: apply at versionPending with nothing left to do${NC}"

INTERRUPT="$TMPDIR/interrupted-chain"; mkdir -p "$INTERRUPT"
write_legacy_config "$INTERRUPT" '"version": "1.1.0",'
seed_modular_memory "$INTERRUPT"
plan_chain "$INTERRUPT" "1.1.0" > /dev/null        # first pass converts; version stamp never written
INTERRUPT_AFTER_FIRST=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(JSON.stringify(c.mcp.servers));
" "$INTERRUPT/.unikit.json")
plan_chain "$INTERRUPT" "1.1.0" > /dev/null        # second pass: version still pending, detect quiet
INTERRUPT_AFTER_SECOND=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(JSON.stringify(c.mcp.servers));
" "$INTERRUPT/.unikit.json")

if [[ "$INTERRUPT_AFTER_FIRST" == "$INTERRUPT_AFTER_SECOND" && "$INTERRUPT_AFTER_SECOND" != "{}" ]]; then
    pass "interrupted chain: a second pass at versionPending leaves the map intact ($INTERRUPT_AFTER_SECOND)"
else
    fail "interrupted chain: map changed across a no-work pass ('$INTERRUPT_AFTER_FIRST' -> '$INTERRUPT_AFTER_SECOND')"
fi

# ─────────────────────────────────────────────────────
# Section 3: the fileId rename and its four surfaces
# ─────────────────────────────────────────────────────
# The rename touches four places that each store a file id, and two of them fail
# only in production: the delivery stamp `update` reads the previous server out
# of, and the `server:` header inside the findings log that four pipeline skills
# compare against it on Bootstrap.

echo -e "\n${BOLD}Section 3: fileId rename surfaces${NC}"

RENAME="$TMPDIR/fileid-rename"; mkdir -p "$RENAME/.unikit/system/engine-mcp"
write_legacy_config "$RENAME" '"version": "1.1.0",'
seed_modular_memory "$RENAME"

# The active findings log, its plain archive, and an INDEXED archive (allocated
# when an earlier run was interrupted mid-swap — the index distinguishes two real
# sessions' findings and is not ours to renumber).
cat > "$RENAME/.unikit/MCP-RECHECK-NOTES.md" << 'EOF'
# MCP findings

server:  unity-mcp-biome
version: 1.37.2

## Findings
EOF
printf 'server:  unity-mcp-coplay\n' > "$RENAME/.unikit/MCP-RECHECK-NOTES.archive.unity-mcp-coplay.md"
printf 'server:  unity-mcp-coplay\n' > "$RENAME/.unikit/MCP-RECHECK-NOTES.archive.unity-mcp-coplay.1.md"
# A neighbouring file whose name merely STARTS with a renamed id must not move.
printf 'server:  unrelated\n' > "$RENAME/.unikit/MCP-RECHECK-NOTES.archive.unity-mcp-coplay-notes.md"
# The delivery stamp of the installed rules tree.
printf 'server: unity-mcp-biome\nversion: 1.37.2\ndelivered: 2026-08-01\n\n# Tree\n' \
  > "$RENAME/.unikit/system/engine-mcp/INDEX.md"

RENAME_NOTES_SHA_BEFORE=$(sha_of "$RENAME/.unikit/MCP-RECHECK-NOTES.md")
plan_chain "$RENAME" "1.1.0" > /dev/null

RENAME_KEYS=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(Object.keys(c.mcp.servers).sort().join(','));
" "$RENAME/.unikit.json")
if [[ "$RENAME_KEYS" == "context7,unity-biome-mcp" ]]; then
    pass "rename: config keys carry the new file ids ($RENAME_KEYS)"
else
    fail "rename: expected 'context7,unity-biome-mcp' in the config map, got '$RENAME_KEYS'"
fi

RENAME_ENGINE_CODE=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(c.mcp.servers['unity-biome-mcp']);
" "$RENAME/.unikit.json")
if [[ "$RENAME_ENGINE_CODE" == "UnityMCP" ]]; then
    pass "rename: the engine server keeps the code it was REGISTERED under (UnityMCP)"
else
    fail "rename: expected the preserved old code 'UnityMCP', got '$RENAME_ENGINE_CODE'"
fi

assert_exists "$RENAME/.unikit/MCP-RECHECK-NOTES.archive.coplay-unity-mcp.md" \
  "rename: the plain archive follows its server"
assert_exists "$RENAME/.unikit/MCP-RECHECK-NOTES.archive.coplay-unity-mcp.1.md" \
  "rename: the INDEXED archive keeps its index"
assert_exists "$RENAME/.unikit/MCP-RECHECK-NOTES.archive.unity-mcp-coplay-notes.md" \
  "rename: a name that merely starts with a renamed id is left alone"
assert_not_exists "$RENAME/.unikit/MCP-RECHECK-NOTES.archive.unity-mcp-coplay.md" \
  "rename: the old archive name is gone (moved, not copied)"

assert_contains "$RENAME/.unikit/MCP-RECHECK-NOTES.md" '^server:  unity-biome-mcp$' \
  "rename: the notes HEADER is rewritten (the Bootstrap comparison, not just the file name)"
assert_contains "$RENAME/.unikit/system/engine-mcp/INDEX.md" '^server: unity-biome-mcp$' \
  "rename: the delivery STAMP is rewritten"

# A rename must NOT look like a server switch. `update` reads the previous server
# out of the stamp; leave the old id there and `swapMcpRecheckNotes` parks the
# ACTIVE log as an archive of a server that no longer exists.
assert_exists "$RENAME/.unikit/MCP-RECHECK-NOTES.md" \
  "rename: the active findings log stays active (a rename is not a swap)"
assert_not_exists "$RENAME/.unikit/MCP-RECHECK-NOTES.archive.unity-biome-mcp.md" \
  "rename: no archive is created for the server that is still selected"

RENAME_NOTES_SHA_AFTER=$(sha_of "$RENAME/.unikit/MCP-RECHECK-NOTES.md")
if [[ "$RENAME_NOTES_SHA_BEFORE" != "$RENAME_NOTES_SHA_AFTER" ]]; then
    pass "rename: the findings log was rewritten in place (header changed, file did not move)"
else
    fail "rename: the findings log is byte-identical — the server: header was not rewritten"
fi

# ─────────────────────────────────────────────────────
# Section 4: settings-file write rules
# ─────────────────────────────────────────────────────
# Driven through the exported reconciliation rather than the wizard: `init` is
# interactive and has no non-TTY driver (same approach as test-install.sh Test 12).

echo -e "\n${BOLD}Section 4: settings-file write rules${NC}"

reconcile() {
    local project="$1"; local selection="$2"; local agent="$3"; local stored="${4:-{\}}"
    (cd "$ROOT_DIR" && PROJECT="$project" SELECTION="$selection" AGENT="$agent" STORED="$stored" \
      node --input-type=module -e "
      const { discoverMcpServers } = await import('./dist/core/mcp.js');
      const { reconcileMcpSettings } = await import('./dist/core/mcp-reconcile.js');
      const servers = await discoverMcpServers('unity');
      const selection = JSON.parse(process.env.SELECTION);
      await reconcileMcpSettings(
        process.env.PROJECT, servers, selection, [process.env.AGENT],
        null, JSON.parse(process.env.STORED),
      );
    " > /dev/null 2>&1)
}

# 4a — an entry we did not write is not overwritten, but our `env` is overlaid.
KEEP="$TMPDIR/keep-existing"; mkdir -p "$KEEP"
cat > "$KEEP/.mcp.json" << 'EOF'
{
  "mcpServers": {
    "unity-biome-mcp": {
      "command": "my-own-launcher",
      "args": ["--from", "/local/checkout", "unity-biome-mcp"]
    }
  }
}
EOF
reconcile "$KEEP" '["unity-biome-mcp"]' claude
KEEP_RESULT=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const e = c.mcpServers['unity-biome-mcp'];
  const checks = {
    commandKept: e.command === 'my-own-launcher',
    argsKept: JSON.stringify(e.args) === JSON.stringify(['--from', '/local/checkout', 'unity-biome-mcp']),
    envOverlaid: e.env && e.env.UNITY_MCP_NO_GATING === '1',
    oneEntry: Object.keys(c.mcpServers).length === 1,
  };
  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  console.log(failed.length === 0 ? 'ok' : 'fail:' + failed.join(','));
" "$KEEP/.mcp.json")
if [[ "$KEEP_RESULT" == "ok" ]]; then
    pass "existing entry: command/args untouched, env overlaid, no duplicate written"
else
    fail "existing entry: $KEEP_RESULT"
fi

# 4b — a key differing only in case is OUR entry under a spelling grants cannot
# reach, so it is normalised: removed and rewritten. A key an extension
# registered is left alone even when it looks exactly like ours.
NORM="$TMPDIR/normalize"; mkdir -p "$NORM"
cat > "$NORM/.mcp.json" << 'EOF'
{
  "mcpServers": {
    "Unity-Biome-MCP": { "command": "uvx", "args": ["placeholder"] },
    "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp@latest"] }
  }
}
EOF
reconcile "$NORM" '["unity-biome-mcp"]' claude
NORM_KEYS=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(Object.keys(c.mcpServers).sort().join(','));
" "$NORM/.mcp.json")
if [[ "$NORM_KEYS" == "context7,unity-biome-mcp" ]]; then
    pass "normalisation: a case variant collapses into exactly one key in our spelling"
else
    fail "normalisation: expected 'context7,unity-biome-mcp', got '$NORM_KEYS'"
fi

# The reserved-key half. `reconcileMcpSettings` collects extension keys from the
# manifests on disk, so an extension is installed the way the real thing is.
RESERVED="$TMPDIR/reserved-key"; mkdir -p "$RESERVED/.unikit/extensions/my-ext"
cat > "$RESERVED/.unikit/extensions/my-ext/extension.json" << 'EOF'
{
  "name": "my-ext",
  "version": "1.0.0",
  "mcpServers": [{ "key": "Unity-Biome-MCP", "template": "server.json" }]
}
EOF
cat > "$RESERVED/.unikit.json" << 'EOF'
{
  "version": "1.2.0",
  "engine": "unity",
  "engineMcpKey": "unity-biome-mcp",
  "mcp": { "servers": { "unity-biome-mcp": "unity-biome-mcp" } },
  "agents": [],
  "rules": { "installed": { "version": "1.2.0", "modules": { "code": { "core": [], "stack": [] } } } },
  "extensions": [{ "name": "my-ext", "source": "local", "version": "1.0.0" }]
}
EOF
cat > "$RESERVED/.mcp.json" << 'EOF'
{
  "mcpServers": {
    "Unity-Biome-MCP": { "command": "extension-owned", "args": [] }
  }
}
EOF
(cd "$ROOT_DIR" && PROJECT="$RESERVED" node --input-type=module -e "
  const fs = await import('node:fs');
  const { discoverMcpServers } = await import('./dist/core/mcp.js');
  const { reconcileMcpSettings } = await import('./dist/core/mcp-reconcile.js');
  const { loadConfig } = await import('./dist/core/config.js');
  const servers = await discoverMcpServers('unity');
  const config = await loadConfig(process.env.PROJECT);
  await reconcileMcpSettings(process.env.PROJECT, servers, ['unity-biome-mcp'], ['claude'], config, {});
  void fs;
" > /dev/null 2>&1)
RESERVED_RESULT=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  const checks = {
    extensionKeyIntact: c.mcpServers['Unity-Biome-MCP']
      && c.mcpServers['Unity-Biome-MCP'].command === 'extension-owned',
    ourKeyWritten: !!c.mcpServers['unity-biome-mcp'],
  };
  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  console.log(failed.length === 0 ? 'ok' : 'fail:' + failed.join(','));
" "$RESERVED/.mcp.json")
if [[ "$RESERVED_RESULT" == "ok" ]]; then
    pass "reserved keys: an extension's key survives an identical-looking normalisation candidate"
else
    fail "reserved keys: $RESERVED_RESULT"
fi

# 4c — the swap. Bound to a JSON-writer agent on purpose: see 4d.
SWAP="$TMPDIR/swap-json"; mkdir -p "$SWAP"
reconcile "$SWAP" '["unity-biome-mcp"]' claude
reconcile "$SWAP" '["coplay-unity-mcp"]' claude '{"coplay-unity-mcp":"unity-biome-mcp"}'
SWAP_KEYS=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(Object.keys(c.mcpServers).sort().join(','));
" "$SWAP/.mcp.json")
if [[ "$SWAP_KEYS" == "UnityMCP" ]]; then
    pass "swap: the orphan entry is removed and the server rewritten under the new code"
else
    fail "swap: expected only 'UnityMCP' to remain, got '$SWAP_KEYS'"
fi

# ...and symmetrically back.
reconcile "$SWAP" '["unity-biome-mcp"]' claude '{"unity-biome-mcp":"UnityMCP"}'
SWAP_BACK_KEYS=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(Object.keys(c.mcpServers).sort().join(','));
" "$SWAP/.mcp.json")
if [[ "$SWAP_BACK_KEYS" == "unity-biome-mcp" ]]; then
    pass "swap back: symmetric — the previous code's entry is removed in turn"
else
    fail "swap back: expected only 'unity-biome-mcp' to remain, got '$SWAP_BACK_KEYS'"
fi

# 4d — the SAME swap on OpenCode, which used to be only half of one. While the
# writer refused anything whose `command` was not a string, the swap to HTTP
# coplay removed the old entry and wrote nothing in its place, and the pinned
# expectation existed so that refusal was never misread as a swap defect. The
# writer now translates an HTTP source into OpenCode's own remote shape, so both
# halves happen here exactly as they do on claude — and the entry that lands is
# asserted to be remote, not merely present, because the shape is the half the
# key list cannot see.
SWAP_OC="$TMPDIR/swap-opencode"; mkdir -p "$SWAP_OC"
reconcile "$SWAP_OC" '["unity-biome-mcp"]' opencode
reconcile "$SWAP_OC" '["coplay-unity-mcp"]' opencode '{"coplay-unity-mcp":"unity-biome-mcp"}'
SWAP_OC_KEYS=$(node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  console.log(Object.keys(c.mcp || {}).sort().join(',') || '(none)');
" "$SWAP_OC/opencode.json")
if [[ "$SWAP_OC_KEYS" == "UnityMCP" ]]; then
    pass "swap on opencode: removal and write both happen — an HTTP server lands as a remote entry"
else
    fail "swap on opencode: expected only 'UnityMCP' to remain after the HTTP swap, got '$SWAP_OC_KEYS'"
fi

SWAP_OC_TYPE=$(node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  const e = (c.mcp || {}).UnityMCP || {};
  console.log([e.type || '(no type)', 'command' in e ? 'has-command' : 'no-command'].join(','));
" "$SWAP_OC/opencode.json")
if [[ "$SWAP_OC_TYPE" == "remote,no-command" ]]; then
    pass "swap on opencode: the written entry is type=remote with no command field"
else
    fail "swap on opencode: expected 'remote,no-command' for the written entry, got '$SWAP_OC_TYPE'"
fi

# 4e — the version placeholder reaches the settings file, and the reconciliation
# says so out loud until it is filled in.
PLACEHOLDER_LOG="$TMPDIR/placeholder.log"
PH="$TMPDIR/placeholder"; mkdir -p "$PH"
(cd "$ROOT_DIR" && PROJECT="$PH" node --input-type=module -e "
  const { setVerbose } = await import('./dist/utils/log.js');
  const { discoverMcpServers } = await import('./dist/core/mcp.js');
  const { reconcileMcpSettings } = await import('./dist/core/mcp-reconcile.js');
  setVerbose(true);
  const servers = await discoverMcpServers('unity');
  await reconcileMcpSettings(process.env.PROJECT, servers, ['unity-biome-mcp'], ['claude'], null, {});
" > "$PLACEHOLDER_LOG" 2>&1)
assert_contains "$PLACEHOLDER_LOG" 'version placeholder not filled' \
  "version placeholder: an unfilled pin is warned about"

# Fill the pin by hand — the user, or their Unity editor — and the warning stops.
node -e "
  const fs = require('fs');
  const f = process.argv[1];
  const c = JSON.parse(fs.readFileSync(f, 'utf8'));
  const e = c.mcpServers['unity-biome-mcp'];
  e.args = e.args.map(a => typeof a === 'string' ? a.replace('{{ VERSION }}', '1.37.2') : a);
  fs.writeFileSync(f, JSON.stringify(c, null, 2));
" "$PH/.mcp.json"
PLACEHOLDER_LOG2="$TMPDIR/placeholder-2.log"
(cd "$ROOT_DIR" && PROJECT="$PH" node --input-type=module -e "
  const { setVerbose } = await import('./dist/utils/log.js');
  const { discoverMcpServers } = await import('./dist/core/mcp.js');
  const { reconcileMcpSettings } = await import('./dist/core/mcp-reconcile.js');
  setVerbose(true);
  const servers = await discoverMcpServers('unity');
  await reconcileMcpSettings(process.env.PROJECT, servers, ['unity-biome-mcp'], ['claude'], null, {});
" > "$PLACEHOLDER_LOG2" 2>&1)
assert_not_contains "$PLACEHOLDER_LOG2" 'version placeholder not filled' \
  "version placeholder: a filled pin is silent (the check reads the settings file, not the package)"

# ─────────────────────────────────────────────────────
# Section 5: the `update` path end to end
# ─────────────────────────────────────────────────────

echo -e "\n${BOLD}Section 5: update path${NC}"

# 5a — one run migrates the config, recomputes the code, writes the settings file
# and substitutes the SAME code into the installed skill. All of it in one pass:
# "it will heal on the next update" is exactly what cannot happen here, because
# `mcpHashComponent` is computed from the same value that went stale.
E2E="$TMPDIR/update-e2e"; mkdir -p "$E2E"
write_map_config "$E2E" "1.1.0" "UnityMCP"
inject_fake_registry "$E2E"
cat > "$E2E/.mcp.json" << 'EOF'
{
  "mcpServers": {
    "UnityMCP": { "command": "uvx", "args": ["--from", "git+https://example/x#subdirectory=server", "unity-biome-mcp"] }
  }
}
EOF
run_update "$E2E" "$TMPDIR/update-e2e.log"

E2E_CONFIG=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(c.engineMcpKey + '|' + c.mcp.servers['unity-biome-mcp']);
" "$E2E/.unikit.json")
if [[ "$E2E_CONFIG" == "unity-biome-mcp|unity-biome-mcp" ]]; then
    pass "update: engineMcpKey and the map both hold the current vendor code"
else
    fail "update: expected 'unity-biome-mcp|unity-biome-mcp', got '$E2E_CONFIG'"
fi

E2E_SETTINGS=$(node -e "
  const c = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
  console.log(Object.keys(c.mcpServers).sort().join(','));
" "$E2E/.mcp.json")
if [[ "$E2E_SETTINGS" == "unity-biome-mcp" ]]; then
    pass "update: the orphan UnityMCP entry is gone from .mcp.json in the same run"
else
    fail "update: expected only 'unity-biome-mcp' in .mcp.json, got '$E2E_SETTINGS'"
fi

E2E_SKILL="$E2E/.claude/skills/unikit-implement/SKILL.md"
assert_contains "$E2E_SKILL" 'mcp__unity-biome-mcp__' \
  "update: the installed skill carries the NEW code (substitution and settings agree in one run)"
assert_not_contains "$E2E_SKILL" 'mcp__UnityMCP__' \
  "update: no trace of the stale code survives in the installed skill"

# 5b — idempotence. A second run with nothing to change must not touch the file.
E2E_SHA=$(sha_of "$E2E/.mcp.json")
run_update "$E2E" "$TMPDIR/update-e2e-2.log"
assert_file_unchanged "$E2E/.mcp.json" "$E2E_SHA" \
  "update: a second run leaves the settings file byte-identical"

# 5c — a legacy project reaches a clean `rules install` in one `update`. Exit 8 is
# the staleness gate; a chain that ran must clear it.
LEGACY="$TMPDIR/update-legacy"; mkdir -p "$LEGACY"
write_legacy_config "$LEGACY" '"version": "1.0.0",'
seed_flat_memory "$LEGACY"
inject_fake_registry "$LEGACY"
run_update "$LEGACY" "$TMPDIR/update-legacy.log"
set +e
(cd "$LEGACY" && node "$CLI" rules install > "$TMPDIR/rules-install.log" 2>&1)
RULES_INSTALL_EXIT=$?
set -e
if [[ "$RULES_INSTALL_EXIT" -ne 8 ]]; then
    pass "legacy project: one update clears the staleness gate (rules install did not exit 8)"
else
    fail "legacy project: rules install still exits 8 after update — the chain did not run from update"
    sed 's/^/      /' "$TMPDIR/rules-install.log"
fi

# 5d — an empty selection must stay silent on stderr. `rules --json` output is
# parsed by the harness, and a stray warn line lands in the same stream.
EMPTY="$TMPDIR/empty-servers"; mkdir -p "$EMPTY"
cat > "$EMPTY/.unikit.json" << 'EOF'
{
  "version": "1.2.0",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": {} },
  "agents": [],
  "rules": { "installed": { "version": "1.2.0", "modules": { "code": { "core": [], "stack": [] } } } }
}
EOF
inject_fake_registry "$EMPTY"
set +e
EMPTY_STDERR=$( (cd "$EMPTY" && node "$CLI" rules status --json 2>&1 >/dev/null) )
set -e
if [[ -z "$EMPTY_STDERR" ]]; then
    pass "empty selection: no stderr noise from an empty mcp.servers map"
else
    fail "empty selection: unexpected stderr output"
    echo "$EMPTY_STDERR" | sed 's/^/      /'
fi

# 5e — a vendor code that changes while the SELECTION does not must still
# reinstall: the code is part of the artifact source hash, and without that the
# prose and the settings file drift apart with nothing to notice it.
HASH="$TMPDIR/code-change-hash"; mkdir -p "$HASH"
write_map_config "$HASH" "1.2.0" "unity-biome-mcp"
inject_fake_registry "$HASH"
run_update "$HASH" "$TMPDIR/code-hash-1.log"
HASH_SKILL="$HASH/.claude/skills/unikit-implement/SKILL.md"
assert_contains "$HASH_SKILL" 'mcp__unity-biome-mcp__' \
  "code-change hash: the first update injects the shipped code"

BIOME_JSON_BACKUP="$TMPDIR/unity-biome-mcp.json.orig"
cp "$BIOME_JSON" "$BIOME_JSON_BACKUP"
BIOME_JSON="$BIOME_JSON" BIOME_SRC="$BIOME_JSON_BACKUP" node -e "
    const fs = require('fs');
    const m = JSON.parse(fs.readFileSync(process.env.BIOME_SRC, 'utf8'));
    m.code = 'unity-biome-renamed';
    fs.writeFileSync(process.env.BIOME_JSON, JSON.stringify(m, null, 2));
"
run_update "$HASH" "$TMPDIR/code-hash-2.log"
assert_contains "$HASH_SKILL" 'mcp__unity-biome-renamed__' \
  "code-change hash: renaming the vendor code alone reinstalls the skill with the new prefix"
assert_not_contains "$HASH_SKILL" 'mcp__unity-biome-mcp__' \
  "code-change hash: the previous prefix is swept out of the frontmatter"
cp "$BIOME_JSON_BACKUP" "$BIOME_JSON"
BIOME_JSON_BACKUP=""

# ─────────────────────────────────────────────────────
# Section 6: the plan-manifest merge
# ─────────────────────────────────────────────────────
# What golden-guard #3 does NOT cover: it drives one already-modular plan folder
# through `update`. The interesting states of this step are the ones it refuses
# to touch and the ones it half-finishes, so they are seeded here directly under
# `.unikit/code/plans/` and run through a single `update`.

echo -e "\n${BOLD}Section 6: plan-manifest merge${NC}"

P6="$TMPDIR/plan-merge"; mkdir -p "$P6"
use_fake_registry "$P6" unity minimal-valid
P6_PLANS="$P6/.unikit/code/plans"
mkdir -p "$P6_PLANS/selfheal" "$P6_PLANS/completed" "$P6_PLANS/statusonly" \
         "$P6_PLANS/live" "$P6_PLANS/dup"

# The flat fast plan — a DIFFERENT artifact that shares the manifest's basename.
# Nothing in this step may reach it (scenario 8).
printf '# fast plan\n\n- [ ] Task 1 open\n' > "$P6/.unikit/code/PLAN.md"
P6_FLAT_SHA="$(sha_of "$P6/.unikit/code/PLAN.md")"

# (6) fold self-heal: the rename half already ran, the brief is still on disk.
printf '# plan\n\n## Checklist\n\n- [ ] Task 1 open\n' \
    > "$P6_PLANS/selfheal/PLAN.md"
printf '# Brief\n\n## CONSTRAINTS\n- MUST: resume\n' \
    > "$P6_PLANS/selfheal/PLAN-BRIEF.md"

# (9) completed: zero `- [ ]` lines. Untouched forever, both files.
printf '# tasks\n\n- [x] Task 1 shipped\n' > "$P6_PLANS/completed/TASKS.md"
printf '# Brief\n\n## CONSTRAINTS\n- MUST: archived\n' > "$P6_PLANS/completed/PLAN-BRIEF.md"
P6_DONE_TASKS_SHA="$(sha_of "$P6_PLANS/completed/TASKS.md")"
P6_DONE_BRIEF_SHA="$(sha_of "$P6_PLANS/completed/PLAN-BRIEF.md")"

# (11) the counter must not read a phase status line as an open task: the only
#      square brackets here are `**Status:** [ ] Not started`, and the folder is
#      completed. Count it and every finished plan in existence would migrate.
printf '# tasks\n\n**Status:** [ ] Not started\n\n- [x] Task 1 shipped\n' \
    > "$P6_PLANS/statusonly/TASKS.md"
P6_STATUS_SHA="$(sha_of "$P6_PLANS/statusonly/TASKS.md")"

# (12) lift: `## Design` in the brief must land at `##` level ABOVE the
#      separator, never demoted into `### Design` inside Technical Context.
printf '# tasks\n\n## Checklist\n\n- [ ] Task 1 open\n' > "$P6_PLANS/live/TASKS.md"
printf '# Brief\n\n## Design\nSYS-combat v3\n\n## CONSTRAINTS\n- MUST: live\n' \
    > "$P6_PLANS/live/PLAN-BRIEF.md"

# (13) dedup: the block sits in BOTH files. The manifest's copy wins and the
#      brief's is dropped, so the merged file carries exactly one.
printf '# tasks\n\n## Design\nSYS-combat v3 (authoritative)\n\n- [ ] Task 1 open\n' \
    > "$P6_PLANS/dup/TASKS.md"
printf '# Brief\n\n## Design\nSYS-combat v2 (stale copy)\n\n## CONSTRAINTS\n- MUST: dup\n' \
    > "$P6_PLANS/dup/PLAN-BRIEF.md"

run_update "$P6" "$TMPDIR/plan-merge-update.log"

# 6 — self-heal
assert_contains   "$P6_PLANS/selfheal/PLAN.md" '## Technical Context' \
  "self-heal: the brief folded into a manifest that already existed"
assert_contains   "$P6_PLANS/selfheal/PLAN.md" '### CONSTRAINTS' \
  "self-heal: the brief headings came down one level"
assert_not_exists "$P6_PLANS/selfheal/PLAN-BRIEF.md" \
  "self-heal: the brief is removed once the write is verified"

# 8 — the flat fast plan is a different artifact and is never touched
assert_file_unchanged "$P6/.unikit/code/PLAN.md" "$P6_FLAT_SHA" \
  "flat code/PLAN.md untouched by the plan-folder merge"

# 9 + 10 — selectivity, and a mixed project migrating exactly the live folders
assert_file_unchanged "$P6_PLANS/completed/TASKS.md" "$P6_DONE_TASKS_SHA" \
  "completed plan: TASKS.md byte-identical"
assert_file_unchanged "$P6_PLANS/completed/PLAN-BRIEF.md" "$P6_DONE_BRIEF_SHA" \
  "completed plan: PLAN-BRIEF.md byte-identical"
assert_not_exists "$P6_PLANS/completed/PLAN.md" \
  "completed plan: no manifest created"
assert_exists     "$P6_PLANS/live/PLAN.md" \
  "mixed project: the folder with an open task did migrate"

# 11 — a phase status line is not an open task
assert_file_unchanged "$P6_PLANS/statusonly/TASKS.md" "$P6_STATUS_SHA" \
  "status line is not a checkbox: the folder counts as completed"

# 12 — the lift, asserted from both sides
assert_contains     "$P6_PLANS/live/PLAN.md" '^## Design$' \
  "lift: ## Design kept its heading level"
assert_not_contains "$P6_PLANS/live/PLAN.md" '^### Design$' \
  "lift: ## Design was never demoted into Technical Context"
P6_LIVE_DESIGN=$(grep -n '^## Design$' "$P6_PLANS/live/PLAN.md" | cut -d: -f1)
# `tail -1`, not `head -1`: the merge appends its separator LAST, and a manifest
# body may legitimately carry an earlier one (frontmatter, a horizontal rule).
# Anchoring on the first would make this assertion pass for the wrong reason.
P6_LIVE_RULE=$(grep -n '^---$' "$P6_PLANS/live/PLAN.md" | tail -1 | cut -d: -f1)
if [[ -n "$P6_LIVE_DESIGN" && -n "$P6_LIVE_RULE" && "$P6_LIVE_DESIGN" -lt "$P6_LIVE_RULE" ]]; then
    pass "lift: ## Design sits above the separator (line $P6_LIVE_DESIGN < $P6_LIVE_RULE)"
else
    fail "lift: expected ## Design above the separator, got design=$P6_LIVE_DESIGN rule=$P6_LIVE_RULE"
fi

# 13 — dedup keeps exactly one, and it is the manifest's own
P6_DUP_COUNT=$(grep -c '^## Design$' "$P6_PLANS/dup/PLAN.md")
if [[ "$P6_DUP_COUNT" -eq 1 ]]; then
    pass "dedup: exactly one ## Design survives the merge"
else
    fail "dedup: expected exactly one ## Design in the merged manifest, got $P6_DUP_COUNT"
fi
assert_contains     "$P6_PLANS/dup/PLAN.md" 'authoritative' \
  "dedup: the manifest's own copy is the one kept"
assert_not_contains "$P6_PLANS/dup/PLAN.md" 'stale copy' \
  "dedup: the brief's duplicate is dropped, not demoted"

# 4 — idempotence: a second update rewrites nothing
P6_LIVE_SHA="$(sha_of "$P6_PLANS/live/PLAN.md")"
P6_SELFHEAL_SHA="$(sha_of "$P6_PLANS/selfheal/PLAN.md")"
run_update "$P6" "$TMPDIR/plan-merge-update-2.log"
assert_file_unchanged "$P6_PLANS/live/PLAN.md" "$P6_LIVE_SHA" \
  "idempotence: the merged manifest is byte-identical on a second update"
assert_file_unchanged "$P6_PLANS/selfheal/PLAN.md" "$P6_SELFHEAL_SHA" \
  "idempotence: the self-healed manifest is byte-identical on a second update"

# 7 — no permanent pending. The completed and status-only folders are skipped by
#     `apply`, so `detect` must call them done too; disagree and `rules sync`
#     answers exit 8 with no `update` able to clear it.
assert_cmd_exit 0 "no permanent pending: rules sync exits 0 after the merge" \
  "$TMPDIR/plan-merge-sync.log" -- env -C "$P6" node "$CLI" rules sync

# 14 — the same claim on a project where there is no work BY CONSTRUCTION: every
#      folder is completed, so nothing is ever migrated and nothing may hang.
P14="$TMPDIR/plan-all-completed"; mkdir -p "$P14"
use_fake_registry "$P14" unity minimal-valid
mkdir -p "$P14/.unikit/code/plans/done-a" "$P14/.unikit/code/plans/done-b"
printf '# tasks\n\n- [x] Task 1 shipped\n' > "$P14/.unikit/code/plans/done-a/TASKS.md"
printf '# Brief\n\n## CONSTRAINTS\n- MUST: a\n' > "$P14/.unikit/code/plans/done-a/PLAN-BRIEF.md"
printf '# tasks\n\n- [x] Task 1 shipped\n' > "$P14/.unikit/code/plans/done-b/TASKS.md"
P14_A_SHA="$(sha_of "$P14/.unikit/code/plans/done-a/TASKS.md")"
run_update "$P14" "$TMPDIR/plan-all-completed-update.log"
assert_file_unchanged "$P14/.unikit/code/plans/done-a/TASKS.md" "$P14_A_SHA" \
  "all-completed project: nothing was migrated"
assert_cmd_exit 0 "all-completed project: rules sync exits 0 (the gate creates no pending work)" \
  "$TMPDIR/plan-all-completed-sync.log" -- env -C "$P14" node "$CLI" rules sync

# 15 — a folder the process cannot write must not strand the rest, and must not
#      abort the chain. `readTextFile` answers null on failure, but `movePath`,
#      `writeTextFile` and `removeFile` throw, and `update` awaits the chain
#      directly — so without the guard one read-only PLAN.md ends the whole run.
#      Probe-gated: a filesystem that ignores the read-only bit (some mounts,
#      some CI containers running as root) would make the scenario vacuous.
P15="$TMPDIR/plan-unwritable"; mkdir -p "$P15"
use_fake_registry "$P15" unity minimal-valid
P15_PLANS="$P15/.unikit/code/plans"
mkdir -p "$P15_PLANS/locked" "$P15_PLANS/healthy"
printf '# plan\n\n- [ ] Task 1 open\n' > "$P15_PLANS/locked/PLAN.md"
printf '# Brief\n\n## CONSTRAINTS\n- MUST: locked\n' > "$P15_PLANS/locked/PLAN-BRIEF.md"
printf '# tasks\n\n- [ ] Task 1 open\n' > "$P15_PLANS/healthy/TASKS.md"
printf '# Brief\n\n## CONSTRAINTS\n- MUST: healthy\n' > "$P15_PLANS/healthy/PLAN-BRIEF.md"

P15_PROBE=$(LOCKED="$P15_PLANS/locked/PLAN.md" node -e "
  const fs = require('fs');
  fs.chmodSync(process.env.LOCKED, 0o444);
  try { fs.appendFileSync(process.env.LOCKED, 'x'); process.stdout.write('writable'); }
  catch { process.stdout.write('unwritable'); }
" 2>/dev/null || echo 'probe-error')

if [[ "$P15_PROBE" == "unwritable" ]]; then
    assert_cmd_exit 0 "unwritable plan folder: update still exits 0" \
      "$TMPDIR/plan-unwritable-update.log" -- env -C "$P15" node "$CLI" update
    assert_exists     "$P15_PLANS/healthy/PLAN.md" \
      "unwritable plan folder: the healthy folder still migrated"
    assert_not_exists "$P15_PLANS/healthy/PLAN-BRIEF.md" \
      "unwritable plan folder: the healthy brief was still folded and removed"
    assert_exists     "$P15_PLANS/locked/PLAN-BRIEF.md" \
      "unwritable plan folder: the brief it could not fold is left in place"
else
    echo "  - skipped: this filesystem ignores the read-only bit (probe=$P15_PROBE)"
fi
LOCKED="$P15_PLANS/locked/PLAN.md" node -e "
  require('fs').chmodSync(process.env.LOCKED, 0o666);
" 2>/dev/null || true

# ─────────────────────────────────────────────────────
# Section 7: plan-artifact pure functions
# ─────────────────────────────────────────────────────
# The three exported helpers are the only part of the step with no observable
# side effect, so the end-to-end scenarios above can only reach them through a
# whole `update`. These assertions are why they are exported at all — without a
# caller outside the module, `ignoreExportsUsedInFile` keeps knip quiet and the
# export surface would sit there unjustified.
#
# Strings are assembled from `String.fromCharCode` rather than written with
# escapes: the block is a double-quoted bash string, where a backtick opens a
# command substitution and a backslash is eaten before node ever sees it.

echo -e "\n${BOLD}Section 7: plan-artifact pure functions${NC}"

PURE_RESULT=$(cd "$ROOT_DIR" && node --input-type=module -e "
  const m = await import('./dist/core/workspace-migrations/plan-artifact.js');
  const NL = String.fromCharCode(10);
  const FENCE = String.fromCharCode(96).repeat(3);
  const why = [];
  const eq = (name, actual, expected) => {
    if (actual !== expected) why.push(name + '=' + JSON.stringify(actual));
  };

  // openTaskCount — the selectivity signal
  eq('open-counted', m.openTaskCount(['- [ ] a', '- [x] b'].join(NL)), 1);
  eq('status-line-not-a-task', m.openTaskCount(['**Status:** [ ] Not started', '- [x] b'].join(NL)), 0);
  eq('fenced-checkbox-ignored', m.openTaskCount([FENCE + 'md', '- [ ] sample', FENCE].join(NL)), 0);
  eq('none-is-zero', m.openTaskCount('# title'), 0);

  // foldBrief — H1 dropped, headings demoted one level, fences untouched
  const folded = m.foldBrief([
    '# Brief', '', '## CONSTRAINTS', '- MUST: x', '', '### CREATE', 'y', '',
    FENCE + 'bash', '# not a heading', FENCE, '', '###### deep', '', ''
  ].join(NL));
  eq('h1-dropped', folded.split(NL)[0], '### CONSTRAINTS');
  eq('h2-demoted', folded.includes('### CONSTRAINTS'), true);
  eq('h3-demoted', folded.includes('#### CREATE'), true);
  eq('h6-untouched', folded.includes('###### deep'), true);
  eq('fence-untouched', folded.includes(NL + '# not a heading' + NL), true);
  eq('trailing-blanks-trimmed', folded.endsWith('###### deep'), true);

  // liftDesignSections — verbatim lift, dedup against the manifest
  const brief = ['# Brief', '', '## Design', 'SYS-combat', '', '## CONSTRAINTS', '- MUST: x'].join(NL);
  const lifted = m.liftDesignSections(brief, ['# Plan', '', '## Checklist'].join(NL));
  eq('lifted-verbatim', lifted.lifted, ['## Design', 'SYS-combat'].join(NL));
  eq('lifted-out-of-rest', lifted.rest.includes('## Design'), false);
  eq('rest-keeps-the-others', lifted.rest.includes('## CONSTRAINTS'), true);

  const deduped = m.liftDesignSections(brief, ['# Plan', '', '## Design', 'authoritative'].join(NL));
  eq('dup-not-lifted', deduped.lifted, '');
  eq('dup-not-demoted-either', deduped.rest.includes('Design'), false);

  const none = m.liftDesignSections(['# Brief', '', '## CONSTRAINTS'].join(NL), '# Plan');
  eq('no-section-empty-lift', none.lifted, '');
  eq('no-section-rest-intact', none.rest.includes('## CONSTRAINTS'), true);

  process.stdout.write(why.length ? why.join(' ') : 'ok');
" 2>/dev/null || echo "pure-error")

if [[ "$PURE_RESULT" == "ok" ]]; then
    pass "plan-artifact helpers: openTaskCount, foldBrief and liftDesignSections hold their contracts"
else
    fail "plan-artifact helper contract violated: $PURE_RESULT"
fi

print_summary_and_exit "Migration + MCP reconciliation Smoke Tests"
