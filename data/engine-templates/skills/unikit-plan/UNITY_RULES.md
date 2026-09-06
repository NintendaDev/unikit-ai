# Engine Rules: Unity

Engine planning vocabulary for Unity projects. This file tells the `unikit-plan` skill **how to write a plan** for this engine — how the neutral `Editor:` grammar resolves into Unity concepts, which placeholders the plan templates expand to, and when a change belongs in `Editor:` rather than `Files:`.

## §1 Kind → concept

The `Editor:` line is `Editor: [kind] <container> → <target> : <action>`. For Unity, `<container>` and `<target>` resolve as follows:

| Kind | Container | Target | Typical assets | Affordance the editor must offer |
|------|-----------|--------|----------------|----------------------------------|
| `scene` | a `.unity` scene or a `.prefab` | a GameObject by hierarchy path (`/Root/Child`) or a MonoBehaviour on it | `.unity`, `.prefab` | mutate the object graph · attach / detach components · write a serialized field · wire an object reference |
| `ui` | a uGUI hierarchy inside a `.prefab` / `.unity`, or a UI Toolkit document | a UI element by hierarchy path, or a selector / element in the document | `.prefab`, `.unity`, `.uxml`, `.uss` | build a layout · set a rectangle · bind a handler · read the element tree back |
| `vfx` | a ParticleSystem host object, a VFX Graph, a Shader Graph, or a material | the emitter / node / property being tuned | `.vfx`, `.shadergraph`, `.mat` | retune a named property on a graph or material · read the tuned value back |
| `anim` | an animation clip, an animator controller, or a Timeline asset | a curve, a state / transition, or a track / clip | `.anim`, `.controller`, `.playable` | create or edit a clip · add a state or transition · place a track or clip |
| `asset` | a ScriptableObject asset, an Input System asset, or the folder either lives in | the asset itself, or one of its serialized fields | `.asset`, `.inputactions` | create an asset of a named type · write a serialized field · read it back |
| `settings` | Project Settings | a layer, a tag, a physics-matrix cell, an input axis, a render-pipeline setting | `ProjectSettings/*.asset` | register an entry on a settings page · read the page back |

Default kind is `scene` — use it when the change is a plain scene / prefab edit and no more specific kind applies.

There is **no `input` kind.** Input is not a kind of editor work, it is an area of functionality, and it resolves into the six above: an Input System asset is an `asset` (a text file, so §6 allows a direct edit); a legacy input axis is `settings`; a component holding a reference to an input asset is `scene`; the handling code — bindings, subscriptions, MVVM plumbing — is plain code and stays in `Files:`.

The **Affordance** column is what the plan checks against the live catalog: it names the *capability class* the editor has to offer for that kind, never a tool. A kind whose affordance is unreachable is a planning-time fact, not an implementation-time surprise.

**Path convention.** `<container>` is a project-relative asset path (`Assets/...`); `<target>` inside a scene or prefab is a hierarchy path starting at the root object (`/Root/Child`). For `settings`, `<container>` is the Project Settings page name.

## §2 Language & layout

Placeholder values for the plan templates in `references/TASK-FORMAT.md`:

| Placeholder | Unity value |
|-------------|-------------|
| code fence (`<lang>`) | `csharp` |
| source extension (`<ext>`) | `cs` |
| content root (`<content-root>`) | `Assets` |
| DI binding form | `Container.Bind<IExample>().To<Example>().AsSingle();` (Zenject) |

Use these verbatim when writing `Files:` lines, `## Technical Context` code blocks, and the `### DI BINDINGS` subsection. Do not invent alternatives — if a project's stack differs (a different DI container, a different content root), the project's own `.unikit/DESCRIPTION.md` wins over this table.

## §3 When to write `Editor:`

Write an `Editor:` line when the change touches the editor's **serialized state**. Eight concrete signals for Unity — any one of them is enough:

1. A GameObject is added to, removed from, or reparented inside a scene or a prefab.
2. A component is added to or removed from a GameObject.
3. A `[SerializeField]` value is set or retuned in the Inspector (rather than in code).
4. An object, asset, or scene reference is wired in the Inspector.
5. A ScriptableObject asset is created, or its values are filled in.
6. A UI layout is built or restructured — a uGUI hierarchy, or a UI Toolkit `.uxml` / `.uss` document.
7. A material, animation clip, animator state or transition, Timeline track, particle system, VFX Graph or Shader Graph is created or retuned.
8. A layer, tag, physics-matrix cell, input axis, or render-pipeline setting is registered in Project Settings (`settings`), or an Input System action map, action or binding is authored in an `.inputactions` asset (`asset`).

**Negative rule.** Editing a plain text or config file stays in `Files:` — an `.asmdef`, a `.json`, a `.md`, a `.csproj` is not editor state even though it lives under `Assets/`. Writing or changing C# source is always `Files:`, never `Editor:`, even when that source is a MonoBehaviour that will later be attached in a scene (the attaching is the `Editor:` half).

## §4 Engine planning pitfalls

