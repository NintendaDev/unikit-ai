# Game-Design Principles

This file is the canonical working discipline for the game-design skill family
(`unikit-gd-*`). Installed by `unikit-ai init` / `unikit-ai update` into
`.unikit/system/gd-principles.md` as a flat copy — engine-agnostic, with no
engine-variable substitution (unlike `dev-principles.md`). It is NOT
hash-tracked: every init/update rewrites it. Each game-design skill loads it once
at the start of a task (Bootstrap), the same way the code pipeline loads
`dev-principles.md`.

This file owns the cross-skill **process** contract: the user-driven
collaboration protocol, the section-cycle authoring contract, the one-way
design→code boundary, delta discipline, the facts-registry / ID conventions, the
language rules, the critique stance, and the shared severity rubric. **Domain
knowledge** (frameworks, motivation, balance, economy, progression, level design,
narrative, UX, accessibility, liveops, monetization ethics) lives in the
`gamedesign` memory rules under `.unikit/memory/gamedesign/` and is loaded on
demand by `Load when` — this file is process, never domain.

## Collaborative Protocol (User-Driven)

The user owns the vision and makes every creative decision. The skill is an expert
consultant — it informs, structures, and recommends; it never decides.

- Every design point follows **Question → Options → Decision → Draft → Approval**.
- **Explain → Capture:** write the full reasoning in conversation first (pros/cons,
  theory from the loaded domain rules, reference games), then capture the decision
  with a structured question (`AskUserQuestion` on Claude Code) — concise labels, at
  most 4 questions per call. Agents without a structured-question tool present the
  same options as plain text.
- Present 2–4 options; mark exactly one **"(Recommended)"** with the WHY (framework,
  pillar alignment, scope fit) and explicitly defer the final choice to the user.
- Anti-anchoring: state your own preference only after the user has chosen.
- On ambiguity, ask — never guess. "I don't know" from the user → offer 2–4
  defaults with a recommendation.
- **Files are written only by the main session, only after approval.** Inline review
  lenses and sub-agent calls are read-only advisors — they never write.
- Registry (`GD-IDS.yaml`) and index (`GD-INDEX.md`) writes require the same
  approval as document writes; existing registry values are never changed silently.
- Web research is allowed in `unikit-gd-explore`, `unikit-gd-brainstorm` (market and
  reference scans), and the memory research pipeline. It is forbidden in
  `unikit-gd-verify` — verification is offline, deterministic, and reproducible.

## Section-Cycle Contract (GDD Authoring)

`unikit-gd-detail` (fills skeletons) and `unikit-gd-improve` (edits approved
content) both write through this single contract; the mechanics live here and are
not re-specified per skill. Section letters refer to the SYSTEM GDD template:
A Overview, B Player Fantasy, C Detailed Design, D Formulas, E Edge Cases,
F Dependencies, G Tuning Knobs, H Acceptance Criteria, I Telemetry,
J Accessibility, K Open Questions & Changelog.

1. **Skeleton first.** Create the document from its template with every section
   header and `[To be designed]` placeholders; one approval for the skeleton.
   Approved text is never overwritten silently: placeholders are filled by
   `unikit-gd-detail`; edits to approved content go through `unikit-gd-improve`.
2. **Per section, in order:** Context (2–3 lines) → Questions → Options (2–4 with
   pros/cons and theory, one Recommended) → Decision → **Draft (full section text
   in the reply) → Approval in the SAME reply** — separating the draft from its
   approval is a protocol violation → Write (Edit anchored on the unique section
   heading).
3. **Write incrementally.** Persist each approved section immediately. The file is
   the only memory that survives a session — decisions live in files, not in chat.
4. **Registry check after C and D:** compare every number and name against GD-IDS
   facts. On mismatch, surface the conflict immediately and let the user resolve
   it: obey the registry / change the registry via a verify resolution / park it
   in section K (Open Questions).
5. **Terminology:** every new game term goes to GD-IDS `terms` — canonical English
   name, translation, forbidden aliases.
6. **Acceptance criteria (H)** derive semi-automatically from C, D, and E: one
   Given-When-Then per core rule and edge case, numbered `AC-<sys>-N`; numbering
   is stable — never reshuffled.

## One-Way Boundary (Design → Code)

Code reads design; design knows nothing about code.

- Game-design skills never read the code workspace (`.unikit/code/`), project
  sources, or build artifacts.
- The code side consumes design exclusively through the `## Design` section of its
  plan brief — SYS-id, version snapshot, verbatim AC quotes. There is no reverse
  flow: no design documents reconstructed from code, no code-to-design sync.
- Importing an existing GDD is a document operation — extract from the provided
  document; never reverse-engineer design from an implementation.
- Single sanctioned exception: the **feasibility lens** inside `unikit-gd-review`
  may read `DESCRIPTION.md` / `ARCHITECTURE.md` to flag implementability risks.

## Lifecycle & Status

