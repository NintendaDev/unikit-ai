### Gate calibration

A gate marked **GATE LIFTED** below is not achievable on this server. Skip it
and quote the reason given here — do **not** report it as "MCP unavailable"
(the MCP is available; the capability is not), and do not substitute a
different tool for it.

| gate | how | status |
|---|---|---|
| compile | `script_diagnostics` | 🟢 works |
| tests | — | ❌ lifted |
| console | `runtime_session` | 🟡 partial — only Fennara's own runs |
| validation | `validate_scene` | 🟢 works |
| visual regression | — | ❌ lifted |

**GATE LIFTED — tests:** this server has no test tooling at all. Not a broken
one, not a partial one — the capability does not exist. Skip the test gate and
say so plainly; do not fabricate a substitute out of `runtime_session`.

**GATE LIFTED — visual regression:** `screenshot_scene` renders a scene, but
there is no baseline store and no comparison — nothing keeps a previous image
or diffs two of them. A one-shot render is not a regression check. Skip the
gate; do not improvise a comparison by eye out of `screenshot_scene`.

### The gates that do work, and their limits

- **compile** — `script_diagnostics` goes through Godot's built-in LSP on
  `127.0.0.1:6005` and returns `file:line:severity`. This is a real check and
  cheap for GDScript. On a `godot-net` project, C# diagnostics require
  `scan_project:true`, which is a full `dotnet build` — seconds per call, so
  batch the C# edits and diagnose once.

  Its accuracy depends on the editor having rescanned. If `.gd` files were
  written directly on disk instead of through `write_or_update_file`, the
  editor still holds the old content and this gate reports on stale code. When
  a diagnostic result contradicts the file you just wrote, suspect the rescan
  before suspecting the diagnostic.

- **console** — `runtime_session` captures full stdout+stderr with a real
  cursor (`RuntimeLogCursor {byte_offset, line}`), which makes it a genuine
  watermark: output can be attributed to a specific run rather than guessed at.

  Its limit is scope. It covers **only runs Fennara itself launched**. The
  editor's own Output panel is not readable — `scrape_editor` is a heuristic
  scrape of the UI tree and its `captured_messages` is hard-coded empty. If an
  error only appears in the editor's Output panel, this gate will not see it;
  say the console coverage is partial rather than reporting a clean console.

- **validation** — `validate_scene` opens scenes headless, up to 10 scenes at
  roughly 3s each. Budget for that: validating a large set is not free, so
  scope it to the scenes actually touched.

### Fake success

None found on this server. A reported failure is a real failure and a reported
success is, as far as the audit went, real.

That is not a licence to skip read-back. The shared rule still stands — confirm
by reading state, not by reading a status code — because the risk here is not a
lying tool but a **stale editor**: a call can succeed against content the
editor has not rescanned.
