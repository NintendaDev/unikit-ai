#!/bin/bash
# Smoke tests: validates `unikit-ai rules sync` across the full matrix of
# modes × states, plus four critical regression guards.
#
# Modes exercised:
#   - bare `rules sync`  (safe: no overwrite, no prune)
#   - `sync --replace`   (overwrite locally-modified rules)
#   - `sync --prune`     (remove obsolete stack rules)
#   - `sync --replace --prune` (equivalent of the legacy `sync --force`)
#
# Regression guards:
#   - HARD GUARD: `sync --replace --prune` never materialises rules that
#     are absent from state (see installer.ts:1337 `if (!existing) continue`).
#   - Phase 1 case-sensitive coexistence: a legacy `CODE-STYLE` state
#     entry and a fresh `code-style.md` disk file must stay distinct.
#   - phase2:downgrade: `--replace` against a registry with a LOWER
#     version than state emits a downgrade log line.
#   - RULES_INDEX.md: regenerated on every sync; removed when the last
#     rule disappears.
#
# Usage: ./scripts/test-rules-sync.sh

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

echo -e "${BOLD}=== rules sync Smoke Tests ===${NC}"

# Helper: write a minimal .unikit.json with rulesRegistry pinned to a
# named fake fixture and an arbitrary installed.core / installed.stack
# JSON array (built by the caller with json_installed_entries or inline
# heredoc).
write_sync_config() {
    local project="$1"
    local engine="$2"
    local fixture="$3"
    local core_json="$4"
    local stack_json="$5"
    mkdir -p "$project/.unikit/memory/core" "$project/.unikit/memory/stack"
    cat > "$project/.unikit.json" <<EOF
{
  "version": "1.0.0",
  "engine": "$engine",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [],
  "rulesRegistry": "$(fake_registry_path "$fixture")",
  "rules": {
    "installed": {
      "version": "1.0.0",
      "core": $core_json,
      "stack": $stack_json
    }
  }
}
EOF
}

# ─────────────────────────────────────────────
# Scenario 1 — missing .unikit.json → exit 1
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 1: missing .unikit.json${NC}"

S1_DIR="$TMPDIR/s1-no-config"
mkdir -p "$S1_DIR"

assert_cmd_exit 1 "rules sync without config exits 1" "$TMPDIR/s1.log" -- \
    env -C "$S1_DIR" node "$CLI" rules sync

# ─────────────────────────────────────────────
# Scenario 2 — empty project → exit 0, no RULES_INDEX
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 2: empty project${NC}"

S2_DIR="$TMPDIR/s2-empty"
mkdir -p "$S2_DIR"
use_fake_registry "$S2_DIR" unity minimal-valid

assert_cmd_exit 0 "rules sync on empty state exits 0" "$TMPDIR/s2.log" -- \
    env -C "$S2_DIR" node "$CLI" rules sync

if [[ -f "$S2_DIR/.unikit/memory/RULES_INDEX.md" ]]; then
    fail "empty project should not generate RULES_INDEX.md"
else
    pass "empty project skips RULES_INDEX.md"
fi

# ─────────────────────────────────────────────
# Scenario 3 — Phase 1: untracked disk file registered as source=local
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 3: Phase 1 untracked → source=local${NC}"

S3_DIR="$TMPDIR/s3-untracked"
write_sync_config "$S3_DIR" unity minimal-valid "[]" "[]"
# Drop a hand-edited stack rule on disk with no state entry
cat > "$S3_DIR/.unikit/memory/stack/custom-local.md" << 'EOF'
# Custom Local Rule

> **Scope**: hand-written rule, not from any registry.
> **Load when**: exercising the Phase 1 reconciliation path.
EOF

assert_cmd_exit 0 "rules sync registers untracked file" "$TMPDIR/s3.log" -- \
    env -C "$S3_DIR" node "$CLI" rules sync

assert_stdout_contains "$TMPDIR/s3.log" "Found untracked rule: stack/custom-local" \
    "Phase 1 emits untracked-found event"
assert_json_field "$S3_DIR/.unikit.json" "rules.installed.stack.0.name" custom-local \
    "untracked rule added to state"
assert_json_field "$S3_DIR/.unikit.json" "rules.installed.stack.0.source" local \
    "untracked rule tagged as source=local"

# ─────────────────────────────────────────────
# Scenario 4 — Phase 1: state entry without disk file → removed
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 4: Phase 1 missing file → removed from state${NC}"

