# Unity CLI

Reference for ordinary use - the collected documentation of this bridge (`/unikit-bridge-docs`) and Context7 `/websites/unity_en-us_unity-cli_unity-cli-reference` (the library its block in `BRIDGES.md` names).
**This file is an amendment to it.** Take names and signatures from the live catalog, not from the reference and not from here.

## Access

**The authority is the listing the bridge gives now.** The catalog follows the editor version and the packages installed in the project: a command the reference describes can be absent, and a command the catalog lists can need a package the project does not have. Confirm a name in the live listing before you plan around it.

**The compact listing reports zero parameters for every command.** That number does not mean "no parameters". Read the parameters from the schema of the command or from the listing of its group.

## Live failure classes

| class | here | what it turns into |
|---|---|---|
| false success | yes | the answer says done while the editor refused the call or the write missed its target |
| eaten parameter | yes | a name or a path the call accepted may take no effect, or land somewhere other than asked |
| stale read | yes | a read after a failed compile or after a flood of messages describes the past |
| destructive default | yes | opening or creating a scene in place of an unsaved one discards the unsaved work |
| transport ambiguity | yes | a refusal that reads like a lost connection can be a failure of the call itself, and a lost connection can hide a change that did happen |

A `yes` means the matching check from `dev-principles` is mandatory. This is a prior probability, not a guarantee: a class may have been fixed.

## Shape and cost

Reading a whole scene has no bound: about 130 bytes, 30 to 35 tokens, per object, so six hundred objects cost about twenty thousand tokens and the cost grows with every object added. Read narrowly - find objects by name, tag or type, or take the counts of the open-scene list - and keep whole-scene reads for small scenes.
Creating a script file through the bridge starts an import and a domain reload by itself, although the reference says it does not and although the editor does not refresh automatically. A file written around the bridge stays invisible to the editor until a compile is requested.

## Check

| id | area | confirm that |
|---|---|---|
| scene-1 | scene | before a whole-scene read the nesting depth is below sixty-three: an answer that only calls the response format invalid is the depth, not the connection, and a chain several hundred deep hangs the command lane |
| scene-2 | scene | before a scene is opened or created in place of the current one, every open scene was saved - the call neither asks nor warns |
| scene-3 | scene | a path used as a target names one object across all open scenes: with the same path in two scenes the object of the inactive one may be taken without a word - address by instance id, or by global id when the scene is a saved asset |
| scene-4 | scene | before a test run every open scene was saved: an unsaved scene makes the run hold the command lane for its whole timeout and end as a success with no tests |
| compile-1 | compile | after entering play mode the editor's play state says it is playing: a text of success with a stopped state means the entry was refused, and the reason is in the console |
| compile-2 | compile | a compile failure is read from the failed flag and the error list, never from the compilation-failed field, which lags one compile behind; reads after a failed compile describe the last good build |
| console-1 | console | a clean read of errors after a noisy run was checked against the dropped flag and the editor's own error counters: the buffer holds two thousand entries and a flood pushes an error out |
| ui-1 | ui | uGUI · an element created under a child of a screen-space overlay canvas sits where intended: its rectangle was read back after creation |
| settings-1 | settings | a settings write by name took effect: a misspelled key answers success with nothing applied, so the value was read back |
| anim-1 | anim | a curve written by property name exists on the target: an unknown property name is accepted and leaves a dead curve, a dry run included |
| asset-1 | asset | markup or style text written to a file is valid: a broken file is accepted as a success, and its parse error shows only in the console |
| visual-1 | visual | a screenshot written to a save path landed inside the assets folder and was imported there - the documented project-relative path is not the project root |
| transport-1 | transport | after a package change that waited for its result, a broken connection is not evidence of failure: the package may be in, so its state was read |
| transport-2 | transport | after a test call ended in a timeout, the run was not started again as it was: it goes on in the editor to its end, keeps no result and holds the lane until then - wait for the lane, then start it in the background and read its status |
| transport-3 | transport | the answer of a test run was read whole: the default output keeps a summary line only, and a run with a part started in the background (play mode) has not ended until that part reported through the status of the run |

## Irreversible

Unsaved scene edits are gone for good when a scene is opened or created in place of the current one, and when the editor has to be restarted after a hung call; the editor's undo journal brings neither back. Save, and commit, before the phase that does either.

## Lane

One executor per editor instance. Parallel clients are queued without damage; a long synchronous call holds the lane for everyone, and a call that waited more than a minute is refused without having run.

## When this file is silent

Two reasons to ask for more:
- an unfamiliar area - what approaches the authors propose (once per area per session);
- a dead end - the schema is there, the capability is not.

Read the collected documentation of this bridge first, then the documentation library its block in `BRIDGES.md` names, as `dev-principles` D8 says. What you take from either describes **intent, not behaviour** and carries the same evidence obligations. A reference nobody collected or configured is not a capability this bridge lacks.