Every system carries a `doc_status` recording how far its GDD has progressed. The
value lives in **three places that must always agree** — the document header
(the `> Status:` line in `SYSTEM.md`), the system's row in `GD-INDEX.md`, and its
`doc_status` field in `GD-IDS.yaml`. On any disagreement **`GD-IDS.yaml` wins**
(it is the machine truth); the conflict surfaces through `unikit-gd-verify`.

**System `doc_status` — the design-writable set, in order:**

| Status | Meaning | Set by | Next |
|---|---|---|---|
| `not-started` | mapped in the index, no document yet | `unikit-gd-spec` | `skeleton` |
| `skeleton` | A–K headers + `[To be designed]` placeholders | `unikit-gd-detail` | `detailed` |
| `detailed` | every section authored, facts registered | `unikit-gd-detail` | `reviewed` / `revised` |
| `reviewed` | passed `unikit-gd-review` with no Critical/Major | `unikit-gd-review` (on approval) | `revised` |
| `revised` | edited after `detailed`/`reviewed`; **pending re-verify** | `unikit-gd-improve` (edit) · `unikit-gd-verify` (flags a stale dependent) | `reviewed` (after re-review) |

- `not-started` carries **no version** — `Ver —` in the GD-INDEX row, no
  `version` in GD-IDS. A version of `1` appears only from `skeleton` onward.
- `revised` is the "needs re-verify" state: a system stays `revised` until
  `unikit-gd-review` re-clears it back to `reviewed`.
