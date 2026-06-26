# Saving Research Results (artifact templates)

Loaded on demand by `unikit-gd-explore/SKILL.md` → "Saving Research Results" when a
research crystallizes and the user accepts the save offer. The SKILL keeps the offer +
the trigger; this file holds the artifact templates, the Next Steps routing, and the
index format. The **mode-aware brief blocks** are NOT duplicated here — their field
lists are owned by `references/internal-design-lens.md` → "Mode-aware brief".

## Saving Research Results

When the conversation crystallizes, **offer** to save (never auto-save):

```
AskUserQuestion: Save this research to .unikit/gamedesign/researches/?
Research name: <date>_<kebab-slug>
Options: 1. 💾 Yes — save   2. 🚫 No
```

On yes:

```bash
mkdir -p .unikit/gamedesign/researches/<date>_<slug>
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
   Kind: feature | improvement   # internal-design lens only — feature = new system/flow/content type, improvement = existing one

   ## Table of Contents
   ## Topic            — 1–2 sentences
   ## Context          — why this research started
   ## Findings         — dissections, comparisons, diagrams, trade-off tables
   ## Conclusions      — what the evidence supports
   ## Open Questions   — what remains unproven
   ## Next Steps       — concrete follow-ups (see routing below)
   ## References       — games, articles, URLs (note any web/Agent sources used)
   ```

   The Table of Contents is **mandatory** and reflects the real sections. The
   **`Target:` / `Kind:`** lines are written **only** by the internal design lens
   (`internal-design-lens.md` → "Research tags") — they let `unikit-gd-system` /
   `unikit-gd-flow` / `unikit-gd-content` discover this research deterministically
   after a `/clear`.
   A reference-dissection or market research omits both.

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

**Next Steps routing** — turn insights into concrete follow-ups:

| Insight | Follow-up |
|---------|-----------|
| A direction worth ideating | 💡 `/unikit-gd-brainstorm` |
| Ready to formalize into the master spec / a system | 🗺️ `/unikit-gd-spec` / 🧩 `/unikit-gd-system` |
| **Internal lens** — improve a `detailed`/`reviewed`/`revised` system | 🧩 `/unikit-gd-system` (consumes `## Improvement Plan`) |
| **Internal lens** — a new mechanic (no doc / `not-started`) | 🗺️ `/unikit-gd-spec` (add-system) → 🧩 `/unikit-gd-system` (consumes `## New Feature Plan`) |
| **Internal lens** — fill a `skeleton` system | 🧩 `/unikit-gd-system` |
| **Internal lens** — improve a `detailed`/`reviewed`/`revised` flow | 🌊 `/unikit-gd-flow` (consumes `## Flow Improvement Plan`) |
| **Internal lens** — a new / `skeleton` flow | 🌊 `/unikit-gd-flow` (consumes `## Flow Feature Plan`) |
| **Internal lens** — improve a `detailed`/`reviewed`/`revised` content type | 📦 `/unikit-gd-content` (consumes `## Content Improvement Plan`) |
| **Internal lens** — a new / `skeleton` content type | 📦 `/unikit-gd-content` (consumes `## Content Feature Plan`) |
| A balance/economy/UX convention worth keeping | 🧠 `/unikit-memory --module gamedesign` |
| A consistency concern in the current design | ✅ `/unikit-gd-verify` |

3. **Update `researches/INDEX.md`** — **prepend** (newest first) after the header
   (create with `> Auto-maintained by /unikit-gd-explore. Do not edit manually.`
   if absent):

   ```markdown
   ---
   ### <Research Title>
   - **Date**: <YYYY-MM-DD HH:MM>
   - **Updated**: <YYYY-MM-DD HH:MM>
   - **Status**: completed | in-progress | needs-follow-up
   - **Summary**: <1–2 sentences from ## Topic>
   - **Path**: `<folder-name>/`
   - **Target**: SYS-<slug>   (internal-design lens only — the fallback discovery key
     for `unikit-gd-system`; omit for reference/market research)
   ```

   On a new research `Updated` equals `Date`; on revision only `Updated` changes.
