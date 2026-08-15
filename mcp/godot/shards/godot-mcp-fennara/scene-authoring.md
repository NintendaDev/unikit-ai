### Editor work kind → tool

| kind | tool |
|---|---|
| `scene` | `run_scene_edit_script(scene_path, code=<GDScript>)` |
| `ui` | `run_scene_edit_script` |
| `vfx` | `run_scene_edit_script` |
| `anim` | `run_scene_edit_script` |
| `asset` | `run_asset_import_script` (import settings) · `run_scene_edit_script` (everything else) |
| `input` | `project_settings` |
| `settings` | `project_settings` |

There is no per-kind tool family to learn. The column collapses on purpose:
every scene-shaped edit is a GDScript worker, and the interesting decision is
what the script says, not which tool to call.

**One scene per call.** `run_scene_edit_script` targets a single `scene_path`.
Touching three scenes is three calls, not one script that opens them all.

### Read the API before writing the script

Call `get_class_info` for every class the script will touch, before writing the
body. It returns documentation from the branch of the editor that is actually
attached, so it reflects this project's Godot version rather than whichever
version the model happened to learn. Skipping it is the single most common way
to produce a script that fails on a renamed method.

### 🔴 Doctrine override — write `.gd` files through the MCP

The development principles say source files are edited directly with
Read/Edit/Write. **On this server that rule is overridden for `.gd` files:**
use `write_or_update_file`.

`write_or_update_file` is the only trigger of `notify_editor_filesystem()`. A
`.gd` file written directly on disk leaves the editor without a rescan, so the
script it holds in memory is the old one — `script_diagnostics` will then
report on stale content and quietly lie to you. The direct-write path is not
merely slower here, it makes verification wrong.

Scene, resource and other engine-owned files were already MCP-side; this
override adds `.gd` to that list. Non-engine files (`.md`, `.json`, CI config)
stay on Read/Edit/Write as usual.

### Batching

The unit of batching is the **worker script**: N operations inside one
GDScript body, executed in one call. That is genuinely atomic in the sense
that matters — the script either runs to its end or stops at the failing line.

Keep reusable worker templates in `res://.fennara/scripts/` rather than
re-deriving them per task.

### Plan → apply

There is no built-in preview tool. Synthesize the two-step yourself:

```
run_scene_edit_script(mode=inspect)   → report what is there and what will change
                                      → show it
run_scene_edit_script(mode=edit)      → apply
```

For anything structural — deleting nodes, reparenting, rewriting a subtree —
run the inspect pass first. It costs one call and it is the only preview
available.

### Rollback

Rollback is **implicit and time-bounded**: until `ResourceSaver::save()` runs,
the change lives only in the editor's in-memory scene and closing without
saving discards it. After the save there is no undo through this server.

So: keep an inspect-pass record of the prior state for anything you cannot
trivially reconstruct, and commit to git before a structural edit.
