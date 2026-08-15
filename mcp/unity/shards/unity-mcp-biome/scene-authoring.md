### Editor work kind → tool family

| kind | tools | category |
|---|---|---|
| `scene` | `get_hierarchy` · `inspect` · `search_scene` · `scene` · `create_object` · `delete_object` · `set_parent` · `set_active` · `set_property` · `manage_component` | CORE/TIER1 |
| | `find_objects` · `get_object_detail` · `set_properties` · `object_diff` · `scene_diff` · `rename_object` · `set_material` | SCENE (Tier2) |
| `ui` | `create_ui` · `set_rect` · `validate_layout` · `ui_intent` | MEDIA (Tier2) |
| `vfx` | `particle` · `vfx_intent` · `material` · `shader` | MEDIA / ASSETS (Tier2) |
| `anim` | `animation` · `animator` · `timeline` | MEDIA (Tier2) |
| `asset` | `prefab` · `asset` · `scriptable_object` · `material` · `shader` · `project_settings` | ASSETS (Tier2) |
| `input` | `wire_event` · `unwire_event` · `auto_wire` · `get_unity_events` | COMPONENTS / SCENE (Tier2) |
| `settings` | `project_settings` · `editor` · `menu` | ASSETS / SYSTEM |

Unlock the Tier2 category with `discover_tools` before the first call.

### Prefer the transaction

For any scene edit worth naming, go through the transaction rather than firing
individual writes:

```
scene_change_plan   → pre-gate: compile + console + target resolution
apply_scene_change  → post-verify: references + console, then save
```

This is the only path that gates *before* touching the scene and verifies
*after*, and it is why biome is the strongest of the four servers.

### Batching

`batch` executes 2+ compatible operations; pass `atomic=true` so a failure part
way through unwinds.

Two hard limits:

- **`direct_only` tools cannot go in a batch.** Confirmed members:
  `set_properties`, `setup_objects`, `configure_objects`, `ui_intent`,
  `vfx_intent`, `screenshot_compare`, `run_tests_wait` (~25 more exist). Call
  them directly.
- **No references between commands.** A batch is a list, not a script — command
  N cannot use the object command N-1 created. Split at that boundary.

### Rollback

`atomic=true` only unwinds what Unity's own Undo recorded. Anything outside
Undo (asset writes, imports) stays. To roll back a whole phase use
`checkpoint` — that is what it exists for.
