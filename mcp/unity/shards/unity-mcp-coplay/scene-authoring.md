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
