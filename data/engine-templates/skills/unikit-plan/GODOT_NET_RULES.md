# Engine Rules: Godot 4 .NET

Engine planning vocabulary for Godot 4 .NET projects. This file tells the `unikit-plan` skill **how to write a plan** for this engine — how the neutral `Editor:` grammar resolves into Godot concepts, which placeholders the plan templates expand to, and when a change belongs in `Editor:` rather than `Files:`.

## §1 Kind → concept

The `Editor:` line is `Editor: [kind] <container> → <target> : <action>`. For Godot .NET, `<container>` and `<target>` resolve as follows:

| Kind | Container | Target | Typical assets | Affordance the editor must offer |
|------|-----------|--------|----------------|----------------------------------|
| `scene` | a `.tscn` scene, including an inherited scene | a node by path from the scene root (`/Main/Child`), or the C# class attached to it — a class deriving from the node type | `.tscn` | rebuild the node tree · attach / detach a script · write an exported property · wire a node path or a resource reference |
| `ui` | a Control subtree inside a `.tscn`, or a Theme resource | a Control node by path, or a theme property / StyleBox | `.tscn`, `.tres` | build a Control layout · set anchors and rectangle · apply a theme override · read the control tree back |
| `vfx` | a particle node, a `.gdshader`, or a ShaderMaterial | the emitter, a shader uniform, or a material parameter | `.gdshader`, `.tres` | retune a named property on a particle node, shader or material · read the tuned value back |
| `anim` | an AnimationPlayer / AnimationTree, or an animation resource | a track, a key, or a state / transition | `.tres`, `.res` | create or edit an animation resource · add a track or a key · add a state or a transition |
| `asset` | a `.tres` / `.res` Resource, including a custom C# Resource marked `[GlobalClass]` — that attribute is what makes the `.tres` typed and creatable from the editor | the resource itself, or one of its exported fields | `.tres`, `.res` | create a resource of a named type · write an exported field · read it back |
| `settings` | Project Settings (physically `project.godot`) | a physics or rendering layer, an autoload, an input action, a feature-tag override | `project.godot` | register an entry on a settings page · read the page back |

Default kind is `scene` — use it when the change is a plain scene edit and no more specific kind applies.

There is **no `input` kind.** Input is not a kind of editor work, it is an area of functionality, and it resolves into the six above: an input action on the project settings page is `settings`; an input resource that is a plain text file is an `asset` (§6 allows a direct edit); a node holding a reference to it is `scene`; the handling code — signal connections, bindings, dispatch — is plain code and stays in `Files:`.

The **Affordance** column is what the plan checks against the live catalog: it names the *capability class* the editor has to offer for that kind, never a tool. A kind whose affordance is unreachable is a planning-time fact, not an implementation-time surprise. On this engine the planner is granted no discovery names at all — a deliberate decision recorded in the project's own configuration documentation, not an omission — so the planner's catalog step is skipped as a matter of course and the implementer resolves this column against the live catalog at execution time. An unanswered discovery is not a limitation; it is the normal state here.

**Path convention.** `<container>` is a `res://` path; `<target>` inside a scene is a node path starting at that scene's root (`/Main/Child`). For `settings`, `<container>` is the Project Settings page name.

## §2 Language & layout

Placeholder values for the plan templates in `references/TASK-FORMAT.md`:

| Placeholder | Godot .NET value |
|-------------|------------------|
| code fence (`<lang>`) | `csharp` |
| source extension (`<ext>`) | `cs` |
| content root (`<content-root>`) | `res://` |
| DI binding form | an autoload — registered on the Autoload settings page, stored in the autoload section of `project.godot` |

C# specifics that shape a plan on this engine: a node script is a `partial` class deriving from its node type; a resource type is exposed to the editor with `[GlobalClass]`; the assembly and its references are declared in the project's `.csproj`. Those two halves are planned differently and the pair is worth stating outright — **editing `.csproj` is `Files:`, registering an autoload on the settings page is `Editor:`**, even though both are "wiring".

Use these verbatim when writing `Files:` lines, `## Technical Context` code blocks, and the `### DI BINDINGS` subsection. Do not invent alternatives — if a project's stack differs (a service locator, a different content root), the project's own `.unikit/DESCRIPTION.md` wins over this table.

## §3 When to write `Editor:`

Write an `Editor:` line when the change touches the editor's **serialized state**. Eight concrete signals for Godot .NET — any one of them is enough:

1. A node is added to, removed from, or reparented inside a scene.
2. A script is attached to a node, or detached from it.
3. An exported property value is set or retuned in the Inspector (rather than in code).
4. A node path or a resource reference is wired in the Inspector.
5. A `.tres` resource is created, or its values are filled in.
6. A Control hierarchy is built or restructured, or a theme override is applied.
7. A material, shader, particle system, or animation resource is created or retuned.
8. A physics or rendering layer, an autoload, or an input action is registered on a Project Settings page.

**Negative rule.** C# is source, so writing or changing a `.cs` file is always `Files:`, never `Editor:` — **whatever route ends up writing the file**. Choosing the write route belongs to the implementer, not to the planner, and it does not turn a source file into an editor target. The only criterion is the one in the neutral principles: the boundary is serialized editor state. Editing a plain text or config file likewise stays in `Files:` — a `.cs`, a `.csproj`, a `.json`, a `.md`, a `.cfg` is not editor state even though it lives under `res://`. Writing a class that will later be attached to a node is `Files:` (the attaching is the `Editor:` half).

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
| `project.godot` | 🟢 acceptable | a plain text config file; editing it directly is safe |
| `.csproj` | 🟢 acceptable | ordinary XML — but it is `Files:`, not an editor target |
| `.tres` / `.res` in text form | 🟢 acceptable | a stable text format |
| `.tscn` | 🟡 editor may not reload | the format is text and tolerates even adding nodes, but a file written behind the editor's back may not be re-read by it — diagnostics and validation then describe the previous state (a stale read; the detector is in `.unikit/system/dev-principles.md`). Prefer the route through the editor; `direct` is defensible when no other route exists |
| `.gdshader` | 🟢 acceptable | plain text — but editing a shader as a file is `Files:`; the `Editor:` half is wiring the material |
| `.import` | 🟡 regenerated | produced by the importer; a hand edit lives until the next reimport |
| binary `.res` / `.scn` | 🔴 not acceptable | not editable as text |

The `unikit-plan` skill offers `direct` only for 🟢 / 🟡 formats, and the `unikit-implement` skill requires a git commit **before** any direct edit so the change is trivially revertible.

> **Verbatim install — two things this file must never contain.** Engine templates are written to the project as-is: they bypass double-brace variable substitution, and they bypass the per-agent rewrite that adapts slash-prefixed skill invocations for Codex and Qwen. So (1) no double-brace variables — they would ship to the user as literal text; (2) no slash-prefixed skill invocations — name skills as `` `unikit-<name>` `` instead.
