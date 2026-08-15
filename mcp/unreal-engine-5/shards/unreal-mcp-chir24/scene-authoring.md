### Editor work kind → parent tool

Every call still goes through the single `unreal` tool; the table names the
*parent* to search within and the category that must be loaded first.
⚠️ marks a parent outside `core`, i.e. one that needs `enable_category`.

| kind | parent(s) | category |
|---|---|---|
| `scene` | `control_actor` · `manage_level` · `inspect` | core |
| | `manage_level_structure` | world ⚠️ |
| `ui` | `manage_blueprint` (widget actions) | core |
| `vfx` | `manage_asset` (`material.*` / `texture.*`) | core |
| | `manage_effect` (Niagara) | gameplay ⚠️ |
| `anim` | `animation_physics` · `manage_sequence` | gameplay / utility ⚠️ |
| `asset` | `manage_asset` · `manage_blueprint` | core |
| `input` | `manage_networking` | utility ⚠️ |
| `settings` | `system_control` · `control_editor` | core |
| | `build_environment` | world ⚠️ |

Find the exact action with `{"operation":"search","query":...}` and confirm its
parameters with `describe`. Do not guess.

### No batching

One operation per call. There is no batch mechanism on this server.

### Plan / preview does not work

`preview` is **refused for all 1381 actions** (`UNSUPPORTED_PREVIEW`) — the
server does not even consult the declared preview flag. There is no dry-run
here. Plan on paper, then execute.

### Persistence is inconsistent

Some edits only dirty the package and are lost unless you explicitly commit
them:

- UMG (widget) edits → `blueprint.compile`
- Niagara and material graphs → `compile_material` / `blueprint.compile`
- Level changes → `manage_level.save`

Make the explicit compile/save call part of every edit, not an afterthought.

### 🔴 Fake success — these report success and change nothing

`bind_text` · `bind_visibility` · `bind_color` · `bind_enabled` ·
`create_property_binding` · `set_widget_binding` · `add_animation_keyframe` ·
`set_animation_loop` · `preview_widget` · `apply_style_to_widget` ·
`disable_input_action` · `set_axis_settings` · `set_interpolation_settings` ·
`asset.validate`

Silently drop a parameter (the call succeeds, the parameter is ignored):

- `create_animation_blueprint.parentClass`
- `add_layered_blend_per_bone.boneName`
- `set_transition_rules` — the condition graph is not created
- Niagara module values
- `add_animation_track.propertyName`

Read the result back after any of these. If the read-back does not show the
change, report it — do not retry the same call expecting a different answer.

### Rollback — git only

`control_editor.undo` reports success unconditionally, whether or not anything
was undone. The only real rollback on this server is a git commit before the
change. Commit first.
