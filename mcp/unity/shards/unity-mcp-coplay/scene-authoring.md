### Editor work kind → tool family

48 tools in 10 groups. Only `core` is active by default — activate the group
before the first call, or the tool is invisible:

```
manage_tools(action="activate", group="testing"|"ui"|"vfx"|"animation"|"scripting_ext"|…)
```

| kind | tools | group |
|---|---|---|
| `scene` | `manage_scene` · `manage_gameobject` · `manage_components` · `find_gameobjects` · `manage_prefabs` | core |
| `ui` | `manage_ui` (UI Toolkit only) · `manage_components` (uGUI — see below) | ui / core |
| `vfx` | `manage_vfx` · `manage_material` · `manage_texture` · `manage_shader` · `manage_graphics` | vfx / core |
| `anim` | `manage_animation` | animation |
| `asset` | `manage_asset` · `manage_prefabs` · `manage_scriptable_object` · `manage_material` · `manage_texture` | core / scripting_ext |
| `input` | — | — |
| `settings` | `manage_editor` (tags, layers) · `manage_physics` (collision matrix, physics materials) · `manage_graphics` (RP, lighting) · `manage_build` (player settings) | core |

`manage_components` is the path to anything without a dedicated tool, **uGUI
included** — there is no uGUI-specific tool on this server. It resolves
references by name, instanceID, GUID and asset path, but has no converters for
`LayerMask`, `AnimationCurve` or `Gradient`; set those a different way.

**Kinds this server does not cover — degrade to `manual` and say so:**

- **`input`** — the Input System is not covered at all. There is no tool.
- **`anim` beyond AnimatorController and clip curves** — Timeline is not covered.
- **`vfx` via Shader Graph** — `manage_shader` is CRUD over a shader *file*;
  Shader Graph is not supported.

Do not reach for a lookalike in these cases. Report the gap.

### `batch_execute` is not a transaction

The product page says the batch is atomic. `BatchExecute.cs` has no rollback at
all. If operation 7 of 10 fails, operations 1-6 stay applied.

Further caveats:

- It **bypasses the Python-side normalisation**, so parameters are coerced
  differently than on a direct call. The same arguments can behave differently
  inside a batch than outside it.
- `parallel=...` is accepted and silently ignored.
- Caps: 25 operations per batch, 100 total.
- A `null` result counts as success (`DetermineCallSucceeded`).

Use it only for genuinely independent operations whose results you will read
back anyway. When order or all-or-nothing matters, call the tools directly.

### Rollback

There is no scoped rollback. The only undo is a single global Ctrl+Z in the
Editor, which the agent cannot target. Treat every write as irreversible within
the session: read back, and rely on git for the source side.

### Known no-op

`manage_scene get_hierarchy max_depth` is a no-op — the depth limit is ignored
and the full hierarchy comes back. Do not plan around it for large scenes.

### Consequence for planning

Because `manage_asset action="modify"` and `manage_gameobject action="modify"`
report success on a full no-op, **any** edit routed through them must be
followed by a read of the modified object. If the read-back shows the old
value, the edit did not happen — retry with a different action or report the
gap. Do not treat the success response as confirmation.
