# Game-Design Principles — Critique Stance & Severity Rubric

A shard of the `gd-principles` working contract, installed by `unikit-ai init` /
`unikit-ai update` into `.unikit/system/gamedesign/gd-critique.md` as a flat copy
(engine-agnostic, no variable substitution, not hash-tracked). Loaded on Bootstrap
by `unikit-gd-review`, `unikit-gd-verify`, and `unikit-gd-explore`. See the core
`gd-principles.md` for zone ownership and routing.

## Critique Stance (Braintrust)

Reviews follow the Pixar Braintrust model (Catmull): the room has no authority —
the user decides; honesty over politeness, about the work, never the person.

- **Diagnose, don't prescribe:** name the problem and the evidence ("FORM-damage's
  output range contradicts PIL-2's design test"), not your solution.
- Prescriptions are opt-in: offer "what if…" suggestions (plussing — d.school
  "I like / I wish / What if") only when the user asks for them.
- Critique (iteration on a draft) and review (verdict on a finished document) are
  different activities — never blur them (Connor & Irizarry). A verify conflict
  cannot be "declined"; a review finding can.
- Name what works ("I like…") — honest calibration, not flattery.

## Severity Rubric

The single source of truth for finding severity, shared by `unikit-gd-review`
(quality verdicts), `unikit-gd-verify` (consistency conflicts), and the domain
memory rules that grade their own findings (notably `balance` and
`monetization-ethics`). Lenses and review report structure live in
`unikit-gd-review`; this file owns only the rubric so there is one definition.

| Severity | Meaning | Examples |
|---|---|---|
| **Critical** | blocks handoff | contradicts a pillar or a registry fact; unimplementable; hole in core rules; dominant strategy; monetization-ethics violation |
| **Major** | risk if unaddressed | ambiguous rule; empty section; missing edge case; untestable AC; terminology drift |
| **Minor** | text quality | missing example; weak rationale |
| **Suggestion** | "what if…" (plussing) | never blocks; offered, not required |

- Severity attaches to **evidence, not taste**: a finding cites the document
  section AND the contradicted fact, pillar, or rule. No citation → it is an
  opinion; downgrade it to Suggestion.
- **Required before implementation** = all Critical + Major findings; Minor and
  Suggestion items go to a separate, explicitly non-blocking list.
- A verify conflict cannot be declined; a review finding can. The severity is
  advisory input to the user's Status decision (recorded in `GD-IDS` `doc_status`,
  rendered in the `## System Map [gen]`) — it never auto-applies.

## Handoff Engine

The shared triage that turns a finished review verdict or a verify pass into a
**handoff**, loaded by `unikit-gd-review`, `unikit-gd-verify`, and (as the
research-bucket consumer) `unikit-gd-explore`. Every finding is sorted into one
of two destinations:

- **apply-ready** — carries a *named, entailed fix* the user can apply now
  (handed to `unikit-gd-apply`).
- **research** — a diagnosis that still needs a decision (handed to
  `unikit-gd-explore`).

The sort criterion is identical for both callers; only the interview shape
differs (review can decline a finding, verify can only re-direct a conflict).
The engine **classifies only** — it never writes to the GDD.

### ENTAILED criterion (the apply-ready gate)

A finding is **apply-ready** only when ALL FIVE hold — checked silently, never
surfaced to the user as a checklist:

1. **Concrete target** — it names the doc/section AND the id/term to change.
2. **Known-correct value** — the right value is already authoritative in the
   workspace (registry canon · the `GAME.md` vision · an existing AC); it is
   read, never invented.
3. **Exactly one fix** — a single edit, not a menu of options.
4. **Local fix** — a field/term/reference swap, not a redesign.
5. **No external knowledge** — no market data, math, playtest, or taste call is
   needed to pick the fix.

Fail any one → the finding is **not entailed** → it joins the interview pool; it
is never applied silently. Entailed ≈ exactly the consistency fixes
`unikit-gd-verify` already catches in passing. The rule knows only "entailed vs
not" — it never tries to separate "research" from "merely ambiguous"; the user
does that in the interview.

### Interview (the user decides — Braintrust)

Everything not entailed is triaged WITH the user (the room has no authority).
One **per-run** choice up front — **[Run the interview]** or **[Send everything
to research]** — then, when interviewing, findings are presented in **batches**
(`AskUserQuestion`, ≤ 4 questions per call). The interview **classifies** each
finding and records the user's decision text; it writes **nothing** to the GDD
(review stays non-authoring, verify stays consistency-only). It captures the
"needs a decision but not research" case — the answer already in the user's head
— routing it straight to apply-ready with no detour through `unikit-gd-explore`.

**decline-vs-direction** — the per-finding options differ by caller, following
the stance (a critique can be declined; a consistency conflict cannot):

- **review** finding → **[I decide: <fix>]** → apply-ready · **[To research]**
  → research · **[Decline]** → dropped.
- **verify** conflict → a choice of *direction*, never of whether to act:
  **[Fix as A]** / **[Fix as B]** / **[This is authoring → owner]**. There is
  **no "Decline"** — the conflict is a fact, not an opinion.

### Loop-guard sentinel

`unikit-gd-apply` closes its Phase 3 by calling `unikit-gd-verify` with one
reserved token as the argument — defined HERE as the single source of truth,
written by `unikit-gd-apply`, read by `unikit-gd-verify`:

> **`apply-phase3`** — the loop-guard sentinel.

It is **not** a scope argument. When `unikit-gd-verify` sees `apply-phase3` it
treats the run as the in-apply Phase 3 gate: it **suppresses** the handoff
offer + interview and derives changed-scope from `git diff` as usual. A
standalone `/unikit-gd-verify` (no sentinel) runs the offer. This is what keeps
`apply → verify → apply` from looping.
