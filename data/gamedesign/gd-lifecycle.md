# Game-Design Principles — Lifecycle & Status

A shard of the `gd-principles` working contract, installed by `unikit-ai init` /
`unikit-ai update` into `.unikit/system/gamedesign/gd-lifecycle.md` as a flat copy
(engine-agnostic, no variable substitution, not hash-tracked). Loaded on Bootstrap
by `unikit-gd-spec`, `unikit-gd-system`, `unikit-gd-flow`, `unikit-gd-content`,
`unikit-gd-verify`, and the `unikit-gd-apply` dispatcher.
See the core `gd-principles.md` for zone ownership and routing.

## Lifecycle & Status

Every system carries a `doc_status` recording how far its GDD has progressed. The
value lives in **two places that must always agree** — the document header (the
`> Status:` line in `SYSTEM.md`) and its `doc_status` field in `GD-IDS.yaml`. On
any disagreement **`GD-IDS.yaml` wins** (it is the machine truth); the conflict
surfaces through `unikit-gd-verify`. The `## System Map [gen]` block in `GAME.md`
**renders** each system's status read-only from `GD-IDS` — it is a generated view,
never an authored coherence surface (a stale render is a *freshness* conflict,
fixed by a re-render, not a status disagreement).

**System `doc_status` — the design-writable set, in order:**

| Status | Meaning | Set by | Next |
|---|---|---|---|
| `not-started` | mapped in the roster, no document yet | `unikit-gd-spec` | `skeleton` |
| `skeleton` | A–K headers + `[To be designed]` placeholders | `unikit-gd-system` | `detailed` |
| `detailed` | every core section authored (deferred standard/full ⇒ detailed · partial) | `unikit-gd-system` | — (terminal readiness; edits bump `Ver`, status stays `detailed`) |

- `not-started` carries **no version** — no `version` in GD-IDS (the
  `## System Map [gen]` shows `Ver —`). A version of `1` appears only from
  `skeleton` onward.
- `detailed` is **terminal readiness**. Editing a `detailed` document bumps its
  `version` (`Ver+1` + changelog) but **never** changes `doc_status` — status
  records readiness only; "what changed" is carried by the version + changelog and
  re-checked by an *ephemeral* `unikit-gd-verify` / `unikit-gd-review` run, not by a
  stored status badge. This is the current-state-only axiom: history lives in git
  and the changelog, not in a status value.
- `approved` is **not** a system `doc_status`. The word "approved" elsewhere in
  this contract ("approved content", "approved edit", "after approval") means
  collaborative approval, not a status. `GAME.md` (`drafted | approved`) and
  `CONCEPT.md` (`exploring | drafted | approved`) keep their **own** lifecycle
  enums — those are not system `doc_status`.

**Depth tiers, the core floor, and the inferred `detailed · partial` status.**
Authoring runs at an **ephemeral depth** — a `core/standard/full` picker chosen per
pass and **never stored** (see `gd-authoring` → Section-Cycle Contract). Depth is
orthogonal to this lifecycle; the lasting fact is the **status**, and partiality is
**inferred**, never a stored field. The enum above is unchanged. This is the
**canonical home** — every `## *Map [gen]` renderer reads the core-set and the
partial render format from here.

- **`core` is the floor.** A document reaches `detailed` when its whole **core-set**
  is authored; deferred `standard`/`full` sections are fine. The **per-zone core-set**
  (canonical):
  - **system** — A Overview · B Player Fantasy · C Detailed Design · D Formulas ·
    H Acceptance Criteria (`A/B/C/D/H`).
  - **flow** — A Overview · B Objective Flow / GOAL (`A/B`).
  - **content** — A Overview · B Schema (`CT.fields`) · C Scale (`A/B/C`; Scale is in
    core because it dictates code structure).
- **Soft floor guard.** A **core** section may be deferred, but then the status
  honestly **does not rise to `detailed`** — it stays `skeleton`. Emit
  `WARN [gd] core section §<name> deferred — status held below detailed`. A
  `detailed` document therefore has **zero deferred core sections** by
  construction.
- **`detailed · partial` is inferred.** When the core is complete but ≥1 **non-core**
  (`standard`/`full`) section is intentionally deferred, the status reads
  `detailed · partial`. Partiality is **derived from the presence of
  `<!-- deferred -->` markers** in the document, **never stored** — there is **no new
  field and no two-place coherence for partiality** (drift is impossible). The enum
  `doc_status` stays `{not-started, skeleton, detailed}`; `· partial` is a
  **render-time annotation**, not a status value.
