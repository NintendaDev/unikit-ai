---
name: unikit-gd-review
description: >-
  Qualitative quality review of game design documents — answers "is this design good,
  and does it follow best practices?" — across all three GDD axes: systems, flows, and
  content types. Fans out adversarial lenses (completeness, clarity, pillar alignment,
  systems-math, fantasy-delivery, catalog scale, pacing & funnel, feasibility, scope) plus
  domain lenses that check it against the game-design rules, each prompted to find problems
  rather than validate; produces a severity-graded verdict and report. Scope is inferred: a
  named system, flow, or content type reviews that document; "all" runs a cross-document
  review. Use when the user wants a critique, quality judgment, or rules check of the design,
  e.g. "review the combat GDD", "does this follow best practices", "check the design
  against the rules", "is the loot content well-designed", "review the onboarding flow".
  This is the subjective quality pass — for a mechanical consistency check (numbers, terms,
  IDs, references matching the registry) use /unikit-gd-verify.
argument-hint: "[system name | SYS-slug | path | \"all\"]  (scope inferred; no flags)"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - Edit
  - Bash(ls *)
  - Bash(find *)
  - Bash(wc *)
  - Bash(date *)
  - Bash(mkdir *)
  - Agent
  - AskUserQuestion
disable-model-invocation: false
user-invocable: true
metadata:
  author: unikit
  version: "1.0"
  category: game-design
---

# Game Design — Quality Review

Answer **"is this design good?"** — expert judgment on a finished design document,
delivered as a severity-graded verdict with evidence. This is the design-side
mirror of `unikit-review`. It is distinct from `unikit-gd-verify`, which answers
the cheaper, binary **"is the design consistent with itself?"** — a review finding
*can* be declined; a verify conflict cannot.

Review is **axis-aware**: it judges **systems** (the A–K GDD), **flows** (`FLOW.md`
+ the `## Flow Map [gen]` / `## Funnel [gen]` renders), and **content types**
(`CONTENT-TYPE.md` + the `## Content Map [gen]` render). The flow lenses — pacing /
guidance / funnel — and the content lenses — schema-coherence / catalog-scale /
content-fantasy-delivery — live in `references/lenses.md` alongside the system lenses.

A review is most honest in a **fresh session** — the reviewer should not be the
author of the document. This skill never authors or edits design **content**; its
only writes are the review report and — with the user's approval, to record a
verdict — the system's `doc_status` in its **two** coherent places (the `SYSTEM.md`
header `> Status:` line and the `GD-IDS.yaml` `doc_status`). The `## System Map
[gen]` in `GAME.md` re-renders that status read-only (a freshness concern owned by
`unikit-gd-verify` / `unikit-gd-spec`, never a third write surface).

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply it to all output and the report (fall back to English if it is missing) —
including the rule to **translate concepts, not transliterate jargon**.
`gd-principles` → "Language" adds the game-design specifics: which IDs and stored
field values stay English. Do not announce the language setting.

<!-- unikit:agents codex -->
## Subagent Delegation — BLOCKING PRE-REQUISITE

When the workflow reaches the lens fan-out (`Agent`), the assistant MUST spawn the
review lenses as parallel sub-agents if agent execution is supported and not
prohibited by higher-priority instructions. Only if agent execution is unavailable
or blocked does the assistant run the lenses sequentially in the main session.
<!-- unikit:end -->

## Phase 0 — Bootstrap

Silently load — do not narrate:

1. **`.unikit/system/gamedesign/gd-principles.md`** (the core) — the language rules
   (plus the zone model and one-way boundary). Plus, from the same `gamedesign/`
   folder, the shards this skill needs: **`gd-critique.md`** (the **severity rubric**
   — Critical / Major / Minor / Suggestion — and the **critique stance** — Braintrust:
   diagnose don't prescribe; critique vs review; plussing), **`gd-flow-axis.md`** (the
   Flow Axis contract behind the pacing / guidance / funnel lenses),
   **`gd-content-axis.md`** (the Content Axis contract behind the schema-coherence /
   catalog-scale / content-fantasy-delivery lenses), and **`gd-provenance.md`** (the
   import provenance markers the provenance lens checks). This skill **applies** them.
   If missing, warn (`unikit-ai update`) and fall back to the rubric summarized in
   `references/lenses.md`.
