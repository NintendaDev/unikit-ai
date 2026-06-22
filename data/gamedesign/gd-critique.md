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
