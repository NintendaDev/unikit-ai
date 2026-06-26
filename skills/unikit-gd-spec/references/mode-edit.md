# unikit-gd-spec — Edit Mode

> Loaded on demand by the `unikit-gd-spec` mode dispatch when the resolved mode is
> **Edit** (`GAME.md` exists; change an authored section). Re-render via
> **Regen-on-Write** (in `SKILL.md`) only when the edit touches roster metadata, then
> run the Final report (in `SKILL.md`).

## Edit Mode — Change GAME.md Content (the GAME.md carve-out)

`GAME.md` exists and the user wants to **change an authored section** — a pillar, the
core fantasy, a loop, an anti-pillar, the win/lose or monetization intent, the
premise. This zone is **owned here** (no separate editor skill); apply the **GAME.md
carve-out of the delta discipline** (`gd-authoring` → Delta Discipline), which is
deliberately lighter than a SYSTEM GDD edit.

1. Read `GAME.md` (and `GD-IDS.yaml` if a pillar/term is involved).
2. Author the change with the collaborative protocol — Context → Questions →
   Options (2–4, one Recommended with the WHY) → Decision → **Draft + Approval in the
   same reply** → Write (Edit anchored on the unique heading). Never rewrite an
   approved section without approval.
3. **Registry sync.** A pillar change updates `GD-IDS.yaml` `pillars` (never delete
   a `PIL-n` — deprecate it); a new term goes to `terms`. Same approval as the edit.
4. **Mandatory tail (GAME.md carve-out):**
   - **Version +1** in the GAME.md header `> **Version**:` line **only** — GAME.md
     has no `GD-IDS.yaml systems` row, so there is no system `version` to bump.
   - Append a **light** entry to `## Changelog` (version, date, essence, one line per
     changed section). **No** AC-delta line and **no** `Affected (gd-verify):` line —
     those are SYSTEM GDD fields.
   - Status stays `drafted | approved`; it is **never** set to `revised`. No two-place
     coherence, no pending-loop (a GAME.md edit does not flag dependents).
5. **Roster touch?** If the edit changes a pillar that a system's coverage depends on,
   or otherwise shifts roster metadata, re-render `## System Map [gen]` (Regen-on-Write
   in `SKILL.md`) — but Edit never adds or removes a system (that is Add-System / Remap).
6. Recommend `/unikit-gd-verify` (changed scope) after the edit.

A significant decision needs no separate registry record — its rationale rides the
`## Changelog` essence, and the full "why" lives in git history.

**After writing → run the Final report (in `SKILL.md`).**
