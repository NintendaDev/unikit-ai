# Review Lenses

The catalog of review lenses for `unikit-gd-review` — absorbed from the former
`review-lenses` memory rule. The **severity rubric** and the **critique stance**
(Braintrust, critique-vs-review, plussing) live in `gd-critique`; this file holds
only the lenses and their adversarial prompts.

**Adversarial framing (the whole point).** Every lens runs as a skeptic: *"Your
job is NOT to validate this design — find what is wrong with it."* A lens that
returns "looks good" without having tried to break the document has not run.
Default to finding a problem; only conclude clean after a genuine attempt to
falsify. Each finding cites the **document section AND the contradicted fact /
pillar / rule** (`gd-critique` — no citation → downgrade to Suggestion).

## Core lenses (run on every review)

| Lens | The question it attacks | Typical severity on a hit |
|------|-------------------------|---------------------------|
| **completeness** | Is any section empty, a `[To be designed]` skeleton placeholder, or missing? Does every core rule and edge case have an AC? A `<!-- deferred -->` marker is an **intentional** omission (`gd-lifecycle`), **not** a gap — a `detailed · partial` document is a deliberate state, never a completeness finding; a deferred **core** section is `unikit-gd-verify`'s core-floor check, not this lens. | Major (empty section / untestable AC / `[To be designed]` leak) |
| **clarity / implementability** | Could a programmer build this without guessing? Find every ambiguous rule and undefined term. | Major (ambiguous rule); Critical (hole in core rules) |
| **pillar alignment** | Does the system serve ≥1 pillar? Does anything contradict a pillar (lower-numbered wins)? | Critical (contradicts a pillar) |
| **systems-math** | Try to BREAK the numbers: find a dominant strategy, an infinite/positive-feedback loop, a degenerate min-max line, a cost curve that inverts, a value at zero/max/negative that breaks a formula, or an intransitivity that collapses to one best choice. "Ranges look fine" is not a result — name the exploit or state the line you tried and why it fails. | Critical (dominant strategy / infinite loop); Major (untuned range / unhandled extreme) |
| **scope** | Is the S/M/L/XL realistic against the ambition and the team constraint? | Major (scope/ambition mismatch) |
| **feasibility** | Reads `DESCRIPTION.md`/`ARCHITECTURE.md` (the **single** sanctioned code-context read) to flag implementability risks against the actual stack/architecture. | Critical (unimplementable on this stack) |
| **fantasy-delivery** | Does section B's promised feeling actually arise from the mechanics in C/D/E? Does the system serve ≥1 SDT need (autonomy/competence/relatedness)? Attack the gap between the promised fantasy and what the rules produce. | Major (mechanics don't deliver the stated fantasy); Critical (system serves no need and no pillar) |

## Provenance lens (imported & code-reconstructed systems)

Runs **only** when the system was built by import or reconstructed from code — its
sections carry provenance markers (see `gd-provenance` → Provenance). It separates
inferred content from author-sourced content and holds them to different bars.

**First, classify the import.** A system is a **code-reconstructed import** when its
`SOURCE.md` carries the `unikit-gd-recon` code-provenance banner, or `GAME.md`'s
`> **Based on**:` header names a `RECON.md`. Otherwise it is a normal authored import.

- Walk every section tagged `<!-- provenance: generated -->`. A generated claim has
  no author authority: check it against the imported source and the registry
  (`GD-IDS.yaml`). A generated number, rule, or fact the source never stated — or
  that contradicts a registered fact — is **≥ Major** (it was invented to fill the
  skeleton, not designed).
- Walk every section tagged `<!-- provenance: extracted from code -->` — and, for a
  **code-reconstructed import**, every `<!-- provenance: extracted from SOURCE.md -->`
  section too (the recon banner overrides their normal "trusted" treatment, because
  the material was inferred from an implementation, not authored). Code carries
  *structure*, never *intent* — so hold each such claim at **≥ Major** against the
  registry and the system's own stated purpose: a number, rule, or relationship the
  code implies but no human has confirmed as *intended* is a finding, not a fact.
  Cross-check the `## Intent Gap` — anything the recon flagged as unknown that now
  reads as a confident claim is **≥ Major**.
