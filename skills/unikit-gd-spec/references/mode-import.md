# unikit-gd-spec — Import Mode

> Loaded on demand by the `unikit-gd-spec` mode dispatch when the resolved mode is
> **Import** (the argument is a path or URL to an existing GDD). It reuses **Phase A**
> (extract GAME.md) and **Phase B** (decompose) from `mode-create.md` — load that
> reference for the Phase A/B detail. After writing, re-render via **Regen-on-Write**
> (in `SKILL.md`) and run the Final report (in `SKILL.md`).

## Import Mode — Bring an Existing GDD into the Workspace

The argument is a path or URL to an existing design document. Import is a
**document operation** — extract from the source, never reverse-engineer design
from code (one-way boundary).

1. **Read the source.** A local path → Read it. A URL → WebFetch it.
2. **Preserve it verbatim.** Write the original, unchanged, to
   `.unikit/gamedesign/researches/<date>_import-<slug>/SOURCE.md`. This is the
   provenance record `unikit-gd-system` later pulls section content from.
3. **Extract GAME.md** (Create Mode Phase A structure — `mode-create.md` § Phase A) from
   the source — *extract, do not regenerate*. Pull the premise, core fantasy, pillars,
   loops, the win/lose and monetization intent, and references the document already
   states. For elements the source lacks (commonly anti-pillars, pillar **design tests**,
   the Quantic Foundry / SDT profile, explicit non-goals, the monetization stance),
   follow the section-cycle to **ask** the user rather than inventing them, and tell
   the user which elements the source lacked. GAME.md records its provenance through
   the header `> **Based on**:` line (step 5), **not** per-section provenance markers
   — the `<!-- provenance: … -->` markers (`gd-principles` → Provenance) are a
   SYSTEM-GDD device; GAME.md is a free-form one-pager and is deliberately outside
   their scope (cf. the SYSTEM.md skeleton).
4. **Decompose** (Create Mode Phase B — `mode-create.md` § Phase B): take the systems the
   document names as **explicit**, then **infer the implicit** ones the document omits and
   mark them inferred. Build the `GD-IDS.yaml` roster + GAME.md Design Order / Risks and
   re-render `## System Map [gen]`.
5. **Provenance:** fill the GAME.md header `> **Based on**:` line with
   `researches/<date>_import-<slug>/SOURCE.md` — the single provenance record,
   identical in shape to the concept-seeded case (Create Mode Phase A). Do **not**
   add a separate `## Based on` section.

Holes the source leaves in per-system detail (sections E/G/H/I/J are commonly
missing from real-world GDDs) are filled later by `unikit-gd-system`, which marks
generated-vs-extracted content. Tell the user which systems came from the
document and which were inferred.

**After writing → re-render `## System Map [gen]` (Regen-on-Write in `SKILL.md`), then run the Final report (in `SKILL.md`).**