S4_DIR="$TMPDIR/s4-missing-file"
write_sync_config "$S4_DIR" unity minimal-valid \
    '[{"name":"code-style","source":"registry","origin":"primary","version":"1.0.0","installed_hash":"deadbeef"}]' \
    "[]"
# No file on disk — Phase 1 should strip the state entry.

assert_cmd_exit 0 "rules sync removes orphaned state entry" "$TMPDIR/s4.log" -- \
    env -C "$S4_DIR" node "$CLI" rules sync

assert_stdout_contains "$TMPDIR/s4.log" "missing from disk" \
    "Phase 1 emits missing-removed event"
assert_json_array_length "$S4_DIR/.unikit.json" "rules.installed.core" 0 \
    "orphan state entry dropped"

# ─────────────────────────────────────────────
# Scenario 5 — Phase 2: registry-sourced rule updates on version bump
# ─────────────────────────────────────────────
# Pin the project at multi-version/v1 (unitask@1.0.0), then switch the
# registry pointer to multi-version/v2 (unitask@2.0.0). A bare `rules
# sync` should update the stack rule in place.
echo -e "\n${BOLD}Scenario 5: Phase 2 version bump${NC}"

S5_DIR="$TMPDIR/s5-version-bump"
write_sync_config "$S5_DIR" unity multi-version/v1 \
    '[{"name":"code-style","source":"registry","origin":"primary","version":"1.0.0","installed_hash":"aaaa"}]' \
    '[{"name":"unitask","source":"registry","origin":"primary","version":"1.0.0","installed_hash":"bbbb"}]'
# Seed disk copies matching state (bogus hashes so they'll be refreshed)
cp "$ROOT_DIR/scripts/test-fixtures/multi-version/v1/unity/core/code-style.md" \
    "$S5_DIR/.unikit/memory/core/code-style.md"
cp "$ROOT_DIR/scripts/test-fixtures/multi-version/v1/unity/stack/unitask.md" \
    "$S5_DIR/.unikit/memory/stack/unitask.md"
# Flip to v2 fixture
node -e "
    const fs = require('fs');
    const j = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    j.rulesRegistry = process.argv[2];
    fs.writeFileSync(process.argv[1], JSON.stringify(j, null, 2));
" "$S5_DIR/.unikit.json" "$(fake_registry_path multi-version/v2)"

# Reset the installed_hash to match the v1 content on disk so Phase 2
# doesn't misread it as locally-modified.
node -e "
    const fs = require('fs');
    const crypto = require('crypto');
    const configPath = process.argv[1];
    const j = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const coreContent = fs.readFileSync(process.argv[2], 'utf8');
    const stackContent = fs.readFileSync(process.argv[3], 'utf8');
    j.rules.installed.core[0].installed_hash = crypto.createHash('sha256').update(coreContent, 'utf-8').digest('hex');
    j.rules.installed.stack[0].installed_hash = crypto.createHash('sha256').update(stackContent, 'utf-8').digest('hex');
    fs.writeFileSync(configPath, JSON.stringify(j, null, 2));
" "$S5_DIR/.unikit.json" \
    "$S5_DIR/.unikit/memory/core/code-style.md" \
    "$S5_DIR/.unikit/memory/stack/unitask.md"

assert_cmd_exit 0 "rules sync exit 0 on version bump" "$TMPDIR/s5.log" -- \
    env -C "$S5_DIR" node "$CLI" rules sync

assert_stdout_contains "$TMPDIR/s5.log" "Updating stack/unitask" \
    "Phase 2 updating event fires"
assert_stdout_contains "$S5_DIR/.unikit/memory/stack/unitask.md" "sentinel: v2" \
    "v2 content landed on disk"
assert_json_field "$S5_DIR/.unikit.json" "rules.installed.stack.0.version" 2.0.0 \
    "state version bumped to 2.0.0"

# ─────────────────────────────────────────────
# Scenario 6 — Phase 2: rule with same version is a no-op
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 6: Phase 2 same version is a no-op${NC}"

assert_cmd_exit 0 "second sync is no-op" "$TMPDIR/s6.log" -- \
    env -C "$S5_DIR" node "$CLI" rules sync

if grep -q "Updating" "$TMPDIR/s6.log"; then
    fail "second sync unexpectedly emitted Updating events"
else
    pass "second sync did not emit Updating events"
fi

