# Saving Research Results (artifact templates)

Loaded on demand by `unikit-gd-explore/SKILL.md` → "Saving Research Results" when a
research crystallizes and the user accepts the save offer. The SKILL keeps the offer +
the trigger; this file holds the artifact templates, the Next Steps routing, and the
index format. The **mode-aware brief blocks** are NOT duplicated here — their field
lists are owned by `{{skills_dir}}/{{self_name}}/references/internal-design-lens.md` → "Mode-aware brief".

## Saving Research Results

When the conversation crystallizes, **offer** to save (never auto-save):

```
The question tool of your agent (`AskUserQuestion`): Save this research to .unikit/gamedesign/researches/?
Research name: <kebab-slug>
Options: 1. 💾 Yes — save   2. 🚫 No
```

On yes, **before creating anything**, check for a collision — the check has to precede the
folder, or it observes a directory it just made and fires every time.

**Collision — the slug already exists.** A folder `researches/<slug>/` is already there → ask, never decide it yourself:

```
The question tool of your agent (`AskUserQuestion`): A research named "<slug>" already exists.

Options:
1. Update it — rewrite in place; `Updated:` moves, `Date:` is left alone
2. Save under another name — I'll enter a different slug
```

Then print `INFO [gd-research] <slug> exists — updating it` or `INFO [gd-research] saving as <new-slug>`.

In an ultra research the question was already put at the first pin (`ultra-research.md` → `## Pinning`); the save does not repeat it. When this session made no pin (ultra named late), there was no earlier question, and the save asks it itself. In an ultra research the slug is fixed at the first pin and named to the user then; the save writes under it, asks no slug question, and an automatic suffix stays forbidden.

**Appending an automatic suffix is forbidden.** The date used to separate two runs at one topic on its own; without it there is a single name, and a silently suffixed second folder splits one research into two that no reader knows to join.

Then create the folder (a no-op when option 1 resolved to an existing one):

```bash
mkdir -p .unikit/gamedesign/researches/<slug>
```

1. **`RESEARCH_RESULT.md`** — the complete research: every dissection, comparison
   table, diagram, and conclusion presented to the user. Header:

   ```markdown
   # <Research Title>
   Date: <YYYY-MM-DD HH:MM>
   Updated: <YYYY-MM-DD HH:MM>
   Status: completed | in-progress | needs-follow-up
   Research: <folder-name>
   Target: SYS-<slug> | FLOW-<slug> | CONTENT-<slug>   # internal-design lens only — the system, flow, or content type this research targets
   Kind: feature | improvement | experiment   # feature/improvement: internal-design lens only — feature = new system/flow/content type, improvement = existing one; experiment: experiment lens only, written without Target

   ## Table of Contents
   ## Artifact Index   — ultra only, immediately after the Table of Contents (see ultra-research.md); the first line of an ultra record is the mode marker defined there
   ## Active Summary   — the region between the two markers below; what a reader needs without the chat
   <!-- unikit:active-summary:start -->
   Experiment: <EXP-<nnn> v<Version> — <card title>; one line per card, only for a research grounded on an experiment card — omit it otherwise>
   Goal: <what this research is for>
   Scope: <what it covers, and what it does not>
   Constraints: <known limits; one line each>
   Decisions: DEC-<n> — <a few words; the value stays in ## Conclusions>
   Risks: RISK-<n> — <a few words; the value stays in ## Conclusions>
   Open questions: OQ-<n> — <a few words; the question stays in ## Open Questions>
   Success signals: <how a reader knows the research did its job>
   Next step: <one concrete follow-up; the command comes from the routing table below>
   <!-- unikit:active-summary:end -->
   ## Topic            — 1–2 sentences
   ## Context          — why this research started
   ## Findings         — dissections, comparisons, diagrams, trade-off tables; every finding carries an id `F-<n>`
   ## Conclusions      — what the evidence supports; every decision carries `DEC-<n>`, every risk `RISK-<n>`
   ## Open Questions   — what remains unproven; every question carries `OQ-<n>`
   ## Next Steps       — concrete follow-ups (see routing below)
   ## Sessions         — the region between the two markers below
   <!-- unikit:sessions:start -->
   ### <YYYY-MM-DD HH:MM> — <session title>
   What changed: <what this save added or revised>
   Key notes: <what a later session must not rediscover>
   Gate: passed (<N> passes) | stopped at budget: <k> unresolved — OQ-<n>, … | not run — <reason>
   Links (paths): <files the session read or wrote>
   <!-- unikit:sessions:end -->
   ## References       — games, articles, URLs (note any web/Agent sources used)
   ```

   The text after each `—` in the template is a note to you; it is not copied into the
   record.

   **The `Experiment:` line** is written only by a research grounded on a card (`SKILL.md`, Bootstrap Context → Experiment grounding), one line per card. `EXP-<nnn>` is defined by the card, not by the record, so the coherence gate does not look for it. A planner picks the research up by this line and reads its Active Summary as context; the routing row for an experiment card, below, outranks the lens rows. In a grounded research it is **not optional**: before the gate runs, check that the summary holds one such line per card read, because a research without it is invisible to the planner.

   The Table of Contents is **mandatory** and reflects the real sections. The
   **`Target:` / `Kind:`** lines are written **only** by the internal design lens
   (`internal-design-lens.md` → "Research tags") — they let `unikit-gd-system` /
   `unikit-gd-flow` / `unikit-gd-content` discover this research deterministically
   after a `/clear`.
   A reference-dissection or market research omits both. The **experiment lens** writes
   `Kind: experiment` and no `Target:` (`experiment-lens.md` → "Tags and routing"): the
   experiment skill finds the research by its words, not by a target.

   **Identifiers.** The vocabulary is closed: `F-<n>` (finding), `DEC-<n>` (decision),
   `RISK-<n>` (risk), `OQ-<n>` (open question), and in an ultra research also `ADR-<NNNN>`
   (numbered inside the folder from 0001). An identifier is unique in the record and
   never reused; a superseded item is marked superseded and keeps its number. The record
   defines each identifier in the section that owns it — `F-<n>` in `## Findings`,
   `DEC-<n>` and `RISK-<n>` in `## Conclusions`, `OQ-<n>` in `## Open Questions` — and the
   summary only cites it: its `Decisions:` / `Risks:` / `Open questions:` lines carry the
   identifier and a few words that let a reader recognise the item, while the value (a
   number, a threshold, an enumeration, a path) stays in the one owning section. In one
   sentence: the summary characterises, it never carries the value.

   **A record without a summary stays readable.** Updating such a record (option 1 of the
   collision question) adds both regions to the same record; `Date:` is not changed.

   **`## Sessions` is append-only.** A new session entry goes at the end of its region;
   earlier entries are never rewritten. The one exception is the `Gate:` field of the
   current save's own entry, which is filled in after the coherence gate
   (`references/coherence-gate.md`) has run.

   The marker pair of the summary is the one `.unikit/system/research-link.md` uses, so the format is
   compatible with that contract; a design research is not read by it today and the
   contract does not change. A marker pair with only one marker present is damage: the
   saving session does not guess the boundary, it prints
   `WARN [gd-research] <folder>: marker pair incomplete — region rewritten whole` and
   rewrites that region whole.

