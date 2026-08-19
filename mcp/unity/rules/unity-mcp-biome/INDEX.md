# Unity Biome MCP

Reference for ordinary use — Context7 `/german-krasnikov/unity-biome-mcp`.
**This file is an amendment to it.** Take signatures from the server, not from
the reference and not from here.

## Access

The set is visible in full — gating is removed by configuration. A tool that is
not in your list does not exist here; it is not hidden.

**The authority is the list your client holds.** A reply that enumerates what a
category contains is not that list; confirm against your own list before you build
a plan around anything you saw enumerated there.

**An empty schema does not mean "no parameters".** Declarations are truncated —
most show a one-line description and an empty parameter list. Request the full
schema before calling an unfamiliar one; arguments the truncated declaration
omits still go through, because validation runs against the full schema server-side.

**Project-relative paths are written from the content root down**, with the root
folder itself as the first segment and forward slashes throughout — `<root>/Sub/File.ext`.
An absolute path, or one that climbs out of the root, is rejected. This is the form to use
whenever a path has to be handed to the server or reserved for a scratch folder.

## Live failure classes

| class | here | what it turns into |
|---|---|---|
| false success | yes | ok on a structurally broken artifact |
| eaten parameter | yes | an argument the call accepted may simply not take effect |
| catalog phantom | yes | declared reachable, no handler behind it |
| lying validator | yes | the built-in layout checker is blind to markup it broke itself |
| fake rollback | yes | a mix of direct and batched calls makes undo unpredictable |
| transport ambiguity | yes | a transport signal does not say whether the world changed |
| opaque aggregate | yes | an aggregate gate goes green after only part of its checks |
| stale read | yes | the counting console mode is silent about overflow |
| destructive default | yes | a scene is created over an unsaved one |

A `yes` means the matching check from `dev-principles` is mandatory. This is a
prior probability, not a guarantee: a class may have been fixed.

## Shape and cost

The load-bearing mechanisms — transaction, console marker, compilation,
references, tests — are directly available; nothing has to be unlocked first.
The structural gate is cheap in summary form and two-hundredfold more expensive
in full, and it runs after every mutation — find the summary mode before you
read the tree. A delta gate exists: do not re-read what did not change.
The batch is capacious — group compatible work freely.
Checking code before writing it is cheaper than a domain reload, and when it
refuses it leaves no file behind — the early refusal costs nothing to undo. That
reload costs a minute or more of full unavailability. The test run accepts an
idempotency key — after a disconnect, repeat with the same one.

## Check

| id | area | confirm that |
|---|---|---|
| ui-1 | ui | uGUI · scroll container: the content is able to exceed the viewport |
| ui-2 | ui | uGUI · clickability is proved by overlap and a raycast receiver, not by a handler firing |
| ui-3 | ui | uGUI · the built-in layout checker is not evidence |
| ui-4 | ui | UI Toolkit · document binding: the settings panel is not empty |
| ui-5 | ui | UI Toolkit · markup file edit: a path inside the content root is accepted |
| ui-6 | ui | UI Toolkit · a style edit made through the element landed; a partial style read is not proof that a rule is absent |
| scene-1 | scene | creating a scene: the unsaved one was saved or explicitly discarded, and the new one landed at the path you named |
| scene-2 | scene | after an ambiguous answer, a repeated create left one object and not two |
| scene-3 | scene | a compressed structural read really came back shorter |
| scene-4 | scene | after a serialized field was renamed, the values survived — the audit answers the same before and after |
| anim-1 | anim | the write landed: a path a read accepts may still be rejected by a write |
| rollback-1 | rollback | before a phase that writes to the asset database, the rollback point outside the editor captured more than zero files |
| rollback-2 | rollback | after a mix of direct and batched calls, what actually rolled back was read back |
| console-1 | console | the read was made outside the counting mode, which is silent about overflow |
| console-2 | console | an empty change journal after a mutation is not evidence that nothing changed — close it with a marker and a delta |
| console-3 | console | a gate that refuses on console state agrees with a direct read of it |
| batch-1 | batch | a batch report that contained an error is not evidence — re-read the state |
| compile-1 | compile | a structural read after a failed build describes the last successful one — close it with the compilation gate |
| compile-2 | compile | the aggregate gate names which of its checks actually ran |
| transport-1 | transport | a timeout is not evidence that the transition did not happen — re-read the state |
| transport-2 | transport | the endpoint you are calling is the live one; it can change between calls within one session |
| visual-1 | visual | the target made it into the frame: the container's render mode decides that |
| visual-2 | visual | comparison against a baseline proves "nothing changed", not "it looks right" |
| visual-3 | visual | the frame came back at the size you asked for |

## Irreversible

Any write that reached the asset database is outside the editor's undo journal —
git is the only rollback. Commit before the phase that writes there.

## Lane

One executor per editor instance. Asynchronous job calls do not hold the lane.

## When this file is silent

Two reasons to ask the reference:
— an unfamiliar area — what approaches the authors propose (once per area per session);
— a dead end — the schema is there, the capability is not.

The reference describes **intent, not behaviour**. What you take from it carries
the same evidence obligations, and with heightened attention: it has been caught
presenting a structurally broken path as an exemplary example.

The reference is **optional** in the installer. When it was not configured, the
second reason above simply has no answer available: descend the degradation ladder
in `dev-principles` and reach `⏸️ MANUAL` only at its own rung — by absence of a
route, established by trying. A reference nobody configured is not a capability
this server lacks.