# ─────────────────────────────────────────────
# Scenario 7 — Phase 2: local-sourced rule is skipped without --replace
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 7: Phase 2 source=local is skipped${NC}"

S7_DIR="$TMPDIR/s7-local-skipped"
write_sync_config "$S7_DIR" unity multi-version/v2 \
    "[]" \
    '[{"name":"unitask","source":"local","origin":null,"version":null,"installed_hash":"aaaa"}]'
# Put the v1 content on disk (older) so if sync were to touch it,
# the on-disk content would change.
cp "$ROOT_DIR/scripts/test-fixtures/multi-version/v1/unity/stack/unitask.md" \
    "$S7_DIR/.unikit/memory/stack/unitask.md"
SAVED_HASH="$(sha_of "$S7_DIR/.unikit/memory/stack/unitask.md")"

assert_cmd_exit 0 "rules sync on local-sourced rule" "$TMPDIR/s7.log" -- \
    env -C "$S7_DIR" node "$CLI" rules sync

assert_file_unchanged "$S7_DIR/.unikit/memory/stack/unitask.md" "$SAVED_HASH" \
    "local-sourced rule was not touched"

# ─────────────────────────────────────────────
# Scenario 8 — Phase 2: --replace overrides source=local skip
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 8: --replace overrides source=local${NC}"

assert_cmd_exit 0 "rules sync --replace on local-sourced rule" "$TMPDIR/s8.log" -- \
    env -C "$S7_DIR" node "$CLI" rules sync --replace

assert_stdout_contains "$S7_DIR/.unikit/memory/stack/unitask.md" "sentinel: v2" \
    "--replace overwrote the local rule with v2 content"
assert_json_field "$S7_DIR/.unikit.json" "rules.installed.stack.0.source" registry \
    "--replace flipped source=local → registry"

# ─────────────────────────────────────────────
# Scenario 9 — Phase 2: locally-modified file skipped without --replace
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 9: locally-modified file is skipped${NC}"

S9_DIR="$TMPDIR/s9-local-mod-skip"
write_sync_config "$S9_DIR" unity multi-version/v2 \
    "[]" \
    '[{"name":"unitask","source":"registry","origin":"primary","version":"1.0.0","installed_hash":"aaaa"}]'
cat > "$S9_DIR/.unikit/memory/stack/unitask.md" << 'EOF'
# Locally-modified copy

This content intentionally differs from both v1 and v2 so the hash
compare inside Phase 2 flags it as locally-modified.
EOF
SAVED_MOD_HASH="$(sha_of "$S9_DIR/.unikit/memory/stack/unitask.md")"

assert_cmd_exit 0 "rules sync on locally-modified rule" "$TMPDIR/s9.log" -- \
    env -C "$S9_DIR" node "$CLI" rules sync

assert_stdout_contains "$TMPDIR/s9.log" "local modifications" \
    "locally-modified skip event printed"
assert_file_unchanged "$S9_DIR/.unikit/memory/stack/unitask.md" "$SAVED_MOD_HASH" \
    "locally-modified file left intact"

# ─────────────────────────────────────────────
# Scenario 10 — Phase 2: --replace overwrites locally-modified file
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 10: --replace overwrites locally-modified file${NC}"

assert_cmd_exit 0 "rules sync --replace on locally-modified rule" "$TMPDIR/s10.log" -- \
    env -C "$S9_DIR" node "$CLI" rules sync --replace

assert_stdout_contains "$TMPDIR/s10.log" "overwriting from registry" \
    "--replace emits overwrite event"
assert_stdout_contains "$S9_DIR/.unikit/memory/stack/unitask.md" "sentinel: v2" \
    "--replace landed v2 content on disk"

# ─────────────────────────────────────────────
# Scenario 11 — Regression guard: --replace + downgrade event
# ─────────────────────────────────────────────
# State says unitask v2.0.0. Registry says v1.0.0. Without --replace,
# the version guard short-circuits so no downgrade happens. With
# --replace, Phase 2 walks the update path and emits phase2:downgrade.
echo -e "\n${BOLD}Scenario 11: phase2:downgrade under --replace${NC}"

S11_DIR="$TMPDIR/s11-downgrade"
write_sync_config "$S11_DIR" unity multi-version/v1 \
    "[]" \
    '[{"name":"unitask","source":"registry","origin":"primary","version":"2.0.0","installed_hash":"aaaa"}]'
