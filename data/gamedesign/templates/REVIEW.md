# Design Review: [Document or Scope] — [YYYY-MM-DD]

> **Reviewed**: [SYS-slug vX / GAME.md vX / full design] · **Reviewer**: `unikit-gd-review`
> **Verdict**: [single: APPROVED | NEEDS REVISION | MAJOR REVISION] · [cross: PASS | CONCERNS | FAIL]
> **Scope signal**: [single SYS-slug | cross: N systems] · **Mode**: [review | critique]

A quality verdict, not a consistency check (that is `unikit-gd-verify`). The
reviewer's job is to FIND PROBLEMS, not to validate. Every finding cites a
section AND the evidence (the contradicted pillar, fact, or rule) — a finding
with no citation is an opinion, downgraded to a Suggestion. Severity follows the
rubric in `.unikit/system/gamedesign/gd-critique.md`. The room has no authority: this
verdict informs the user's Status decision (recorded in `GD-IDS`, rendered in
`GAME.md`'s `## System Map [gen]`); it never auto-applies.

After the verdict, every finding is triaged into one of two **buckets** — the durable
handoff interface (`gd-critique` → Handoff Engine). The buckets are **orthogonal to
severity** (severity stays the Findings column): they sort by *who acts* —
**Apply-ready** carries a named entailed fix for `unikit-gd-apply`, **Research** is a
diagnosis still needing a decision, for `unikit-gd-explore`. The two buckets **replace**
the old Required-Before-Implementation / Non-Blocking split. An empty bucket is valid.

## Verdict Rationale

[2–3 sentences: why this verdict. A single Critical anywhere forces MAJOR
REVISION (single) / FAIL (cross). Name the deciding findings.]

## Findings

[Merged and deduped across all lenses, then severity-classified. Lenses applied:
completeness · clarity/implementability · pillar alignment · systems-math ·
fantasy-delivery · domain (economy/UX/accessibility/ethics/liveops) · feasibility ·
scope · (flows) pacing/guidance/funnel · (content) schema-coherence/catalog-scale.
Each finding has a stable id `RF-<date>-n`, numbered in severity order, Critical first.]

| RF | Severity | Document / Section | Lens | Diagnosis (problem + evidence) |
|----|----------|--------------------|------|--------------------------------|
| RF-<date>-1 | Critical | [SYS-combat / D] | [systems-math] | [FORM-damage output contradicts PIL-2's design test] |
| RF-<date>-2 | Major | [section] | [lens] | [problem + cited fact / pillar / rule] |
| RF-<date>-3 | Minor | [section] | [lens] | [problem + citation] |

Severity: **Critical** blocks handoff · **Major** risk if unaddressed ·
**Minor** text quality · **Suggestion** plussing, never blocks.

## Apply-ready  ← hand to /unikit-gd-apply

[The entailed + user-decided findings — each carries a named fix the user can apply now
(the ENTAILED gate: one concrete target · the value already authoritative in the registry ·
one local edit · no external knowledge). One line each. Empty bucket → write "(none)".]

- RF-<date>-n · [target doc / section] · Fix (entailed): [the single named edit]

## Research  ← hand to /unikit-gd-explore

[The diagnoses that still need a decision — develop each via the internal-design lens,
then apply. One line each. Empty bucket → write "(none)".]

- RF-<date>-n · [the open question to work out]

## I Like

[Honest calibration — what works, and why. A review with zero positives is as
miscalibrated as one with zero findings. Not flattery: cite the specific
strength.]

- [Specific thing that works well, and the evidence it works.]
