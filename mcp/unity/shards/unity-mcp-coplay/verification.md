### Gate calibration

A gate marked **GATE LIFTED** is not achievable on the server and must be
skipped with the reason quoted from here. **This server lifts none of them** —
every gate is reachable, though several are indirect and none may be trusted
without a read-back.

| gate | how | status |
|---|---|---|
| compile | `read_console(format="detailed")` after a forced refresh | 🟡 indirect — no dedicated compile tool |
| tests | `run_tests` + `get_test_job` | ✅ working (activate the `testing` group first) |
| console | `read_console(action="clear")` **before** the change | 🟡 no watermark — clearing is the only way |
| validation | `manage_scene action=validate` | 🟡 shallow |
| visual regression | — | ❌ none |

### 🔴 `read_console` returns the OLDEST entries

`ReadConsole.cs` walks from index 0, so the "10 most recent" in the description
is the opposite of what you get. There is no watermark tool. The only reliable
way to attribute output to your own change is to clear first.

### The deterministic sequence — use exactly this

```
read_console(action="clear")

<make the change, passing options={"refresh":"immediate","validate":"standard"}>

refresh_unity(mode="force", scope="all", compile="request", wait_for_ready=true)

read_console(types=["error"], count="all", format="detailed")

run_tests
get_test_job(wait_timeout=60)
```

Skipping the `clear` means reading someone else's errors from earlier in the
session. Skipping the forced `refresh_unity` means reading the console before
the compile finished.

### Two traps in the results you read back

- **Severity is a substring guess.** `InferTypeFromMessage` classifies by
  looking for words in the text and overrides the real `LogEntry.mode` bits. A
  log line mentioning "error" is reported as an error even when Unity logged it
  as info. Read the message, not just the severity.
- **`validate_script` is not a compiler.** Without a manual `USE_ROSLYN` build
  it checks brace balance. Passing it says nothing about whether the code
  compiles — the compile gate above is the real check.
