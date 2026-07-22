# RECON-input mode (input-mode body)

Loaded on demand by `unikit-gd-explore/SKILL.md` → "Input modes" when the argument
resolves to a `RECON.md` file. This is the body; the SKILL keeps only the switch.
Develops the reconstruction through the internal-design lens
(`references/internal-design-lens.md`); the pre-GDD carve-out lets the lens engage with
no `GAME.md` yet.

## RECON-input mode — developing a cold-start reconstruction

`unikit-gd-recon` reconstructs a brownfield project into one passive
`.unikit/gamedesign/RECON.md` — a candidate design **skeleton** (system roster +
`depends_on`, content schemas, RES/ENT/FORM) plus a mandatory **`## Intent Gap`** of what
code cannot know (pillars, fantasy, the "why"). That skeleton is exactly what the
**internal-design lens** is for: working the open questions into decided design before the
GDD is authored. When the argument **resolves to a `RECON.md` file**, run this mode.

**Pre-GDD carve-out.** The internal-design lens normally requires `GAME.md` (it reasons
about *this game's* design). RECON.md **is** that candidate design surface before a GDD
exists, so the lens engages on it directly — the one pre-GDD case where "no `GAME.md`"
does **not** bounce to brainstorm/spec.

1. **Deep-read `RECON.md`** as the candidate design (in place of `GAME.md` + system docs):
   its `## Systems`, `## Content Types`, `## Resources · Entities · Forms`,
   `## Provided Context`, and especially the **`## Intent Gap`**.
2. **Treat the `## Intent Gap` as the open-questions registry.** Each gap item — pillars,
   target fantasy, win/lose intent, "are these numbers balanced or merely current?" — is
   an open question; run the lens's closure pass over them (deep-read, options, decide),
   exactly as the internal-design lens does for a GDD's open questions.
3. **Carry the code provenance.** Facts the lens lifts **from RECON's reconstructed
   sections** stay `provenance: extracted from code` (held ≥ Major — `gd-provenance`); mark
   them as such in the research record, symmetric with the code-grounded lens. The
   designer's own decisions worked out on top stay **untagged**.
4. **Save the research AS USUAL — then backlink it (the asymmetry with review-file mode).**
   Unlike a review file (mutated in place, no `researches/`), RECON.md is a **durable
   seed**: save the research the normal way (`researches/<date>_<slug>/` via "Saving
   Research Results"), then write a `research:` **backlink** into RECON.md's
   **`## Explorations`** section — an accumulating registry of pointers, the cold-start
   mirror of the `GD-IDS` `research:` pointer. Append (create the section if absent), one
   line per research:

   ```
   - research: `researches/<date>_<slug>/` — <1-line topic>  (Target: <SYS-slug | Intent-Gap item>)
   ```

   This is a **sanctioned write into RECON.md** (owned by `unikit-gd-recon`) — recorded in
   Ownership below; explore writes nothing else to RECON.md.
5. **End with the import command (Handoff Tail contract).** The reconstruction is now
   worked-through. **Recommend** (print, never invoke — no `Skill` tool) the import as the
   **last block**, icon in front, nothing after it:

   ```
   🗺️ /unikit-gd-spec .unikit/gamedesign/RECON.md
   ```

   `/unikit-gd-spec` import mode extracts a `GAME.md` and asks the user to fill the Intent
   Gap — now pre-worked by the linked research. The subagent-mode bypass applies as
   elsewhere (no interactive closure-pass questions when spawned).