2. **`RESEARCH_BRIEF.md`** — a compact brief built **for `unikit-gd-spec` /
   `unikit-gd-system` to consume** (the acceptance bar: it must be usable as their
   input). Sections:

   ```markdown
   # Research Brief: <title>
   - **Question**: <what was researched>
   - **Key findings**: <bulleted, each with a source>
   - **Portable mechanics**: <what to borrow> · **Incidental**: <what not to>
   - **Trade-offs**: <the comparison table's conclusion>
   - **Implications for our design**: <which pillars / systems this informs>
   - **Recommended follow-up**: <spec / detail / brainstorm / prototype>
   ```

   Fill sections with `N/A` rather than inventing content the research did not cover.

   **Internal design lens — append the mode-aware block.** When this research came
   from the internal design lens, append to `RESEARCH_BRIEF.md` the **one** block that
   matches the resolved handoff route. The **block definitions (field lists) are owned
   by `internal-design-lens.md` → "Mode-aware brief"** — read them there; do **not**
   duplicate the fields here. The headings are **stable English anchors** so the routed
   skill greps them deterministically. Pick the block by route:

   - **`## Improvement Plan`** / **`## New Feature Plan`** — a **system** (route
     `/unikit-gd-system`, or `/unikit-gd-spec` add-system → `/unikit-gd-system` for a
     mechanic with no doc yet).
   - **`## Flow Improvement Plan`** / **`## Flow Feature Plan`** — a **flow** (route
     `/unikit-gd-flow`; the flow zone registers itself — no add-flow step).
   - **`## Content Improvement Plan`** / **`## Content Feature Plan`** — a **content
     type** (route `/unikit-gd-content`; the content zone registers itself — no
     add-content step).

   For several targets, append one block per target (dependency-sorted).

   **Experiment lens — append the `## Experiment Plan` block.** One block, for
   `/unikit-gd-experiment`; its field list is owned by `experiment-lens.md` → "The block" and
   is not repeated here.

   **Offering the block.** When the research is about a mechanic or a player flow and the
   experiment lens did not engage (the prompt carried no test signal), ask once before the
   brief is written, with the question tool of your agent (`AskUserQuestion`): add the
   `## Experiment Plan` block, so that `/unikit-gd-experiment` can build a card from this
   research? The options are no (recommended) and yes; the default is no. On yes, fill the
   fields of the block from what the research already holds and ask only what is still
   missing; on no, write the brief as usual. In subagent mode nothing is asked.

**Next Steps routing** — turn insights into concrete follow-ups:

