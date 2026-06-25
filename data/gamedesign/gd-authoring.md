# Game-Design Principles — Authoring (Section-Cycle + Delta Discipline)

A shard of the `gd-principles` working contract, installed by `unikit-ai init` /
`unikit-ai update` into `.unikit/system/gamedesign/gd-authoring.md` as a flat copy
(engine-agnostic, no variable substitution, not hash-tracked). Loaded on Bootstrap
by the authoring zones (`unikit-gd-spec`, `unikit-gd-system`, `unikit-gd-flow`,
`unikit-gd-content`) and the `unikit-gd-apply` dispatcher (for the delta discipline).
See the core `gd-principles.md` for zone ownership and routing.

## Section-Cycle Contract (GDD Authoring)

The authoring zones write through this single **Decision-First** contract — it both
fills skeletons and edits approved content within a zone; the mechanics live here and
are **not re-specified per skill**. Each zone supplies its own **section map** (the
template's lettered sections + a human name for each) and reads its **core-set** (the
floor sections, defined once in `gd-lifecycle`): system `A/B/C/D/H`, flow `A/B`,
content `A/B/C`. Section letters are the template's internal index only — **address
sections by name in the dialogue, never by a bare letter** (A–K means nothing to the
user).

**Ceremony scales to choice.** A section the seeds already answer is drafted
silently; only a genuine design fork earns a question. Depth picks *how many*
sections this pass attempts; Decision-First picks *how much ceremony* each one earns.
The old "full Context → Options → Decision → Draft → Approval cycle for every section,
in order" is replaced by the six phases below — the same number of facts captured,
far fewer gates.

### The six phases

0. **Bootstrap.** Load this contract, the core `gd-principles`, `gd-lifecycle`, and
   the zone's section map + core-set.

1. **Depth.** One gate — a **picker** of the named tiers `core/standard/full`, each
   offered with what it adds (core = the floor that makes the doc `detailed`;
   standard / full layer on optional depth). The picked tier is the **ephemeral scope
   of this pass — it is NOT stored** (depth is orthogonal to the lifecycle; the
   lasting fact is the inferred status at Phase 6). Recommended **packs** for the
   zone's domain are surfaced here as an independent, value-framed opt-in (see Packs
   below). Emit `INFO [gd] depth=<core|standard|full>`.

2. **Fork scan (silent).** Walk the in-scope sections and classify each **without
   asking**: **seeded** — a SOURCE / recon / explore brief, the pillars, the domain
   rules, or a neighbouring system already answer it → it will be drafted silently;
   **real fork** — a genuine design choice with no seeded answer. Pillar- and
   registry-conflicts are caught here, **early** — before any prose is written.

3. **Decision interview.** Ask **only the real forks**, batched (1–2 structural
   `AskUserQuestion` rounds) — never one gate per section. Options are always
   **grounded** — in `balance` / `frameworks` theory, the pillars, or neighbours —
   **never a blank page**: "which formula?" is a choice of a grounded **form**
   (linear / diminishing / threshold) plus an open **"my own — I'll describe it"**
   escape (open elicitation). A section with no grounded options is raised as an
   explicit, **flagged open question**, not a silent blank. A **pillar conflict** that
   surfaces here is escalated to `unikit-gd-spec` **before writing** — early, not
   mid-section. Zone-specific decisions ride this round: flow's **Mode**
   (`linear|conditional|emergent`), content's **Scale** (`bulk|curated`). Greenfield
   decisions are dependent (`D`←`C`, `H`←`C/D`) → interview per **tier-group**
   (core → standard → full).

4. **Generation.** Draft each in-scope section: seeded → silently (emit
   `INFO [gd] seeded §<name> — drafted silently`); decided → from the decision. The
   acceptance-criteria section (`H` for systems) **auto-derives** from C/D/E — one
   Given-When-Then per core rule and edge case, numbered `AC-<sys>-N`, stable, never
   reshuffled, **never asked**. At a low depth, **Accessibility / Telemetry
   auto-default from the rules + a "clarify" note** (a sensible default with a flag,
   never an empty marker — accessibility is not dropped). A section the user chose to
   **defer** is written with a **`<!-- deferred -->` marker** — the one new artefact of
   this contract, kept distinct from the skeleton `[To be designed]` placeholder
   (`<!-- deferred -->` is an *intentional* omission; `[To be designed]` is an
   *unfilled* skeleton). Run the **registry check** as numbers and names are written —
   every new number, term, and id vs `GD-IDS` facts; a conflict surfaces and is
   resolved (obey the registry / change it via a verify resolution / park it in Open
   Questions), it never silently wins. New game terms go to `GD-IDS` `terms`
   (canonical EN name, translation, forbidden aliases).

5. **Group review.** Present the generated sections **by tier-group**. Before each
   section show a **card** — Context · why this section exists · what it captures · its
   source — drawn from the template's `[]`-hints (no duplication; the hint *is* the
   card, surfaced to the user instead of left in the file). Each group closes with
   **one structural group gate**, an `AskUserQuestion` over the group:
   `[ Accept & continue · Fix this · Defer this · Accept all the rest ]`, with a
   **progress indicator** ("core 3/5"). *Fix* loops the section back through a
   decision; *Defer* writes its `<!-- deferred -->` marker; *Accept all the rest* ends
   the review. **Write incrementally** — persist each accepted section immediately
   (Edit anchored on its unique heading); the file is the only memory that survives the
   session, decisions live in files, not in chat.

