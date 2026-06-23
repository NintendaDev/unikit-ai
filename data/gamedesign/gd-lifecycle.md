# Game-Design Principles — Lifecycle & Status

A shard of the `gd-principles` working contract, installed by `unikit-ai init` /
`unikit-ai update` into `.unikit/system/gamedesign/gd-lifecycle.md` as a flat copy
(engine-agnostic, no variable substitution, not hash-tracked). Loaded on Bootstrap
by `unikit-gd-spec`, `unikit-gd-system`, `unikit-gd-flow`, and `unikit-gd-verify`.
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
| `detailed` | every section authored, facts registered | `unikit-gd-system` | `reviewed` / `revised` |
| `reviewed` | passed `unikit-gd-review` with no Critical/Major | `unikit-gd-review` (on approval) | `revised` |
| `revised` | edited after `detailed`/`reviewed`; **pending re-verify** | `unikit-gd-system` (edit) · `unikit-gd-verify` (flags a stale dependent) | `reviewed` (after re-review) |

- `not-started` carries **no version** — no `version` in GD-IDS (the
  `## System Map [gen]` shows `Ver —`). A version of `1` appears only from
  `skeleton` onward.
- `revised` is the "needs re-verify" state: a system stays `revised` until
  `unikit-gd-review` re-clears it back to `reviewed`.
- `approved` is **not** a system `doc_status` — it was merged into `reviewed`.
  The word "approved" elsewhere in this contract ("approved content", "approved
  edit", "after approval") means collaborative approval, not a status. `GAME.md`
  (`drafted | approved`) and `CONCEPT.md` (`exploring | drafted | approved`) keep
  their **own** lifecycle enums — those are not system `doc_status`.
- `doc_status: revised` (this lifecycle state) is distinct from the GD-IDS
  `revised:` **date field** (when a fact's value last changed). Status writers
  touch `doc_status` only; they never repurpose the `revised:` date as a status.

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
carries `doc_status` on the **same 5-value spine** as systems and flows
(`not-started` → `skeleton` → `detailed` → `reviewed` → `revised`), in the same
**two places that must always agree** — the `CONTENT-TYPE.md` header `> Status:` line
and the `content_types[].doc_status` field in `GD-IDS.yaml`. On disagreement
`GD-IDS.yaml` wins; the conflict surfaces through `unikit-gd-verify`, and the
`## Content Map [gen]` block in `GAME.md` renders the status read-only (a stale
render is a *freshness* conflict, fixed by a re-render, not a status disagreement).
Only a **schema edit** drives a `CT` to `revised`; catalog churn never does (the
schema-vs-values split — see `gd-authoring` → Content delta).

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
`unikit-gd-system`, `unikit-gd-flow`, `unikit-gd-content`, `unikit-gd-review` — write
the status into **both places** (the document header `> Status:` line in `SYSTEM.md`
/ `FLOW.md` / `CONTENT-TYPE.md` and the `GD-IDS` `doc_status` field) on every status
change, so the spine stays coherent; the `## System Map [gen]` / `## Flow Map [gen]`
/ `## Content Map [gen]` then re-render from `GD-IDS`.

**Dependent-lag exception (intentional).** `unikit-gd-verify` is deliberately
**not** a full two-place writer. When it flags a *dependent* system as stale it
bumps that dependent to `revised` in the **GD-IDS `doc_status` only**, leaving the
dependent's document header to catch up on its next authoring touch. So a
verify-flagged dependent may transiently carry a header `Status` behind its GD-IDS
value — this is expected, and full header alignment for flagged dependents is a
later tier. The "both agree" invariant holds for every system **except** a
dependent caught between a verify flag and its next authoring edit.
