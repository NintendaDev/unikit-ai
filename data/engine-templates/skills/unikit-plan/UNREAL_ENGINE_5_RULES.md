# Engine Rules: Unreal Engine 5

Engine planning vocabulary for Unreal Engine 5 projects. This file tells the `unikit-plan` skill **how to write a plan** for this engine — how the neutral `Editor:` grammar resolves into Unreal concepts, which placeholders the plan templates expand to, and when a change belongs in `Editor:` rather than `Files:`.

## §1 Kind → concept

The `Editor:` line is `Editor: [kind] <container> → <target> : <action>`. For Unreal Engine 5, `<container>` and `<target>` resolve as follows:

| Kind | Container | Target | Typical assets | Affordance the editor must offer |
|------|-----------|--------|----------------|----------------------------------|
| `scene` | a level (`.umap`) | an Actor by label, or a component on it | `.umap` | add / remove an actor · add / remove a component · write a property in the details panel · wire an asset or actor reference |
| `ui` | a widget blueprint | a widget in the tree, or a binding | `.uasset` | build the widget tree · set a binding · compile the graph · read the tree back |
| `vfx` | an effect system, or a material | an emitter / module, or a material parameter | `.uasset` | create or retune an effect · write a named material parameter · read the value back |
| `anim` | a sequence, an animation graph, or a montage | a state / transition, or a track / key | `.uasset` | create or edit an animation asset · add a state or transition · place a track or key |
| `asset` | a data asset, a data table, or an input resource | the asset itself, or a table row / field | `.uasset` | create an asset of a named class · write a field · read it back from the project |
| `settings` | `Config/Default*.ini` | a section and a key | `.ini` | register an entry on a project settings page · read it back |

Default kind is `scene` — use it when the change is a plain level edit and no more specific kind applies.

There is **no `input` kind.** Input is not a kind of editor work, it is an area of functionality, and it resolves into the six above: a mapping or action resource is a project asset, so it is an `asset`; a key binding registered on the project settings page or in `Config/Default*.ini` is `settings`; a component holding a reference to a mapping is `scene`; the handling code — bindings, callbacks, dispatch — is plain code and stays in `Files:`.

The **Affordance** column is what the plan checks against the live catalog: it names the *capability class* the editor has to offer for that kind, never a tool. A kind whose affordance is unreachable is a planning-time fact, not an implementation-time surprise.

**Path convention.** `<container>` is an asset path in `/Game/...` form (on disk, `Content/...`); `<target>` inside a level is the actor's label. For `settings`, `<container>` is the Project Settings page name or the configuration file.

## §2 Language & layout

Placeholder values for the plan templates in `references/TASK-FORMAT.md`:

| Placeholder | Unreal value |
|-------------|--------------|
| code fence (`<lang>`) | `cpp` |
| source extension (`<ext>`) | a pair — `h` for the header, `cpp` for the implementation; name **both** in `Files:` |
| content root (`<content-root>`) | `Content/` for assets, `Source/<Module>/` for code |
| DI binding form | engine subsystems (game and world scoped), resolved from the engine — not a container registration |

Use these verbatim when writing `Files:` lines, `## Technical Context` code blocks, and the `### DI BINDINGS` subsection. Do not invent alternatives — if a project's stack differs (a service locator, a different module layout), the project's own `.unikit/DESCRIPTION.md` wins over this table.

## §3 When to write `Editor:`

Write an `Editor:` line when the change touches the editor's **serialized state**. Eight concrete signals for Unreal — any one of them is enough:

1. An Actor is added to, or removed from, a level.
2. A component is added to or removed from an Actor.
3. A property value is set or retuned in the details panel (rather than in code).
4. An asset or actor reference is wired in the details panel.
5. A data asset or data table is created, or its rows are filled in.
6. A widget hierarchy is built or restructured.
7. An effect system or a material is created or retuned.
8. A key, action, or configuration section is registered on a project settings page, or in `Config/Default*.ini`.

**Plus one signal this engine has and the others do not: editing a blueprint graph is `Editor:`, never `Files:`** — even when the logic reads like code. The graph is stored inside a binary asset, so there is no text to put in `Files:` and no way to review a diff of it. A plan that describes graph logic as a source edit produces a task nobody can execute.

**Negative rule.** Text is `Files:`: a `.cpp`, a `.h`, a build script, the project descriptor, an `.ini`. The one file that goes either way is `.ini` — write it as `Editor:` only when the change is a *project setting* as an editor-owned fact, and as `Files:` when the file is being edited as configuration the repository owns. Decide by who owns the value, not by the extension. Writing a class that will later be placed or referenced in a level is `Files:` (the placing is the `Editor:` half).

## §4 Engine planning pitfalls

Collected from documentation; pitfalls section pending real-project validation.

## §5 Out of scope

This file does **not** carry code-writing rules. The boundary is exact:

- **The rules registry** (`.unikit/memory/code/{core,stack}`) = **HOW to write code** for this engine — naming, patterns, APIs, anti-patterns.
- **This file** = **HOW to write a PLAN** for this engine — vocabulary, placeholders, what belongs in `Editor:`, planning-time traps.

If a rule tells the implementer what the code should look like, it belongs in the registry, not here. Do not duplicate registry content into this file — a second source diverges from the first on its next edit.

## §6 Direct-edit feasibility

Whether the `direct` value of `Editor tasks` (a plain text edit of the serialized file, no editor and no MCP) is defensible for a given format:

| Format | Feasibility | Bounds |
|--------|-------------|--------|
| `Config/Default*.ini` | 🟢 acceptable | an ordinary text config file |
| the project descriptor, build and target scripts | 🟢 acceptable | text — but they are `Files:`, not editor targets |
| `.umap`, `.uasset` — every kind of them: graph, effect, material, data, widget | 🔴 not acceptable | a binary format. **Never offer `direct` for these**, at any size of change |

This engine is the reason the `direct` route needs a gate at all. With no engine MCP configured, the only mode available for a `scene` / `ui` / `vfx` / `anim` / `asset` target here is `manual`; `direct` remains available only for `settings` targets living in `.ini`. The `unikit-plan` skill offers `direct` only for 🟢 / 🟡 formats, and the `unikit-implement` skill requires a git commit **before** any direct edit so the change is trivially revertible.

> **Verbatim install — two things this file must never contain.** Engine templates are written to the project as-is: they bypass double-brace variable substitution, and they bypass the per-agent rewrite that adapts slash-prefixed skill invocations for Codex and Qwen. So (1) no double-brace variables — they would ship to the user as literal text; (2) no slash-prefixed skill invocations — name skills as `` `unikit-<name>` `` instead.
