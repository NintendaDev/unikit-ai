#!/bin/bash
# Smoke tests: validates the nested `unikit-ai rules registry` command
# group (show / set / reset) plus cross-cutting regression guards that
# used to live in test-rules-registry-switch.sh.
#
# Scope:
#   - show: exit codes, bare-alias invocation, --json payload shape
#   - set: happy path, invalid paths (relative → 3, bad manifest → 5,
#     nonexistent → 5), --json payload, CRITICAL guard that `set` never
#     silently runs `rules sync` against the new URL
#   - reset: writes OFFICIAL_REGISTRY_URL literal into .unikit.json,
#     --json payload, CRITICAL guard that `reset` never touches memory
#   - createRegistry class dispatch: `null` and OFFICIAL_REGISTRY_URL
#     route to `OfficialRegistry`; a custom URL routes to
#     `HybridRegistry`. Guards the regression that used to manifest as a
#     double fetch to raw.githubusercontent.com/.../manifest.json when
#     primary and official were the same GitRegistry instance.
#
# `rules registry init` lives in its own file
# (test-rules-registry-init.sh) and is NOT re-covered here.
#
# Usage: ./scripts/test-rules-registry.sh

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
REGISTRY_MODULE="$ROOT_DIR/dist/core/registry/index.js"
OFFICIAL_URL="https://raw.githubusercontent.com/NintendaDev/unikit-ai-rules/main"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Helper: seed a minimal project with a known rulesRegistry value.
# The rulesRegistry field is written verbatim via bash expansion, so the
# caller must pre-normalize Windows paths via normalize_path_for_json
# or fake_registry_path.
make_registry_project() {
    local dir="$1"
    local engine="$2"
    local registry_value="$3"
    mkdir -p "$dir/.unikit/memory/code/core" "$dir/.unikit/memory/code/stack"
    if [[ "$registry_value" == "__NULL__" ]]; then
        cat > "$dir/.unikit.json" <<EOF
{
  "version": "1.0.0",
  "engine": "$engine",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [],
  "rulesRegistry": null,
  "rules": {
    "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } }
  }
}
EOF
    else
        cat > "$dir/.unikit.json" <<EOF
{
  "version": "1.0.0",
  "engine": "$engine",
  "engineMcpKey": null,
  "mcp": { "servers": [] },
  "agents": [],
  "rulesRegistry": "$registry_value",
  "rules": {
    "installed": { "version": "1.0.0", "modules": { "code": { "core": [], "stack": [] } } }
  }
}
EOF
    fi
}

echo -e "${BOLD}=== rules registry Smoke Tests ===${NC}"

# ─────────────────────────────────────────────
# Scenario 1 — show: missing .unikit.json → exit 1
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 1: show without config${NC}"

S1_DIR="$TMPDIR/s1-no-config"
mkdir -p "$S1_DIR"

assert_cmd_exit 1 "rules registry show without config exits 1" "$TMPDIR/s1.log" -- \
    env -C "$S1_DIR" node "$CLI" rules registry show

# ─────────────────────────────────────────────
# Scenario 2 — show: configured local registry
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 2: show with configured local registry${NC}"

S2_DIR="$TMPDIR/s2-local"
make_registry_project "$S2_DIR" unity "$(fake_registry_path minimal-valid)"

assert_cmd_exit 0 "rules registry show exit 0" "$TMPDIR/s2.log" -- \
    env -C "$S2_DIR" node "$CLI" rules registry show

assert_stdout_contains "$TMPDIR/s2.log" "minimal-valid" \
    "human output references the fixture path"
assert_stdout_contains "$TMPDIR/s2.log" "local" \
    "human output labels it as [local]"

# ─────────────────────────────────────────────
# Scenario 3 — show with null rulesRegistry (legacy)
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 3: show with null rulesRegistry${NC}"

S3_DIR="$TMPDIR/s3-null"
make_registry_project "$S3_DIR" unity __NULL__

assert_cmd_exit 0 "rules registry show on legacy null config" "$TMPDIR/s3.log" -- \
    env -C "$S3_DIR" node "$CLI" rules registry show

assert_stdout_contains "$TMPDIR/s3.log" "default — official" \
    "human output marks the default as (default — official)"

# ─────────────────────────────────────────────
# Scenario 4 — show --json with configured local registry
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 4: show --json with local fixture${NC}"

assert_cmd_exit 0 "rules registry show --json" "$TMPDIR/s4.log" -- \
    env -C "$S2_DIR" node "$CLI" rules registry show --json

assert_json_field "$TMPDIR/s4.log" configured true "configured=true"
assert_json_field "$TMPDIR/s4.log" kind local "kind=local"

