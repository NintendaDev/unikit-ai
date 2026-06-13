# Defective GDD fixture (ground truth)

Test data for the agent-driven `/unikit-gd-review` (quality) and
`/unikit-gd-verify` (mechanical consistency) skills, and for the Phase H manual
smoke (#19). These skills are LLM-driven, so there is no bash assertion here —
this README is the **ground truth** a reviewer checks the skill output against.
`test-skills.sh` only asserts the fixture exists and is well-formed.

The fixture is a tiny, deliberately broken design workspace:
`GAME.md` + `GD-IDS.yaml` + `systems/combat.md`.

## Planted defects

**Mechanical (should be caught by `/unikit-gd-verify`):**

1. **Doc ≠ GD-IDS version drift** — `systems/combat.md` header says `Version: 1`,
   but `GD-IDS.yaml` records `SYS-combat` at `version: 2`. The machine truth and
   the doc disagree.
2. **Dangling dependency** — `systems/combat.md` section F declares it depends on
   `SYS-inventory`, which exists in neither `GD-IDS.yaml` nor any system doc.
3. **Term drift** — the same resource is called **"stamina"** in the loop section
   and **"energy"** in the formula table; only one canonical term may exist.
4. **Unregistered fact** — `systems/combat.md` cites `FORM-combat-dps`, which is
   absent from `GD-IDS.yaml`'s facts.

**Qualitative (should be flagged by `/unikit-gd-review`):**

5. **Balance hole (Major)** — the damage formula has no upper bound, so stacking
   the buff scales damage to infinity (degenerate dominant strategy).
6. **Missing acceptance criteria (Major)** — section H lists no Given-When-Then
   acceptance criteria, so the system is not implementation-ready.
7. **Unfalsifiable pillar tie-in (Minor)** — the "feels skillful" claim has no
   design test backing it.
