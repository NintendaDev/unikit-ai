---
name: unikit-gd-review
description: >-
  Qualitative quality review of game design documents — answers "is this design good?" — by
  fanning out adversarial lenses (completeness, clarity, pillar alignment, systems-math,
  fantasy-delivery, feasibility, scope, and domain lenses), each prompted to find problems
  rather than validate. Produces a severity-graded verdict and a report. Scope is inferred:
  a named system reviews that document; "all"/"all systems" runs a cross-system review. Use
  when the user wants a critique or quality judgment of the design, e.g. "review the combat
  GDD", "is this design good", "critique this system", "what's wrong with this design",
  "review all the GDDs", "is this system fun/balanced". This is the subjective quality pass
  — for a mechanical consistency check (numbers, terms, IDs, references matching the
  registry) use /unikit-gd-verify.
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

A review is most honest in a **fresh session** — the reviewer should not be the
author of the document. This skill never authors or edits design **content**; its
only writes are the review report and — with the user's approval, to record a
verdict — the system's `doc_status` in its three coherent places (the `SYSTEM.md`
header `> Status:` line, the `GD-INDEX.md` row, and `GD-IDS.yaml`).

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

1. **`.unikit/system/gd-principles.md`** — the working contract. The **severity
   rubric** (Critical / Major / Minor / Suggestion), the **critique stance**
   (Braintrust: diagnose don't prescribe; critique vs review; plussing), and the
   language rules live there. This skill **applies** them. If missing, warn
   (`unikit-ai update`) and fall back to the rubric summarized in `references/lenses.md`.
2. **`.unikit/gamedesign/GAME.md`**, **`GD-INDEX.md`**, **`GD-IDS.yaml`** — pillars,
   the map, and the facts every finding is checked against.
3. **`{{skills_dir}}/{{self_name}}/references/lenses.md`** — the lens catalog and
   the adversarial prompts (absorbed from the former `review-lenses` rule).
4. **`.unikit/memory/gamedesign/RULES_INDEX.md`** — load the **core** domain rules
   for the target's behaviour/domain (by `Load When`) so each domain lens has its theory:
   `economy`, `balance`, `progression`, `ux-onboarding`, `accessibility`,
   `monetization-ethics`, `liveops`, `frameworks`.
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
provenance markers — see `gd-principles` → Provenance), also run the **provenance**
lens over each `<!-- provenance: generated -->` section: inferred content is held to
a stricter bar (≥ Major against source/registry) than author-sourced text.

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
citation to **Suggestion** (`gd-principles`).

## Phase 3 — Cross-Scope Checks (cross review only)

When the scope is "all", add the cross-system lenses from `references/lenses.md`:
formula compatibility, cross-AC consistency, pillar drift, total scope vs tiers,
and **3–5 end-to-end "one moment through N systems"** scenarios. These are the
checks no single-document review can make. **Depends symmetry is not a review
lens** — `unikit-gd-verify` owns the Depends 3-way check (GD-INDEX ↔ section F ↔
GD-IDS `depends_on`).

## Phase 4 — Verdict & Report

Compute the verdict from the findings:

- **Single:** `APPROVED` (no Critical/Major) · `NEEDS REVISION` (Major, no
  Critical) · `MAJOR REVISION` (≥1 Critical).
- **Cross:** `PASS` · `CONCERNS` · `FAIL` (≥1 Critical anywhere).

Give each finding a **stable id** `RF-<YYYY-MM-DD>-<n>` (numbered in severity
order, Critical first). The id lets a later `unikit-gd-improve` edit cite the
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

On approval, the verdict updates the system's `doc_status` to `reviewed` in **all
three coherent places** — the `SYSTEM.md` header (the `> Status:` token in the
combined header line, never a separate bold line), the `GD-INDEX.md` row, and
`GD-IDS.yaml` (see gd-principles → Lifecycle & Status). Never silently:

```
AskUserQuestion: Verdict is <verdict>. Set SYS-<slug> Status → reviewed?
Options:
1. Set Status: reviewed (recommended on APPROVED/PASS — writes all three places)
2. Leave as-is — I'll address findings first
```

- A clean re-review of a `revised` system clears it **back to `reviewed`** — the
  `revised` → `reviewed` exit after re-verification.
- Report the write in the compact summary: which of the three surfaces changed.

The gate is soft: `unikit-plan` warns when a system's Status is not
`detailed`/`reviewed` or is `revised`. A review never auto-applies fixes — route
revisions to `unikit-gd-improve`.

## Final: Compact Report & Next Steps

```
Scope: <SYS-slug | all (N systems)>   Mode: <review|critique>
Verdict: <verdict>
Findings: <C> Critical · <M> Major · <m> Minor · <s> Suggestion
Report: .unikit/gamedesign/reviews/<date>_review-<scope>.md
Status: <set to `reviewed` across header + GD-INDEX + GD-IDS | unchanged>
```

```
AskUserQuestion: Review complete. What's next?

Options:
1. Address the findings — /unikit-gd-improve <system> "<finding>" (recommended if not APPROVED)
2. Verify consistency — /unikit-gd-verify <system>
3. Nothing — I'll continue later
```

If the same finding recurs across reviews of different systems, surface it as a
candidate **studio `library` rule** (`/unikit-memory --module gamedesign`) so the
lesson is captured as durable domain knowledge, not re-discovered each review.
No summary document beyond the report file.

## Ownership Boundaries

- **Owns:** `.unikit/gamedesign/reviews/` report files; and — with approval, to
  record a verdict — the system's `doc_status` in its three coherent places: the
  `GD-INDEX.md` Status cell, the `GD-IDS.yaml` `doc_status`, and the `SYSTEM.md`
  header `> Status:` line.
- **Read-only:** the **content** of every design document (sections A–K, `GAME.md`,
  the fact values in `GD-IDS.yaml`); plus `DESCRIPTION.md`/`ARCHITECTURE.md` for the
  feasibility lens only. The only design-surface writes are the three status fields
  above.
- **Not this skill:** consistency/impact checks → `unikit-gd-verify`; applying
  fixes → `unikit-gd-improve`; authoring → `unikit-gd-detail`/`unikit-gd-spec`.
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
