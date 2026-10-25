# Coding-Solo Godot MCP

Reference for ordinary use — Context7 `/coding-solo/godot-mcp`.
**This file is an amendment to it.** Take signatures from the server, not from
the reference and not from here.

## Access

The tool catalog matches the vendor's own published list exactly — the first
Godot server measured with zero discrepancy in either direction. No approval
or permission gate exists on the server side; a client-side auto-approve
setting mentioned in the vendor's own docs configures the calling client, not
this server, and does not apply to this integration.

## Live failure classes

- `transport ambiguity` — the success/failure signal on most calls is derived
  from unrelated engine-startup noise inside an aggregated log, not from the
  operation's actual outcome. It can call a fully-applied mutation a failure,
  and — for a call that only reads and reports — the same defect can also mean
  the useful answer itself never reaches you, indistinguishable from an empty
  one.
- `eaten parameter` — a non-scalar property value (a 2D position, a color)
  silently fails to apply, or applies with the wrong value, while a scalar
  value passed the same way applies correctly.
- `eaten parameter` — a node name that collides with an existing sibling is not
  rejected and gets no readable increment; the node is silently renamed into
  the engine's own internal anonymous form, with nothing in the response
  naming what happened.

## Shape and cost

There is no reading of scene content through this server, in any form or any
amount — not partial, not with a caveat. The structural gate is not expensive
here: it does not exist through this server at all.

## Check

| id | area | confirm that |
|---|---|---|
| scene-1 | scene | a non-scalar property value you set (a position, a color — anything beyond a bare number, string, or boolean) actually landed in the saved file with the value you asked for — by reading the file independently, not by the call's own response text |
| scene-2 | scene | a newly added node kept exactly the name you asked for — a collision with an existing sibling silently renames the node, with no rejection and no readable increment |
| transport-1 | transport | an "error" reported by this server actually means the operation did not apply — re-read the target independently before retrying anything; the response text here does not track the real outcome |

## Irreversible

No rollback exists in any form — no step-undo, no snapshot, no transaction.
Version control is the only rollback available.

## Lane

Most operations run as independent one-shot processes with no live state
shared between them. A separate small subset shares a live session with
itself only. A concurrently open interactive editor on the same project is an
architecturally possible file race that this integration has not measured
directly.

## When this file is silent

This file records where this server's reports diverge from its actual state —
it is not a catalogue of what the server can or cannot do. Neither the total
absence of scene-content reading nor of any screen capture is a row here — an
absent affordance is established by trying, not declared in advance.
