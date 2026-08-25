#!/bin/bash
# Smoke tests: the project migration chain and the MCP settings reconciliation.
# Usage: ./scripts/test-migrations.sh
#
# Two mechanisms land together in 2.0.0 and only make sense read together:
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

# Rewrite the version stamp of an existing `.unikit.json`.
#
# `use_fake_registry` always stamps the CURRENT version, which silences the
# version half of the runner — the right default for a fixture whose subject is
# `detect`. A fixture whose subject is what a real 1.x UPGRADE prints needs the
# opposite, and it still needs the fake registry that `rules sync` reads, so the
# two cannot be swapped for `write_legacy_config`. Rewriting the one field after
# the fact is the only way to have both.
stamp_config_version() {
    local project="$1"
    local version="$2"
    node -e "
      const fs = require('fs');
      const file = process.argv[1] + '/.unikit.json';
      const config = JSON.parse(fs.readFileSync(file, 'utf8'));
      config.version = process.argv[2];
      fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
    " "$project" "$version"
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

# A pre-2.0.0 config: `mcp.servers` is still a bare array of file ids, and the
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
# The two manifest merges and the timestamp backfill are carried by the version
# half and apply as no-ops (this project has neither plan nor research folders,
# nor a flat manifest) — which is the contract every step owes since the runner
# started ORing the halves, and the reason the row lists them.
M1="$TMPDIR/matrix-1.0.0"; mkdir -p "$M1"
write_legacy_config "$M1" '"version": "1.0.0",'
seed_flat_memory "$M1"
M1_APPLIED=$(plan_chain "$M1" "1.0.0")
if [[ "$M1_APPLIED" == "memory-1-to-2-code-wrap,workspace-1-to-2-code-relocate,mcp-servers-map,mcp-fileid-rename,plan-1-to-2-manifest-merge,research-1-to-2-manifest-merge,plan-2-to-3-timestamps" ]]; then
    pass "matrix 1.0.0: every step group applied, ordered by since ($M1_APPLIED)"
else
    fail "matrix 1.0.0: expected all seven steps in since order, got '$M1_APPLIED'"
fi

# Row 2 — 1.1.0, modular memory + array. The 1.1.0 steps are quiet; every 2.0.0
# step — the two MCP ones, the two manifest merges and the timestamp backfill —
# is above the stamp.
M2="$TMPDIR/matrix-1.1.0"; mkdir -p "$M2"
write_legacy_config "$M2" '"version": "1.1.0",'
seed_modular_memory "$M2"
M2_APPLIED=$(plan_chain "$M2" "1.1.0")
if [[ "$M2_APPLIED" == "mcp-servers-map,mcp-fileid-rename,plan-1-to-2-manifest-merge,research-1-to-2-manifest-merge,plan-2-to-3-timestamps" ]]; then
    pass "matrix 1.1.0: only the steps anchored above the stamp applied ($M2_APPLIED)"
else
    fail "matrix 1.1.0: expected the MCP steps + both merges + the backfill, got '$M2_APPLIED'"
fi

# Row 3 — 2.0.0, modular memory + array. The version half is quiet for the whole
# 2.0.0 group (the project is stamped with the very version they are anchored
# at), so this row is carried by `detect` alone. It is the regression that
# matters most: every dev project running `npm link` before publication is
# stamped this way. The plan merge is absent here on purpose — its `detect`
# finds no plan folder on this project, and with the version half quiet that is
# the whole signal. The research merge is absent for exactly the same reason and
# on exactly the same evidence — these fixtures carry no research folder either,
# so its `detect` answers false honestly. The timestamp backfill is absent on the
# same evidence a third time: no plan folder and no flat `code/PLAN.md`. Rows 4
# and 5 inherit all three absences; stated here once so a later reader does not
# read a missing step as an omission.
M3="$TMPDIR/matrix-2.0.0"; mkdir -p "$M3"
write_legacy_config "$M3" '"version": "2.0.0",'
seed_modular_memory "$M3"
M3_APPLIED=$(plan_chain "$M3" "2.0.0")
if [[ "$M3_APPLIED" == "mcp-servers-map,mcp-fileid-rename" ]]; then
    pass "matrix 2.0.0: detect carries the MCP steps when the version half is quiet ($M3_APPLIED)"
else
    fail "matrix 2.0.0: expected the MCP steps via detect, got '$M3_APPLIED'"
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
cat > "$RESERVED/.unikit.json" <<EOF
{
  "version": "$(current_project_version)",
  "engine": "unity",
  "engineMcpKey": "unity-biome-mcp",
  "mcp": { "servers": { "unity-biome-mcp": "unity-biome-mcp" } },
  "agents": [],
  "rules": { "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } } },
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
cat > "$EMPTY/.unikit.json" <<EOF
{
  "version": "$(current_project_version)",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": {} },
  "agents": [],
  "rules": { "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } } }
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
write_map_config "$HASH" "$(current_project_version)" "unity-biome-mcp"
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

# (6) fold self-heal: the rename half already ran, the brief is still on disk.
printf '# plan\n\n## Checklist\n\n- [ ] Task 1 open\n' \
    > "$P6_PLANS/selfheal/PLAN.md"
printf '# Brief\n\n## CONSTRAINTS\n- MUST: resume\n' \
    > "$P6_PLANS/selfheal/PLAN-BRIEF.md"

# (9) completed: zero `- [ ]` lines. Untouched forever, both files.
printf '# tasks\n\n- [x] Task 1 shipped\n' > "$P6_PLANS/completed/TASKS.md"
printf '# Brief\n\n## CONSTRAINTS\n- MUST: archived\n' > "$P6_PLANS/completed/PLAN-BRIEF.md"
P6_DONE_BRIEF_SHA="$(sha_of "$P6_PLANS/completed/PLAN-BRIEF.md")"

# (11) the counter must not read a phase status line as an open task: the only
#      square brackets here are `**Status:** [ ] Not started`, and the folder is
#      completed. Count it and every finished plan in existence would migrate.
printf '# tasks\n\n**Status:** [ ] Not started\n\n- [x] Task 1 shipped\n' \
    > "$P6_PLANS/statusonly/TASKS.md"

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

# 8 — the flat fast plan is a different artifact and the MERGE never reaches it.
# It is no longer byte-identical after an `update`, and that is not a regression:
# `plan-2-to-3-timestamps` stamps it deliberately (it is the second root of that
# step, and priority #1 in all three plan resolvers). So the claim is asserted on
# what the merge would have done rather than on a hash — a folded manifest would
# carry `## Technical Context`, and its own checklist would not survive intact.
assert_not_contains "$P6/.unikit/code/PLAN.md" '## Technical Context' \
  "flat code/PLAN.md: nothing was folded into it by the plan-folder merge"
assert_contains "$P6/.unikit/code/PLAN.md" '^- \[ \] Task 1 open$' \
  "flat code/PLAN.md: its own body came through the merge untouched"

# 8b — and the timestamp backfill DID reach it, in the same run. This is the one
# place the two plan steps are proved to act on the same file in the right order.
assert_contains "$P6/.unikit/code/PLAN.md" '^Created: [0-9]{4}-[0-9]{2}-[0-9]{2}$' \
  "flat code/PLAN.md: the backfill stamped Created:"
assert_contains "$P6/.unikit/code/PLAN.md" '^Updated: [0-9]{4}-[0-9]{2}-[0-9]{2}$' \
  "flat code/PLAN.md: the backfill stamped Updated:"

# 9 + 10 — selectivity, and a mixed project migrating exactly the live folders.
# The claim about `TASKS.md` is asserted on what the MERGE would have done, not
# on a hash: `plan-2-to-3-timestamps` stamps a completed plan under its own file
# name by design (it is the only name that folder will ever have), so the file
# is not byte-identical after an `update` and that is not a regression. A merge,
# by contrast, would have appended `## Technical Context` and deleted the brief.
assert_not_contains "$P6_PLANS/completed/TASKS.md" '## Technical Context' \
  "completed plan: the merge folded nothing into TASKS.md"
assert_contains "$P6_PLANS/completed/TASKS.md" '^- \[x\] Task 1 shipped$' \
  "completed plan: its own checklist came through the run untouched"
assert_file_unchanged "$P6_PLANS/completed/PLAN-BRIEF.md" "$P6_DONE_BRIEF_SHA" \
  "completed plan: PLAN-BRIEF.md byte-identical"
assert_not_exists "$P6_PLANS/completed/PLAN.md" \
  "completed plan: no manifest created"
assert_exists     "$P6_PLANS/live/PLAN.md" \
  "mixed project: the folder with an open task did migrate"

# 10b — THE ORDER OF THE TWO PLAN STEPS, end to end and nowhere else.
# `live/` entered this run as TASKS.md and left it as a stamped PLAN.md, so
# both steps acted on the same file in the same pass. Reverse them and the
# backfill would walk a folder whose manifest does not exist yet: the stamp
# would land nowhere and these two asserts would be the only thing to say so.
assert_contains "$P6_PLANS/live/PLAN.md" '^Created: [0-9]{4}-[0-9]{2}-[0-9]{2}$' \
  "order: the merged manifest was stamped with Created: in the same run"
assert_contains "$P6_PLANS/live/PLAN.md" '^Updated: [0-9]{4}-[0-9]{2}-[0-9]{2}$' \
  "order: the merged manifest was stamped with Updated: in the same run"

# 11 — a phase status line is not an open task. Same reading as 9 above: the
#      claim is that the COUNTER did not read `**Status:** [ ] Not started` as
#      an open task, so the folder was judged completed and never merged. The
#      backfill still stamps it, which is why this is not a hash either.
assert_not_exists "$P6_PLANS/statusonly/PLAN.md" \
  "status line is not a checkbox: the folder counts as completed (no manifest created)"
assert_contains "$P6_PLANS/statusonly/TASKS.md" '^\*\*Status:\*\* \[ \] Not started$' \
  "status line is not a checkbox: the line itself survived the run verbatim"

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
P14_A_BRIEF_SHA="$(sha_of "$P14/.unikit/code/plans/done-a/PLAN-BRIEF.md")"
run_update "$P14" "$TMPDIR/plan-all-completed-update.log"
# "Nothing was MIGRATED" — asserted on the merge's own two traces, since the
# backfill stamps a completed plan deliberately and a hash could no longer tell
# the two steps apart.
assert_not_exists "$P14/.unikit/code/plans/done-a/PLAN.md" \
  "all-completed project: no manifest was created"
assert_file_unchanged "$P14/.unikit/code/plans/done-a/PLAN-BRIEF.md" "$P14_A_BRIEF_SHA" \
  "all-completed project: the brief was neither folded nor removed"
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

# ─────────────────────────────────────────────────────
# Section 7b: markdown + workspace-folders pure functions
# ─────────────────────────────────────────────────────
# The two helpers the research merge added to the shared markdown layer, plus the
# folder-name date reader. Same shape as Section 7 and for the same reason: they
# are the pure half of a step whose impure half destroys data, so they are worth
# asserting where a failure names the function rather than the folder.
#
# Strings are assembled from `String.fromCharCode` rather than written with
# escapes: the block is a double-quoted bash string, where a backtick opens a
# command substitution and a backslash is eaten before node ever sees it.

echo -e "\n${BOLD}Section 7b: markdown pure functions${NC}"

MD_RESULT=$(cd "$ROOT_DIR" && node --input-type=module -e "
  const m = await import('./dist/core/workspace-migrations/markdown.js');
  const f = await import('./dist/core/workspace-migrations/workspace-folders.js');
  const NL = String.fromCharCode(10);
  const FENCE = String.fromCharCode(96).repeat(3);
  const why = [];
  const eq = (name, actual, expected) => {
    if (actual !== expected) why.push(name + '=' + JSON.stringify(actual));
  };

  // sectionBody — exact-line match, level-aware boundary, fence-blind
  const doc = [
    '# Brief', '', '## CONTEXT', '', 'needs a cache', '', '### detail', 'kept', '',
    '## CONSTRAINTS', '- MUST: x', '', '## OUT OF SCOPE', 'N/A', ''
  ].join(NL);
  eq('found', m.sectionBody(doc, '## CONTEXT'), ['needs a cache', '', '### detail', 'kept'].join(NL));
  eq('subsection-kept', m.sectionBody(doc, '## CONTEXT').includes('### detail'), true);
  eq('next-section-not-swallowed', m.sectionBody(doc, '## CONTEXT').includes('CONSTRAINTS'), false);
  eq('missing-is-null', m.sectionBody(doc, '## INTERFACES'), null);
  eq('later-section', m.sectionBody(doc, '## OUT OF SCOPE'), 'N/A');

  // a heading-shaped line inside a fence closes nothing
  const fenced = [
    '## CONTEXT', 'before', FENCE + 'md', '## CONSTRAINTS', FENCE, 'after', '', '## REAL', 'x'
  ].join(NL);
  eq('fenced-heading-does-not-close', m.sectionBody(fenced, '## CONTEXT'),
     ['before', FENCE + 'md', '## CONSTRAINTS', FENCE, 'after'].join(NL));

  // demoteHeadings — one level down, six is the ceiling, fences untouched
  const dem = m.demoteHeadings([
    '## CONSTRAINTS', 'x', '', '### CREATE', 'y', '', FENCE + 'bash', '# not a heading', FENCE,
    '', '###### deep', '', ''
  ].join(NL));
  eq('h2-to-h3', dem.split(NL)[0], '### CONSTRAINTS');
  eq('h3-to-h4', dem.includes('#### CREATE'), true);
  eq('h6-untouched', dem.includes('###### deep'), true);
  eq('h6-not-h7', dem.includes('####### deep'), false);
  eq('fence-untouched', dem.includes(NL + '# not a heading' + NL), true);
  eq('trailing-blanks-trimmed', dem.endsWith('###### deep'), true);
  eq('no-h1-step', m.demoteHeadings(['# Title', '', 'body'].join(NL)).split(NL)[0], '## Title');

  // folderDatePrefix — the three name formats the resolvers have to tell apart
  eq('dated', f.folderDatePrefix('2026-03-08_customers'), '2026-03-08');
  eq('legacy-numbered', f.folderDatePrefix('001-legacy'), null);
  eq('dateless', f.folderDatePrefix('customers'), null);


  // headerEnd — the header block is BOUNDED. The shape that breaks an
  // unbounded scan is a manifest with no '##' at all: the whole document then
  // counts as header, and the new fields land next to the last colon-shaped
  // line in the BODY, wherever that happens to be.
  const hdr = ['# Plan', '', 'Branch: x', 'Status: y', '', '## Checklist', '- [ ] t'].join(NL);
  eq('header-ends-at-blank-after-fields', m.headerEnd(hdr), 4);
  eq('header-ends-at-h2', m.headerEnd(['# Plan', 'Branch: x', '## Checklist'].join(NL)), 2);
  const noH2 = ['# Plan', '', 'Branch: x', '', 'body', 'Owner: bob'].join(NL);
  eq('no-h2-header-still-bounded', m.headerEnd(noH2), 3);
  const bare = ['# fast plan', ''].join(NL);
  eq('h1-only-runs-to-eof', m.headerEnd(bare), 2);

  // findField / insertPoint / fieldValue — the header primitives BOTH manifest
  // steps read, declared once so the two cannot drift apart
  eq('field-found', m.findField(hdr.split(NL), m.headerEnd(hdr), 'Status:'), 3);
  eq('field-absent', m.findField(hdr.split(NL), m.headerEnd(hdr), 'Created:'), -1);
  eq('field-beyond-header-not-found', m.findField(noH2.split(NL), m.headerEnd(noH2), 'Owner:'), -1);
  eq('insert-after-last-field', m.insertPoint(hdr.split(NL), m.headerEnd(hdr)), 4);
  eq('insert-after-h1', m.insertPoint(bare.split(NL), m.headerEnd(bare)), 1);
  eq('field-value', m.fieldValue('Created: 2026-03-08', 'Created:'), '2026-03-08');
  process.stdout.write(why.length ? why.join(' ') : 'ok');
" 2>/dev/null || echo "markdown-error")

if [[ "$MD_RESULT" == "ok" ]]; then
    pass "markdown helpers: sectionBody, demoteHeadings, the header primitives and folderDatePrefix hold their contracts"
else
    fail "markdown helper contract violated: $MD_RESULT"
fi

# ─────────────────────────────────────────────────────
# Section 8b: the research-manifest merge
# ─────────────────────────────────────────────────────
# Two folders, and the second one is the whole point of the section. `withbrief`
# is the ordinary case; `nobrief` carries only RESULT + SOURCE, and it is the
# only fixture on which it is visible that NEITHER half 3 (`## Sessions`) NOR
# branch 4b (`## Active Summary`) depends on a brief existing. A folder that
# reached disk without those markers fails on the first `/unikit-explore` save,
# three steps away from this cause.

echo -e "\n${BOLD}Section 8b: research-manifest merge${NC}"

R8="$TMPDIR/research-merge"; mkdir -p "$R8"
use_fake_registry "$R8" unity minimal-valid
R8_DIR="$R8/.unikit/code/researches"
mkdir -p "$R8_DIR/2026-06-12_withbrief" "$R8_DIR/nobrief"

printf '# Search cache\n\nDate: 2026-06-12\nStatus: in-progress\n\n## Findings\n\nbody\n' \
    > "$R8_DIR/2026-06-12_withbrief/RESEARCH_RESULT.md"
printf '# Brief\n\n## CONTEXT\n\ncache the search\n\n## CONSTRAINTS\n\n- Redis exists\n\n## INTERFACES\n\nCache.get\n\n## DEPENDENCY GRAPH\n\nA to B\n' \
    > "$R8_DIR/2026-06-12_withbrief/RESEARCH_BRIEF.md"
printf 'dialogue\n' > "$R8_DIR/2026-06-12_withbrief/RESEARCH_SOURCE.md"

printf '# Flat research\n\nStatus: in-progress\n\n## Findings\n\nbody\n' \
    > "$R8_DIR/nobrief/RESEARCH_RESULT.md"
printf 'dialogue\n' > "$R8_DIR/nobrief/RESEARCH_SOURCE.md"

run_update "$R8" "$TMPDIR/research-merge-update.log"

# The rename half, on both folders
assert_exists     "$R8_DIR/2026-06-12_withbrief/RESEARCH.md" \
  "with brief: RESEARCH_RESULT.md renamed to the manifest"
assert_not_exists "$R8_DIR/2026-06-12_withbrief/RESEARCH_RESULT.md" \
  "with brief: the legacy result name is gone"
assert_exists     "$R8_DIR/2026-06-12_withbrief/SOURCE.md" \
  "with brief: the dialogue log kept its own file under the new name"
assert_not_exists "$R8_DIR/2026-06-12_withbrief/RESEARCH_BRIEF.md" \
  "with brief: the brief is removed once the write is verified"
assert_exists     "$R8_DIR/nobrief/RESEARCH.md" \
  "no brief: RESEARCH_RESULT.md renamed to the manifest"
assert_exists     "$R8_DIR/nobrief/SOURCE.md" \
  "no brief: the dialogue log kept its own file under the new name"

# The heavy half — written only where the brief carried it
assert_exists     "$R8_DIR/2026-06-12_withbrief/CONTRACTS.md" \
  "with brief: the heavy sections became CONTRACTS.md"
assert_exists     "$R8_DIR/2026-06-12_withbrief/DEPENDENCY-GRAPH.md" \
  "with brief: the dependency graph became its own artifact"
assert_not_exists "$R8_DIR/nobrief/CONTRACTS.md" \
  "no brief: no adaptive artifact is invented from nothing"

# All four markers, each exactly once, on BOTH folders — symmetrically
for R8_CASE in 2026-06-12_withbrief nobrief; do
    R8_MANIFEST="$R8_DIR/$R8_CASE/RESEARCH.md"
    for R8_MARK in 'unikit:active-summary:start' 'unikit:active-summary:end' \
                   'unikit:sessions:start' 'unikit:sessions:end'; do
        R8_N=$(grep -cF "$R8_MARK" "$R8_MANIFEST" 2>/dev/null || true)
        if [[ "$R8_N" == "1" ]]; then
            pass "$R8_CASE: $R8_MARK present exactly once"
        else
            fail "$R8_CASE: expected 1 occurrence of $R8_MARK, got '$R8_N'"
        fi
    done
    assert_contains "$R8_MANIFEST" 'Topic:' \
      "$R8_CASE: the Active Summary carries the Topic line the registry reads"
done

# The header axes: Date became Created, Updated seeded from it, Lifecycle added,
# and Status left exactly as it was (REQ-5 — renaming it kills a filter silently).
assert_contains "$R8_DIR/2026-06-12_withbrief/RESEARCH.md" 'Created: 2026-06-12' \
  "with brief: Date: became Created:"
assert_contains "$R8_DIR/2026-06-12_withbrief/RESEARCH.md" 'Updated: 2026-06-12' \
  "with brief: Updated: seeded from Created:"
assert_contains "$R8_DIR/2026-06-12_withbrief/RESEARCH.md" 'Lifecycle: active' \
  "with brief: the currency axis was added"
assert_contains "$R8_DIR/2026-06-12_withbrief/RESEARCH.md" 'Status: in-progress' \
  "with brief: the completeness axis is untouched"

# Branch 4b, asserted directly: without this the section could be green merely
# because the migration did not crash.
assert_contains "$R8_DIR/nobrief/RESEARCH.md" 'Topic: Flat research' \
  "no brief: the Topic line was seeded from the manifest H1"
assert_contains "$R8_DIR/nobrief/RESEARCH.md" 'unikit:migrated-summary' \
  "no brief: the banner naming the missing brief is present"

# Idempotence — the merge is the one step in the chain that destroys a source
R8_FILES=()
R8_SHAS=()
while IFS= read -r R8_FILE; do
    R8_FILES+=("$R8_FILE")
    R8_SHAS+=("$(sha_of "$R8_FILE")")
done < <(find "$R8_DIR" -type f | sort)

run_update "$R8" "$TMPDIR/research-merge-update-2.log"

for R8_I in "${!R8_FILES[@]}"; do
    R8_LABEL="$(basename "$(dirname "${R8_FILES[$R8_I]}")")/$(basename "${R8_FILES[$R8_I]}")"
    assert_file_unchanged "${R8_FILES[$R8_I]}" "${R8_SHAS[$R8_I]}" \
      "idempotence: $R8_LABEL byte-identical on a second update"
done

# ─────────────────────────────────────────────────────
# Section 9: plan timestamps backfill
# ─────────────────────────────────────────────────────
# Three sources of the date and one absence of selectivity, plus the second root.
# The flat `.unikit/code/PLAN.md` gets its own assert rather than riding along
# with the folders: skipping it is the ONE kind of miss that shows up on no
# folder on disk, and it surfaces two phases later — Phase 04 removes the
# file-mtime branch that serves it today, so a project with a fast plan would be
# left with no input at all for "researches newer than the plan".

echo -e "\n${BOLD}Section 9: plan timestamps backfill${NC}"

P9="$TMPDIR/plan-timestamps"; mkdir -p "$P9"
use_fake_registry "$P9" unity minimal-valid
P9_PLANS="$P9/.unikit/code/plans"
mkdir -p "$P9_PLANS/2026-03-08_customers-system" "$P9_PLANS/001-legacy-feature" \
         "$P9_PLANS/already-stamped"

# (a) dated folder name — the date comes off the name, not off the filesystem
printf '# Customers system\n\nBranch: feature/customers\nStatus: in-progress\n\n## Checklist\n\n- [ ] Task 1 open\n' \
    > "$P9_PLANS/2026-03-08_customers-system/PLAN.md"

# (b) legacy `DDD-` name AND zero open tasks — two claims in one fixture: the
#     date falls back to mtime, and a COMPLETED plan is stamped all the same
#     (the merge would have skipped it; this step has no selectivity).
printf '# Legacy feature\n\n## Checklist\n\n- [x] Task 1 shipped\n' \
    > "$P9_PLANS/001-legacy-feature/PLAN.md"

# (c) already carrying both fields — must not be rewritten
printf '# Already\n\nCreated: 2025-01-01\nUpdated: 2025-02-02\n\n## Checklist\n\n- [ ] Task 1 open\n' \
    > "$P9_PLANS/already-stamped/PLAN.md"
P9_STAMPED_SHA="$(sha_of "$P9_PLANS/already-stamped/PLAN.md")"

# (d) the flat fast plan — no folder, therefore never a dated name. An H1 and
#     nothing else: the most fragile shape for the insertion point.
printf '# fast plan\n' > "$P9/.unikit/code/PLAN.md"

run_update "$P9" "$TMPDIR/plan-timestamps-update.log"

# (a) the date came off the folder name, both fields agree
assert_contains "$P9_PLANS/2026-03-08_customers-system/PLAN.md" '^Created: 2026-03-08$' \
  "dated folder: Created: taken from the folder name"
assert_contains "$P9_PLANS/2026-03-08_customers-system/PLAN.md" '^Updated: 2026-03-08$' \
  "dated folder: Updated: seeded from Created:"
assert_contains "$P9_PLANS/2026-03-08_customers-system/PLAN.md" '^Status: in-progress$' \
  "dated folder: the existing header fields are untouched"
assert_contains "$P9_PLANS/2026-03-08_customers-system/PLAN.md" '^- \[ \] Task 1 open$' \
  "dated folder: nothing below the header was touched"

# (b) no date in the name → mtime; and a completed plan is stamped regardless
P9_LEGACY_CREATED=$(grep -E '^Created: ' "$P9_PLANS/001-legacy-feature/PLAN.md" | head -1)
P9_LEGACY_UPDATED=$(grep -E '^Updated: ' "$P9_PLANS/001-legacy-feature/PLAN.md" | head -1)
if [[ "$P9_LEGACY_CREATED" =~ ^Created:\ [0-9]{4}-[0-9]{2}-[0-9]{2}$ \
   && "${P9_LEGACY_CREATED#Created:}" == "${P9_LEGACY_UPDATED#Updated:}" ]]; then
    pass "legacy name: both fields present and equal, date derived from mtime ($P9_LEGACY_CREATED)"
else
    fail "legacy name: expected equal YYYY-MM-DD fields, got '$P9_LEGACY_CREATED' / '$P9_LEGACY_UPDATED'"
fi

# (c) an already-stamped plan is not rewritten
assert_file_unchanged "$P9_PLANS/already-stamped/PLAN.md" "$P9_STAMPED_SHA" \
  "already stamped: byte-identical — the step is a backfill, not a refresher"

# (d) THE SECOND ROOT. Its own assert, because its absence shows on no folder.
P9_FLAT_CREATED=$(grep -E '^Created: ' "$P9/.unikit/code/PLAN.md" | head -1)
P9_FLAT_UPDATED=$(grep -E '^Updated: ' "$P9/.unikit/code/PLAN.md" | head -1)
if [[ "$P9_FLAT_CREATED" =~ ^Created:\ [0-9]{4}-[0-9]{2}-[0-9]{2}$ \
   && "${P9_FLAT_CREATED#Created:}" == "${P9_FLAT_UPDATED#Updated:}" ]]; then
    pass "flat code/PLAN.md: both fields present and equal ($P9_FLAT_CREATED)"
else
    fail "flat code/PLAN.md: expected equal YYYY-MM-DD fields, got '$P9_FLAT_CREATED' / '$P9_FLAT_UPDATED'"
fi
assert_contains "$P9/.unikit/code/PLAN.md" '^# fast plan$' \
  "flat code/PLAN.md: the H1-only manifest kept its title"

# No folder is ever renamed — dateless naming is for NEW plans only (C-1, C-10)
assert_exists "$P9_PLANS/2026-03-08_customers-system" "no rename: the dated folder keeps its name"
assert_exists "$P9_PLANS/001-legacy-feature"          "no rename: the legacy folder keeps its name"
assert_exists "$P9_PLANS/already-stamped"             "no rename: the dateless folder keeps its name"

# Idempotence
P9_FILES=()
P9_SHAS=()
for P9_F in "$P9_PLANS/2026-03-08_customers-system/PLAN.md" "$P9_PLANS/001-legacy-feature/PLAN.md" \
            "$P9_PLANS/already-stamped/PLAN.md" "$P9/.unikit/code/PLAN.md"; do
    P9_FILES+=("$P9_F")
    P9_SHAS+=("$(sha_of "$P9_F")")
done

run_update "$P9" "$TMPDIR/plan-timestamps-update-2.log"

for P9_I in "${!P9_FILES[@]}"; do
    assert_file_unchanged "${P9_FILES[$P9_I]}" "${P9_SHAS[$P9_I]}" \
      "idempotence: $(basename "$(dirname "${P9_FILES[$P9_I]}")")/PLAN.md byte-identical on a second update"
done

# ─────────────────────────────────────────────────────
# Section 8c: an unreadable brief must not strand the project
# ─────────────────────────────────────────────────────
# The regression that closes the widest hole in this step: `detect` reported the
# folder pending because `## Active Summary` was absent, while `apply` refused it
# because the brief could not be read — a disagreement that never converges, so
# `rules sync` answers exit 8 that NO `update` can clear. Verbatim the failure
# the step's own `detect` comment promises cannot happen.
#
# The brief is seeded as a DIRECTORY rather than a permission-stripped file:
# `fileExists` answers true and `readTextFile` answers null on every platform,
# with no chmod that Windows would ignore.

echo -e "\n${BOLD}Section 8c: research merge — unreadable brief${NC}"

R8C="$TMPDIR/research-unreadable"; mkdir -p "$R8C"
use_fake_registry "$R8C" unity minimal-valid
R8C_DIR="$R8C/.unikit/code/researches/locked"
mkdir -p "$R8C_DIR/RESEARCH_BRIEF.md"
printf '# Locked research\n\nStatus: in-progress\n\n## Findings\n\nbody\n' \
    > "$R8C_DIR/RESEARCH_RESULT.md"

run_update "$R8C" "$TMPDIR/research-unreadable-update.log"

# The section is owed whatever the brief's state: it is the hashed object and the
# registry generator's input, not a derivative of the brief.
for R8C_MARK in 'unikit:active-summary:start' 'unikit:active-summary:end' \
                'unikit:sessions:start' 'unikit:sessions:end'; do
    R8C_N=$(grep -cF "$R8C_MARK" "$R8C_DIR/RESEARCH.md" 2>/dev/null || true)
    if [[ "$R8C_N" == "1" ]]; then
        pass "unreadable brief: $R8C_MARK present exactly once"
    else
        fail "unreadable brief: expected 1 occurrence of $R8C_MARK, got '$R8C_N'"
    fi
done
assert_contains "$R8C_DIR/RESEARCH.md" '^Topic: Locked research$' \
  "unreadable brief: Topic seeded from the manifest H1, as with no brief at all"

# Nothing is destroyed: the unreadable source stays for a human to sort out.
assert_exists "$R8C_DIR/RESEARCH_BRIEF.md" \
  "unreadable brief: the source is left in place, never removed unread"

# THE claim. A shape `apply` refuses must not be reported pending, or the project
# is stranded at exit 8 forever.
assert_cmd_exit 0 "unreadable brief: no permanent pending — rules sync exits 0" \
  "$TMPDIR/research-unreadable-sync.log" -- env -C "$R8C" node "$CLI" rules sync

# ─────────────────────────────────────────────────────
# Section 9b: a flat straggler with no plan folders beside it
# ─────────────────────────────────────────────────────
# The partially-migrated shape: the modular workspace root already exists, the
# fast plan is still flat, and there is not a single plan FOLDER to carry the
# detect. The runner evaluates `detect` for the whole chain before any `apply`
# (phase 1), so a backfill that probes only one of the two possible manifest
# locations answers false, never runs, and leaves the manifest unstamped even
# though the relocation moved it in that very pass. On a project stamped at the
# current version the version half is quiet too, so nothing rescues it — and
# `rules sync` answers exit 8 straight after a clean `update`.
#
# `use_fake_registry` stamps the CURRENT version, which is exactly the condition
# that silences the version half. That is the point of the fixture, not an
# accident of it.

echo -e "\n${BOLD}Section 9b: plan timestamps — flat straggler, no plan folders${NC}"

P9B="$TMPDIR/plan-straggler"; mkdir -p "$P9B"
use_fake_registry "$P9B" unity minimal-valid
mkdir -p "$P9B/.unikit/code"
printf '# fast plan\n\n- [ ] Task 1 open\n' > "$P9B/.unikit/PLAN.md"

run_update "$P9B" "$TMPDIR/plan-straggler-update.log"

assert_exists "$P9B/.unikit/code/PLAN.md" \
  "flat straggler: relocated under code/ by the same run"
assert_contains "$P9B/.unikit/code/PLAN.md" '^Created: [0-9]{4}-[0-9]{2}-[0-9]{2}$' \
  "flat straggler: stamped with Created: by the SAME update that relocated it"
assert_contains "$P9B/.unikit/code/PLAN.md" '^Updated: [0-9]{4}-[0-9]{2}-[0-9]{2}$' \
  "flat straggler: stamped with Updated: by the SAME update that relocated it"
assert_cmd_exit 0 "flat straggler: rules sync exits 0 right after one clean update" \
  "$TMPDIR/plan-straggler-sync.log" -- env -C "$P9B" node "$CLI" rules sync

# ─────────────────────────────────────────────────────
# Section 8d: research merge — the branches that refuse
# ─────────────────────────────────────────────────────
# Three shapes `apply` walks past without folding. Each one is a place where the
# step could lose a brief, and none of them had a test: the guard that protects
# against data loss is exactly the guard nothing was exercising. All three live
# in ONE project so that `apply` walks every folder — a folder whose own `detect`
# is false is still visited when a sibling carries the run.

echo -e "\n${BOLD}Section 8d: research merge — refusing branches keep the brief${NC}"

R8D="$TMPDIR/research-refusals"; mkdir -p "$R8D"
use_fake_registry "$R8D" unity minimal-valid
R8D_DIR="$R8D/.unikit/code/researches"
mkdir -p "$R8D_DIR/stray-end" "$R8D_DIR/already-folded" "$R8D_DIR/both-dates"

# (a) a manifest carrying a STRAY end-marker. The summary write then produces a
#     second `end`, `manifestVerified` refuses the result, and the brief must
#     survive — this is the verify-then-delete guard, and the only reason an
#     interrupted or malformed write does not cost the brief's content.
printf '# Stray end\n\nStatus: in-progress\n\n## Findings\n\nbody\n<!-- unikit:active-summary:end -->\n' \
    > "$R8D_DIR/stray-end/RESEARCH_RESULT.md"
printf '# Brief\n\n## CONTEXT\n\nreal content worth keeping\n' \
    > "$R8D_DIR/stray-end/RESEARCH_BRIEF.md"
R8D_STRAY_BRIEF_SHA="$(sha_of "$R8D_DIR/stray-end/RESEARCH_BRIEF.md")"

# (b) already folded, with a brief still beside it. The manifest wins; the brief
#     is never folded twice and never deleted unread.
printf '# Already folded\n\nStatus: in-progress\nLifecycle: active\n\n## Active Summary\n<!-- unikit:active-summary:start -->\nTopic: hand-written\n<!-- unikit:active-summary:end -->\n\n## Sessions\n<!-- unikit:sessions:start -->\n\n### seeded\n\n<!-- unikit:sessions:end -->\n' \
    > "$R8D_DIR/already-folded/RESEARCH.md"
printf '# Brief\n\n## CONTEXT\n\nstale copy\n' \
    > "$R8D_DIR/already-folded/RESEARCH_BRIEF.md"
R8D_FOLDED_BRIEF_SHA="$(sha_of "$R8D_DIR/already-folded/RESEARCH_BRIEF.md")"
R8D_FOLDED_SUMMARY_SHA="$(sha_of "$R8D_DIR/already-folded/RESEARCH.md")"

# (c) both `Date:` and `Created:` present — the legacy line is dropped, and the
#     value already recorded under the new name is the one that survives.
printf '# Both dates\n\nDate: 2020-01-01\nCreated: 2026-06-12\nStatus: in-progress\n\n## Findings\n\nbody\n' \
    > "$R8D_DIR/both-dates/RESEARCH_RESULT.md"

run_update "$R8D" "$TMPDIR/research-refusals-update.log"

# (a) the write was refused and the brief is byte-identical
assert_file_unchanged "$R8D_DIR/stray-end/RESEARCH_BRIEF.md" "$R8D_STRAY_BRIEF_SHA" \
  "stray end-marker: the unverified write cost the brief nothing"

# (b) the manifest's own summary is untouched and the brief survives
assert_file_unchanged "$R8D_DIR/already-folded/RESEARCH.md" "$R8D_FOLDED_SUMMARY_SHA" \
  "already folded: the hand-written summary is not overwritten"
assert_file_unchanged "$R8D_DIR/already-folded/RESEARCH_BRIEF.md" "$R8D_FOLDED_BRIEF_SHA" \
  "already folded: the brief is left for a human, never deleted unread"

# (c) one date axis survives, and it is the one under the new name
assert_not_contains "$R8D_DIR/both-dates/RESEARCH.md" '^Date: ' \
  "both dates: the legacy Date: line is dropped"
assert_contains "$R8D_DIR/both-dates/RESEARCH.md" '^Created: 2026-06-12$' \
  "both dates: the value already under Created: is the one kept"

# None of the three may leave the project pending — a refused shape reported as
# work is the exit-8 trap this whole family of branches has to avoid.
assert_cmd_exit 0 "refusing branches: no permanent pending — rules sync exits 0" \
  "$TMPDIR/research-refusals-sync.log" -- env -C "$R8D" node "$CLI" rules sync

# ─────────────────────────────────────────────────────
# Section 9c: a leftover flat manifest beside a modular one
# ─────────────────────────────────────────────────────
# The other direction of the same resolver. When both manifests exist the
# relocation refuses to overwrite and the flat copy becomes a leftover no step
# will ever touch — so `detect` must NOT judge it. Probing both paths
# unconditionally would report it pending forever and strand the project at
# exit 8 with nothing able to clear it, which is why the gate is the modular
# MANIFEST rather than "either file that needs a stamp".

echo -e "\n${BOLD}Section 9c: plan timestamps — leftover flat manifest${NC}"

P9C="$TMPDIR/plan-leftover"; mkdir -p "$P9C"
use_fake_registry "$P9C" unity minimal-valid
mkdir -p "$P9C/.unikit/code"
printf '# modular fast plan\n\nCreated: 2026-01-01\nUpdated: 2026-01-01\n\n- [ ] Task 1 open\n' \
    > "$P9C/.unikit/code/PLAN.md"
printf '# leftover flat plan\n\n- [ ] Task 1 open\n' > "$P9C/.unikit/PLAN.md"
P9C_MODULAR_SHA="$(sha_of "$P9C/.unikit/code/PLAN.md")"
P9C_LEFTOVER_SHA="$(sha_of "$P9C/.unikit/PLAN.md")"

run_update "$P9C" "$TMPDIR/plan-leftover-update.log"

assert_file_unchanged "$P9C/.unikit/code/PLAN.md" "$P9C_MODULAR_SHA" \
  "leftover: the stamped modular manifest is not re-stamped"
assert_file_unchanged "$P9C/.unikit/PLAN.md" "$P9C_LEFTOVER_SHA" \
  "leftover: the flat copy is left exactly as it is"
assert_cmd_exit 0 "leftover: an untouchable flat copy never strands the project" \
  "$TMPDIR/plan-leftover-sync.log" -- env -C "$P9C" node "$CLI" rules sync

# ─────────────────────────────────────────────────────
# Section 9d: a folder the merge renames in this very pass
# ─────────────────────────────────────────────────────
# The third shape of the same asymmetry, and the one no fixture covered: the
# manifest the backfill stamps DOES NOT EXIST YET when `detect` runs. The runner
# evaluates `detect` for the whole chain before any `apply` (phase 1), so on a
# folder still carrying `TASKS.md` the backfill probes a path that
# `plan-1-to-2-manifest-merge` is about to create, answers false, and is left
# out of `pendingIds` entirely. The merge then renames the file, `update`
# reports success, and the NEXT `detect` — now seeing a `PLAN.md` without the
# fields — declares work pending: `rules sync` answers exit 8 straight after a
# clean run, with nothing able to clear it but a second `update`.
#
# `use_fake_registry` stamps the CURRENT version, which silences the version
# half. That is the condition the defect needs, not an accident of the fixture:
# on a version-pending project the backfill runs regardless and the asymmetry is
# invisible. Every dev project running `npm link` before publication is stamped
# this way, and so is any project whose earlier merge skipped one folder on a
# per-folder error while the chain as a whole completed and stamped the version.

echo -e "\n${BOLD}Section 9d: plan timestamps — a manifest created by the merge in the same pass${NC}"

P9D="$TMPDIR/plan-unmerged"; mkdir -p "$P9D"
use_fake_registry "$P9D" unity minimal-valid
P9D_FOLDER="$P9D/.unikit/code/plans/2026-03-08_live"
mkdir -p "$P9D_FOLDER"
printf '# tasks\n\n## Checklist\n\n- [ ] Task 1 open\n' > "$P9D_FOLDER/TASKS.md"

run_update "$P9D" "$TMPDIR/plan-unmerged-update.log"

# The merge half really did run — without this the section could go green on a
# project where nothing happened at all.
assert_exists     "$P9D_FOLDER/PLAN.md"  "unmerged folder: TASKS.md was renamed to the manifest"
assert_not_exists "$P9D_FOLDER/TASKS.md" "unmerged folder: the legacy checklist name is gone"

# And the backfill reached the file the merge had just created.
assert_contains "$P9D_FOLDER/PLAN.md" '^Created: 2026-03-08$' \
  "unmerged folder: stamped with Created: by the SAME update that merged it"
assert_contains "$P9D_FOLDER/PLAN.md" '^Updated: 2026-03-08$' \
  "unmerged folder: stamped with Updated: by the SAME update that merged it"

assert_cmd_exit 0 "unmerged folder: rules sync exits 0 right after one clean update" \
  "$TMPDIR/plan-unmerged-sync.log" -- env -C "$P9D" node "$CLI" rules sync

# ─────────────────────────────────────────────────────
# Section 9e: a completed plan, which the merge never renames
# ─────────────────────────────────────────────────────
# The other half of the same resolver. `plan-1-to-2-manifest-merge` is selective
# and leaves a folder with zero open tasks exactly as it is — FOREVER — so its
# plan file keeps the name `TASKS.md` and a `PLAN.md` never appears there. A
# backfill that knows only one file name therefore skips the very folders its
# own contract singles out (no selectivity: completed plans are stamped too,
# because `--list` and latest-by-Updated enumerate them), and prints a warning
# about an unreadable manifest for each of them on every upgrade — `logWarn` is
# not behind the verbose gate, so the noise is permanent and reads like an I/O
# error rather than a shape the migration chose to leave alone.
#
# Version-pending on purpose: this is what a real 1.x upgrade prints, and it is
# the only state in which the step runs over a folder its own `detect` would not
# have reported.

echo -e "\n${BOLD}Section 9e: plan timestamps — a completed plan keeps its own file name${NC}"

P9E="$TMPDIR/plan-completed-stamp"; mkdir -p "$P9E"
use_fake_registry "$P9E" unity minimal-valid
stamp_config_version "$P9E" "1.1.0"
P9E_FOLDER="$P9E/.unikit/code/plans/2026-06-12_completed"
mkdir -p "$P9E_FOLDER"
printf '# tasks\n\n## Checklist\n\n- [x] Task 1 shipped\n' > "$P9E_FOLDER/TASKS.md"

run_update "$P9E" "$TMPDIR/plan-completed-update.log"

# Selectivity is untouched: the merge still refuses to rename a completed plan.
assert_not_exists "$P9E_FOLDER/PLAN.md" \
  "completed plan: the merge created no manifest (selectivity intact)"

# But the backfill did stamp the file that IS this folder's plan.
assert_contains "$P9E_FOLDER/TASKS.md" '^Created: 2026-06-12$' \
  "completed plan: stamped with Created: under its own file name"
assert_contains "$P9E_FOLDER/TASKS.md" '^Updated: 2026-06-12$' \
  "completed plan: stamped with Updated: under its own file name"
assert_contains "$P9E_FOLDER/TASKS.md" '^- \[x\] Task 1 shipped$' \
  "completed plan: nothing below the header was touched"

# And it said nothing about an unreadable manifest — the folder is a shape the
# chain understands, not a failure to read a file.
assert_not_contains "$TMPDIR/plan-completed-update.log" 'no readable manifest' \
  "completed plan: no WARN about a manifest that was never supposed to exist"

P9E_SHA="$(sha_of "$P9E_FOLDER/TASKS.md")"
run_update "$P9E" "$TMPDIR/plan-completed-update-2.log"
assert_file_unchanged "$P9E_FOLDER/TASKS.md" "$P9E_SHA" \
  "completed plan: byte-identical on a second update"
assert_cmd_exit 0 "completed plan: rules sync exits 0 after the upgrade" \
  "$TMPDIR/plan-completed-sync.log" -- env -C "$P9E" node "$CLI" rules sync

# ─────────────────────────────────────────────────────
# Section 8e: the dependency-graph fold is entered twice
# ─────────────────────────────────────────────────────
# The adaptive artifacts are written BEFORE the manifest, and the manifest write
# is the one that can throw — `apply` catches per folder and the run completes,
# so the next `update` re-enters the same branch with `DEPENDENCY-GRAPH.md`
# already on disk. An append with no idempotence check then files the graph a
# second time under a second copy of its own source heading.
#
# The fixture IS that post-crash state, seeded directly rather than produced by
# forcing a write to fail: the manifest never got its `## Active Summary`, while
# the artifacts of the interrupted run are already there.

echo -e "\n${BOLD}Section 8e: research merge — a retried dependency-graph fold${NC}"

R8E="$TMPDIR/research-graph-retry"; mkdir -p "$R8E"
use_fake_registry "$R8E" unity minimal-valid
R8E_FOLDER="$R8E/.unikit/code/researches/retried"
mkdir -p "$R8E_FOLDER"
printf '# Retried\n\nStatus: in-progress\n\n## Findings\n\nbody\n' > "$R8E_FOLDER/RESEARCH.md"
printf '# Brief\n\n## CONTEXT\n\ncache the search\n\n## DEPENDENCY GRAPH\n\nA to B\n' \
    > "$R8E_FOLDER/RESEARCH_BRIEF.md"
printf '## From RESEARCH_BRIEF.md\n\nA to B\n' > "$R8E_FOLDER/DEPENDENCY-GRAPH.md"

run_update "$R8E" "$TMPDIR/research-graph-retry-update.log"

R8E_BLOCKS=$(grep -cF '## From RESEARCH_BRIEF.md' "$R8E_FOLDER/DEPENDENCY-GRAPH.md" 2>/dev/null || echo 0)
if [[ "$R8E_BLOCKS" == "1" ]]; then
    pass "retried fold: the graph carries exactly one source block, not two"
else
    fail "retried fold: expected 1 source block in DEPENDENCY-GRAPH.md, got '$R8E_BLOCKS'"
fi
assert_contains "$R8E_FOLDER/DEPENDENCY-GRAPH.md" '^A to B$' \
  "retried fold: the graph the interrupted run wrote is still there"
assert_cmd_exit 0 "retried fold: rules sync exits 0 once the folder converges" \
  "$TMPDIR/research-graph-retry-sync.log" -- env -C "$R8E" node "$CLI" rules sync

print_summary_and_exit "Migration + MCP reconciliation Smoke Tests"
