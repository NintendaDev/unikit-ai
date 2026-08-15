### Bootstrap — activate the tool groups you need

48 tools in 10 groups; over the HTTP transport only **30 of 48** are exposed.
The `testing` group in particular is off, which means `run_tests` and
`get_test_job` are invisible until you activate it:

```
manage_tools(action="activate", group="testing")
```

Visibility depends on the transport, so a tool present in one session can be
absent in another. Activate the group before the first call, and if a tool is
still missing, report it — do not reach for a lookalike.

### 🔴 Fake success — this server reports success on no-ops

Confirmed cases where the response says `success: true` and **nothing
happened**:

| call | what actually happens |
|---|---|
| `manage_asset action="modify"` | full no-op, `success: true` |
| `manage_gameobject action="modify"` | full no-op, `success: true` |
| `batch_execute(parallel=...)` | `parallel` is accepted and ignored |
| `unity_reflect` | `success` even on "Type not found" |
| `manage_ui render_ui` | `success` with an empty PNG |
| `BatchExecute.DetermineCallSucceeded` | returns `true` when the result is `null` |

Consequence: **every** write on this server must be confirmed by reading the
state back. A status code is not evidence here — it is decoration.

### Other things the tool descriptions get wrong

- `read_console` promises "10 most recent" and returns the **oldest** entries.
  See the verification shard for the only sequence that works around it.
- `validate_script` without a manual `USE_ROSLYN` build is a brace-balance
  check, not a compiler. It will pass code that does not compile.
- Severity is inferred from the message substring and overrides the real
  `LogEntry.mode` bits, so a log line containing the word "error" is reported
  as an error regardless of how Unity classified it.

### What this server is genuinely good at

The test machinery — job semantics, filtering on four axes, a fully structured
result — is the best of the four. Structural C# edits carry SHA protection and
atomic writes. ProBuilder, Cinemachine, UI Toolkit and physics (including the
collision matrix) are covered.

Not covered at all: uGUI, Timeline, Shader Graph, the Input System, reverse
dependency search, visual baselines, and any atomic batch.