# ─────────────────────────────────────────────
# Scenario 5 — show --json with null rulesRegistry
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 5: show --json with null registry${NC}"

assert_cmd_exit 0 "rules registry show --json on legacy null" "$TMPDIR/s5.log" -- \
    env -C "$S3_DIR" node "$CLI" rules registry show --json

assert_json_field "$TMPDIR/s5.log" configured false "configured=false"
assert_json_field "$TMPDIR/s5.log" kind url "kind=url (official fallback)"
assert_json_field "$TMPDIR/s5.log" url "$OFFICIAL_URL" "url resolves to OFFICIAL_REGISTRY_URL"

# ─────────────────────────────────────────────
# Scenario 6 — set: happy path writes the URL, prints hints
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 6: set happy path${NC}"

S6_DIR="$TMPDIR/s6-set-happy"
make_registry_project "$S6_DIR" unity __NULL__

assert_cmd_exit 0 "rules registry set <fake>" "$TMPDIR/s6.log" -- \
    env -C "$S6_DIR" node "$CLI" rules registry set "$(fake_registry_path minimal-valid)"

assert_stdout_contains "$TMPDIR/s6.log" "Registry set to" \
    "set prints confirmation line"
assert_stdout_contains "$TMPDIR/s6.log" "Rule content on disk was left untouched" \
    "set prints post-change hint block"
assert_json_field "$S6_DIR/.unikit.json" rulesRegistry \
    "$(fake_registry_path minimal-valid)" \
    ".unikit.json.rulesRegistry matches the fake fixture"

# ─────────────────────────────────────────────
# Scenario 7 — set --json: payload shape
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 7: set --json${NC}"

S7_DIR="$TMPDIR/s7-set-json"
make_registry_project "$S7_DIR" unity __NULL__

assert_cmd_exit 0 "rules registry set --json" "$TMPDIR/s7.log" -- \
    env -C "$S7_DIR" node "$CLI" rules registry set "$(fake_registry_path minimal-valid)" --json

assert_json_field "$TMPDIR/s7.log" configured true "configured=true"
assert_json_field "$TMPDIR/s7.log" kind local "kind=local"

# ─────────────────────────────────────────────
# Scenario 8 — set with relative path → exit 3
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 8: set relative path (exit 3)${NC}"

S8_DIR="$TMPDIR/s8-relative"
make_registry_project "$S8_DIR" unity __NULL__

assert_cmd_exit 3 "rules registry set relative/path" "$TMPDIR/s8.log" -- \
    env -C "$S8_DIR" node "$CLI" rules registry set relative/path

assert_stdout_contains "$TMPDIR/s8.log" "Invalid registry input" \
    "relative path error message"

# ─────────────────────────────────────────────
# Scenario 9 — set with corrupted-manifest fixture → exit 5
# ─────────────────────────────────────────────
# The corrupted-manifest fixture ships an unparsable manifest.json so
# `validateRegistry` fails with FETCH_FAILED (registry.fetchManifest
# returns null). The CLI caller surfaces that as exit 5.
echo -e "\n${BOLD}Scenario 9: set corrupted-manifest (exit 5)${NC}"

S9_DIR="$TMPDIR/s9-corrupted"
make_registry_project "$S9_DIR" unity __NULL__

assert_cmd_exit 5 "rules registry set <corrupted-manifest>" "$TMPDIR/s9.log" -- \
    env -C "$S9_DIR" node "$CLI" rules registry set "$(fake_registry_path corrupted-manifest)"

assert_stdout_contains "$TMPDIR/s9.log" "Registry validation failed" \
    "validation error surfaces to user"

# ─────────────────────────────────────────────
# Scenario 10 — set with nonexistent path → exit 5
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 10: set nonexistent path (exit 5)${NC}"

S10_DIR="$TMPDIR/s10-missing"
make_registry_project "$S10_DIR" unity __NULL__
MISSING_PATH="$(normalize_path_for_json "$TMPDIR/does-not-exist-registry")"

assert_cmd_exit 5 "rules registry set <missing>" "$TMPDIR/s10.log" -- \
    env -C "$S10_DIR" node "$CLI" rules registry set "$MISSING_PATH"

# ─────────────────────────────────────────────
# Scenario 11 — CRITICAL: set does NOT auto-sync rules
# ─────────────────────────────────────────────
# Pre-seed a locally-modified rule file whose content differs from the
# fake fixture. `registry set` must store the URL and leave disk alone.
# If this regresses, the file hash would change.
echo -e "\n${BOLD}Scenario 11: CRITICAL — set does not trigger sync${NC}"

