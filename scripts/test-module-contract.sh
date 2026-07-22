#!/bin/bash
# Guard #2 — module-contract completeness + no-hardcode tiers in the routers.
#
# The modular knowledge base is driven by MODULE_REGISTRY (src/core/modules.ts).
# Every registered module must be fully wired across four surfaces, and the two
# router skills must stay tier-agnostic (no hardcoded module/tier paths). This
# guard proves both, derived from MODULE_REGISTRY itself so a new module fails
# loudly until it is wired everywhere.
#
# Two arms:
#   Arc A (per-module completeness) — for every module in MODULE_REGISTRY assert:
#     1. a registry section (manifest `modules.<id>` + top-level `rules-registry/<id>/`)
#     2. an entry in the generated `.unikit/system/modules.yml`
#     3. a content contract `skills/unikit-memory/references/module-<id>.md`
#     4. the GLOBAL router skills exist (unikit-memory, unikit-rules-registry —
#        they serve every module via --module / inference; a per-prefix router
#        like `unikit-gd-memory` must NOT be required), plus ≥1 skill carrying
#        the module's `<skillPrefix>-` prefix (WARN while the family has not
#        shipped yet — tightened to a hard fail by PR#4 task #18)
#   Arc B (no-hardcode tiers) — grep EXACTLY the two router SKILL.md bodies
#     (`unikit-memory`, `unikit-rules-registry`, excluding their `references/`)
#     for concrete module/tier path literals built from MODULE_REGISTRY. No broad
#     sweep over `skills/` — the code-pinned `/unikit` orchestrator legitimately
#     hardcodes `code/{core,stack}` and is out of scope here.
#
# Usage: ./scripts/test-module-contract.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -f "$ROOT_DIR/rules-registry/manifest.json" ]; then
    bash "$SCRIPT_DIR/download-rules.sh"
fi

# shellcheck source=./test-fixtures.sh
source "$SCRIPT_DIR/test-fixtures.sh"

ensure_build

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo -e "${BOLD}=== guard #2 (module-contract completeness + tier-agnostic routers) ===${NC}"

