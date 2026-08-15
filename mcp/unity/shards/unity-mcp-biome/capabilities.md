### Bootstrap — unlock the tools you need

Only **38 of 163** tools are visible when the session starts (13 CORE + 25 TIER1).
Everything else is hidden behind a category unlock:

```
discover_tools(category="SCENE" | "COMPONENTS" | "ASSETS" | "MEDIA" | "VERIFY" | "RUNTIME" | "TESTS" | "SYSTEM")
```

Call it once per category you are about to use, before the first tool of that
category. A tool that "does not exist" is far more often a locked Tier2 tool
than a wrong name — check the category first, then report.

### Categories

| category | what lives there |
|---|---|
| `SCENE` | object search / detail / diffing, batch property writes, renames, materials |
| `COMPONENTS` | UnityEvent wiring (`wire_event`, `auto_wire`), reference lookups |
| `ASSETS` | prefabs, ScriptableObjects, materials, shaders, project settings |
| `MEDIA` | uGUI authoring, RectTransform, layout validation, particles, animation, Animator, Timeline, screenshot baselines |
| `VERIFY` | `scan_scene`, `scene_health`, `diagnose`, `serialized_field_rename_audit` |
| `RUNTIME` | play-mode inspection — **not enabled for this pipeline** |
| `TESTS` | test run / results / count lookups |
| `SYSTEM` | `checkpoint`, `get_schema`, `menu` |

### Known gap

`compile_preflight` needs Roslyn, whose phase is not shipped yet. It can answer
`Command not registered` — that is the tool being absent, not the code being
broken. Fall back to `get_compile_errors` + `await_compile`.

### Strengths worth reaching for

- `verify_after_change` runs five gates in one call.
- `console_mark` + `get_console_since` is a **real** watermark — the only
  reliable way to attribute console output to your own change.
- `scene_change_plan` → `apply_scene_change` is a genuine transaction.
- `checkpoint` rolls back a whole phase, not just the last Undo entry.
