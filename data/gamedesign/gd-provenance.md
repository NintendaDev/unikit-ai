# Game-Design Principles — Provenance (imports)

A shard of the `gd-principles` working contract, installed by `unikit-ai init` /
`unikit-ai update` into `.unikit/system/gamedesign/gd-provenance.md` as a flat copy
(engine-agnostic, no variable substitution, not hash-tracked). Loaded on Bootstrap
by `unikit-gd-system`, `unikit-gd-flow`, `unikit-gd-review`, and `unikit-gd-explore`.
See the core `gd-principles.md` for zone ownership and routing.

## Provenance (imports)

When a system GDD is built by importing an existing document (the
`unikit-gd-system` import path), each section records where its content came from,
so a later review can hold inferred material to a higher bar than author-sourced
material. The markers are HTML comments placed directly under the section heading
they describe:

- `<!-- provenance: extracted from SOURCE.md -->` — the section's content was
  lifted from the imported source document (verbatim or lightly edited). It is
  trusted as author-sourced; review does not second-guess it on provenance grounds.
- `<!-- provenance: generated -->` — the section had no counterpart in the source
  and was inferred to complete the skeleton. It carries no author authority; the
  provenance lens (`unikit-gd-review`) holds every generated claim against the
  source and the registry at **≥ Major**.
- **Untagged is normal authored content** — a section with no provenance marker is
  ordinary collaborative authoring (the non-import default). Absence of a marker is
  never itself a finding. **Drafts seeded from a `unikit-gd-explore` internal-design
  lens brief are untagged normal authored content too** — the lens is collaborative
  authoring carried out in research, not an import, so `unikit-gd-system` leaves its
  explore-seeded section drafts and deltas **unmarked**: the `extracted` /
  `generated` markers belong to the import path alone.

Rules:

- `unikit-gd-system` writes the markers on import (one per section that needs one);
  the regular collaborative authoring path leaves sections untagged.
- **Explore research is an allowed authoring source.** `unikit-gd-explore` research
  may seed `unikit-gd-system` and `unikit-gd-flow` section drafts and deltas (a
  generalization of the import-reading path) — discovered by the `GD-IDS` `research:`
  pointer (authoritative) → `researches/INDEX.md` `Target:` (fallback). The system
  `research:` pointer is owned by `unikit-gd-spec` (written in add-system); the flow
  `research:` pointer (under `flows[]`) is owned by `unikit-gd-flow` (there is no
  add-flow in spec — the flow zone registers itself). Either is a **non-id path**,
  inert to `unikit-gd-verify` coherence, and the seeded artifact's **lifecycle is
  unchanged** — it stays `not-started` until its zone owner authors it.
- An edit **never strips a provenance marker** — it may change a generated
  section's content, but the marker survives so its origin stays auditable across
  versions. Promoting `generated` → `extracted` is a deliberate, recorded act,
  never a silent side effect of editing.
- Markers are **inert to the code side** — they are HTML comments, never parsed by
  the plan brief or any code-module skill; they live entirely inside the design
  layer.
