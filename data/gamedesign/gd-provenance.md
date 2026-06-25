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
- `<!-- provenance: extracted from code -->` — the fact was **reconstructed from the
  codebase** by a read-only research verb (`unikit-gd-recon` cold-start, or the
  `unikit-gd-explore` code-grounded lens), not from a designer or an authored source
  document. Code expresses *structure* (a roster, a `depends_on` graph, a `CT.fields`
  schema), never *intent* (pillars, fantasy, the "why") — so a code-extracted claim is
  **inference about design from an implementation**, held by the provenance lens at
  **≥ Major** against the registry and the system's own stated purpose. It is
  **distinct from** the trusted `extracted from SOURCE.md`: same verb ("extracted"),
  opposite trust — author-sourced is trusted, code-sourced is suspect. Promotion
  `extracted from code` → `extracted from SOURCE.md` / untagged is a deliberate,
  recorded act, performed only once a human has confirmed the intent the code could
  not carry.
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
- **Provenance asymmetry — the explore code lens.** The internal-design lens brief
  seeds **untagged** normal authoring (above). The `unikit-gd-explore` **code-grounded
  lens** is the exception: because it reads code, the facts it lifts directly from the
  codebase carry `provenance: extracted from code` (review ≥ Major), exactly as a
  `RECON.md` would — the designer's own options and reasoning in the same brief stay
  untagged. So `unikit-gd-system` / `unikit-gd-content`, when seeding a draft from a
  code-grounded explore brief, marks the code-lifted sections `extracted from code` and
  leaves the rest untagged. This keeps the two read-only research verbs symmetric:
  code-origin is tagged identically no matter which verb surfaced it.
- **Code reconstruction is held at `extracted from code`, and the import membrane must
  not launder it.** A `unikit-gd-recon` `RECON.md` carries a **durable code-provenance
  banner** at the top of the file plus per-fact `provenance: extracted from code`
  markers. The `unikit-gd-spec` import path copies its source **verbatim** into
  `SOURCE.md`, so the banner and markers survive the copy. When a system's import
  source (`SOURCE.md`) carries the banner — or `GAME.md`'s `> **Based on**:` header
  names a `RECON.md` — the system is a **code-reconstructed import**: the provenance
  lens holds even its `extracted from SOURCE.md` sections at **≥ Major** (the banner
  overrides the normal "trusted" treatment), because the underlying material was
  inferred from code, not lifted from an authored document. Without this signal the
  import path would relabel code-facts as trusted author-sourced content — exactly
  backwards.
- An edit **never strips a provenance marker** — it may change a generated
  section's content, but the marker survives so its origin stays auditable across
  versions. Promoting `generated` → `extracted` is a deliberate, recorded act,
  never a silent side effect of editing.
- Markers are **inert to the code side** — they are HTML comments, never parsed by
  the plan brief or any code-module skill; they live entirely inside the design
  layer.
