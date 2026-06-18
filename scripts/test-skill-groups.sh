#!/bin/bash
# Guard: validates the skill-grouping SSOT (src/core/skill-groups.ts) against
# the skills actually present on disk, and locks the behavior of its pure
# resolution functions.
#
# Two jobs:
#   1. Completeness — every available skill (getAvailableSkills) resolves into
#      EXACTLY one group, and no group references a skill that does not exist.
#      A new skill added under skills/ without a group assignment fails here.
#   2. Pure-function contract — resolveSkillDefaults / findUngrouped /
#      resolveSkillPrune behave as specified. The init wizard has no
#      non-interactive driver, so these guard assertions are the ONLY coverage
#      for the re-init default/prune logic; they also give the new exports a
#      consumer so `npm run lint` (knip) stays green.
#
# The checks run against the compiled dist/ via dynamic import with absolute
# file URLs (cwd-independent, Windows-safe).
#
# Usage: ./scripts/test-skill-groups.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Shared helpers: pass/fail counters + print_summary_and_exit.
# shellcheck source=./test-fixtures.sh
source "$SCRIPT_DIR/test-fixtures.sh"

# Ensure dist/ is current (no-op when the parent runner already built).
ensure_build

echo -e "${BOLD}=== Skill grouping guard ===${NC}"

CHECK_MJS="$(mktemp -d)/check-skill-groups.mjs"
trap 'rm -rf "$(dirname "$CHECK_MJS")"' EXIT

cat > "$CHECK_MJS" <<'NODE'
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.argv[2];
const url = (rel) => pathToFileURL(path.join(root, rel)).href;
const skillsMod = await import(url('dist/core/installer/skills.js'));
const groupsMod = await import(url('dist/core/skill-groups.js'));

const { getAvailableSkills } = skillsMod;
const { SKILL_GROUPS, groupSkills, findUngrouped, resolveSkillDefaults, resolveSkillPrune } = groupsMod;

const available = [...(await getAvailableSkills())].sort();
const results = [];
const ok = (m) => results.push(['ok', m]);
const bad = (m) => results.push(['fail', m]);

// 1. Every available skill resolves into a group.
const ungrouped = findUngrouped(available);
ungrouped.length === 0
  ? ok('every available skill resolves into a group')
  : bad(`ungrouped skills: ${ungrouped.join(', ')}`);

// 2. Exactly one group each — grouped flat set matches the available set 1:1.
const grouped = groupSkills(available);
const groupedFlat = grouped.flatMap((g) => g.skills);
const groupedSet = new Set(groupedFlat);
groupedFlat.length === available.length && groupedSet.size === available.length
  ? ok('each available skill appears in exactly one group')
  : bad(`partition mismatch: grouped=${groupedFlat.length} unique=${groupedSet.size} available=${available.length}`);

// 3. No group references a skill that does not exist on disk.
const availableSet = new Set(available);
const phantom = SKILL_GROUPS.flatMap((g) => g.skills ?? []).filter((s) => !availableSet.has(s));
phantom.length === 0
  ? ok('no group references a nonexistent skill')
  : bad(`phantom skill ids: ${phantom.join(', ')}`);

// 4. resolveSkillDefaults(null) = the full available set (fresh install).
const dFull = resolveSkillDefaults(available, null);
dFull.length === available.length && available.every((s) => dFull.includes(s))
  ? ok('resolveSkillDefaults(null) returns the full available set')
  : bad('resolveSkillDefaults(null) did not return the full available set');

// 5. resolveSkillDefaults(subset) mirrors the installed set (re-init).
const subset = available.slice(0, 3);
const dSub = resolveSkillDefaults(available, subset);
dSub.length === subset.length && subset.every((s) => dSub.includes(s))
  ? ok('resolveSkillDefaults(subset) mirrors the installed set')
  : bad('resolveSkillDefaults(subset) did not mirror the installed set');

// 5b. resolveSkillDefaults drops skills the package no longer ships.
const dStale = resolveSkillDefaults(available, [...subset, 'unikit-ghost-skill']);
!dStale.includes('unikit-ghost-skill')
  ? ok('resolveSkillDefaults drops skills no longer available')
  : bad('resolveSkillDefaults kept a no-longer-available skill');

// 6. resolveSkillPrune(baseline, selected) = baseline minus selected.
const prune = resolveSkillPrune(['a', 'b', 'c'], ['a']);
prune.length === 2 && prune.includes('b') && prune.includes('c')
  ? ok('resolveSkillPrune returns baseline minus selected')
  : bad(`resolveSkillPrune wrong: ${JSON.stringify(prune)}`);

// 6b. selected superset of baseline -> empty prune set.
const pruneEmpty = resolveSkillPrune(['a', 'b'], ['a', 'b', 'c']);
pruneEmpty.length === 0
  ? ok('resolveSkillPrune is empty when selected covers baseline')
  : bad(`resolveSkillPrune should be empty: ${JSON.stringify(pruneEmpty)}`);

for (const [status, msg] of results) {
  console.log(`${status}\t${msg}`);
}
process.exit(results.some(([status]) => status === 'fail') ? 1 : 0);
NODE

# Run the checks; capture each line and route to pass/fail. We tolerate a
# non-zero exit (set -e) since failures are reported per-line below.
CHECK_OUT="$(node "$CHECK_MJS" "$ROOT_DIR" 2>&1)" || true

if [[ -z "$CHECK_OUT" ]]; then
    fail "skill-groups checks produced no output (import/runtime error)"
else
    while IFS=$'\t' read -r status msg; do
        [[ -z "$status" ]] && continue
        if [[ "$status" == "ok" ]]; then
            pass "$msg"
        else
            fail "$msg"
        fi
    done <<< "$CHECK_OUT"
fi

print_summary_and_exit "Skill grouping guard"