S11_DIR="$TMPDIR/s11-set-no-sync"
make_registry_project "$S11_DIR" unity __NULL__
cat > "$S11_DIR/.unikit/memory/code/core/code-style.md" << 'EOF'
# Locally-modified copy
<!-- LOCAL-MODIFICATION-MARKER -->
EOF
# Register it as source=local so subsequent asserts still work.
node -e "
    const fs = require('fs');
    const j = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    j.rules.installed.modules.code.core.push({
        name: 'code-style',
        source: 'local',
        origin: null,
        version: null,
        installed_hash: 'deadbeef'
    });
    fs.writeFileSync(process.argv[1], JSON.stringify(j, null, 2));
" "$S11_DIR/.unikit.json"

BEFORE_HASH="$(sha_of "$S11_DIR/.unikit/memory/code/core/code-style.md")"

assert_cmd_exit 0 "registry set with locally-modified rule" "$TMPDIR/s11.log" -- \
    env -C "$S11_DIR" node "$CLI" rules registry set "$(fake_registry_path minimal-valid)"

assert_file_unchanged "$S11_DIR/.unikit/memory/code/core/code-style.md" "$BEFORE_HASH" \
    "registry set left the rule file untouched (no silent sync)"

# ─────────────────────────────────────────────
# Scenario 12 — reset: writes OFFICIAL_REGISTRY_URL literal
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 12: reset stores OFFICIAL_REGISTRY_URL literal${NC}"

S12_DIR="$TMPDIR/s12-reset"
make_registry_project "$S12_DIR" unity "$(fake_registry_path minimal-valid)"

assert_cmd_exit 0 "rules registry reset" "$TMPDIR/s12.log" -- \
    env -C "$S12_DIR" node "$CLI" rules registry reset

assert_stdout_contains "$TMPDIR/s12.log" "Registry reset to default (official)" \
    "reset prints confirmation line"
assert_json_field "$S12_DIR/.unikit.json" rulesRegistry "$OFFICIAL_URL" \
    ".unikit.json.rulesRegistry holds the literal OFFICIAL_REGISTRY_URL"

# ─────────────────────────────────────────────
# Scenario 13 — reset --json payload
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 13: reset --json${NC}"

S13_DIR="$TMPDIR/s13-reset-json"
make_registry_project "$S13_DIR" unity "$(fake_registry_path minimal-valid)"

assert_cmd_exit 0 "rules registry reset --json" "$TMPDIR/s13.log" -- \
    env -C "$S13_DIR" node "$CLI" rules registry reset --json

assert_json_field "$TMPDIR/s13.log" configured true \
    "reset --json reports configured=true (literal stored)"
assert_json_field "$TMPDIR/s13.log" kind url "reset --json reports kind=url"
assert_json_field "$TMPDIR/s13.log" url "$OFFICIAL_URL" "reset --json url is official"

# ─────────────────────────────────────────────
# Scenario 14 — CRITICAL: reset does NOT auto-sync rules
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 14: CRITICAL — reset does not trigger sync${NC}"

S14_DIR="$TMPDIR/s14-reset-no-sync"
make_registry_project "$S14_DIR" unity "$(fake_registry_path minimal-valid)"
cat > "$S14_DIR/.unikit/memory/code/core/code-style.md" << 'EOF'
# Locally-modified copy (reset scenario)
<!-- MARKER -->
EOF
BEFORE_HASH_RESET="$(sha_of "$S14_DIR/.unikit/memory/code/core/code-style.md")"

assert_cmd_exit 0 "rules registry reset with locally-modified rule" "$TMPDIR/s14.log" -- \
    env -C "$S14_DIR" node "$CLI" rules registry reset

assert_file_unchanged "$S14_DIR/.unikit/memory/code/core/code-style.md" "$BEFORE_HASH_RESET" \
    "reset left the rule file untouched (no silent sync)"

# ─────────────────────────────────────────────
# Scenario 15 — bare `rules registry` alias for show
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Scenario 15: bare registry alias for show${NC}"

S15_DIR="$TMPDIR/s15-bare"
make_registry_project "$S15_DIR" unity "$(fake_registry_path minimal-valid)"

assert_cmd_exit 0 "bare rules registry prints URL" "$TMPDIR/s15.log" -- \
    env -C "$S15_DIR" node "$CLI" rules registry

assert_stdout_contains "$TMPDIR/s15.log" "minimal-valid" \
    "bare registry invocation prints the URL"

