# ChiR24 Unreal MCP

Reference for ordinary use — Context7 `/chir24/unreal_mcp`.
**This file is an amendment to it.** Take signatures from the server, not from
the reference and not from here.

## Access

The catalog splits into 23 top-level tools rather than one gateway dispatching
every action, and gating a tool on or off for the calling agent is real and
immediate in both directions — confirmed by a live round trip. Narrower
per-tool grants are possible for the first time on this engine; none of the 23
is purely read-only, so a perfectly read-only grant still is not.

## Live failure classes

- `eaten parameter` — a requested display name at actor creation is silently
  replaced by a name derived from the visual asset instead; a requested
  destination folder at Blueprint creation is silently dropped and the asset
  lands at the content root instead.
- `lying validator` — a folder-existence check reports absence for a folder
  that a listing of the very same path proves holds real, registered content.
- `fake rollback` — a captured/restored state pair reports success on both
  ends while the restore leaves the state exactly as the moment of restore,
  not as the moment of capture; a step-undo call reports success while the
  value it claims to reverse is unchanged.
- `transport ambiguity` — some calls answer with nothing but the console
  command they ran and no outcome field of any kind, indistinguishable in
  form from a genuine result.

## Shape and cost

A full per-object runtime-transform read of the active level returned over a
quarter-million characters on fewer than 150 objects, with no class filter,
no per-object selection and no summarised form in its schema — cost grows
with object count and there is no cheaper shape to ask for. A separate
listing of the same level, without the runtime transform expansion, comes
back roughly twenty times more compact per object.

## Check

| id | area | confirm that |
|---|---|---|
| scene-1 | scene | the name reported back after creating an actor is the one you requested, not a fallback derived from the visual asset |
| scene-2 | scene | a class-not-found error at creation time is not actually a missing visual-asset reference — rule that out first, before trusting the class name the error names |
| asset-1 | asset | a newly created asset landed in the folder you requested — read the containing folder's own listing, never the path you passed as the request |
| asset-2 | asset | a folder's existence and contents are read through a listing, never through a bare existence check — the existence check has been measured blind to folders a listing shows are populated |
| rollback-1 | rollback | a restored state snapshot matches the value at the moment of capture — read it back independently; both ends of the pair report success unconditionally |
| rollback-2 | rollback | a step-undo call actually reversed the last change — read the value back independently, its own report is unconditional |
| console-1 | console | a response holding only the console command you sent is not a result — the real outcome is unknown until read back independently |
| transport-1 | transport | a response holding only the console command you sent is not a result — the real outcome is unknown until read back independently |

## Irreversible

The captured/restored state pair is not a checkpoint — see `fake rollback`
above — and a step-undo call is not a substitute either, for the same
reason. Version control is the only real rollback; every claim measured here
was reverted by hand, not by either of those two calls.

## Lane

One executor per open editor instance. A live run session inside it was not
measured against a second concurrent attempt — establish what that does by
trying, not by assuming it queues.

## When this file is silent

This file records where a report from this server disagrees with the state
it actually describes — it is not a catalogue of what the server can or
cannot do. A tool this file says nothing about carries no known exceptions
so far, not a guarantee that none exist.