| Insight | Follow-up |
|---------|-----------|
| A direction worth ideating | 💡 `/unikit-gd-brainstorm` |
| Ready to formalize into the master spec / a system | 🗺️ `/unikit-gd-spec` / 🧩 `/unikit-gd-system` |
| **Internal lens** — improve a `detailed` system | 🧩 `/unikit-gd-system` (consumes `## Improvement Plan`) |
| **Internal lens** — a new mechanic (no doc / `not-started`) | 🗺️ `/unikit-gd-spec` (add-system) → 🧩 `/unikit-gd-system` (consumes `## New Feature Plan`) |
| **Internal lens** — fill a `skeleton` system | 🧩 `/unikit-gd-system` |
| **Internal lens** — improve a `detailed` flow | 🌊 `/unikit-gd-flow` (consumes `## Flow Improvement Plan`) |
| **Internal lens** — a new / `skeleton` flow | 🌊 `/unikit-gd-flow` (consumes `## Flow Feature Plan`) |
| **Internal lens** — improve a `detailed` content type | 📦 `/unikit-gd-content` (consumes `## Content Improvement Plan`) |
| **Internal lens** — a new / `skeleton` content type | 📦 `/unikit-gd-content` (consumes `## Content Feature Plan`) |
| **Experiment lens** — a test to run | 🧪 `/unikit-gd-experiment` (consumes `## Experiment Plan`) |
| A balance/economy/UX convention worth keeping | 🧠 `/unikit-memory --module gamedesign` |
| A consistency concern in the current design | ✅ `/unikit-gd-verify` |
| **Grounded on an experiment card** — the card is ready for planning | 🧭 `/unikit-plan EXP-<nnn>` |
| **Grounded on an experiment card** — any other state | 🧪 `/unikit-gd-experiment` (finish the card, or its assessment, in the light of this research) |

3. **Update `researches/INDEX.md`** — **prepend** (newest first) after the header
   (create with `> Auto-maintained by /unikit-gd-explore. Do not edit manually.`
   if absent):

   ```markdown
   ---
   ### <Research Title>
   - **Date**: <YYYY-MM-DD HH:MM>
   - **Updated**: <YYYY-MM-DD HH:MM>
   - **Status**: completed | in-progress | needs-follow-up
   - **Mode**: ultra   (ultra research only — omit the field for a standard research; absent means standard)
   - **Summary**: <1–2 sentences from ## Topic>
   - **Path**: `<folder-name>/`
   - **Target**: SYS-<slug>   (internal-design lens only — the fallback discovery key
     for `unikit-gd-system`; omit for reference/market research)
   ```

   On a new research `Updated` equals `Date`; on revision only `Updated` changes.

## Write order

The order of writing a research. Items marked `[ultra]` are skipped by a standard research:

1. `[ultra]` append to `SOURCE.md` whatever the log does not hold yet (it was pinned while the conversation went on; here only what is still missing is appended)
2. `[ultra]` write the adaptive artifacts — only those `ultra-research.md` → `## Adaptive artifacts` lists and the subject needs
3. `RESEARCH_RESULT.md` — its `## Artifact Index` points at files that already exist
4. `RESEARCH_BRIEF.md`
5. Update researches/INDEX.md
6. `[ultra]` the integrity checks (`ultra-research.md` → `## Integrity`); each is blocking, and the save stands still until it passes
7. Research coherence gate

After `researches/INDEX.md` is re-rendered (and, in ultra, after the integrity checks of `ultra-research.md`) hand the path
`{{skills_dir}}/{{self_name}}/references/coherence-gate.md` to a `check-agent` dispatch, and
run the gate it specifies through that dispatch. The agent reads the file; this session does not.
Act on the report's `Next:` line and on nothing the report does not carry:

- `pass` → write the `Gate:` value it names into this save's session entry, record the remainder it lists, confirm the save;
- `repair` → apply the listed repairs as one batch, keeping to the repair rules the report quotes, then dispatch pass 2 with the findings adjudicated so far;
- `ask` → put the unresolved findings, the count per pass and the four options to the user, and on a save write the `OQ-<n>` entries and the `Gate:` value it names;
- `hold` → do not confirm; tell the user which durable file could not be read.

If `references/coherence-gate.md` does not exist, or the pass reports that it cannot read it, print one line
`WARN [coherence] reference missing — saving without the coherence pass`, write `Gate: not run — reference missing` into this save's session entry, and continue. A `hold` leaves the entry's `Gate:` as `not run — a durable file could not be read` until the file is readable again.
A report without a `Next:` line is treated as `hold`: say that the gate report is incomplete, do not confirm, and do not start another pass on your own.
The save is confirmed to the user only after the gate has finished (passed, or stopped at its budget with the user's answer in hand). The gate verdict is printed above the Next Steps routing and the handoff tail, which stay the last blocks of the reply.

This is the order of a standard research. An ultra research inserts its own steps into it ({{skills_dir}}/{{self_name}}/references/ultra-research.md); every save ends with the coherence gate (references/coherence-gate.md). The index of artifacts is never written before the artifacts, and the gate never runs before researches/INDEX.md is re-rendered.