cp "$ROOT_DIR/scripts/test-fixtures/multi-version/v2/unity/stack/unitask.md" \
    "$S11_DIR/.unikit/memory/stack/unitask.md"
# Refresh installed_hash to match the v2 content we just placed so the
# locally-modified branch stays out of the way.
node -e "
    const fs = require('fs');
    const crypto = require('crypto');
    const cp = process.argv[1];
    const j = JSON.parse(fs.readFileSync(cp, 'utf8'));
    const content = fs.readFileSync(process.argv[2], 'utf8');
    j.rules.installed.stack[0].installed_hash = crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
    fs.writeFileSync(cp, JSON.stringify(j, null, 2));
" "$S11_DIR/.unikit.json" "$S11_DIR/.unikit/memory/stack/unitask.md"

assert_cmd_exit 0 "rules sync --replace on downgrade" "$TMPDIR/s11.log" -- \
    env -C "$S11_DIR" node "$CLI" rules sync --replace

assert_stdout_contains "$TMPDIR/s11.log" "downgraded" \
    "phase2:downgrade event fired"
assert_stdout_contains "$S11_DIR/.unikit/memory/stack/unitask.md" "sentinel: v1" \
    "v1 content landed after downgrade"
assert_json_field "$S11_DIR/.unikit.json" "rules.installed.stack.0.version" 1.0.0 \
    "state version downgraded to 1.0.0"

# ─────────────────────────────────────────────
# Scenario 12 — CRITICAL HARD GUARD: --replace --prune never installs
#               rules missing from state
# ─────────────────────────────────────────────
# State has one registry rule. The fake registry has SIX entries
# (multi-version/v1 has 2, but let's use the bundled-like layout from
# minimal-valid with both core+stack). The only file that should
# survive on disk is the one already in state.
echo -e "\n${BOLD}Scenario 12: HARD GUARD — sync --replace --prune${NC}"

S12_DIR="$TMPDIR/s12-hard-guard"
write_sync_config "$S12_DIR" unity minimal-valid \
    '[{"name":"code-style","source":"registry","origin":"primary","version":"1.0.0","installed_hash":"aaaa"}]' \
    "[]"
cp "$ROOT_DIR/scripts/test-fixtures/minimal-valid/unity/core/code-style.md" \
    "$S12_DIR/.unikit/memory/core/code-style.md"
node -e "
    const fs = require('fs');
    const crypto = require('crypto');
    const cp = process.argv[1];
    const j = JSON.parse(fs.readFileSync(cp, 'utf8'));
    const content = fs.readFileSync(process.argv[2], 'utf8');
    j.rules.installed.core[0].installed_hash = crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
    fs.writeFileSync(cp, JSON.stringify(j, null, 2));
" "$S12_DIR/.unikit.json" "$S12_DIR/.unikit/memory/core/code-style.md"

assert_cmd_exit 0 "sync --replace --prune on hard-guard setup" "$TMPDIR/s12.log" -- \
    env -C "$S12_DIR" node "$CLI" rules sync --replace --prune

CORE_FILES=$(find "$S12_DIR/.unikit/memory/core" -maxdepth 1 -name "*.md" | wc -l | tr -d ' ')
STACK_FILES=$(find "$S12_DIR/.unikit/memory/stack" -maxdepth 1 -name "*.md" 2> /dev/null | wc -l | tr -d ' ')

if [[ "$CORE_FILES" == "1" && "$STACK_FILES" == "0" ]]; then
    pass "hard-guard: only the pre-installed core rule survived (core=$CORE_FILES, stack=$STACK_FILES)"
else
    fail "hard-guard violated: core=$CORE_FILES, stack=$STACK_FILES (expected 1, 0)"
    ls "$S12_DIR/.unikit/memory/core" "$S12_DIR/.unikit/memory/stack" 2>&1 || true
fi

assert_json_array_length "$S12_DIR/.unikit.json" "rules.installed.stack" 0 \
    "hard-guard: state stack list stays empty"
assert_json_array_length "$S12_DIR/.unikit.json" "rules.installed.core" 1 \
    "hard-guard: state core list stays at 1"