6. **Final.** Registry writes, then the **inferred status** (see `gd-lifecycle`):
   `detailed` once the whole **core-set** is authored; **held below `detailed`** while
   any **core** section carries `<!-- deferred -->` (the soft floor guard — emit
   `WARN [gd] core section §<name> deferred — status held below detailed`);
   `detailed · partial` when the core is complete but ≥1 **non-core** section is
   deferred (partiality is **inferred from the markers, never stored**). Append the
   changelog (Delta Discipline below), re-render the zone's `[gen]` map(s) — with the
   `· partial (n/m)` suffix when applicable — and hand off.

**Approved text is never overwritten silently.** Placeholders are filled and approved
content is edited only by the artifact's zone owner under the **Delta Discipline**
below — **Create** runs the full six phases; **Fill** re-picks depth and runs
Decision-First only over the newly-attempted sections (partiality stays honest);
**Edit / Rework** lie flat on this flow; **Tuning / Tweak** edits stay a single gate
(untouched).

**Packs** are an **independent opt-in, orthogonal to depth.** They are surfaced in the
decision round framed by the **value** they add (not "after sections A–K"); their
sub-sections are authored through these same six phases, never a separate linear pass.

## Delta Discipline

Every authoring zone applies this discipline to edits **within its own zone** — it
is zone-agnostic, owned here once, and never re-specified per skill. Every edit to
an approved design document is made by that artifact's zone owner
(`unikit-gd-system` for a `SYSTEM.md`, `unikit-gd-flow` for a `FLOW.md`,
`unikit-gd-spec` for `GAME.md` — see the carve-out below). A manual `.md` edit
without a version bump and changelog entry is an **unrecorded delta**: the planning
side sees the same version and assumes the code is current. The design→plan loop is
only as honest as your use of it.

The mandatory tail of every design edit:

1. **Version +1** in the document header and in the system's `version` in `GD-IDS`.
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
   revised`: the editing zone owner (`unikit-gd-system`) marks **only the system it
   edited** `revised`, and `unikit-gd-verify` marks affected **dependents**
   `revised` (verdict-gated — see Lifecycle & Status). A `revised` system stays in
   the loop until `unikit-gd-review` clears it back to `reviewed`.
3. **Registry check:** new numbers vs GD-IDS facts — conflicts surface, they never
   silently win.
4. Recommend `unikit-gd-verify` (changed scope) after the edit.

**GAME.md exception (not a system).** An edit to `GAME.md` bumps the version
**only** in the GAME.md header `> **Version**:` line — GAME.md has no
`GD-IDS.yaml` `systems` row, so the "and in the system's `version` in `GD-IDS`"
part of step 1 does not apply. It appends a **light** block to GAME.md's own
`## Changelog` (version, date, essence, one line per changed section) — **no**
AC-delta line and **no** `Affected (gd-verify):` line, since those are SYSTEM GDD
fields. Its status stays `drafted | approved`; it is **never** set to `revised`,
and there is no two-place coherence and no pending-loop. `unikit-gd-spec`
implements this carve-out — `GAME.md` is its zone — this is the canonical
statement.

**Content delta — schema vs values (`unikit-gd-content`).** The content zone draws a
hard line the other zones do not: `GD-IDS` holds a content type's **schema +
descriptor** (the contract), never its catalog of values (the data). The two move at
different speeds, so they carry different discipline:

- **Schema / descriptor edit = full delta discipline.** Changing a `CT`'s
  `CT.fields` (add / remove / retype a field, change `required`/`default`/`range`),
  its `scale` (`bulk` ⇄ `curated`), or its `belongs_to` is a **contract change** —
  the code side reads exactly this. Apply the full tail: Version +1 in the
  `CONTENT-TYPE.md` header **and** in the `content_types` `version` in `GD-IDS`; a
  changelog block whose delta line is the **fields-delta** (`+ field added; field
  retyped; **field removed**`) — the content counterpart of the AC / GOAL delta line
  that the code side consumes; a registry check. A schema change implies a **data
  migration** of the existing units (the values the editor holds). The edited `CT` is
  marked `revised` (its own spine), and `unikit-gd-verify` is recommended.
- **Catalog churn = light, no version bump.** Adding, removing, or editing the
  individual content **units** — a `curated` row's field values, a `bulk` `CT`'s
  `count` — is **data, not contract**: it does **not** bump the `CT` version, needs
  no changelog block, and never sets `revised`. The registry stays calm while the
  editor churns. For a `bulk` `CT` the instance values never enter `GD-IDS` at all —
  only the `count` + `spec` descriptor does, so a count change is a light edit, not a
  schema delta. "500 new instances" never crosses the contract boundary; "the item
  schema gained a `rarity` field" does.

A significant decision also gets a **DD record** in GD-IDS `decisions`: the options
considered, the rationale, and the affected systems (decision-log practice —
Nygard).

GD-IDS stores **current values only**; history lives in changelog blocks and git.
