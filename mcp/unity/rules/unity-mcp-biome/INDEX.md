# Unity Biome MCP

Reference for ordinary use — Context7 `/german-krasnikov/unity-biome-mcp`.
**This file is an amendment to it.** Take signatures from the server, not from
the reference and not from here.

## Access

The set is visible in full — gating is removed by configuration. A tool that is
not in your list does not exist here; it is not hidden.

**An empty schema does not mean "no parameters".** Declarations are truncated —
most show a one-line description and an empty parameter list. Request the full
schema before calling an unfamiliar one; arguments the truncated declaration
omits still go through, because validation runs against the full schema server-side.

## Live failure classes

| class | here | what it turns into |
|---|---|---|
| false success | yes | ok on a structurally broken artifact |
| eaten parameter | yes | |
| catalog phantom | yes | declared reachable, no handler behind it |
| lying validator | yes | the built-in layout checker is blind to markup it broke itself |
| fake rollback | partly | a mix of direct and batched calls makes undo unpredictable |
| transport ambiguity | yes | a domain reload is a minute and a half of unavailability |
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
Checking code before writing it is cheaper than a domain reload, and that reload
costs a minute and a half. The test run accepts an idempotency key — after a
disconnect, repeat with the same one.

## Check

| id | area | confirm that |
|---|---|---|
| ui-1 | ui | uGUI · scroll container: the content is able to exceed the viewport |
| ui-2 | ui | uGUI · clickability is proved by overlap and a raycast receiver, not by a handler firing |
| ui-3 | ui | uGUI · the built-in layout checker is not evidence |
| ui-4 | ui | UI Toolkit · document binding: the settings panel is not empty |
| ui-5 | ui | UI Toolkit · markup file edit: a path inside the content root is accepted |
| batch-1 | batch | a batch report that contained an error is not evidence — re-read the state |
| console-1 | console | the read was made outside the counting mode, which is silent about overflow |
| rollback-1 | rollback | the snapshot captured more than zero files |
| rollback-2 | rollback | after a mix of direct and batched calls, what actually rolled back was read back |
| visual-1 | visual | the target made it into the frame: the container's render mode decides that |
| visual-2 | visual | comparison against a baseline proves "nothing changed", not "it looks right" |

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
