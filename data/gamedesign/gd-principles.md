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
design→code boundary, the cross-skill delegation contract (brainstorm → explore),
delta discipline, the facts-registry / ID conventions, the language rules, the
critique stance, and the shared severity rubric. **Domain
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

## Cross-Skill Delegation (brainstorm → explore)

A market existing is not an opportunity, and ideation must not grade a market from
memory. `unikit-gd-brainstorm` therefore does not *own* market research — it
**delegates** to `unikit-gd-explore`'s market lens and consumes the evidence. The
discipline mirrors the design→code boundary: brainstorm depends on this **contract**
(what the delegate must return), never on the engine
(`explore/references/market-scan.md` — how the fields are produced).

**Principle.** A market signal without data is a hypothesis. `market_signal` is only
as trustworthy as its `validation_confidence` tag — an ungraded or evidence-free
signal is a guess and must be labelled one. Brainstorm never promotes a hypothesis
to a fact by restating it.

**The call.** Brainstorm spawns Explore as a subagent — mirroring how the code
orchestrator delegates a skill — and **waits for the return**:

> `Agent(subagent_type: general-purpose, skills: ["unikit-gd-explore"],`
> `  prompt: "/unikit-gd-explore <commercial frame + shortlist>. Return the brief`
> `  into this session as text; do not save any files.")`

- **Input** — the shortlist of surviving concepts plus a **commercial frame**: each
  concept phrased as an explicit market question (viability / discoverability /
  competition / demand / platform-fit). The frame being explicit is what makes the
  delegate's market lens fire deterministically, with no flag and no question.
- **Canonical marker (normative).** The prompt MUST contain, verbatim, the marker
  **"Return the brief into this session as text; do not save any files."** Explore
  detects subagent / delegation mode by this exact phrase — deterministically, not
  by heuristic — and in that mode skips every `AskUserQuestion` and writes no file.
- **Output** — per concept: `market_signal` (white-space / contested / red-ocean /
  unknown) + `validation_confidence` (A / B / C) + a short evidence brief, all
  **returned into the session as text**. The subagent persists nothing.
- **Ownership** — the calling brainstorm session lifts `market_signal` and
  `validation_confidence` into the **CONCEPT card** (outside the nine-field table)
  and distils the argument into the card's `## Notes`. **No `researches/` file is
  created** for a delegated scan — that avoids an ownership collision with Explore's
  own `researches/` output.
- **Gate** — a concept whose `market_signal` is **red-ocean with no reachable
  white-space** is a **kill candidate**: surface it for the user's pre-mortem, never
  cut it silently. The gate informs; the user decides.

This contract is the only sanctioned brainstorm→explore coupling. Brainstorm never
reads `market-scan.md` itself; Explore never reaches back into `concepts/`.

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
   - Affected (gd-verify): <systems with Still Valid / Needs Review verdicts>
   ```

   Mandatory elements: version, date, essence, DD reference for significant
   decisions; one line per affected section; the **AC delta line** (new / changed /
   removed) — the planning side consumes exactly this line to build delta plans.
   The "Affected" line is appended by `unikit-gd-verify`, never by the editor.
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
