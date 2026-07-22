# Code Reconnaissance — the shared `code → design-fact` engine

The single source of the heuristics that turn an implementation into **candidate**
design facts. Owned by `unikit-gd-recon` (cold-start, whole project → `RECON.md`); read
by the `unikit-gd-explore` **code-grounded lens** (post-GDD, targeted slice → an explore
brief). Same heuristics, two consumers, no duplication — the `delegation-contract`
pattern (provider owns the spec, the other skill reads it).

This file is **read-only on code** and **engine-agnostic**. It describes *what to look
for* and *how to record it*; the output document (RECON.md sections / the explore brief)
belongs to the consuming skill, not here.

## The honest limit (read this first)

Code carries **structure**, never **intent**. It can tell you a roster of systems, a
`depends_on` graph, a content schema, the resources a game tracks — the **skeleton**. It
cannot tell you *why* any of it exists: the pillars, the target fantasy, the feeling a
system is supposed to produce, whether a number is balanced or merely current. A filled-
but-soulless GDD is **worse than an empty one** — it manufactures the illusion of a
finished design.

Therefore every fact this engine emits obeys three rules:

1. It is tagged **`provenance: extracted from code`** (see `gd-provenance`) — held by the
   `unikit-gd-review` provenance lens at **≥ Major**. Code-sourced is *suspect*, the
   opposite of author-sourced `extracted from SOURCE.md`.
2. It carries a **confidence** grade and a **source pointer** (`file:line`, or a glob for
   an aggregate). A fact without a pointer is a guess and must not be emitted as a fact.
3. Anything the code cannot answer — every "why", every motivation, every balance
   judgement — is **not invented**. It is named in the consuming document's mandatory
   **`## Intent Gap`** as an open question for a human.

## Step 1 — Infer the engine (cold-start scan)

Do not assume an engine. Detect it from project markers with generic `Glob`, then read
the project's own `.unikit/RULES.md` (if present) for local conventions — the same
precedent `unikit-explore` follows (`.unikit/RULES.md` first, highest priority). No
engine-template wiring is involved: this module is `enginePartitioned: false`, and
`unikit-explore` already proves engine-agnostic code reading with zero `skillTemplates`.

| Engine | Cold-start markers (Glob) |
|--------|---------------------------|
| Unity | `Assets/`, `ProjectSettings/ProjectVersion.txt`, `**/*.asmdef`, `**/*.csproj` |
| Godot 4 (GDScript) | `project.godot`, `**/*.gd`, `**/*.tres` |
| Godot 4 (.NET) | `project.godot` + `**/*.csproj` + `[Export]`/`: Resource` in C# |
| Unreal 5 | `**/*.uproject`, `Source/**/*.Build.cs`, `Content/` |

If markers are mixed or absent, record the ambiguity and proceed with the generic
shapes below — never fabricate an engine. The asset/system **forms** differ per engine;
the **method** (Glob for the form, Grep for the fields, Read for the pointer) does not.

| Design shape | Unity | Godot 4 (GDScript) | Godot 4 (.NET) | Unreal 5 |
|--------------|-------|--------------------|-----------------|----------|
| gameplay-system | `MonoBehaviour` | `Node` + `.gd` | `Node : C#` | `AActor` + `UActorComponent` |
| data-asset (→ content type) | `ScriptableObject` | `Resource` (`.tres`) | `Resource` (C#) | `UDataAsset` / `UDataTable` |

A project's `.unikit/RULES.md` may name additional house conventions (a custom base
class, a folder layout, a naming scheme) — prefer it over the generic table when it
applies.

## Step 2 — Extract, by priority

### P0 — Systems: the roster + the `depends_on` graph

The most reliable extraction, because module structure is explicit in code.

- **Candidate systems** come from the coarse boundaries: assembly definitions
  (`*.asmdef` `name`), top-level namespaces, top-level folders under the source root, or
  the top-level gameplay classes (`MonoBehaviour` / `Node` / `AActor`+`UAC`). One
  boundary → one candidate roster row. Derive a `slug` from the boundary name.
- **`depends_on`** comes from the reference graph: `asmdef` `references`, `using` /
  `import` / `#include` edges aggregated to the boundary level, or constructor/`[Inject]`
  dependencies. Record the edge only when it crosses two candidate systems.
- **`category` / `tier`** are *weak* inferences (a `UI/` folder → presentation; an
  `Economy/` namespace → economy). Emit them as **low confidence** suggestions the human
  confirms, never as settled facts.

