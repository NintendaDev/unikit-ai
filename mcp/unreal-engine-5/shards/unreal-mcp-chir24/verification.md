### Gate calibration

A gate marked **GATE LIFTED** below is not achievable on this server. Skip it
and quote the reason given here — do **not** report it as "MCP unavailable"
(the MCP is available; the capability is not), and do not substitute a
different tool for it.

| gate | how | status |
|---|---|---|
| compile | `run_ubt` | 🟡 partial — output truncated at 20 KB |
| tests | — | ❌ lifted |
| console | `engineErrors[]` | 🟡 partial — max 3 messages per request |
| validation | — | ❌ lifted (fake) |
| visual regression | — | ❌ lifted |

**GATE LIFTED — tests:** `run_tests` is `GEngine->Exec("automation RunTests")`
followed by "Check Output Log". It starts the run and returns nothing. There is
no way to read a pass/fail result back, so a test gate here would be a gate
that can never be satisfied. Skip it and say the server cannot report test
results.

**GATE LIFTED — validation:** `asset.validate` hard-codes `bIsValid = true`.
It is not a check, it is a constant. Skip it rather than reporting a pass it
did not earn.

**GATE LIFTED — visual regression:** there is no baseline capture and no image
comparison anywhere in the tool surface, and `preview` is refused for all 1381
actions, so there is not even a dry-run to render. Skip the gate and say the
server cannot produce a visual baseline.

### The gates that do work, and their limits

- **compile** — `run_ubt`. On the native transport it always degrades to
  fire-and-forget, and the returned text is truncated at 20 KB. A clean result
  is weak evidence; a reported error is strong evidence.
- **console** — there is no log stream. Push notifications
  (`notifications/unreal/automation_event`) are discarded by MCP clients. The
  only readable channel is `engineErrors[]`, capped at **3 messages per
  request**. Poll it more than once if you expect several errors, and state in
  the report that the console coverage is partial.

### 🔴 Fake success — do not trust a status code here

Reports success while changing nothing: `bind_text` · `bind_visibility` ·
`bind_color` · `bind_enabled` · `create_property_binding` ·
`set_widget_binding` · `add_animation_keyframe` · `set_animation_loop` ·
`preview_widget` · `apply_style_to_widget` · `disable_input_action` ·
`set_axis_settings` · `set_interpolation_settings` · `asset.validate`.

Silently drops a parameter: `create_animation_blueprint.parentClass` ·
`add_layered_blend_per_bone.boneName` · `set_transition_rules` (the condition
graph is never created) · Niagara module values ·
`add_animation_track.propertyName`.

Verification on this server is therefore **read-back plus git diff**, not gate
results. Say so plainly in the report rather than implying a coverage the
server cannot deliver.
