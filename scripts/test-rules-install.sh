#!/bin/bash
# Smoke tests: validates `unikit-ai rules install` — both the no-args
# core bootstrap and the variadic `<id>...` signature, plus --force.
#
# Scope:
#   - bootstrap (no args): fresh install, idempotent re-run, drift recovery
#   - single: happy path, already-installed, unknown id (exit 1)
#   - variadic: multi success, mixed success, all-failed, partial already,
#     case-insensitive legacy id, --force overwrite path
#   - --force: re-fetch existing, fresh with --force, partial --force
#   - error paths: engine missing from resolved manifest (exit 5)
#
# Variadic / single / --force scenarios use the minimal-valid fake registry
# (unity + godot) installed under scripts/test-fixtures/ so assertions are
# fully deterministic without touching the bundled production snapshot.
#
# EXCEPTION — the no-args bootstrap (Scenarios 1, 2, 16): it walks every
# registered module by its bootstrap policy. The `gamedesign` module
# (policy `all-rules`) has no tier in the code-only minimal-valid fixture, so
# its canonical catalog backfills from the bundled snapshot ("code from
# registry, GD from bundled" — RESEARCH Session 2026-06-13). Those scenarios
# therefore install code-style PLUS every bundled gamedesign rule; the expected
# count is derived from the bundled manifest (GD_BOOTSTRAP_COUNT) so it tracks
# the snapshot rather than a hardcoded number.
#
# Usage: ./scripts/test-rules-install.sh

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

echo -e "${BOLD}=== rules install Smoke Tests ===${NC}"

