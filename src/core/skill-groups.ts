// Skill grouping — single source of truth for the interactive `init`/`update`
// skill picker.
//
// Skills are partitioned into a handful of user-facing groups (Core, Memory and
// rules, Code, Game Design, Tools) purely for the checkbox UX. This grouping is
// the SSOT for that UX and is guarded by `scripts/test-skill-groups.sh`
// (every available skill resolves into exactly one group, no phantom ids).
//
// NOTE: skill→group (this file, UI buckets) is a DIFFERENT map than skill→module
// (`modules.ts`, knowledge-base partitions). They happen to share the Game
// Design boundary but are intentionally separate concerns — do not conflate.
//
// Pure data + pure functions. No logging, no I/O, no interactivity. All
// interactive prompting lives in the wizard/command layer; these functions only
// compute group membership and default/prune sets so the risky resolution logic
// stays testable in isolation.

/** A user-facing bucket of skills shown as one checkbox section. */
export interface SkillGroup {
  /** Stable group id (used for ordering/lookup, not shown to the user). */
  id: string;
  /** Display title rendered as the checkbox section header. */
  title: string;
  /** Exact skill ids that belong to this group. */
  skills?: readonly string[];
  /** Skills whose id starts with this prefix belong to this group. */
  prefix?: string;
}

/** One group paired with the available skills that fall into it. */
export interface GroupedSkills {
  group: SkillGroup;
  skills: string[];
}

/**
 * The canonical group layout (registry order = display order).
 *
 * Explicit `skills` membership is matched exactly; `prefix` membership matches
 * by id prefix. The two never overlap: `code` skills are listed explicitly and
 * the only prefix group (`Game Design`, `unikit-gd-`) never collides with an
 * explicit id. Keep this in sync with the skills on disk — the guard test
 * fails on any available skill that lands in zero or more than one group.
 */
export const SKILL_GROUPS: readonly SkillGroup[] = [
  {
    id: 'core',
    title: 'Core',
    skills: ['unikit', 'unikit-help'],
  },
  {
    id: 'memory-rules',
    title: 'Memory and rules',
    skills: ['unikit-memory', 'unikit-rules', 'unikit-rules-registry', 'unikit-skills-context'],
  },
  {
    // NOTE: this is a UI-bucket id, NOT the `code` knowledge-module id
    // (CODE_MODULE_ID). Kept distinct on purpose — skill→group is a different
    // map than skill→module — and named to avoid the reserved module literal.
    id: 'code-skills',
    title: 'Code',
    skills: [
      'unikit-architecture', 'unikit-commit', 'unikit-devcontext', 'unikit-evolve',
      'unikit-explore', 'unikit-fix', 'unikit-implement', 'unikit-improve',
      'unikit-plan', 'unikit-review', 'unikit-roadmap', 'unikit-verify',
    ],
  },
  {
    id: 'gamedesign',
    title: 'Game Design',
    prefix: 'unikit-gd-',
  },
  {
    id: 'tools',
    title: 'Tools',
    skills: ['unikit-docs', 'unikit-todo'],
  },
];

/**
 * Resolve the group a skill belongs to, or `undefined` if it is ungrouped.
 *
 * Explicit membership wins over prefix membership so that a hypothetical future
 * skill listed in an explicit group is never shadowed by a prefix bucket.
 */
function resolveSkillGroup(skill: string): SkillGroup | undefined {
  const explicit = SKILL_GROUPS.find(g => g.skills?.includes(skill));
  if (explicit) {
    return explicit;
  }
  return SKILL_GROUPS.find(g => g.prefix !== undefined && skill.startsWith(g.prefix));
}

/**
 * Bucket the available skills into ordered groups, preserving registry order
 * and dropping groups that have no available members. Skills with no group are
 * NOT included here — surface them with {@link findUngrouped}.
 */
export function groupSkills(available: string[]): GroupedSkills[] {
  return SKILL_GROUPS
    .map(group => ({
      group,
      skills: available.filter(s => resolveSkillGroup(s)?.id === group.id),
    }))
    .filter(entry => entry.skills.length > 0);
}

/**
 * Available skills that fall into no group. The guard test asserts this is
 * always empty; the wizard also calls it defensively to warn (and fold the
 * stragglers into a fallback bucket) rather than silently hiding a new skill.
 */
export function findUngrouped(available: string[]): string[] {
  return available.filter(s => resolveSkillGroup(s) === undefined);
}

/**
 * Default-checked skills for the picker.
 *
 *  - Fresh install (`existing === null`): everything is checked — the historical
 *    "install all" default is preserved as the default selection.
 *  - Re-init (`existing` is an array): mirror the previously installed set,
 *    intersected with what is still available so package-dropped skills fall off.
 *
 * The `null` sentinel is load-bearing: an empty array means "re-init where the
 * user had nothing / deselected all", which must NOT be treated as a fresh
 * install. Never pass `[]` to mean fresh.
 */
export function resolveSkillDefaults(available: string[], existing: string[] | null): string[] {
  if (existing === null) {
    return [...available];
  }
  const availableSet = new Set(available);
  return existing.filter(s => availableSet.has(s));
}

/**
 * Skills to remove on re-init: those previously installed for an agent
 * (`agentBaseline`) that the user de-selected (absent from `selected`).
 *
 * Pure set difference `baseline − selected`. Extracted here (rather than inlined
 * in `init.ts`) because the init wizard has no non-interactive test driver, so
 * this is the only place the re-init prune logic can be guard-tested.
 */
export function resolveSkillPrune(agentBaseline: string[], selected: string[]): string[] {
  const selectedSet = new Set(selected);
  return agentBaseline.filter(s => !selectedSet.has(s));
}