2. **`.unikit/gamedesign/GD-IDS.yaml`** and **`GAME.md`** (incl. its `## System Map
   [gen]` render) — pillars, the roster, and the facts every finding is checked
   against. **Schema guard (clean break — no automatic migration):** `GD-IDS.yaml`
   MUST be `version: 2`; on a pre-v2 `version: 1` registry, **STOP** and tell the
   user the workspace predates the v2 clean break (the standalone markdown
   system-index was dropped; the roster renders into `GAME.md` now) — upgrade via
   `/unikit-gd-spec` before reviewing.
3. **`{{skills_dir}}/{{self_name}}/references/lenses.md`** — the lens catalog and
   the adversarial prompts (absorbed from the former `review-lenses` rule).
4. **`.unikit/memory/gamedesign/RULES_INDEX.md`** — load the **core** domain rules
   for the target's behaviour/domain (by `Load When`) so each domain lens has its theory:
   `economy`, `balance`, `progression`, `ux-onboarding`, `accessibility`,
   `monetization-ethics`, `liveops`, `frameworks`. Obey the index's
   **Rule-Loading Discipline**: load by `Load When`, load a reference only from its
   parent rule's `> **References**:`, and **never glob the memory tree**
   (`.unikit/memory/gamedesign/**`) to discover rules.
5. **`.unikit/RULES.md`** (if present) — project overrides, highest priority.

**One-way boundary:** never read `.unikit/code/`, project source, or build
artifacts. **Single sanctioned exception:** the **feasibility lens** may read
**only** `.unikit/DESCRIPTION.md` and `.unikit/ARCHITECTURE.md` (two files, exact
paths) to flag implementability risks. It must NOT read `.unikit/code/`, `Assets/`,
or any source/build artifact — doing so violates the one-way boundary. A
feasibility finding cites the line it relied on in DESCRIPTION/ARCHITECTURE as its
evidence.

## Phase 1 — Resolve Scope & Mode (no flags)

**Scope** is a function of the prompt:

1. The argument names a system or a path → **single** review of that document.
2. The prompt says "all" / "all systems" / "все" → **cross** review of every
   `detailed`/`reviewed` system.
3. Empty argument and several systems are detailed → **ask**:

   ```
   AskUserQuestion: What should I review?
   Options: <each detailed system> · All systems (cross-review) · None
   ```

**Mode** is the user's call — **critique** (iterate on a draft) or **review**
(verdict on a finished document). Default to review on a `detailed`/`reviewed`
document; offer critique if the user is mid-authoring. Announce scope + mode in one
line, then proceed.

## Phase 2 — Run the Lenses (adversarial fan-out)

Select the lenses from `references/lenses.md`: the **core** lenses always
(including **fantasy-delivery** — does section B's promised feeling actually arise
from C/D/E, and is an SDT need served?), plus the **domain** lenses matching the
system's behaviour/domain. When the system was built by import (its sections carry
provenance markers — see `gd-provenance` → Provenance), also run the **provenance**
lens over each `<!-- provenance: generated -->` section: inferred content is held to
a stricter bar (≥ Major against source/registry) than author-sourced text.

When the review **target is a `FLOW.md`** (or the scope is "all"), select the **flow
lenses** (pacing / guidance / funnel) from `references/lenses.md` alongside the system
lenses — a flow finding cites the `FLOW-<slug>` / `GOAL-<flow>-<n>` and the system
`AC` / pillar it serves, on the same `RF-<date>-n` rubric.

When the review **target is a `CONTENT-TYPE.md`** (or the scope is "all"), select the
**content lenses** (schema-coherence / catalog-scale / content-fantasy-delivery) from
`references/lenses.md` alongside the system lenses — a content finding cites the
`CT-<slug>` / `CU-<ct>-<n>` and the `belongs_to` system / pillar it serves, on the same
`RF-<date>-n` rubric.