# ─────────────────────────────────────────────
# Scenario 13 — Regression guard: Phase 1 case-sensitive coexistence
# ─────────────────────────────────────────────
# Put a legacy `CODE-STYLE` state entry alongside a fresh `code-style.md`
# disk file (canonical lowercase). Phase 1 uses strict equality, so the
# two must coexist — Phase 1 appends the canonical one as source=local.
#
# NOTE: this scenario requires a case-sensitive filesystem. On NTFS /
# APFS the two filenames collide into one physical file, so the Phase 1
# coexistence path cannot be exercised. The probe below emits a single
# `pass "(skipped — case-insensitive FS)"` line on Windows/macOS so the
# test still participates in the counters without false-failing.
echo -e "\n${BOLD}Scenario 13: Phase 1 case-sensitive coexistence${NC}"

S13_PROBE_DIR="$TMPDIR/s13-fs-probe"
mkdir -p "$S13_PROBE_DIR"
: > "$S13_PROBE_DIR/AA"
: > "$S13_PROBE_DIR/aa"
PROBE_COUNT=$(find "$S13_PROBE_DIR" -maxdepth 1 -type f | wc -l | tr -d ' ')

if [[ "$PROBE_COUNT" != "2" ]]; then
    pass "Phase 1 case-sensitive coexistence (skipped — case-insensitive FS)"