Seven Unity-specific traps that must be resolved **at planning time**, not discovered during implementation:

1. **Renaming a `[SerializeField]` breaks every reference to it** in prefabs and scenes — the value silently resets to default. Either keep the serialized name and add `[FormerlySerializedAs("oldName")]`, or plan a separate, explicit migration task. Never fold a serialized-field rename into an unrelated task.
2. **Scene edit vs prefab edit — name the owner in the plan.** Changing an instance in a scene creates a prefab override that later diverges from the prefab; changing the prefab propagates to every instance. Pick one and write it into `<container>`, otherwise the implementer produces an override nobody expects.
3. **A new module means a new `.asmdef`** — and that is its own task, with its own references list. An assembly definition added as a side effect of a feature task is how compile-order breakage gets introduced.
4. **ScriptableObject work is `Editor:`, not `Files:`.** Writing the SO class is `Files:`; creating the `.asset` and filling its values is an `Editor: [asset] …` line. A plan that lists only the class leaves the data half unbuilt.
5. **Never plan `.meta` files.** Unity generates and maintains them on refresh — a task that creates or edits a `.meta` is always wrong. (Verification is a separate matter: the `unikit-verify` skill still checks `.meta` pairing after the fact, and that check stays.)
6. **The input-infrastructure object gets its own `Editor:` target.** The scene-level object that dispatches pointer input, and the raycaster on the canvas that feeds it, are implied by no other target — a plan that adds the first UI to a scene names them explicitly. Leave them implicit and the layout builds, the references are written, and no structural check notices that nothing can be pressed.
7. **The owner of a UI element's geometry is named in `<target>`.** When the element sits inside an auto-layout container, that container writes the element's rectangle — target the element alone and the implementer produces an edit another owner overwrites. Name the owning node in `<target>` and describe the edit to the element inside it. This is §4.2's reasoning applied to a different field: the owner in §4.2 is an asset and fits `<container>`, an auto-layout node is a hierarchy node and does not.

**The cut this section is held to.** Two mechanical tests decide whether a rule belongs here at all, and it must pass both. *Would it still be true after the engine MCP server is replaced?* Survives the swap → it is a property of the engine and belongs in this file. Dies when a server or its plugin is updated → it is an exception of that server, and its only home is that server's `INDEX.md` in `.unikit/system/engine-mcp/`. *Does it change the shape of the plan?* A rule here says what the plan must contain — a separate task, a named owner, its own target; the engine fact that makes it necessary is a subordinate clause and never the point. A fact that only describes how the engine works passes the first test and fails this one: the reference already documents it, nothing here would notice when it went stale with an engine version, and this file is not a Unity textbook. All seven rules above pass both: each shapes a plan, each is grounded in Unity's own serialization, prefab, layout or assembly model, and none of them mentions a server. An eighth may join them only after the same two tests, and a rule that describes what some server can or cannot do fails the first by construction — this file never names a tool.

## §5 Out of scope

This file does **not** carry code-writing rules. The boundary is exact:

- **The rules registry** (`.unikit/memory/code/{core,stack}`) = **HOW to write code** for this engine — naming, patterns, APIs, anti-patterns.
- **This file** = **HOW to write a PLAN** for this engine — vocabulary, placeholders, what belongs in `Editor:`, planning-time traps.

If a rule tells the implementer what the code should look like, it belongs in the registry, not here. Do not duplicate registry content into this file — a second source diverges from the first on its next edit.

## §6 Direct-edit feasibility

Whether the `direct` value of `Editor tasks` (a plain text edit of the serialized file, no editor and no MCP) is defensible for a given format:

| Format | Feasibility | Bounds |
|--------|-------------|--------|
| `.asset` (ScriptableObject) | 🟢 acceptable | YAML with a stable shape; scalar values are safe to set directly |
| `.meta` | 🟢 acceptable | small, stable, generated shape — but see §4.5: `.meta` is never *planned* |
| `.unity` (scene) | 🟡 scalar values only | retuning an existing serialized scalar is defensible; creating objects or wiring references by hand is not — the fileID/GUID bookkeeping is unreliable |
| `.prefab` | 🟡 scalar values only | same bound as `.unity`, plus prefab-override blocks that are easy to corrupt |
| `.inputactions`, `.uxml`, `.uss` | 🟡 scalar values only | plain text, but schema-sensitive; small edits only |
| `.anim`, `.controller`, `.playable`, `.vfx`, `.shadergraph` | 🔴 not acceptable | dense generated graphs — hand edits are not reviewable |

The `unikit-plan` skill offers `direct` only for 🟢 / 🟡 formats, and the `unikit-implement` skill requires a git commit **before** any direct edit so the change is trivially revertible.

> **Verbatim install — two things this file must never contain.** Engine templates are written to the project as-is: they bypass double-brace variable substitution, and they bypass the per-agent rewrite that adapts slash-prefixed skill invocations for Codex and Qwen. So (1) no double-brace variables — they would ship to the user as literal text; (2) no slash-prefixed skill invocations — name skills as `` `unikit-<name>` `` instead.
