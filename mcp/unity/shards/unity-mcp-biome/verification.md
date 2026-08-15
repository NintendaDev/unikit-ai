### Gate calibration

A gate marked **GATE LIFTED** is not achievable on the server and must be
skipped with the reason quoted from here. **This server lifts none of them** —
all five are real, the only one of the four where that is true. Do not relax
any of them.

| gate | tools | status |
|---|---|---|
| compile | `get_compile_errors`, `await_compile` | ✅ working |
| tests | `run_tests_wait` | ✅ working |
| console | `console_mark` → change → `get_console_since` | ✅ working — a real watermark |
| validation | `validate_references` · `scan_scene` · `serialized_field_rename_audit` | ✅ working |
| visual regression | `screenshot_baseline` / `screenshot_compare` | ✅ working |

### Sequence

```
console_mark                     # watermark before the change
<make the change>
await_compile                    # wait for the domain reload to settle
get_compile_errors               # compile gate
get_console_since                # only YOUR output, not the whole log
validate_references              # broken refs introduced by the change
run_tests_wait                   # test gate
```

`verify_after_change` collapses the five gates into one call — use it when you
want the whole set and the individual results are not needed separately.

### Extra checks worth running

- `scan_scene` / `scene_health` after any structural scene edit.
- `serialized_field_rename_audit` after renaming a serialized field — this
  catches the silent data loss Unity will not warn you about.
- `screenshot_baseline` before / `screenshot_compare` after, when the change is
  visual. Comparison is local; the LLM budget is only spent on a real diff.

### No fake-success

No silent no-ops were found on this server. A `success` response can be trusted
more here than anywhere else — but the general read-back rule still applies,
because the *semantics* of a change (did the right object move?) are never
carried by a status code.