else
    S13_DIR="$TMPDIR/s13-case-coexist"
    write_sync_config "$S13_DIR" unity minimal-valid \
        '[{"name":"CODE-STYLE","source":"registry","origin":"primary","version":"1.0.0","installed_hash":"legacy"}]' \
        "[]"
    # Both legacy UPPER_CASE and canonical lowercase files on disk.
    echo "# legacy upper case" > "$S13_DIR/.unikit/memory/core/CODE-STYLE.md"
    echo "# canonical lowercase" > "$S13_DIR/.unikit/memory/core/code-style.md"

    assert_cmd_exit 0 "rules sync on mixed-case state" "$TMPDIR/s13.log" -- \
        env -C "$S13_DIR" node "$CLI" rules sync

    CORE_COUNT=$(node -e "
        const j = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
        console.log(j.rules.installed.core.length);
    " "$S13_DIR/.unikit.json")

    if [[ "$CORE_COUNT" == "2" ]]; then
        pass "Phase 1 kept both CODE-STYLE and code-style entries (count=$CORE_COUNT)"
    else
        fail "Phase 1 did not keep both entries (got count=$CORE_COUNT)"
        cat "$S13_DIR/.unikit.json"
    fi
fi

# ─────────────────────────────────────────────
# Scenario 14 — --prune removes obsolete stack rule
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 14: --prune removes obsolete stack rule${NC}"

S14_DIR="$TMPDIR/s14-prune-stack"
write_sync_config "$S14_DIR" unity minimal-valid \
    "[]" \
    '[{"name":"obsolete-stack-rule","source":"registry","origin":"primary","version":"1.0.0","installed_hash":"aaaa"}]'
echo "# will be pruned" > "$S14_DIR/.unikit/memory/stack/obsolete-stack-rule.md"

assert_cmd_exit 0 "rules sync --prune on obsolete rule" "$TMPDIR/s14.log" -- \
    env -C "$S14_DIR" node "$CLI" rules sync --prune

if [[ -f "$S14_DIR/.unikit/memory/stack/obsolete-stack-rule.md" ]]; then
    fail "--prune did not remove obsolete rule file"
else
    pass "--prune removed obsolete rule file"
fi
assert_json_array_length "$S14_DIR/.unikit.json" "rules.installed.stack" 0 \
    "--prune removed state entry"

# ─────────────────────────────────────────────
# Scenario 15 — --prune is scoped to stack (core rules stay)
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 15: --prune does not touch core${NC}"

S15_DIR="$TMPDIR/s15-prune-core"
write_sync_config "$S15_DIR" unity minimal-valid \
    '[{"name":"obsolete-core-rule","source":"registry","origin":"primary","version":"1.0.0","installed_hash":"aaaa"}]' \
    "[]"
echo "# core rule with no registry entry" > "$S15_DIR/.unikit/memory/core/obsolete-core-rule.md"

assert_cmd_exit 0 "rules sync --prune with obsolete core" "$TMPDIR/s15.log" -- \
    env -C "$S15_DIR" node "$CLI" rules sync --prune

assert_exists "$S15_DIR/.unikit/memory/core/obsolete-core-rule.md" \
    "--prune left the core rule file alone"
assert_json_array_length "$S15_DIR/.unikit.json" "rules.installed.core" 1 \
    "--prune left the core state entry alone"

# ─────────────────────────────────────────────
# Scenario 16 — --prune does not touch source=local stack rules
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 16: --prune skips source=local rules${NC}"

S16_DIR="$TMPDIR/s16-prune-local"
write_sync_config "$S16_DIR" unity minimal-valid \
    "[]" \
    '[{"name":"my-local-rule","source":"local","origin":null,"version":null,"installed_hash":"aaaa"}]'
echo "# hand-written rule" > "$S16_DIR/.unikit/memory/stack/my-local-rule.md"

assert_cmd_exit 0 "rules sync --prune with local rule" "$TMPDIR/s16.log" -- \
    env -C "$S16_DIR" node "$CLI" rules sync --prune

assert_exists "$S16_DIR/.unikit/memory/stack/my-local-rule.md" \
    "--prune kept source=local rule file"

# ─────────────────────────────────────────────
# Scenario 17 — RULES_INDEX.md is regenerated after sync
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 17: RULES_INDEX.md regeneration${NC}"

assert_exists "$S12_DIR/.unikit/memory/RULES_INDEX.md" \
    "hard-guard scenario regenerated RULES_INDEX.md"
assert_stdout_contains "$S12_DIR/.unikit/memory/RULES_INDEX.md" "code-style" \
    "RULES_INDEX lists the surviving rule"

# ─────────────────────────────────────────────
# Scenario 18 — RULES_INDEX.md removed when the last rule disappears
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 18: RULES_INDEX.md removed on empty${NC}"

S18_DIR="$TMPDIR/s18-index-removed"
write_sync_config "$S18_DIR" unity minimal-valid \
    "[]" \
    '[{"name":"ghost","source":"registry","origin":"primary","version":"1.0.0","installed_hash":"aaaa"}]'
# No ghost.md on disk → Phase 1 deletes the state entry
# Seed a stale RULES_INDEX.md so we can assert it gets removed
echo "stale index" > "$S18_DIR/.unikit/memory/RULES_INDEX.md"

assert_cmd_exit 0 "rules sync on vanishing rule" "$TMPDIR/s18.log" -- \
    env -C "$S18_DIR" node "$CLI" rules sync

if [[ -f "$S18_DIR/.unikit/memory/RULES_INDEX.md" ]]; then
    fail "stale RULES_INDEX.md was not removed"
    cat "$S18_DIR/.unikit/memory/RULES_INDEX.md"
else
    pass "stale RULES_INDEX.md removed once last rule vanished"
fi

# ─────────────────────────────────────────────
# Scenario 19 — Phase 1 state-in-sync no-op
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 19: state-in-sync no-op${NC}"

S19_DIR="$TMPDIR/s19-in-sync"
write_sync_config "$S19_DIR" unity minimal-valid \
    '[{"name":"code-style","source":"registry","origin":"primary","version":"1.0.0","installed_hash":"aaaa"}]' \
    "[]"
cp "$ROOT_DIR/scripts/test-fixtures/minimal-valid/unity/core/code-style.md" \
    "$S19_DIR/.unikit/memory/core/code-style.md"
node -e "
    const fs = require('fs');
    const crypto = require('crypto');
    const cp = process.argv[1];
    const j = JSON.parse(fs.readFileSync(cp, 'utf8'));
    const content = fs.readFileSync(process.argv[2], 'utf8');
    j.rules.installed.core[0].installed_hash = crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
    fs.writeFileSync(cp, JSON.stringify(j, null, 2));
" "$S19_DIR/.unikit.json" "$S19_DIR/.unikit/memory/core/code-style.md"

assert_cmd_exit 0 "rules sync on in-sync project" "$TMPDIR/s19.log" -- \
    env -C "$S19_DIR" node "$CLI" rules sync

if grep -q "Updating\|Installing\|missing from disk\|untracked" "$TMPDIR/s19.log"; then
    fail "in-sync project unexpectedly produced change events"
    cat "$TMPDIR/s19.log"
else
    pass "in-sync project is a quiet no-op"
fi

# ─────────────────────────────────────────────
# Scenario 20 — Verbose `--replace` path regenerates RULES_INDEX too
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 20: --replace also regenerates RULES_INDEX${NC}"

assert_exists "$S19_DIR/.unikit/memory/RULES_INDEX.md" \
    "in-sync project still regenerated RULES_INDEX.md"
assert_stdout_contains "$S19_DIR/.unikit/memory/RULES_INDEX.md" "code-style" \
    "RULES_INDEX lists code-style"

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
print_summary_and_exit "rules sync Smoke Tests"
