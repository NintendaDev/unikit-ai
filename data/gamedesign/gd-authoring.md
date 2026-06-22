# Game-Design Principles — Authoring (Section-Cycle + Delta Discipline)

A shard of the `gd-principles` working contract, installed by `unikit-ai init` /
`unikit-ai update` into `.unikit/system/gamedesign/gd-authoring.md` as a flat copy
(engine-agnostic, no variable substitution, not hash-tracked). Loaded on Bootstrap
by the authoring zones (`unikit-gd-spec`, `unikit-gd-system`, `unikit-gd-flow`).
See the core `gd-principles.md` for zone ownership and routing.

## Section-Cycle Contract (GDD Authoring)

`unikit-gd-system` writes through this single contract — it both fills skeletons
and edits approved content within its zone; the mechanics live here and are not
re-specified per skill. Section letters refer to the SYSTEM GDD template:
A Overview, B Player Fantasy, C Detailed Design, D Formulas, E Edge Cases,
F Dependencies, G Tuning Knobs, H Acceptance Criteria, I Telemetry,
J Accessibility, K Open Questions & Changelog.

1. **Skeleton first.** Create the document from its template with every section
   header and `[To be designed]` placeholders; one approval for the skeleton.
   Approved text is never overwritten silently: placeholders are filled, and edits
   to approved content are made, by the artifact's zone owner (`unikit-gd-system`
   for a `SYSTEM.md`) under the delta discipline below.
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

A significant decision also gets a **DD record** in GD-IDS `decisions`: the options
considered, the rationale, and the affected systems (decision-log practice —
Nygard).

GD-IDS stores **current values only**; history lives in changelog blocks and git.