Output: a roster skeleton — `slug`, candidate `category`/`tier` (low confidence),
`depends_on`, and a `source` pointer per row. **Existence, not content** — exactly the
slice `unikit-gd-spec` add-system owns (the recon document only *recommends* it).

### P1 — Content: `CT.fields` + `scale`, plus ENT / RES / FORM

The content axis is the second-most extractable layer, because data-assets are typed
schemas in code (see `gd-content-axis` for the `CT` / `CU` model the output must match).

- **Content types (`CT-<slug>`)** come from data-asset definitions (the per-engine
  data-asset form above). Each definition is one candidate `CT`.
- **`CT.fields`** is read field-by-field from the definition and mapped to the typed
  schema `gd-content-axis` defines:

  | Code shape | `CT.fields` type |
  |------------|------------------|
  | `int` / `long` | `int` |
  | `float` / `double` | `float` |
  | `string` / `FName` / `FString` | `string` |
  | `bool` | `bool` |
  | an `enum` type | `enum` |
  | array / `List<T>` / `TArray<T>` | `list<T>` |
  | a sprite/mesh/prefab/asset reference | `asset-ref` |
  | a localization key / `loc-ref` table | `loc-ref` |
  | a reference to another data-asset/system | `ref<PREFIX>` (`ref<ENT>` / `ref<CU>` / `ref<FORM>` / `ref<SYS>` / `ref<RES>`) |

  A field that points at another design entity becomes a **typed `ref<>` field**, not a
  metadata note — that is the lever that keeps the CU envelope genre-stable.
- **`scale`** is inferred from how the instances live: **many** instances as on-disk
  assets/rows (a folder of `.asset`/`.tres`, a `DataTable`) → **`bulk`** (record the
  `count` + a `spec` of where they live and the shape they follow — never the values);
  a **few** hand-authored, individually-meaningful instances → **`curated`** (record the
  `fields` rows). On ambiguity, emit `bulk` with a low-confidence note for the human to
  flip.
- **ENT / RES / FORM** are recognized from their code shapes: an entity/actor definition
  → `ENT-`; a tracked numeric currency/quantity the code increments and spends →
  `RES-`; a discrete form/state/variant enum → `FORM-`. Each is a **fact**, registered by
  the owning zone via a registry-check downstream (`gd-content-axis` → RES/TRACK/KNOB), so
  recon emits them as candidate facts with pointers, not as documents.

### Flows — EXCLUDED

Flows (`FLOW-<slug>`, the *dynamics* axis — what the player does over time) are
**temporal and player-facing**. They are not present in code in any recoverable form: a
sequence of objectives, a pacing envelope, a funnel is a design intention, not an
implementation artifact. **This engine never emits a flow fact.** Flows stay author-only;
the consuming document routes "what does the player do?" into the Intent Gap.

## Step 3 — Record each fact

Every emitted fact is a row with these four parts (the consuming document formats them;
the contract is shared):

| Part | Meaning |
|------|---------|
| **fact** | the candidate design fact (a roster row, a `CT.fields` schema, a `RES-` id, an edge) |
| **confidence** | `high` (structural & explicit) · `medium` (inferred from convention) · `low` (a guess to confirm) |
| **source** | `path/to/File.ext:line` for a single fact, or a glob/folder for an aggregate (`Assets/Items/*.asset` → `count`) |
| **provenance** | always `extracted from code` — never omit it; it is the signal the import membrane and the review lens depend on |

**Confidence rubric.** `high` = the fact is *structurally explicit* (an `asmdef` name, a
typed field, a counted folder of assets). `medium` = inferred from a naming/folder
convention (a `UI/` folder ⇒ presentation tier). `low` = a judgement the code cannot
settle (is this number balanced? is this system a pillar?) — and most `low` items belong
in the Intent Gap instead of the fact list.

## What this engine does NOT do

- It does **not author**. It produces candidate facts for a *document*; the human and the
  authoring zones turn facts into a GDD.
- It does **not call any skill** (recon and the explore lens are read-only research verbs
  with no `Skill` in scope — the dispatch is the consuming skill's recommendation, never
  an inline call).
- It does **not read flows, infer intent, or invent a missing "why"** — those are the
  Intent Gap.
- It does **not write anything but the consuming verb's own document** (recon →
  `RECON.md`; explore lens → its brief). It never touches `GD-IDS`, `GAME.md`, a
  `SYSTEM.md`, a `CONTENT-TYPE.md`, or a `FLOW.md`.