# ─────────────────────────────────────────────
# Introspect MODULE_REGISTRY (the single source of truth) from the built dist.
# Each line: id<TAB>tier1,tier2<TAB>enginePartitioned<TAB>skillPrefix
# ─────────────────────────────────────────────
MODULE_LINES=$(cd "$ROOT_DIR" && node -e "
    import('./dist/core/modules.js').then(m => {
        for (const mod of m.listModules()) {
            process.stdout.write([mod.id, mod.tiers.join(','), mod.enginePartitioned, mod.skillPrefix].join('\t') + '\n');
        }
    });
")

if [[ -z "$MODULE_LINES" ]]; then
    fail "MODULE_REGISTRY introspection returned no modules"
    print_summary_and_exit "guard #2"
fi

# Generate a real modules.yml the same way init/update does, then read it back.
GEN_PROJ="$TMPDIR/gen-proj"
mkdir -p "$GEN_PROJ"
# Run from GEN_PROJ so process.cwd() is the project dir (avoids passing a
# Git-Bash POSIX path to Windows node), and import the asset module by a path
# relative to the repo root resolved as a file URL.
ASSET_URL=$(cd "$ROOT_DIR" && node -e "console.log(require('url').pathToFileURL('dist/core/installer/system-assets.js').href)")
(cd "$GEN_PROJ" && node -e "
    import(process.argv[1]).then(m => m.installModulesYml(process.cwd()));
" "$ASSET_URL") > /dev/null 2>&1
MODULES_YML="$GEN_PROJ/.unikit/system/modules.yml"
if [[ -f "$MODULES_YML" ]]; then
    pass "installModulesYml generated .unikit/system/modules.yml"
else
    fail "installModulesYml did not produce modules.yml at $MODULES_YML"
    print_summary_and_exit "guard #2"
fi

MANIFEST="$ROOT_DIR/rules-registry/manifest.json"
MEMORY_REFS_DIR="$ROOT_DIR/skills/unikit-memory/references"

# ─────────────────────────────────────────────
# Arc A — per-module completeness across all four surfaces
# ─────────────────────────────────────────────
echo -e "\n${BOLD}Arc A: every MODULE_REGISTRY module is fully wired${NC}"

while IFS=$'\t' read -r MID TIERS EP PREFIX; do
    [[ -z "$MID" ]] && continue

    # 1a. registry manifest section
    if node -e "
        const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
        process.exit(m.modules && m.modules[process.argv[2]] ? 0 : 1);
    " "$MANIFEST" "$MID" 2> /dev/null; then
        pass "[$MID] registry manifest has modules.$MID section"
    else
        fail "[$MID] registry manifest missing modules.$MID section"
    fi

    # 1b. registry top-level module directory
    if [[ -d "$ROOT_DIR/rules-registry/$MID" ]]; then
        pass "[$MID] registry directory rules-registry/$MID/ exists"
    else
        fail "[$MID] registry directory rules-registry/$MID/ missing"
    fi

    # 2. modules.yml entry
    if grep -qE "^[[:space:]]+id: $MID$" "$MODULES_YML"; then
        pass "[$MID] modules.yml carries an entry"
    else
        fail "[$MID] modules.yml has no 'id: $MID' entry"
    fi

    # 3. content contract under unikit-memory references/
    if [[ -f "$MEMORY_REFS_DIR/module-$MID.md" ]]; then
        pass "[$MID] contract skills/unikit-memory/references/module-$MID.md exists"
    else
        fail "[$MID] missing contract references/module-$MID.md"
    fi

    # 4. global routers + skill family for the module's skillPrefix.
    #
    # The routers are GLOBAL by design (unikit-memory / unikit-rules-registry
    # serve every module via --module / inference) — deriving router names from
    # the prefix would demand a nonexistent `unikit-gd-memory`. The per-module
    # signal is instead "≥1 skill carries the `<skillPrefix>-` prefix". While a
    # module's skill family has not shipped yet (gamedesign before PR#4 Phase D)
    # zero matches is a WARN, not a fail; task #18 (Phase G) tightens it to a
    # hard fail once the gd-skills exist.
    for router in unikit-memory unikit-rules-registry; do
        if [[ -f "$ROOT_DIR/skills/$router/SKILL.md" ]]; then
            pass "[$MID] global router skill $router exists"
        else
            fail "[$MID] global router skill $router missing"
        fi
    done

    PREFIX_SKILLS=$(find "$ROOT_DIR/skills" -mindepth 1 -maxdepth 1 -type d -name "$PREFIX-*" | wc -l | tr -d '[:space:]')
    if [[ "$PREFIX_SKILLS" -ge 1 ]]; then
        pass "[$MID] $PREFIX_SKILLS skill(s) carry the $PREFIX- prefix"
    else
        echo -e "  ${YELLOW}⚠${NC} [$MID] no skills with prefix $PREFIX- yet (family not shipped — WARN only, see header)"
    fi
done <<< "$MODULE_LINES"

# ─────────────────────────────────────────────
# Arc B — the two routers never hardcode module/tier paths
# ─────────────────────────────────────────────
# Forbidden literals are built from MODULE_REGISTRY: for each (module, tier) the
# router must NOT contain the concrete memory path `memory/<id>/<tier>` nor the
# registry layout hardcodes `<engine>/<tier>` / `<id>/<engine>/<tier>`. Routers
# are expected to use `<module>`/`<tier>` placeholders and read tiers from
# modules.yml. Prose mentions of "core"/"stack" (backticked, in tables) do not
# match these path-shaped literals.
echo -e "\n${BOLD}Arc B: routers stay tier-agnostic (no hardcoded module/tier paths)${NC}"

ROUTER_SKILLS=(
    "$ROOT_DIR/skills/unikit-memory/SKILL.md"
    "$ROOT_DIR/skills/unikit-rules-registry/SKILL.md"
)

FORBIDDEN=()
while IFS=$'\t' read -r MID TIERS EP PREFIX; do
    [[ -z "$MID" ]] && continue
    IFS=',' read -r -a TIER_ARR <<< "$TIERS"
    for T in "${TIER_ARR[@]}"; do
        FORBIDDEN+=("memory/$MID/$T")
        FORBIDDEN+=("<engine>/$T")
        FORBIDDEN+=("$MID/<engine>/$T")
    done
done <<< "$MODULE_LINES"

ARC_B_CLEAN=1
for skill in "${ROUTER_SKILLS[@]}"; do
    if [[ ! -f "$skill" ]]; then
        fail "router skill missing: $skill"
        ARC_B_CLEAN=0
        continue
    fi
    for lit in "${FORBIDDEN[@]}"; do
        set +e
        HITS=$(grep -nF -- "$lit" "$skill")
        set -e
        if [[ -n "$HITS" ]]; then
            ARC_B_CLEAN=0
            fail "$(basename "$(dirname "$skill")") hardcodes tier path '$lit' — use <module>/<tier> + modules.yml"
            echo "$HITS"
        fi
    done
    # Positive signal: the router must actually read the module registry.
    if grep -q "modules.yml" "$skill"; then
        pass "$(basename "$(dirname "$skill")") references modules.yml"
    else
        fail "$(basename "$(dirname "$skill")") does not reference modules.yml"
    fi
done

if [[ $ARC_B_CLEAN -eq 1 ]]; then
    pass "no hardcoded module/tier path literals in the two routers"
fi

# ─────────────────────────────────────────────
# Arc C — modularity smoke
# ─────────────────────────────────────────────
# Both routers must wire to the module registry (modules.yml) AND acknowledge the
# per-module content contract (references/module-<id>.md). The non-code layout
# (gamedesign/{core,library}) is intentionally NOT re-tested here — it already has
# dedicated coverage in test-registry-format.sh (Part 19). This arc only proves
# that coverage still exists, so the two guards stay complementary rather than
# duplicating fixtures (a multi-module fixture arrives with PR#4).
echo -e "\n${BOLD}Arc C: modularity smoke (router wiring + Part 19 cross-check)${NC}"

for skill in "${ROUTER_SKILLS[@]}"; do
    sname="$(basename "$(dirname "$skill")")"
    if grep -q "references/module-" "$skill"; then
        pass "$sname references the per-module contract (references/module-<id>.md)"
    else
        fail "$sname does not reference references/module-<id>.md"
    fi
done

REGISTRY_FORMAT_TEST="$SCRIPT_DIR/test-registry-format.sh"
if [[ -f "$REGISTRY_FORMAT_TEST" ]] \
    && grep -q "gamedesign/core" "$REGISTRY_FORMAT_TEST" \
    && grep -q "gamedesign/library" "$REGISTRY_FORMAT_TEST"; then
    pass "non-code layout gamedesign/{core,library} stays covered by test-registry-format.sh (Part 19)"
else
    fail "test-registry-format.sh no longer covers gamedesign/{core,library} — Part 19 cross-check broken"
fi

print_summary_and_exit "guard #2"
