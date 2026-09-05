# Coplay Unity MCP

Reference for ordinary use — Context7 `/coplaydev/unity-mcp`.
**This file is an amendment to it.** Take signatures from the server, not from
the reference and not from here.

## Access

The visible set is not constant, and absence from your list is not evidence that
a capability is missing. Two independent mechanisms remove a name, they look
identical from here, and only one of them blocks execution.

**They are told apart by trying.** Under the first, the dispatcher still reaches
the affordance and it returns real data. Under the second — a switch held by the
person at the editor — the dispatcher refuses, and the refusal says the affordance
is turned off in the editor. That refusal text is the discriminator, and it is the
only one there is. The second case is the one legitimate route to `⏸️ MANUAL` here:
the affordance is absent, the fallback is exhausted, the evidence is in hand.

**The second mechanism acts per affordance, not per category.** Neighbours in the
same category keep working, so this narrowing is finer than a category and
correspondingly more likely.

**The set can also change between server starts with no setting touched.** A
maintenance action offered as re-syncing clients has been seen replacing the
running server with a differently built one carrying a different set. Confirm
against your own list at the moment you work, and make no claim about what the
server holds.

**Two catalogs answer different questions and neither contains the other.** The
protocol listing is the only source of schemas. The project-scoped catalog knows
about project extensions and about which work is long-running and with what
ceiling; it is registered only when the project-scoped mode is on, so its absence
is a fact about configuration, not about capabilities. The server instructs you to
consult it first — correct, and unconditional about a catalog that is conditional.

## Live failure classes

| class | what it turns into |
|---|---|
| false success | done reported over a structurally broken artifact |
| eaten parameter | an accepted argument that changes nothing about the result |
| catalog phantom | a listing that names what will not run, and is silent about what will |
| lying validator | a built-in code check standing in for a compiler |
| fake rollback | one undo step collapses several operations and can revert an edit that was not yours |
| transport ambiguity | a dropped connection that says nothing about whether the work landed |
| opaque aggregate | a group report that hides which of its elements failed |
| stale read | a journal read that returns the oldest entries without saying it truncated |
| destructive default | a removal that names nothing before it removes |

The detector for each of these in `dev-principles` is mandatory here. A class may
have been fixed since it was measured — the detector settles that, this table does not.

## Shape and cost

There is no delta gate: no fingerprint, no revision tag, and the editor's own change
counter resets on every domain reload. Build the delta from a marker of your own and
do not expect one to survive a reload.

Structure comes back one level per call. A full inspection of a populated scene is
hundreds of calls and hundreds of kilobytes, and a request that asks to go deeper is
accepted and has no effect. Read the level you need and descend deliberately.

The undo journal inside the editor is worse than absent: one step collapses several
operations, an empty stack still reports success, and a step taken after work that
reached the asset database has been seen reverting an unrelated scene edit. Treat
version control as the only rollback and anchor before the phase that writes there.

The group call is capacious and the engine executes its elements one at a time.

## Check

| id | area | confirm that |
|---|---|---|
| scene-1 | scene | creating a scene: the unsaved one was saved or explicitly discarded, and the one that loaded is the one you named |
| scene-2 | scene | after an ambiguous answer, creating again left one object and not two |
| scene-3 | scene | a structure read that asked to be limited by depth came back with more than one level |
| scene-4 | scene | after a structural edit renamed a serialized field, the values survived |
| scene-5 | scene | the identifier creation handed back addresses the object in the scene, not the asset just written |
| asset-1 | asset | a removal names what it will take before it takes it: this lies outside any undo |
| asset-2 | asset | the write reached disk and not only the reply |
| ui-1 | ui | UI Toolkit · a computed read carries geometry; without it the style values are unresolved |
| ui-2 | ui | UI Toolkit · a style edit reached the file and not only the running panel |
| ui-3 | ui | uGUI · the canvas draws into the screen and not into world space |
| vfx-1 | vfx | a particle system property took effect: creation and configuration are different contracts |
| console-1 | console | the read was made outside the counting mode, which returns the oldest entries and is silent about truncation |
| console-2 | console | the marker was placed before the change — there are no timestamps and no watermark here |
| compile-1 | compile | the built-in code check is not a compiler: close the claim with diagnostics taken after a rebuild |
| compile-2 | compile | a readiness signal is not a successful build — a project with errors reports ready too |
| transport-1 | transport | a dropped connection does not say whether the operation ran: re-read before you repeat |
| transport-2 | transport | a refresh that reported ready came back before compilation began |
| rollback-1 | rollback | the undo actually undid something, and undid what you did |
| rollback-2 | rollback | before the phase that writes to the asset database, a rollback point outside the editor captured more than zero files |
| batch-1 | batch | the report of a group that contained a failure is not evidence — read the state back |
| visual-1 | visual | the frame carries content: an empty image arrives in a successful envelope |

## Irreversible

Any write that reached the asset database is outside the editor's undo journal, and
the journal itself is unreliable besides. Git is the only rollback. Commit before
the phase that writes there.

## Lane

One executor per editor instance. Asynchronous job calls do not hold the lane.

## When this file is silent

Two reasons to ask the reference:
— an unfamiliar area — what approaches the authors propose (once per area per session);
— a dead end — the schema is there, the capability is not.

The reference describes **intent, not behaviour**. What you take from it carries the
same evidence obligations.

The reference is **optional** in the installer. When it was not configured, the second
reason above simply has no answer available: descend the degradation ladder in
`dev-principles` and reach `⏸️ MANUAL` only at its own rung — by absence of a route,
established by trying.