# ─────────────────────────────────────────────
# Scenario 16 — bare `rules registry --json` alias for show --json
# ─────────────────────────────────────────────
# The CLI parent action peeks at process.argv for --json because
# commander drops duplicated flag definitions between parent and child.
echo -e "\n${BOLD}Scenario 16: bare registry --json alias${NC}"

assert_cmd_exit 0 "bare rules registry --json" "$TMPDIR/s16.log" -- \
    env -C "$S15_DIR" node "$CLI" rules registry --json

assert_json_field "$TMPDIR/s16.log" configured true \
    "bare --json alias reports configured=true"
assert_json_field "$TMPDIR/s16.log" kind local \
    "bare --json alias reports kind=local"

# ─────────────────────────────────────────────
# Scenario 17 — createRegistry class dispatch
# ─────────────────────────────────────────────
# `createRegistry(null | OFFICIAL_REGISTRY_URL)` must return an
# `OfficialRegistry` (chain = [official, bundled]); a custom URL must
# return a `HybridRegistry` (chain = [primary, official, bundled]).
# Regression target: the old fold path built `new HybridRegistry(official,
# official, ...)` which triggered two identical HTTP requests to the
# official manifest. Class dispatch makes that structurally impossible.
echo -e "\n${BOLD}Scenario 17: createRegistry class dispatch${NC}"

