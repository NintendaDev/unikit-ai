# GDAI Godot MCP

Reference for ordinary use — Context7 `/3ddelano/gdai-mcp-plugin-godot`.
**This file is an amendment to it.** Take signatures from the server, not from
the reference and not from here.

## Access

The tool catalog is complete and matches what is actually callable — the one known discrepancy runs the other way: the vendor's own published tool list undercounts the live catalog, it does not oversell it, and that does not weaken trust in the protocol catalog itself. No approval or permission gate exists in any form for this server — do not look for an unlock step, there is nothing to rely on and nothing to guard against on this side; the whole boundary is the host OS and the process's own permissions.

## Live failure classes

- `false success` — a mutating call reports success before the write has reached disk; the delay is on the order of one further call, not instant, and nothing in any response marks it.
- `lying validator` — the error report reads clean before the scene has actually run once this session, while a real static script error and broken autoloads sit unreported underneath it.
- `opaque aggregate` — a paginated structural read can show zero of a list, with no truncation marker, when the page cursor is applied one level closer to the root than the list you meant.

## Shape and cost

A count-limited structural read is explicit and honest about what it cut. A depth-limited read is honest too — a node past the depth boundary still reports the true size of what it is hiding, it does not pretend to be childless. A page cursor applies uniformly to every list of children in one call, not to one address within it — for a deeply nested list, narrow the starting point first; a cursor applied from the root of an unrelated ancestor can show an empty page with nothing marking it as cut off.

## Check

| id | area | confirm that |
|---|---|---|
| scene-1 | scene | a signal handler wired without persisting the connection survived the scene save — the connection is visible only by reading the file directly, no read affordance prints it back |
| scene-2 | scene | the mutation a task ends on actually reached disk — by an independent file read, not by the call's own success response, especially when no further call in this session is planned |
| scene-3 | scene | the scene open before a mutating call is the one you were working on, not one that became active through a concurrent participant (a person or another agent) — node operations carry no explicit scene target |
| compile-1 | compile | a clean error report is backed by at least one real scene run this session — before the first run it stays silent about both a static script error and a broken autoload |
| scene-4 | scene | a structural read's declared truncation matches what actually happened — a shown count short of the declared total with no truncation marker means you are reading the wrong list, not that the list is short |
| visual-1 | visual | a running-scene screenshot actually arrived — right after entering play mode the request may time out instead |

## Irreversible

Everything is irreversible through the server itself — no step-undo, no snapshot, no transaction, in any domain. Version control is the only rollback that exists.

## Lane

One executor per editor, structurally — not a cautious default but a consequence of the protocol having no way to address a scene explicitly on a mutating call. A second participant silently redirects every subsequent mutating call's implicit target, not just the ones that collide.

## When this file is silent

This file records where this server's reports diverge from its actual state — it is not a catalogue of what the server can do. An absent row is not a missing capability; ask the live tool catalog for that.