- **Render format (canonical).** Every `## *Map [gen]` renderer (`unikit-gd-verify`,
  `unikit-gd-spec` System Map, `unikit-gd-flow` Flow Map, `unikit-gd-content` Content
  Map) appends the suffix **`· partial (n/m)`** to the Status column of a document
  carrying ≥1 `<!-- deferred -->`, where **n = the count of deferred non-core sections**
  (those carrying `<!-- deferred -->`) and **m = the total number of deferrable
  (i.e. non-core) sections** of that zone. Counting against *core* is wrong: the floor
  guard keeps every deferred-core document below `detailed`, so a `detailed · partial`
  document has zero deferred core sections by construction and a core-denominated
  counter would always read `(0/m)`. Partial reflects what was skipped in the
  **superstructure above the floor**.
- **Marker semantics.** `<!-- deferred -->` is an **intentional** omission (a section
  the author chose to skip at this depth) — it is **not** a placeholder leak.
  `[To be designed]` is an **unfilled skeleton** placeholder and remains a leak in any
  `detailed`+ document. The two tokens are distinct and never interchangeable. This
  rule applies identically to a `CT-<slug>` document (the same 3-value spine, below).

**Two values that design never writes as `doc_status`:**

- `deprecated` lives in the system's **`status` field** (`active | deprecated`),
  not in `doc_status`. `unikit-gd-spec` sets it on a remap; the document file and
  the GD-IDS entry are **kept** (never deleted — dangling references are verify
  conflicts). **Display precedence:** while `status: deprecated`, the
  `## System Map [gen]` Status shows `deprecated` regardless of the row's
  underlying `doc_status`.
- `implemented` is **code-set only** — the lone sanctioned code→design write,
  applied by the code pipeline (`unikit-verify` on all-AC-met — see One-Way
  Boundary) and **read-only** to every design skill. It is rendered (read-only) in
  the `## System Map [gen]` as a display value; design skills never set it and
  never read code to learn it. The version it pins lives in the `GD-IDS.yaml`
  `implemented_version` field (also code-set), not in `doc_status`.

**Content axis (`CT` lifecycle + `belongs_to`).** A **content type** (`CT-<slug>`)
carries `doc_status` on the **same 3-value spine** as systems and flows
(`not-started` → `skeleton` → `detailed`), in the same
**two places that must always agree** — the `CONTENT-TYPE.md` header `> Status:` line
and the `content_types[].doc_status` field in `GD-IDS.yaml`. On disagreement
`GD-IDS.yaml` wins; the conflict surfaces through `unikit-gd-verify`, and the
`## Content Map [gen]` block in `GAME.md` renders the status read-only (a stale
render is a *freshness* conflict, fixed by a re-render, not a status disagreement).
Only a **schema edit** bumps a `CT`'s version (`Ver+1`, status stays `detailed`);
catalog churn never does (the schema-vs-values split — see `gd-authoring` →
Content delta).

- **`belongs_to` (`CT → SYS`, one-way).** A content type names the **consuming
  system** it feeds (`belongs_to: SYS-<slug>`). The edge is one-way: a system never
  lists its content types. A `belongs_to` that names a system **missing or
  deprecated** in the roster is a verify conflict that **routes back** to
  `unikit-gd-spec` add-system — the content zone never writes a roster row itself
  (Zone Ownership in the core).
- **Display precedence.** While a `CT`'s `status: deprecated` (the `active |
  deprecated` field, not `doc_status`), the `## Content Map [gen]` Status shows
  `deprecated` regardless of the row's underlying `doc_status` — the same precedence
  rule that governs a deprecated system. The document file and the `GD-IDS` entry are
  **kept** (never deleted — dangling references are verify conflicts).

**Who writes the two places.** The authoring skills — `unikit-gd-spec`,
`unikit-gd-system`, `unikit-gd-flow`, `unikit-gd-content` — write the status into
**both places** (the document header `> Status:` line in `SYSTEM.md` / `FLOW.md` /
`CONTENT-TYPE.md` and the `GD-IDS` `doc_status` field) on every status change, so the
spine stays coherent; the `## System Map [gen]` / `## Flow Map [gen]` /
`## Content Map [gen]` then re-render from `GD-IDS`. `unikit-gd-verify` is
**read-only** — it never writes a status; when it finds a stale dependent it
**prints** the affected docs (informational) and leaves the bump to the owner's next
authoring touch.