Run them as **2–4 parallel inline `Agent()`** calls, each given one lens and the
adversarial framing *"find what is wrong — do NOT validate"*. Each agent is
**read-only** and returns findings only; it never writes. Fall back to running the
lenses sequentially in this session if the Agent tool is unavailable.

```
Agent(subagent_type: general-purpose, model: sonnet, prompt:
  "Review <doc path> through the <lens> lens. Your job is to FIND PROBLEMS, not
   validate. For each: severity (Critical/Major/Minor/Suggestion per the rubric),
   the document section, and the contradicted fact/pillar/rule as evidence.
   Diagnose — do not prescribe a fix. Return a findings list; write nothing.")
```

Collect and de-duplicate the findings. Drop any finding with no section+evidence
citation to **Suggestion** (`gd-critique`).

**Flow lenses (active).** When the target is a `FLOW.md`, run the flow review lenses
(pacing, guidance, funnel — does the wiring-mode deliver its intended arc, is each
`GOAL` step guided, does the `## Funnel [gen]` measure the moments that matter?) from
`references/lenses.md`, with the same adversarial framing. A `FLOW.md` **is** a review
target; the lenses run over systems, flows, and `GAME.md`.

**Content lenses (active).** When the target is a `CONTENT-TYPE.md`, run the content
review lenses (schema-coherence, catalog-scale, content-fantasy-delivery — does
`CT.fields` cover what the consuming system needs and are its types / `ref<>` right, is
`bulk` vs `curated` the right call, does the catalog deliver the feeling section B
promises?) from `references/lenses.md`, with the same adversarial framing. A
`CONTENT-TYPE.md` **is** a review target; the lenses run over systems, flows, content
types, and `GAME.md`.

**Genre lens (active, declinable).** When `GAME.md` carries a `genre_profile:` id, run
the genre **profile-completeness** lens (`references/lenses.md`): read that installed
profile's `critical_sections` (`.unikit/system/gamedesign/genres/<id>.json`) and ask
whether each is present and filled across the reviewed docs — a missing genre-critical
section is a **Major** (declinable / advisory — never a blocker). The profile's
`review_emphasis` is an advisory **re-weight** of the lens priorities, not a new rubric.
This is the **only** profile read on the design side — `unikit-gd-verify` stays
genre-blind (it never reads `critical_sections`). No `genre_profile:` (universal
baseline) → skip the lens.

## Phase 3 — Cross-Scope Checks (cross review only)

When the scope is "all", add the cross-system lenses from `references/lenses.md`:
formula compatibility, cross-AC consistency, pillar drift, total scope vs tiers,
and **3–5 end-to-end "one moment through N systems"** scenarios. These are the
checks no single-document review can make. **Depends symmetry is not a review
lens** — `unikit-gd-verify` owns the Depends 3-way check (section F ↔ GD-IDS
`depends_on` ↔ the `## System Map` Depends cell).

## Phase 4 — Verdict & Report

Compute the verdict from the findings:

- **Single:** `APPROVED` (no Critical/Major) · `NEEDS REVISION` (Major, no
  Critical) · `MAJOR REVISION` (≥1 Critical).
- **Cross:** `PASS` · `CONCERNS` · `FAIL` (≥1 Critical anywhere).

Give each finding a **stable id** `RF-<YYYY-MM-DD>-<n>` (numbered in severity
order, Critical first). The id lets a later `unikit-gd-system` edit cite the
finding it resolves in its changelog.

Write **`.unikit/gamedesign/reviews/<date>_review-<scope>.md`** (`mkdir -p` the
`reviews/` dir; `<scope>` is the SYS-slug or `all`). The report is the only memory
that survives a fresh-session review:

```markdown
# Review: <scope> — <YYYY-MM-DD>
> Verdict: <APPROVED|NEEDS REVISION|MAJOR REVISION | PASS|CONCERNS|FAIL>
> Scope signal: <single SYS-slug | cross: N systems>  ·  Mode: <review|critique>

## Findings
| RF | Severity | Document / Section | Lens | Diagnosis (problem + evidence) |
|----|----------|--------------------|------|--------------------------------|
| RF-<date>-1 | Critical | SYS-combat / D | systems-math | FORM-damage output contradicts PIL-2's design test |

## Required before implementation
<all Critical + Major, as an actionable checklist>

## Suggestions (non-blocking — plussing)
<"what if…" items; only if the user asked for prescriptions>

## I like
<what genuinely works — honest calibration, not flattery>
```

A **clean** single review with zero findings still writes the report (the audit
trail behind the Status change).

## Phase 5 — Status (soft gate)

On approval, the verdict updates the system's `doc_status` to `reviewed` in the
**two coherent places** — the `SYSTEM.md` header (the `> Status:` token in the
combined header line, never a separate bold line) and `GD-IDS.yaml` `doc_status`
(see gd-lifecycle → Lifecycle & Status). The `## System Map [gen]` re-renders that
status read-only (freshness — not a write target here). Never silently:

```
AskUserQuestion: Verdict is <verdict>. Set SYS-<slug> Status → reviewed?
Options:
1. Set Status: reviewed (recommended on APPROVED/PASS — writes both places)
2. Leave as-is — I'll address findings first
```

- A clean re-review of a `revised` system clears it **back to `reviewed`** — the
  `revised` → `reviewed` exit after re-verification.
- Report the write in the compact summary: which of the two surfaces changed.

The gate is soft: `unikit-plan` warns when a system's Status is not
`detailed`/`reviewed` or is `revised`. A review never auto-applies fixes — route
revisions to the owning zone (`unikit-gd-system` for a system, `unikit-gd-spec` for
`GAME.md`).

## Final: Compact Report & Next Steps

```
Scope: <SYS-slug | all (N systems)>   Mode: <review|critique>
Verdict: <verdict>
Findings: <C> Critical · <M> Major · <m> Minor · <s> Suggestion
Report: .unikit/gamedesign/reviews/<date>_review-<scope>.md
Status: <set to `reviewed` across header + GD-IDS (## System Map re-renders) | unchanged>
```

**Next steps** (do not auto-invoke):

- 🔧 Address the findings — /unikit-gd-system <system> "<finding>"
- ✅ Verify consistency — /unikit-gd-verify <system>

If the same finding recurs across reviews of different systems, surface it as a
candidate **studio `library` rule** (`/unikit-memory --module gamedesign`) so the
lesson is captured as durable domain knowledge, not re-discovered each review.
No summary document beyond the report file.

## Ownership Boundaries

- **Owns:** `.unikit/gamedesign/reviews/` report files; and — with approval, to
  record a verdict — the system's `doc_status` in its two coherent places: the
  `GD-IDS.yaml` `doc_status` and the `SYSTEM.md` header `> Status:` line.
- **Read-only:** the **content** of every design document (sections A–K, `GAME.md`,
  the fact values in `GD-IDS.yaml`); plus `DESCRIPTION.md`/`ARCHITECTURE.md` for the
  feasibility lens only. The only design-surface writes are the three status fields
  above.
- **Not this skill:** consistency/impact checks → `unikit-gd-verify`; applying
  fixes and authoring → `unikit-gd-system` (systems) / `unikit-gd-spec` (`GAME.md`).
- **Never:** edit design **content** (any section A–K, `GAME.md`, or a `GD-IDS.yaml`
  fact value); prescribe a fix the user did not ask for; inflate severity past the
  evidence; change a Status without approval; read the code workspace beyond the
  feasibility exception.

## Quick Reference

```
/unikit-gd-review SYS-combat              → single review (verdict + report)
/unikit-gd-review combat                  → resolve to the SYS-slug; same flow
/unikit-gd-review all systems             → cross-review with end-to-end checks
/unikit-gd-review systems/SYS-combat.md   → review a specific document path
```
