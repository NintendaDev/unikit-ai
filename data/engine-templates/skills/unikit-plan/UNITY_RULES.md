# Engine Rules: Unity

Engine planning vocabulary for Unity projects. This file tells the `unikit-plan` skill **how to write a plan** for this engine — how the neutral `Editor:` grammar resolves into Unity concepts, which placeholders the plan templates expand to, and when a change belongs in `Editor:` rather than `Files:`.

## §1 Kind → concept

The `Editor:` line is `Editor: [kind] <container> → <target> : <action>`. For Unity, `<container>` and `<target>` resolve as follows:

| Kind | Container | Target | Typical assets |
|------|-----------|--------|----------------|
| `scene` | a `.unity` scene or a `.prefab` | a GameObject by hierarchy path (`/Root/Child`) or a MonoBehaviour on it | `.unity`, `.prefab` |
| `ui` | a uGUI hierarchy inside a `.prefab` / `.unity`, or a UI Toolkit document | a UI element by hierarchy path, or a selector / element in the document | `.prefab`, `.unity`, `.uxml`, `.uss` |
| `vfx` | a ParticleSystem host object, a VFX Graph, a Shader Graph, or a material | the emitter / node / property being tuned | `.vfx`, `.shadergraph`, `.mat` |
| `anim` | an animation clip, an animator controller, or a Timeline asset | a curve, a state / transition, or a track / clip | `.anim`, `.controller`, `.playable` |
| `asset` | a ScriptableObject asset (or the folder it lives in) | the asset itself, or one of its serialized fields | `.asset` |
| `input` | an Input System asset | an action map, an action, or a binding | `.inputactions` |
| `settings` | Project Settings | a layer, a tag, a physics-matrix cell, a render-pipeline setting | `ProjectSettings/*.asset` |

Default kind is `scene` — use it when the change is a plain scene / prefab edit and no more specific kind applies.

**Path convention.** `<container>` is a project-relative asset path (`Assets/...`); `<target>` inside a scene or prefab is a hierarchy path starting at the root object (`/Root/Child`). For `settings`, `<container>` is the Project Settings page name.

## §2 Language & layout

Placeholder values for the plan templates in `references/TASK-FORMAT.md`:

| Placeholder | Unity value |
|-------------|-------------|
| code fence (`<lang>`) | `csharp` |
| source extension (`<ext>`) | `cs` |
| content root (`<content-root>`) | `Assets` |
| DI binding form | `Container.Bind<IExample>().To<Example>().AsSingle();` (Zenject) |

Use these verbatim when writing `Files:` lines, `PLAN-BRIEF.md` code blocks, and the `DI BINDINGS` section. Do not invent alternatives — if a project's stack differs (a different DI container, a different content root), the project's own `.unikit/DESCRIPTION.md` wins over this table.

## §3 When to write `Editor:`

Write an `Editor:` line when the change touches the editor's **serialized state**. Eight concrete signals for Unity — any one of them is enough:

1. A GameObject is added to, removed from, or reparented inside a scene or a prefab.
2. A component is added to or removed from a GameObject.
3. A `[SerializeField]` value is set or retuned in the Inspector (rather than in code).
4. An object, asset, or scene reference is wired in the Inspector.
5. A ScriptableObject asset is created, or its values are filled in.
6. A UI layout is built or restructured — a uGUI hierarchy, or a UI Toolkit `.uxml` / `.uss` document.
7. A material, animation clip, animator state or transition, Timeline track, particle system, VFX Graph or Shader Graph is created or retuned.
8. A layer, tag, physics-matrix cell, input action, or render-pipeline setting is registered in Project Settings.

**Negative rule.** Editing a plain text or config file stays in `Files:` — an `.asmdef`, a `.json`, a `.md`, a `.csproj` is not editor state even though it lives under `Assets/`. Writing or changing C# source is always `Files:`, never `Editor:`, even when that source is a MonoBehaviour that will later be attached in a scene (the attaching is the `Editor:` half).

## §4 Engine planning pitfalls

Five Unity-specific traps that must be resolved **at planning time**, not discovered during implementation:

1. **Renaming a `[SerializeField]` breaks every reference to it** in prefabs and scenes — the value silently resets to default. Either keep the serialized name and add `[FormerlySerializedAs("oldName")]`, or plan a separate, explicit migration task. Never fold a serialized-field rename into an unrelated task.
2. **Scene edit vs prefab edit — name the owner in the plan.** Changing an instance in a scene creates a prefab override that later diverges from the prefab; changing the prefab propagates to every instance. Pick one and write it into `<container>`, otherwise the implementer produces an override nobody expects.
3. **A new module means a new `.asmdef`** — and that is its own task, with its own references list. An assembly definition added as a side effect of a feature task is how compile-order breakage gets introduced.
4. **ScriptableObject work is `Editor:`, not `Files:`.** Writing the SO class is `Files:`; creating the `.asset` and filling its values is an `Editor: [asset] …` line. A plan that lists only the class leaves the data half unbuilt.
5. **Never plan `.meta` files.** Unity generates and maintains them on refresh — a task that creates or edits a `.meta` is always wrong. (Verification is a separate matter: the `unikit-verify` skill still checks `.meta` pairing after the fact, and that check stays.)

## §5 Out of scope

This file does **not** carry code-writing rules. The boundary is exact:

- **The rules registry** (`.unikit/memory/code/unity/{core,stack}`) = **HOW to write code** for this engine — naming, patterns, APIs, anti-patterns.
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
