#!/bin/bash
# Smoke tests: guards the canonical schema:2 REGISTRY FORMAT.
#
# Two producers must agree on the same on-disk shape:
#   A. the bundled snapshot (rules-registry/, synced from the rules repo)
#   B. the rules repo's build-manifest.js (shipped inside the snapshot)
#
# Canonical schema:2 on-disk manifest:
#   { schema: 2, generated, modules: {
#       code:       { engines: { <engine>: { core[], stack[] } } },
#       gamedesign: { tiers:   { core[], library[] } } } }
#   - NO top-level `engines` sibling of `modules`
#   - every rule carries `always` (core → true, stack → false)
#   - physical layout: code/<engine>/{core,stack}/ and gamedesign/{core,library}/
#
# Part C confirms the CLI itself accepts the bundled snapshot as schema:2.
#
# Usage: ./scripts/test-registry-format.sh

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
BUNDLED="$ROOT_DIR/rules-registry"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# has_top_level_field <manifest_file> <field> → yes|no (top-level key only).
has_top_level_field() {
    node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const m=JSON.parse(d);console.log(('$2' in m)?'yes':'no')})" < "$1"
}

echo -e "${BOLD}=== registry format Smoke Tests ===${NC}"

# ─────────────────────────────────────────────
# Part A: bundled snapshot is canonical schema:2
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part A: bundled snapshot shape${NC}"

assert_json_field "$BUNDLED/manifest.json" schema 2 "bundled manifest schema:2"

# Top-level `engines` must be ABSENT (engine map lives at modules.code.engines).
TOP_ENGINES="$(has_top_level_field "$BUNDLED/manifest.json" engines)"
[[ "$TOP_ENGINES" == "no" ]] && pass "bundled: no top-level engines" || fail "bundled: unexpected top-level engines"
TOP_MODULES="$(has_top_level_field "$BUNDLED/manifest.json" modules)"
[[ "$TOP_MODULES" == "yes" ]] && pass "bundled: top-level modules map present" || fail "bundled: missing modules map"

# Both modules present with the right inner key.
for engine in unity godot godot-net unreal-engine-5; do
    CORE_LEN="$(node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const m=JSON.parse(d);const e=m.modules.code.engines['$engine'];console.log(e&&Array.isArray(e.core)?e.core.length:-1)})" < "$BUNDLED/manifest.json")"
    [[ "$CORE_LEN" -gt 0 ]] && pass "bundled: modules.code.engines.$engine.core non-empty ($CORE_LEN)" || fail "bundled: $engine core empty/missing"
done

# gamedesign module — tiers core + library present (reserved, may be empty).
GD_TIERS="$(node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const m=JSON.parse(d);const t=m.modules.gamedesign&&m.modules.gamedesign.tiers;console.log(t&&Array.isArray(t.core)&&Array.isArray(t.library)?'yes':'no')})" < "$BUNDLED/manifest.json")"
[[ "$GD_TIERS" == "yes" ]] && pass "bundled: modules.gamedesign.tiers {core,library} arrays" || fail "bundled: gamedesign tiers malformed"

# `always` injected: a core rule is always:true, a stack rule is always:false.
assert_json_field "$BUNDLED/manifest.json" "modules.code.engines.unity.core.0.always" true \
    "bundled: unity core rule has always=true"
assert_json_field "$BUNDLED/manifest.json" "modules.code.engines.unity.stack.0.always" false \
    "bundled: unity stack rule has always=false"

# Physical layout.
for engine in unity godot godot-net unreal-engine-5; do
    [[ -d "$BUNDLED/code/$engine/core" ]] && pass "bundled: code/$engine/core dir" || fail "bundled: code/$engine/core missing"
done
[[ -d "$BUNDLED/gamedesign/core" && -d "$BUNDLED/gamedesign/library" ]] \
    && pass "bundled: gamedesign/{core,library} dirs" || fail "bundled: gamedesign dirs missing"
# No leftover flat engine dirs at the snapshot root.
[[ ! -d "$BUNDLED/unity" ]] && pass "bundled: no flat unity/ at root (fully code-wrapped)" || fail "bundled: flat unity/ still at root"

# ─────────────────────────────────────────────
# Part B: build-manifest.js regenerates the same canonical schema:2 shape
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part B: build-manifest.js output${NC}"

if [[ -f "$BUNDLED/scripts/build-manifest.js" ]]; then
    REPO_COPY="$TMPDIR/repo"
    cp -r "$BUNDLED" "$REPO_COPY"
    rm -f "$REPO_COPY/manifest.json"
    if (cd "$REPO_COPY" && node scripts/build-manifest.js > "$TMPDIR/build.log" 2>&1); then
        pass "build-manifest.js runs clean"
        assert_json_field "$REPO_COPY/manifest.json" schema 2 "regenerated manifest schema:2"
        REGEN_TOP_ENGINES="$(has_top_level_field "$REPO_COPY/manifest.json" engines)"
        [[ "$REGEN_TOP_ENGINES" == "no" ]] && pass "regenerated: no top-level engines" || fail "regenerated: top-level engines leaked"
        assert_json_field "$REPO_COPY/manifest.json" "modules.code.engines.unity.core.0.always" true \
            "regenerated: always=true on a core rule"
        GD_OK="$(node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const m=JSON.parse(d);console.log(m.modules.gamedesign&&m.modules.gamedesign.tiers?'yes':'no')})" < "$REPO_COPY/manifest.json")"
        [[ "$GD_OK" == "yes" ]] && pass "regenerated: gamedesign module emitted" || fail "regenerated: gamedesign module missing"
    else
        fail "build-manifest.js failed to run"
        cat "$TMPDIR/build.log"
    fi
else
    fail "bundled snapshot is missing scripts/build-manifest.js"
fi

# ─────────────────────────────────────────────
# Part C: the CLI accepts the bundled snapshot as a reachable schema:2 registry
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Part C: CLI accepts the bundled snapshot${NC}"

BUNDLED_TARGET="$(normalize_path_for_json "$BUNDLED")"
set +e
node "$CLI" rules registry status "$BUNDLED_TARGET" --json > "$TMPDIR/status.json" 2> /dev/null
RC=$?
set -e
assert_exit 0 "$RC" "rules registry status on bundled exits 0"
assert_json_field "$TMPDIR/status.json" schema 2 "bundled reports schema:2 via status"
assert_json_field "$TMPDIR/status.json" readable true "bundled is readable"

print_summary_and_exit "registry format Smoke Tests"
