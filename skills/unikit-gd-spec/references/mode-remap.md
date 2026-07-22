# unikit-gd-spec — Remap Mode

> Loaded on demand by the `unikit-gd-spec` mode dispatch when the resolved mode is
> **Remap** (`GAME.md` exists; re-derive the whole roster). It re-runs **Phase B** from
> `mode-create.md` — load that reference for the Phase B detail. After writing,
> re-render via **Regen-on-Write** (in `SKILL.md`) and run the Final report (in `SKILL.md`).

## Remap Mode — Rebuild the System Map

`GAME.md` exists and the user wants the map re-derived (the game's scope changed,
or the map drifted). This touches **structure** (the roster), not the authored
one-pager's vision.

1. Read `GAME.md`, `GD-IDS.yaml`, and glob `systems/*.md`.
2. Re-run Create Mode Phase B (`mode-create.md` § Phase B: decompose → categorize →
   dependencies → tiers → design order → pillar coverage) against the current GAME.md.
3. Reconcile against existing rows — **never silently change a registry value or
   delete an ID**. Present a diff (added / changed / removed-→-deprecated systems)
   and get approval.
4. **Preserve detailed work:** a system that already has a `detailed`
   GDD keeps its `doc_status` and `version`; only its map metadata (category,
   depends, tier) may change, with approval. Deprecate (never delete) systems that
   no longer fit — set `status: deprecated` in `GD-IDS.yaml` (the `## System Map [gen]`
   then renders `deprecated` via display precedence — see gd-lifecycle → Lifecycle &
   Status); dangling references become verify conflicts.
5. Refresh `## Design Order` / `## Risks & Circular Dependencies` in GAME.md and
   re-render `## System Map [gen]` (Regen-on-Write in `SKILL.md`).
6. Recommend `/unikit-gd-verify` afterwards to catch any dependency drift.

**After writing → run the Final report (in `SKILL.md`).**