- Sections tagged `<!-- provenance: extracted from SOURCE.md -->` **in a normal
  authored import** are trusted as author-sourced — **do not** nitpick them on
  provenance grounds (the other lenses still apply on their own merits).
- Untagged sections are normal authored content; this lens skips them.

## Domain lenses (add by the system's behaviour/domain)

Load the matching **core** domain rule (`.unikit/memory/gamedesign/`) and apply
its checks adversarially:

| Domain | Domain lens | Load | Attacks |
|--------|-------------|------|---------|
| economy / loot | economy | `economy` | a faucet with no sink; uncapped inflation; broken value chains |
| ui / onboarding | ux-clarity | `ux-onboarding` | FTUE drop-off; buried information hierarchy; missing feedback |
| any system | accessibility | `accessibility` | section J below the GAG basic minimum; unjustified deviations |
| monetization | ethics | `monetization-ethics` | dark patterns (darkpattern.games categories); undisclosed odds |
| liveops / events | liveops | `liveops` | injection budget vs the economy guardrail; engagement→burnout |
| combat / progression | systems-math | `balance`, `progression` | dominant strategy; degenerate curve; broken TTK/TTC |

A finding from a domain lens that grades severity uses the **shared rubric in
`gd-critique`** — lenses never invent their own scale.

## Cross-scope lenses (only when the scope is "all" / "all systems")

Beyond running the core lenses on each document, a cross-review adds the checks no
single-document review can make:

- **Formula compatibility** — formulas shared across systems agree on units, ranges,
  and variable meaning.
- **Cross-AC consistency** — acceptance criteria in different systems do not
  contradict each other.
- **Pillar drift** — the set of systems collectively still serves every pillar; a
  pillar no system implements is a gap.
- **Total scope vs tiers** — the summed scope is realistic against the MVP / VS /
  Alpha / Full tiers.
- **End-to-end scenarios** — trace **3–5** "one moment through N systems" walkthroughs
  (e.g. *take damage → status applied → UI feedback → death → respawn economy hit*)
  and find where the systems disagree.

## Flow lenses (run on every flow review)

Review is **axis-aware**: alongside systems it judges **flows** (`FLOW.md` + the
`## Flow Map [gen]` / `## Funnel [gen]` renders). A `FLOW.md` **is** a review target;
these lenses run whenever the scope is a flow (or "all"). Each runs as a skeptic — find
what breaks the dynamics, do not validate.

| Lens | The question it attacks | Typical severity on a hit |
|------|-------------------------|---------------------------|
| **pacing** | Attack the tension arc. For `linear`/`conditional`, walk the objective-flow table beat by beat: does tension actually rise to a climax and release, or flatline (every beat the same, no shape)? For `emergent`, does the pacing envelope have a real floor and ceiling, or can the player sit at one tension level indefinitely? Name the flat or sagging stretch — "the arc looks fine" is not a result. | Major (flatline / sagging mid-section); Critical (no arc at all — the flow has no shape) |
| **guidance** | At each `GOAL` step, can the player tell what to do next? Find every step where the Trigger → Expected action is **not** legible: no success/feedback signal, no beacon where one is needed, or a hand-off that relies on the player guessing. Cross-reference the exercised system's section B (feedback) and the `AC` the `GOAL` targets — a `GOAL → AC` whose AC defines no observable signal is a guidance hole. | Major (a step with no feedback/beacon); Critical (the core path is unguessable) |
| **funnel** | Does the `## Funnel [gen]` measure the moments that matter? Find every retention/conversion-critical `GOAL` with **no** `event` (a blind funnel step), and any event whose name/schema is incoherent with its neighbours. A flow that drops the player at an unmeasured step cannot be diagnosed in liveops. | Major (a critical GOAL with no event); Minor (event naming/schema drift) |

A flow finding cites the `FLOW-<slug>` / `GOAL-<flow>-<n>` and the system `AC` / pillar
it serves, on the same shared `RF-<date>-n` rubric as a system finding. The
**fantasy-delivery**, **systems-math**, and **provenance** core lenses are unchanged —
they apply to systems; the flow lenses are the dynamics-axis complement.