# The no-args bootstrap walks every registered module by its bootstrap policy:
# `code` → always-tagged rules from the configured registry; `gamedesign` →
# its ENTIRE canonical catalog (policy `all-rules`), which backfills from the
# bundled snapshot when the custom registry ships no gamedesign tier. Derive
# that count from the bundled manifest so the bootstrap assertions track the
# snapshot instead of a hardcoded number. minimal-valid ships exactly one
# always-tagged code rule (code-style), so the fresh-bootstrap total is
# 1 + GD_BOOTSTRAP_COUNT.
# Count the bundled gamedesign rule files directly (the manifest is generated
# from these files by build-manifest.js, so the file count equals the catalog
# size). Non-recursive globs, so `references/` subdirs are not counted.
# `nullglob` makes a non-matching glob expand to nothing (no failing `ls` under
# `set -e`/`pipefail`); the shell path avoids node's MSYS-path issue on Windows.
shopt -s nullglob
_gd_core_files=("$ROOT_DIR"/rules-registry/gamedesign/core/*.md)
_gd_lib_files=("$ROOT_DIR"/rules-registry/gamedesign/library/*.md)
shopt -u nullglob
GD_BOOTSTRAP_COUNT=$(( ${#_gd_core_files[@]} + ${#_gd_lib_files[@]} ))
BOOTSTRAP_TOTAL=$((1 + GD_BOOTSTRAP_COUNT))

# ─────────────────────────────────────────────
# Scenario 1 — Bootstrap: fresh install (no args, empty state)
# ─────────────────────────────────────────────
# With no args the CLI installs every always-tagged rule the `code` module
# ships for the engine, PLUS the whole gamedesign catalog backfilled from the
# bundled snapshot. minimal-valid has exactly one always-tagged code rule
# (`code-style`), so the bootstrap reports (1 + GD_BOOTSTRAP_COUNT) installed.
echo -e "\n${BOLD}Scenario 1: bootstrap fresh install${NC}"

S1_DIR="$TMPDIR/s1-bootstrap-fresh"
mkdir -p "$S1_DIR"
use_fake_registry "$S1_DIR" unity minimal-valid

assert_cmd_exit 0 "rules install (no args) exits 0" "$TMPDIR/s1.log" -- \
    env -C "$S1_DIR" node "$CLI" rules install

assert_stdout_contains "$TMPDIR/s1.log" "installed core/code-style v1.0.0" \
    "fresh install line for code-style"
assert_stdout_contains "$TMPDIR/s1.log" "Rules: $BOOTSTRAP_TOTAL installed, 0 already-installed, 0 failed" \
    "bootstrap summary counts (code-style + $GD_BOOTSTRAP_COUNT bundled gamedesign rules)"
assert_exists "$S1_DIR/.unikit/memory/code/core/code-style.md" \
    "bootstrap wrote the core rule to disk"
assert_exists "$S1_DIR/.unikit/memory/code/RULES_INDEX.md" \
    "bootstrap regenerated RULES_INDEX.md"
assert_json_field "$S1_DIR/.unikit.json" "rules.installed.modules.code.core.0.name" code-style \
    "bootstrap recorded code-style in state"
assert_stdout_contains "$TMPDIR/s1.log" "installed gamedesign/core/balance" \
    "bootstrap backfilled the gamedesign catalog from the bundled snapshot"
assert_exists "$S1_DIR/.unikit/memory/gamedesign/core/balance.md" \
    "bootstrap wrote a backfilled gamedesign rule to disk"
assert_exists "$S1_DIR/.unikit/memory/gamedesign/RULES_INDEX.md" \
    "bootstrap regenerated the gamedesign RULES_INDEX.md"

# ─────────────────────────────────────────────
# Scenario 2 — Bootstrap: idempotent re-run
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 2: bootstrap idempotent re-run${NC}"

assert_cmd_exit 0 "second rules install run exits 0" "$TMPDIR/s2.log" -- \
    env -C "$S1_DIR" node "$CLI" rules install

assert_stdout_contains "$TMPDIR/s2.log" "already installed core/code-style" \
    "re-run reports already-installed"
assert_stdout_contains "$TMPDIR/s2.log" "Rules: 0 installed, $BOOTSTRAP_TOTAL already-installed, 0 failed" \
    "idempotent summary counts (code + gamedesign all already-installed)"

# ─────────────────────────────────────────────
# Scenario 3 — Bootstrap: drift recovery (local hash mismatch)
# ─────────────────────────────────────────────
# Overwrite the on-disk file with garbage and zero out the installed
# hash in state so the bootstrap takes the "on disk but stale" branch
# and re-fetches from the registry. The new hash should be a real
# sha256 of the fixture content, not the bogus value we seeded.
echo -e "\n${BOLD}Scenario 3: bootstrap drift recovery${NC}"

S3_DIR="$TMPDIR/s3-bootstrap-drift"
cp -r "$S1_DIR" "$S3_DIR"
echo "DRIFT" > "$S3_DIR/.unikit/memory/code/core/code-style.md"
# Replace installed_hash with "stale" so the hash-match early exit is
# skipped and the full fetch-and-rewrite path runs.
node -e "
    const fs = require('fs');
    const p = process.argv[1];
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.rules.installed.modules.code.core[0].installed_hash = 'stale';
    fs.writeFileSync(p, JSON.stringify(j, null, 2));
" "$S3_DIR/.unikit.json"

assert_cmd_exit 0 "bootstrap with drift exits 0" "$TMPDIR/s3.log" -- \
    env -C "$S3_DIR" node "$CLI" rules install

assert_stdout_contains "$TMPDIR/s3.log" "installed core/code-style v1.0.0" \
    "drift triggers re-install (not already-installed)"
assert_stdout_contains "$S3_DIR/.unikit/memory/code/core/code-style.md" \
    "Minimal core rule" \
    "drifted file was overwritten with fixture content"
# Hash in state should no longer match the 'stale' sentinel.
ACTUAL_HASH=$(node -e "
    const j = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
    console.log(j.rules.installed.modules.code.core[0].installed_hash);
" "$S3_DIR/.unikit.json")
if [[ "$ACTUAL_HASH" != "stale" && -n "$ACTUAL_HASH" ]]; then
    pass "drift recovery refreshed installed_hash to '$ACTUAL_HASH'"
else
    fail "drift recovery did not refresh hash (still '$ACTUAL_HASH')"
fi

# ─────────────────────────────────────────────
# Scenario 4 — Single install: happy path
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 4: single install happy path${NC}"

S4_DIR="$TMPDIR/s4-single"
mkdir -p "$S4_DIR"
use_fake_registry "$S4_DIR" unity minimal-valid

assert_cmd_exit 0 "rules install code-style exits 0" "$TMPDIR/s4.log" -- \
    env -C "$S4_DIR" node "$CLI" rules install code-style

assert_stdout_contains "$TMPDIR/s4.log" "installed core/code-style v1.0.0" \
    "single install report"
assert_exists "$S4_DIR/.unikit/memory/code/core/code-style.md" \
    "single install wrote the rule file"

# ─────────────────────────────────────────────
# Scenario 5 — Single install: already-installed without --force
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 5: single install already-installed${NC}"

assert_cmd_exit 0 "second single install exits 0" "$TMPDIR/s5.log" -- \
    env -C "$S4_DIR" node "$CLI" rules install code-style

assert_stdout_contains "$TMPDIR/s5.log" "already installed core/code-style" \
    "variadic already-installed absorbed into report"
assert_stdout_contains "$TMPDIR/s5.log" "Rules: 0 installed, 1 already-installed, 0 failed" \
    "summary counts already-installed"

# ─────────────────────────────────────────────
# Scenario 6 — Single install: unknown id → exit 1
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 6: single install unknown id (exit 1)${NC}"

S6_DIR="$TMPDIR/s6-unknown-id"
mkdir -p "$S6_DIR"
use_fake_registry "$S6_DIR" unity minimal-valid

assert_cmd_exit 1 "rules install does-not-exist exits 1" "$TMPDIR/s6.log" -- \
    env -C "$S6_DIR" node "$CLI" rules install does-not-exist

assert_stdout_contains "$TMPDIR/s6.log" "failed does-not-exist" \
    "failed report line includes the id"
assert_stdout_contains "$TMPDIR/s6.log" "Rules: 0 installed, 0 already-installed, 1 failed" \
    "summary reports 1 failed"

# ─────────────────────────────────────────────
# Scenario 7 — Variadic install: multiple ids in one call
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 7: variadic install (two ids)${NC}"

S7_DIR="$TMPDIR/s7-variadic"
mkdir -p "$S7_DIR"
use_fake_registry "$S7_DIR" unity minimal-valid

assert_cmd_exit 0 "rules install code-style sample-stack-rule exits 0" "$TMPDIR/s7.log" -- \
    env -C "$S7_DIR" node "$CLI" rules install code-style sample-stack-rule

assert_stdout_contains "$TMPDIR/s7.log" "installed core/code-style v1.0.0" \
    "first id installed (core category)"
assert_stdout_contains "$TMPDIR/s7.log" "installed stack/sample-stack-rule v1.0.0" \
    "second id installed (stack category)"
assert_stdout_contains "$TMPDIR/s7.log" "Rules: 2 installed, 0 already-installed, 0 failed" \
    "variadic summary counts both"
assert_exists "$S7_DIR/.unikit/memory/code/stack/references/sample-stack-rule-quickref.md" \
    "variadic install fetches reference files alongside the parent rule"

# ─────────────────────────────────────────────
# Scenario 8 — Variadic install: mixed success (one bad id)
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 8: variadic mixed success${NC}"

S8_DIR="$TMPDIR/s8-mixed"
mkdir -p "$S8_DIR"
use_fake_registry "$S8_DIR" unity minimal-valid

assert_cmd_exit 0 "mixed success still exits 0" "$TMPDIR/s8.log" -- \
    env -C "$S8_DIR" node "$CLI" rules install code-style does-not-exist

assert_stdout_contains "$TMPDIR/s8.log" "installed core/code-style v1.0.0" \
    "good id installed"
assert_stdout_contains "$TMPDIR/s8.log" "failed does-not-exist" \
    "bad id reported as failed"
assert_stdout_contains "$TMPDIR/s8.log" "Rules: 1 installed, 0 already-installed, 1 failed" \
    "summary reports mixed outcome"

# ─────────────────────────────────────────────
# Scenario 9 — Variadic install: all ids failed → exit 1
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 9: variadic all failed (exit 1)${NC}"

S9_DIR="$TMPDIR/s9-all-failed"
mkdir -p "$S9_DIR"
use_fake_registry "$S9_DIR" unity minimal-valid

assert_cmd_exit 1 "variadic all-failed exits 1" "$TMPDIR/s9.log" -- \
    env -C "$S9_DIR" node "$CLI" rules install not-there also-not

assert_stdout_contains "$TMPDIR/s9.log" "Rules: 0 installed, 0 already-installed, 2 failed" \
    "summary reports 2 failed"

# ─────────────────────────────────────────────
# Scenario 10 — Variadic install: legacy UPPER_CASE id normalizes
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 10: variadic legacy CODE-STYLE id${NC}"

S10_DIR="$TMPDIR/s10-case"
mkdir -p "$S10_DIR"
use_fake_registry "$S10_DIR" unity minimal-valid

assert_cmd_exit 0 "rules install CODE-STYLE exits 0" "$TMPDIR/s10.log" -- \
    env -C "$S10_DIR" node "$CLI" rules install CODE-STYLE

assert_stdout_contains "$TMPDIR/s10.log" "installed core/code-style v1.0.0" \
    "legacy upper-case id resolves to canonical rule"
assert_json_field "$S10_DIR/.unikit.json" "rules.installed.modules.code.core.0.name" code-style \
    "state entry uses canonical lowercase name"

# ─────────────────────────────────────────────
# Scenario 11 — Variadic install: partial already-installed
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 11: variadic partial already-installed${NC}"

# Reuse S7_DIR which already has both rules installed.
assert_cmd_exit 0 "variadic against seeded state exits 0" "$TMPDIR/s11.log" -- \
    env -C "$S7_DIR" node "$CLI" rules install code-style sample-stack-rule

assert_stdout_contains "$TMPDIR/s11.log" "already installed core/code-style" \
    "already-installed reported for core rule"
assert_stdout_contains "$TMPDIR/s11.log" "already installed stack/sample-stack-rule" \
    "already-installed reported for stack rule"
assert_stdout_contains "$TMPDIR/s11.log" "Rules: 0 installed, 2 already-installed, 0 failed" \
    "summary counts both as already-installed"

# ─────────────────────────────────────────────
# Scenario 12 — --force: re-fetch an already-installed rule
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 12: --force re-fetch${NC}"

# S7_DIR already has code-style + sample-stack-rule installed.
S12_DIR="$TMPDIR/s12-force-refetch"
cp -r "$S7_DIR" "$S12_DIR"

assert_cmd_exit 0 "rules install code-style --force" "$TMPDIR/s12.log" -- \
    env -C "$S12_DIR" node "$CLI" rules install code-style --force

assert_stdout_contains "$TMPDIR/s12.log" "installed core/code-style v1.0.0" \
    "--force reports installed (not already-installed)"
assert_stdout_contains "$TMPDIR/s12.log" "Rules: 1 installed, 0 already-installed, 0 failed" \
    "--force summary: 1 installed"

# ─────────────────────────────────────────────
# Scenario 13 — --force on fresh state (no-op difference vs no flag)
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 13: --force on fresh state${NC}"

S13_DIR="$TMPDIR/s13-force-fresh"
mkdir -p "$S13_DIR"
use_fake_registry "$S13_DIR" unity minimal-valid

assert_cmd_exit 0 "rules install --force on empty state" "$TMPDIR/s13.log" -- \
    env -C "$S13_DIR" node "$CLI" rules install code-style --force

assert_stdout_contains "$TMPDIR/s13.log" "installed core/code-style v1.0.0" \
    "fresh --force installs the rule"
assert_exists "$S13_DIR/.unikit/memory/code/core/code-style.md" \
    "fresh --force wrote the rule file"

# ─────────────────────────────────────────────
# Scenario 14 — --force variadic with one unknown id
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 14: --force variadic with unknown id${NC}"

S14_DIR="$TMPDIR/s14-force-mixed"
mkdir -p "$S14_DIR"
use_fake_registry "$S14_DIR" unity minimal-valid

assert_cmd_exit 0 "variadic --force mixed exits 0" "$TMPDIR/s14.log" -- \
    env -C "$S14_DIR" node "$CLI" rules install code-style bogus --force

assert_stdout_contains "$TMPDIR/s14.log" "installed core/code-style v1.0.0" \
    "good id installed under --force"
assert_stdout_contains "$TMPDIR/s14.log" "failed bogus" \
    "bad id still reported as failed under --force"

# ─────────────────────────────────────────────
# Scenario 15 — Error path: engine missing from resolved manifest (exit 5)
# ─────────────────────────────────────────────
# config.engine = unreal-engine-6 is not in the minimal-valid fixture,
# the official URL, or the bundled snapshot. HybridRegistry falls
# through to the bundled manifest (which has 4 engines, none named
# "unreal-engine-6") and returns it. rulesInstallCommand sees a non-null
# manifest with engines[engineId]===undefined and exits 5.
echo -e "\n${BOLD}Scenario 15: engine missing from resolved manifest (exit 5)${NC}"

S15_DIR="$TMPDIR/s15-engine-missing"
mkdir -p "$S15_DIR/.unikit/memory/code/core" "$S15_DIR/.unikit/memory/code/stack"
cat > "$S15_DIR/.unikit.json" <<EOF
{
  "version": "1.1.0",
  "engine": "unreal-engine-6",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [],
  "rulesRegistry": "$(fake_registry_path minimal-valid)",
  "rules": {
    "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } }
  }
}
EOF

assert_cmd_exit 5 "rules install with missing engine exits 5" "$TMPDIR/s15.log" -- \
    env -C "$S15_DIR" node "$CLI" rules install code-style

assert_stdout_contains "$TMPDIR/s15.log" "unreal-engine-6" \
    "error mentions the missing engine"

# ─────────────────────────────────────────────
# Scenario 16 — Empty code core: gamedesign backfill keeps the bootstrap alive (exit 0)
# ─────────────────────────────────────────────
# The no-args bootstrap sums work across ALL registered modules. A schema:1
# fixture with an EMPTY core list (only a stack rule, always=false) contributes
# zero `code` rules — but the `gamedesign` module (policy `all-rules`) still
# backfills its entire canonical catalog from the bundled snapshot ("code from
# registry, GD from bundled"). The summed work is therefore non-empty and the
# bootstrap succeeds (exit 0), installing only gamedesign rules. The
# empty-bootstrap exit-5 gate (rules.ts) fires only when EVERY module resolves
# empty, which the populated bundled gamedesign catalog now prevents; exit 5
# stays covered by Scenario 15 (engine missing).
echo -e "\n${BOLD}Scenario 16: empty code core, gamedesign backfill (exit 0)${NC}"

S16_FIXTURE="$TMPDIR/s16-fixture"
mkdir -p "$S16_FIXTURE/unity/core" "$S16_FIXTURE/unity/stack"
cat > "$S16_FIXTURE/manifest.json" << 'EOF'
{
  "schema": 1,
  "generated": "2026-04-13T00:00:00.000Z",
  "engines": {
    "unity": {
      "core": [],
      "stack": [
        { "id": "stack-only-rule", "description": "Stack rule with no core counterpart — bootstrap finds no core tier", "version": "1.0.0" }
      ]
    }
  }
}
EOF
cat > "$S16_FIXTURE/unity/stack/stack-only-rule.md" << 'EOF'
---
version: 1.0.0
---
# Stack-only rule (test fixture)

> **Scope**: Fixture rule used to exercise the empty-core exit 5 path.
> **Load when**: running the bootstrap no-core-tier regression test.
EOF

S16_DIR="$TMPDIR/s16-empty-core"
mkdir -p "$S16_DIR/.unikit/memory/code/core" "$S16_DIR/.unikit/memory/code/stack"
cat > "$S16_DIR/.unikit.json" <<EOF
{
  "version": "1.1.0",
  "engine": "unity",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [],
  "rulesRegistry": "$(normalize_path_for_json "$S16_FIXTURE")",
  "rules": {
    "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } }
  }
}
EOF

assert_cmd_exit 0 "bootstrap with empty code core still exits 0 via gamedesign" "$TMPDIR/s16.log" -- \
    env -C "$S16_DIR" node "$CLI" rules install

assert_stdout_contains "$TMPDIR/s16.log" "installed gamedesign/core/balance" \
    "gamedesign catalog backfilled despite the empty code core tier"
assert_exists "$S16_DIR/.unikit/memory/gamedesign/core/balance.md" \
    "backfilled gamedesign rule written to disk"
if ls "$S16_DIR/.unikit/memory/code/core/"*.md >/dev/null 2>&1; then
    fail "no code core rule should be installed from an empty-core fixture"
else
    pass "no code core rule installed (empty-core fixture contributes zero code rules)"
fi

# ─────────────────────────────────────────────
# Scenario 17 — Variadic install: --force refreshes disk content
# ─────────────────────────────────────────────
# Pre-condition: S12_DIR was the --force refetch scenario. Reuse it to
# mutate the on-disk file, then run --force again and assert the
# content was rewritten to the fixture canonical form.
echo -e "\n${BOLD}Scenario 17: --force overwrites manually-edited rule${NC}"

S17_DIR="$TMPDIR/s17-force-overwrite"
cp -r "$S12_DIR" "$S17_DIR"
echo "MANUAL EDIT" >> "$S17_DIR/.unikit/memory/code/core/code-style.md"

assert_cmd_exit 0 "rules install --force on edited file" "$TMPDIR/s17.log" -- \
    env -C "$S17_DIR" node "$CLI" rules install code-style --force

if grep -q "MANUAL EDIT" "$S17_DIR/.unikit/memory/code/core/code-style.md"; then
    fail "--force did not overwrite the manual edit"
else
    pass "--force overwrote the manual edit"
fi

# ─────────────────────────────────────────────
# Scenario 18 — un-migrated project: install refuses with exit 8
# ─────────────────────────────────────────────
# Both the no-arg bootstrap (/unikit Step 9.2) and the variadic form must
# refuse on a stale project and leave .unikit.json untouched. The guard runs
# before the manifest fetch, so the local fixture is never consulted.
echo -e "\n${BOLD}Scenario 18: un-migrated project refused (exit 8)${NC}"

S18_DIR="$TMPDIR/s18-unmigrated"
use_unmigrated_registry "$S18_DIR" unity minimal-valid
S18_SHA="$(sha_of "$S18_DIR/.unikit.json")"

# No-arg bootstrap path.
assert_cmd_exit 8 "rules install (no-arg bootstrap) on un-migrated project exits 8" "$TMPDIR/s18a.log" -- \
    env -C "$S18_DIR" node "$CLI" rules install
assert_stdout_contains "$TMPDIR/s18a.log" "out of date" "row18a explains the project is out of date"

# Variadic path.
assert_cmd_exit 8 "rules install <id> on un-migrated project exits 8" "$TMPDIR/s18b.log" -- \
    env -C "$S18_DIR" node "$CLI" rules install code-style
assert_file_unchanged "$S18_DIR/.unikit.json" "$S18_SHA" \
    "row18 .unikit.json left byte-for-byte unchanged (state not wiped)"

# ─────────────────────────────────────────────
# Scenario 19 — migrated project still installs (exit 0)
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 19: migrated project still installs (exit 0)${NC}"

S19_DIR="$TMPDIR/s19-migrated"
use_fake_registry "$S19_DIR" unity minimal-valid
assert_cmd_exit 0 "rules install code-style on migrated project exits 0" "$TMPDIR/s19.log" -- \
    env -C "$S19_DIR" node "$CLI" rules install code-style

# ─────────────────────────────────────────────
# Scenario 20 — B-merge per-id override + bundled backfill (#R2a / #R2b)
# ─────────────────────────────────────────────
# The gamedesign-override fixture ships ONE custom gamedesign core rule
# (`balance`, v9.9.9) matching a canonical id. The no-args bootstrap resolves the
# gamedesign core tier PER-ID: `balance` from the custom registry (origin
# `primary`; custom content + version win — not auto-updated from upstream),
# every OTHER canonical id backfilled from the bundled snapshot (origin
# `bundled`). Per-rule origin is stamped at INSTALL time (not only on a later
# sync), recorded in `.unikit.json`, surfaced in `rules status`, and rendered in
# the GD RULES_INDEX Origin column.
echo -e "\n${BOLD}Scenario 20: B-merge per-id override + bundled backfill${NC}"

S20_DIR="$TMPDIR/s20-bmerge"
use_fake_registry "$S20_DIR" unity gamedesign-override

assert_cmd_exit 0 "bootstrap on override fixture exits 0" "$TMPDIR/s20.log" -- \
    env -C "$S20_DIR" node "$CLI" rules install

assert_stdout_contains "$TMPDIR/s20.log" "installed gamedesign/core/balance v9.9.9" \
    "override id installs the custom version (9.9.9), not the bundled 1.0.0"
assert_stdout_contains "$TMPDIR/s20.log" "installed gamedesign/core/economy v1.0.0" \
    "a non-overridden canonical id backfills from bundled at its bundled version"
assert_stdout_contains "$S20_DIR/.unikit/memory/gamedesign/core/balance.md" "STUDIO OVERRIDE MARKER" \
    "override file carries the studio's custom content, not the bundled rule"
assert_stdout_contains "$S20_DIR/.unikit/memory/gamedesign/RULES_INDEX.md" "| File | Description | Origin | Load When |" \
    "GD RULES_INDEX core table carries the per-rule Origin column"

# Per-rule origin (robust to install ordering): override → primary, backfill → bundled.
assert_cmd_exit 0 "status --module gamedesign on override exits 0" "$TMPDIR/s20-status.log" -- \
    env -C "$S20_DIR" node "$CLI" rules status --module gamedesign
if grep -qE "balance[[:space:]].*registry:primary" "$TMPDIR/s20-status.log"; then
    pass "override 'balance' carries per-rule origin registry:primary"
else
    fail "override 'balance' not tagged registry:primary"
fi
if grep -qE "economy[[:space:]].*registry:bundled" "$TMPDIR/s20-status.log"; then
    pass "backfilled 'economy' carries per-rule origin registry:bundled"
else
    fail "backfilled 'economy' not tagged registry:bundled"
fi

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
print_summary_and_exit "rules install Smoke Tests"