set +e
DISPATCH_RESULT=$(node -e "
const { pathToFileURL } = require('url');
import(pathToFileURL(process.argv[1]).href).then(mod => {
    const rNull = mod.createRegistry(null, 'unity', null);
    const rOfficial = mod.createRegistry('$OFFICIAL_URL', 'unity', null);
    const rCustom = mod.createRegistry('https://example.invalid/custom-registry', 'unity', null);
    const nullIsOfficial = rNull instanceof mod.OfficialRegistry;
    const officialIsOfficial = rOfficial instanceof mod.OfficialRegistry;
    const customIsHybrid = rCustom instanceof mod.HybridRegistry;
    const customIsNotOfficial = !(rCustom instanceof mod.OfficialRegistry);
    if (nullIsOfficial && officialIsOfficial && customIsHybrid && customIsNotOfficial) {
        console.log('OK');
    } else {
        console.log('FAIL nullOfficial=' + nullIsOfficial
            + ' officialOfficial=' + officialIsOfficial
            + ' customHybrid=' + customIsHybrid
            + ' customNotOfficial=' + customIsNotOfficial);
    }
}).catch(e => { console.log('ERR ' + e.message); });
" "$REGISTRY_MODULE" 2>&1)
set -e

if [[ "$DISPATCH_RESULT" == "OK" ]]; then
    pass "createRegistry(null) returns OfficialRegistry"
    pass "createRegistry(OFFICIAL_REGISTRY_URL) returns OfficialRegistry"
    pass "createRegistry(customUrl) returns HybridRegistry (not OfficialRegistry)"
else
    fail "createRegistry class dispatch misbehaved — got: $DISPATCH_RESULT"
fi

# ─────────────────────────────────────────────
# Scenario 18 — getResolvedOrigin() per subclass
# ─────────────────────────────────────────────
# OfficialRegistry's resolved source can only be `official` or `bundled`;
# HybridRegistry also recognizes `primary`. Simulate a successful resolve
# by poking `resolvedSource` directly — we're not exercising fetchManifest
# here, only the origin tagging logic that keys off reference identity.
echo -e "\n${BOLD}Scenario 18: getResolvedOrigin per subclass${NC}"

set +e
ORIGIN_RESULT=$(node -e "
const { pathToFileURL } = require('url');
import(pathToFileURL(process.argv[1]).href).then(mod => {
    const rOfficial = mod.createRegistry('$OFFICIAL_URL', 'unity', null);
    rOfficial.resolvedSource = rOfficial.official;
    const originOfficial = rOfficial.getResolvedOrigin();
    const rCustom = mod.createRegistry('https://example.invalid/custom-registry', 'unity', null);
    rCustom.resolvedSource = rCustom.primary;
    const originCustom = rCustom.getResolvedOrigin();
    if (originOfficial === 'official' && originCustom === 'primary') {
        console.log('OK');
    } else {
        console.log('FAIL official=' + originOfficial + ' custom=' + originCustom);
    }
}).catch(e => { console.log('ERR ' + e.message); });
" "$REGISTRY_MODULE" 2>&1)
set -e

if [[ "$ORIGIN_RESULT" == "OK" ]]; then
    pass "OfficialRegistry reports origin='official' when official won"
    pass "HybridRegistry reports origin='primary' when primary won"
else
    fail "getResolvedOrigin mismatch — got: $ORIGIN_RESULT"
fi

# ─────────────────────────────────────────────
# Scenario 19 — HybridRegistry constructor guard
# ─────────────────────────────────────────────
# The split into HybridRegistry / OfficialRegistry relies on the factory
# never calling `new HybridRegistry(x, x, ...)`. A runtime guard enforces
# that invariant so a future call-site that forgets to switch cannot
# silently regress origin tagging. This scenario asserts the guard fires.
echo -e "\n${BOLD}Scenario 19: HybridRegistry constructor guard throws on primary===official${NC}"

set +e
GUARD_RESULT=$(node -e "
const { pathToFileURL } = require('url');
import(pathToFileURL(process.argv[1]).href).then(mod => {
    const official = new mod.GitRegistry('$OFFICIAL_URL');
    let thrown = false;
    let message = '';
    try {
        new mod.HybridRegistry(official, official, 'unity', undefined);
    } catch (e) {
        thrown = true;
        message = e && e.message ? e.message : String(e);
    }
    const mentionsOfficial = message.includes('OfficialRegistry');
    if (thrown && mentionsOfficial) {
        console.log('OK');
    } else {
        console.log('FAIL thrown=' + thrown + ' message=' + message);
    }
}).catch(e => { console.log('ERR ' + e.message); });
" "$REGISTRY_MODULE" 2>&1)
set -e

if [[ "$GUARD_RESULT" == "OK" ]]; then
    pass "new HybridRegistry(x, x, ...) throws"
    pass "guard message points users at OfficialRegistry"
else
    fail "constructor guard did not fire correctly — got: $GUARD_RESULT"
fi

# ─────────────────────────────────────────────
# Scenario 20 — UNIKIT_OFFICIAL_REGISTRY_URL transport override
# ─────────────────────────────────────────────
# Regression guard for the dev/test-only seam in `createRegistry`: with the
# env var set, the official level's TRANSPORT is built from the override
# (fs:<path> instead of git:<official-url>) — but `OFFICIAL_REGISTRY_URL`
# itself, and the resolve/reset/display dispatch keyed on it, must stay
# untouched. Without the env var, official fetch stays git-backed as before.
echo -e "\n${BOLD}Scenario 20: UNIKIT_OFFICIAL_REGISTRY_URL transport override${NC}"

T6_DEAD_OFFICIAL="$(normalize_path_for_json "$TMPDIR/t6-dead-official")"
mkdir -p "$TMPDIR/t6-dead-official"

set +e
ENV_SEAM_RESULT=$(UNIKIT_OFFICIAL_REGISTRY_URL="$T6_DEAD_OFFICIAL" node -e "
const { pathToFileURL } = require('url');
import(pathToFileURL(process.argv[1]).href).then(mod => {
    const rOfficial = mod.createRegistry(null, 'unity', null);
    const overrideUsesFs = rOfficial.label.includes('fs:');
    const overrideNotGit = !rOfficial.label.includes('git:');
    const constantUnchanged = mod.OFFICIAL_REGISTRY_URL === '$OFFICIAL_URL';
    if (overrideUsesFs && overrideNotGit && constantUnchanged) {
        console.log('OK');
    } else {
        console.log('FAIL usesFs=' + overrideUsesFs + ' notGit=' + overrideNotGit
            + ' constantUnchanged=' + constantUnchanged + ' label=' + rOfficial.label);
    }
}).catch(e => { console.log('ERR ' + e.message); });
" "$REGISTRY_MODULE" 2>&1)
set -e

if [[ "$ENV_SEAM_RESULT" == "OK" ]]; then
    pass "env override builds the official transport from fs:<path>"
    pass "OFFICIAL_REGISTRY_URL constant unchanged by the env override"
else
    fail "env override misbehaved — got: $ENV_SEAM_RESULT"
fi

set +e
NO_ENV_SEAM_RESULT=$(node -e "
const { pathToFileURL } = require('url');
import(pathToFileURL(process.argv[1]).href).then(mod => {
    const rOfficial = mod.createRegistry(null, 'unity', null);
    const stillGit = rOfficial.label.includes('git:' + mod.OFFICIAL_REGISTRY_URL);
    if (stillGit) {
        console.log('OK');
    } else {
        console.log('FAIL label=' + rOfficial.label);
    }
}).catch(e => { console.log('ERR ' + e.message); });
" "$REGISTRY_MODULE" 2>&1)
set -e

if [[ "$NO_ENV_SEAM_RESULT" == "OK" ]]; then
    pass "without the env var, official fetch stays git-backed"
else
    fail "official fetch regressed without the env var — got: $NO_ENV_SEAM_RESULT"
fi

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
print_summary_and_exit "rules registry Smoke Tests"