- `approved` is **not** a system `doc_status` — it was merged into `reviewed`.
  The word "approved" elsewhere in this contract ("approved content", "approved
  edit", "after approval") means collaborative approval, not a status. `GAME.md`
  (`drafted | approved`) and `CONCEPT.md` (`exploring | drafted | approved`) keep
  their **own** lifecycle enums — those are not system `doc_status`.
- `doc_status: revised` (this lifecycle state) is distinct from the GD-IDS
  `revised:` **date field** (when a fact's value last changed). Status writers
  touch `doc_status` only; they never repurpose the `revised:` date as a status.

**Two values that design never writes as `doc_status`:**

- `deprecated` lives in the system's **`status` field** (`active | deprecated`),
  not in `doc_status`. `unikit-gd-spec` sets it on a remap; the document file and
  the GD-IDS entry are **kept** (never deleted — dangling references are verify
  conflicts). **Display precedence:** while `status: deprecated`, the GD-INDEX
  Status column shows `deprecated` regardless of the row's underlying
  `doc_status`.
- `implemented` is **code-set only** — the lone sanctioned code→design write,
  applied by the code pipeline (wired in a later tier) and **read-only** to every
  design skill. It appears in the GD-INDEX Status legend as a display value;
  design skills never set it and never read code to learn it.

**Who writes the three places.** The authoring skills — `unikit-gd-spec`,
`unikit-gd-detail`, `unikit-gd-review`, `unikit-gd-improve` — write the status
into **all three places** on every status change, so the spine stays coherent.

**Dependent-lag exception (intentional).** `unikit-gd-verify` is deliberately
**not** a full three-place writer. When it flags a *dependent* system as stale it
bumps that dependent to `revised` in the **GD-INDEX row and GD-IDS `doc_status`
only**, leaving the dependent's document header to catch up on its next authoring
touch. So a verify-flagged dependent may transiently carry a header `Status`
behind its GD-INDEX/GD-IDS value — this is expected, and full header alignment
for flagged dependents is a later tier. The "all three agree" invariant holds for
every system **except** a dependent caught between a verify flag and its next
authoring edit.

## Delta Discipline (`unikit-gd-improve`)

Every edit to an approved design document goes through `unikit-gd-improve`. A
manual `.md` edit without a version bump and changelog entry is an **unrecorded
delta**: the planning side sees the same version and assumes the code is current.
The design→plan loop is only as honest as your use of it.

The mandatory tail of every design edit:

1. **Version +1** in the document header and in its GD-INDEX row.
2. **Changelog block** appended to section K:

   ```markdown
   #### v<N> — <YYYY-MM-DD> — <essence of the change> (DD-<n>)
   - <Section>: <what changed>
   - AC: + AC-<sys>-7, AC-<sys>-8 (new); AC-<sys>-3 changed; **AC-<sys>-5 removed**
   - Affected (gd-verify): <systems with Still Valid / Needs Review / Likely Stale verdicts>
   ```

   Mandatory elements: version, date, essence, DD reference for significant
   decisions; one line per affected section; the **AC delta line** (new / changed /
   removed) — the planning side consumes exactly this line to build delta plans.
   The "Affected" line is appended by `unikit-gd-verify`, never by the editor — it
   is a **human-readable record** of the impact pass, not the mechanism that
   re-checks dependents. The pending-loop is driven by each system's own `Status:
   revised`: the editor (`unikit-gd-improve`) marks **only the system it edited**
   `revised`, and `unikit-gd-verify` marks affected **dependents** `revised`
   (verdict-gated — see Lifecycle & Status). A `revised` system stays in the loop
   until `unikit-gd-review` clears it back to `reviewed`.
3. **Registry check:** new numbers vs GD-IDS facts — conflicts surface, they never
   silently win.
4. Recommend `unikit-gd-verify` (changed scope) after the edit.

A significant decision also gets a **DD record** in GD-IDS `decisions`: the options
considered, the rationale, and the affected systems (decision-log practice —
Nygard).

GD-IDS stores **current values only**; history lives in changelog blocks and git.

## Facts Registry & ID Conventions

`GD-IDS.yaml` is the single source of truth for numbers, names, and decisions.
When document text disagrees with the registry, the registry wins until the user
resolves the conflict the other way (via a `unikit-gd-verify` resolution). The
user is the arbiter of every conflict.

| Prefix | Meaning | Recorded in |
|---|---|---|
| `PIL-<n>` | Pillar | GAME.md + GD-IDS `pillars` |
| `SYS-<slug>` | System | GD-INDEX row + GD-IDS `systems` |
| `ENT-<slug>` | Entity with facts (stats) | GD-IDS `entities` |
| `FORM-<slug>` | Formula | GDD section D + GD-IDS `formulas` |
| `AC-<sys>-<n>` | Acceptance criterion | GDD section H |
| `DD-<n>` | Design decision | GD-IDS `decisions` |

- IDs are English lowercase slugs, stable across versions.
- Never delete an ID — mark it deprecated. Dangling references are verify
  conflicts.
- Every registry fact carries its `source` — the system that owns it.

## Provenance (imports)

When a system GDD is built by importing an existing document (the
`unikit-gd-detail` import path), each section records where its content came from,
so a later review can hold inferred material to a higher bar than author-sourced
material. The markers are HTML comments placed directly under the section heading
they describe:

- `<!-- provenance: extracted from SOURCE.md -->` — the section's content was
  lifted from the imported source document (verbatim or lightly edited). It is
  trusted as author-sourced; review does not second-guess it on provenance grounds.
- `<!-- provenance: generated -->` — the section had no counterpart in the source
  and was inferred to complete the skeleton. It carries no author authority; the
  provenance lens (`unikit-gd-review`) holds every generated claim against the
  source and the registry at **≥ Major**.
- **Untagged is normal authored content** — a section with no provenance marker is
  ordinary collaborative authoring (the non-import default). Absence of a marker is
  never itself a finding.

Rules:

- `unikit-gd-detail` writes the markers on import (one per section that needs one);
  the regular collaborative authoring path leaves sections untagged.
- `unikit-gd-improve` **never strips a provenance marker** — an edit may change a
  generated section's content, but the marker survives so its origin stays
  auditable across versions. Promoting `generated` → `extracted` is a deliberate,
  recorded act, never a silent side effect of editing.
- Markers are **inert to the code side** — they are HTML comments, never parsed by
  the plan brief or any code-module skill; they live entirely inside the design
  layer.

## Language

- Design artifacts follow the configured artifact language; conversation follows the
  configured UI language (see `.unikit/system/LANGUAGE_RULES.md`). The general
  **"translate the concept, not the label"** rule — no transliterating jargon, no
  mid-sentence code-switching — lives there and applies to every skill; this section
  adds only the game-design specifics.
- **Always English — but only stored identifiers and machine values, never
  vocabulary:** IDs (`PIL-*`, `SYS-*`, `ENT-*`, `FORM-*`, `AC-*`, `DD-*`), MDA
  aesthetic names, formula expressions and variables, telemetry event names, and the
  literal **field values** stored in artifacts (e.g. `market_signal: red-ocean`,
  `validation_confidence: B`). These are parsed or referenced as stable tokens, so
  they never translate. The list is exhaustive — "keywords" and "canonical terms"
  are *not* a licence to keep arbitrary jargon English. A stored `market_signal:
  red-ocean` field in the card is correct; the same words spliced into chat are not —
  render them in the user's language.
- **Numbers live in tables, intent lives in prose.** A document that hides numbers
  inside prose or buries intent inside bare stat tables fails review.

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
  advisory input to the user's Status decision in GD-INDEX — it never auto-applies.

## Anti-patterns

- Writing or editing any artifact without an explicit approval.
- Drafting a section and asking for its approval in a later, separate reply.
- Manual edits to approved documents bypassing `unikit-gd-improve` (unrecorded
  delta).
- A design skill reading `.unikit/code/` or project sources.
- Changing a GD-IDS value silently because "the document says otherwise".
- Inventing ad-hoc ID formats, reusing or renumbering existing IDs, deleting IDs.
- Prescribing solutions in a review nobody asked for.
- Severity inflation: filing a taste disagreement as Critical, or a finding with
  no section-and-evidence citation above Suggestion.
- Hiding tuned numbers in prose; replacing design intent with bare stat tables.
