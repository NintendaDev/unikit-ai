# Design Review: [Document or Scope] — [YYYY-MM-DD]

> **Reviewed**: [SYS-slug vX / GAME.md vX / full design] · **Reviewer**: `unikit-gd-review`
> **Verdict**: [single: APPROVED | NEEDS REVISION | MAJOR REVISION] · [cross: PASS | CONCERNS | FAIL]

A quality verdict, not a consistency check (that is `unikit-gd-verify`). The
reviewer's job is to FIND PROBLEMS, not to validate. Every finding cites a
section AND the evidence (the contradicted pillar, fact, or rule) — a finding
with no citation is an opinion, downgraded to a Suggestion. Severity follows the
rubric in `.unikit/system/gd-principles.md`. The room has no authority: this
verdict informs the user's Status decision in GD-INDEX; it never auto-applies.

## Verdict Rationale

[2–3 sentences: why this verdict. A single Critical anywhere forces MAJOR
REVISION (single) / FAIL (cross). Name the deciding findings.]

## Findings

[Merged and deduped across all lenses, then severity-classified. Lenses applied:
completeness · clarity/implementability · pillar alignment · systems-math ·
domain (economy/UX/accessibility/ethics/liveops) · feasibility · scope.]

| # | Severity | Section | Finding | Evidence (cited fact / pillar / rule) |
|---|----------|---------|---------|----------------------------------------|
| 1 | Critical | [C / D / …] | [What is wrong / underspecified / missing] | [PIL-n design test, FORM-x range, GD-IDS fact, domain rule] |
| 2 | Major | [section] | [Finding] | [Citation] |
| 3 | Minor | [section] | [Finding] | [Citation] |

Severity: **Critical** blocks handoff · **Major** risk if unaddressed ·
**Minor** text quality · **Suggestion** plussing, never blocks.

## Required Before Implementation

[All Critical + Major findings, as an actionable checklist. This is the blocking
set — the document is not ready for the code side until these clear.]

- [ ] [#1 — Critical — short action]
- [ ] [#2 — Major — short action]

## Non-Blocking (Minor + Suggestions)

[Minor findings and invited "what if…" builds. Explicitly does NOT block handoff.
Suggestions are offered, not required — plussing (d.school "I like / I wish /
What if"), included here only because the user asked for direction.]

- [#3 — Minor — note]
- [What if… — suggestion, optional]

## I Like

[Honest calibration — what works, and why. A review with zero positives is as
miscalibrated as one with zero findings. Not flattery: cite the specific
strength.]

- [Specific thing that works well, and the evidence it works.]