## Content lenses (run on every content review)

Review is **axis-aware**: alongside systems and flows it judges **content types**
(`CONTENT-TYPE.md` + the `## Content Map [gen]` render). A `CONTENT-TYPE.md` **is** a
review target; these lenses run whenever the scope is a content type (or "all"). Each
runs as a skeptic — find what breaks the catalog, do not validate.

| Lens | The question it attacks | Typical severity on a hit |
|------|-------------------------|---------------------------|
| **schema-coherence** | Attack `CT.fields` as a contract. Does it cover everything the consuming (`belongs_to`) system needs to read — or will the code hit a missing field? Are the types right (an `enum` that should be `int`, a `float` range that admits nonsense), and does every `ref<>` point at a real, typed thing (`ref<SYS>` / `ref<RES>` / …)? A field the system reads but the schema omits, or a `ref<>` to a missing target, is a broken contract — name it; "the schema looks complete" is not a result. | Critical (a field the consuming system needs is absent, or a `ref<>` is unresolvable); Major (a wrong type / loose range) |
| **catalog-scale** | Attack the `bulk` vs `curated` choice. Is `bulk` claimed for content that actually needs hand-authored, individually-balanced units (so the registry hides real design debt), or `curated` for content that will balloon to hundreds of rows (so `GD-IDS` becomes a data dump)? Walk the expected catalog size and authoring cost — the wrong scale is a maintenance trap that surfaces only at content volume. | Major (the scale will not hold at the real catalog size); Minor (borderline, defensible either way) |
| **content-fantasy-delivery** | The fantasy-delivery core lens aimed at the catalog: does the *content itself* deliver the feeling section B promises and serve an SDT need — or is it a flat list of stat-blocks no system turns into an experience? A schema can be perfectly coherent and still produce boring content. Cross-reference the `belongs_to` system's section B and the pillars. | Major (the catalog delivers no felt experience / serves no pillar); Minor (thin but functional) |

A content finding cites the `CT-<slug>` / `CU-<ct>-<n>` and the `belongs_to` system /
pillar it serves, on the same shared `RF-<date>-n` rubric as a system finding. The
**fantasy-delivery**, **systems-math**, and **provenance** core lenses are unchanged —
they apply to systems; the content lenses are the catalog-axis complement.

## Genre lens (run when `GAME.md` carries a `genre_profile:`)

Review reads exactly ONE profile — the genre profile `GAME.md` resolved
(`genre_profile:` id, installed at `.unikit/system/gamedesign/genres/<id>.json`). It is
the **only** profile read on the design side; `unikit-gd-verify` never reads it (verify
is genre-blind — `critical_sections` lives only here).

| Lens | The question it attacks | Typical severity on a hit |
|------|-------------------------|---------------------------|
| **profile-completeness** | Read the profile's `critical_sections` — the sections a complete GDD of this genre must carry (e.g. `economy.SourcesAndSinks`, `level-design.LevelMetrics`, `ux-onboarding.FTUEFunnel`). For each, is it **present and filled** across the docs under review (the relevant SYSTEM / FLOW / CONTENT-TYPE / `GAME.md`)? A `critical_section` that is absent or still a placeholder is a genre-completeness gap — name it; "looks complete for the genre" is not a result. | Major (a genre-critical section is missing/empty) — **declinable / advisory**, never a blocker |

The profile's `review_emphasis` is an **advisory re-weight**: a soft priority bump for
the lenses it names (e.g. "у каждого booster есть sink" raises the systems-math lens on
that point). It changes emphasis, not the rubric. When `GAME.md` has no `genre_profile:`
(universal baseline) → **skip this lens entirely**. The genre layer is otherwise
dissolved into `GD-IDS` (seeds became registered facts at spec), so the rest of review
stays genre-agnostic.

## Output discipline

- **Diagnose, don't prescribe** (`gd-critique`): name the problem and its
  evidence, not your fix. Prescriptions ("what if…", plussing) are offered **only
  when the user asks**.
- **Name what works** ("I like…") — honest calibration, not flattery.
- Separate **Required before implementation** (all Critical + Major) from the
  explicitly non-blocking **Suggestions** list.
