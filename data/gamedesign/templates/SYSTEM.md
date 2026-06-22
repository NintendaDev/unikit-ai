# [System Name] — SYS-[slug]

> **Status**: skeleton | detailed | reviewed | revised
> **Version**: 1
> **Last Updated**: [YYYY-MM-DD]
> **Implements**: [PIL-n, PIL-m] · **Layer**: [Foundation | Core | Feature | Presentation] · **Scope**: [S | M | L | XL]

A per-system design document. Eleven sections A–K, authored one at a time
through the section-cycle contract (see `.unikit/system/gamedesign/gd-authoring.md`):
Context → Options → Decision → Draft+Approval (same reply) → Write. Sections D
and H trigger a `GD-IDS.yaml` registry check. Domain section-packs (economy, UX,
accessibility, narrative, level…) append after K when the system touches that
domain — see `unikit-gd-system`'s `references/section-packs.md`. Numbers live in
tables, intent lives in prose.

## A. Overview

[One paragraph explaining the system to someone who knows nothing about the
project: what it is, what the player does with it, and why it exists. A skill
scanning 20 GDDs reads only this to decide whether to read further.]

## B. Player Fantasy

[What the player should FEEL when engaging with this system, and which pillar
that feeling serves. This guides every detail decision below.]

## C. Detailed Design

### Core Rules

[Precise, unambiguous rules — a programmer implements these without guessing.
Numbered for sequential processes, bulleted for properties.]

### States & Transitions

[If the system has states, document every state and every valid transition.]

| State | Entry condition | Exit condition | Behavior |
|-------|-----------------|----------------|----------|
| [State] | [When entered] | [When left] | [What happens] |

### Interactions with Other Systems

[For each interaction: what data flows in, what flows out, who owns what. Every
cross-system reference here must also be a row in F.]

## D. Formulas

[Each named formula gets a block. Register every formula in `GD-IDS.yaml`
`formulas` as `FORM-<slug>` — run the registry check after writing this section.]

### FORM-[slug] — [Name]

```
result = base * (1 + modifier_sum) * scaling_factor
```

| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| base | float | [1–100] | [data file] | [meaning] |
| modifier_sum | float | [-0.9–5.0] | [calculated] | [meaning] |

- **Expected output range**: [min] – [max]
- **Degenerate cases**: [values that break the curve and how they are clamped]

## E. Edge Cases

[What happens in unusual situations. Each has a clear, deliberate resolution —
these feed the acceptance criteria in H.]

| Scenario | Expected behavior | Rationale |
|----------|-------------------|-----------|
| [What if X is zero?] | [Result] | [Why] |
| [What if two effects collide?] | [Priority rule] | [Why] |

## F. Dependencies

[Every system this one depends on, and every system that depends on it. The edge
must be symmetric — this section F, the system's `GD-IDS.yaml` `depends_on`, and
the `Depends` column of `## System Map [gen]` in `GAME.md` must all agree;
`unikit-gd-verify` checks all three.]

| System | Direction | Nature of dependency |
|--------|-----------|----------------------|
| [SYS-combat] | this depends on it | [needs damage result] |
| [SYS-inventory] | it depends on this | [provides item effect data] |

## G. Tuning Knobs

[Every value that should be adjustable for balancing — never hardcoded in
implementation. Include current value, safe range, and effect of extremes.]

| Parameter | Current | Safe range | Effect of increase | Effect of decrease |
|-----------|---------|------------|--------------------|--------------------|
| [name] | [value] | [min–max] | [what happens] | [what happens] |

## H. Acceptance Criteria

[One Given-When-Then per core rule (C) and edge case (E), numbered `AC-<slug>-N`.
Numbering is stable — never reshuffled. These are the verbatim contract the code
side quotes in its plan brief.]

- **AC-[slug]-1** — Given [context], when [action], then [observable result].
- **AC-[slug]-2** — Given [context], when [edge case], then [resolution].
- **AC-[slug]-3** — Performance: [operation] completes within [X] ms.

## I. Telemetry

[Events worth measuring to know the system performs as designed. Event names are
always English (`snake_case`). Tie each to a design question it answers.]

| Event | Payload | Design question it answers |
|-------|---------|----------------------------|
| [system_action_done] | [fields] | [e.g. is the loop completing at the intended rate?] |

## J. Accessibility

[Per-system accessibility commitments (load the `accessibility` library rule).
Name impairment categories addressed and the concrete option/setting.]

| Barrier | Affected players | Accommodation | Commitment tier |
|---------|------------------|---------------|-----------------|
| [e.g. small targets] | [motor] | [remappable input / larger hitbox] | [basic / intermediate / advanced] |

## K. Open Questions & Changelog

### Open Questions

| Question | Why it is open | What would resolve it |
|----------|----------------|-----------------------|
| [Undecided point] | [missing info / needs playtest] | [prototype / decision] |

### Changelog

[Appended by the system's zone owner (`unikit-gd-system`) on every approved edit.
Newest first. The **AC delta line** is what the planning side consumes to build
delta plans; the **Affected** line is appended by `unikit-gd-verify` as a
human-readable record. The pending-loop is driven by each system's own `Status:
revised` (the zone owner marks the edited system; `unikit-gd-verify` marks affected
dependents), not by this line.]

```markdown
#### v1 — [YYYY-MM-DD] — initial design
- Created from template; sections A–K authored.
- AC: + AC-[slug]-1 … AC-[slug]-N (new)
- Affected (gd-verify): —
```
