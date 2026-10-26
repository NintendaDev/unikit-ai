# Bridge environment check

Runs at Step 11.0 when `.unikit/system/engine-bridges/BRIDGES.md` exists. Read-only probes first; nothing is installed without a confirmation.

For each bridge block, in the file's order:
1. A `probe version` line → run that command; compare its answer with the block's `floor` line when there is one. **How to compare versions:** split each into dotted numbers and compare them as numbers, part by part; a tag after a hyphen puts a version below the same version without it (`0.9.0-exp.1` is below `0.9.0`), and a number inside a tag is a number (`beta.9` is below `beta.14` - never compare the two strings letter by letter). Below the floor, or the command fails → print the block's `setup` lines (those marked human are printed, never run).
2. A `probe package` line names a file of the project and a key path in it: read the file with the file-reading tool (no command, no permission), take the value at the key path, and when the file or the key is missing read the fallback the line names. Compare the value with the `floor` line the same way. No value anywhere → the package is not installed: print the `setup` line marked `agent, confirm first` and ask once with the question tool of your agent (`AskUserQuestion`): `Run it now?` — `Run it` · `I will do it myself`. Only on the first answer run it; then say that an editor that is already open loads a new package only after it refreshes the project: bring its window forward and, when Auto Refresh is switched off in the editor, use Assets > Refresh. A value found only in the fallback file means the same thing: requested, not loaded yet.
3. The block has a `status` line → run it once. An error that the block's `note:` lines describe as "the package is in the manifest but the open editor has not loaded it yet" → say the same sentence about refreshing; any other error → print its first line and go on.
4. No probe lines → nothing to check; print the `setup` lines once if the bridge has any.

Then the section `Not selected` of `BRIDGES.md`, if it exists: for each line with a `probe` run it. It answers → print `A bridge you did not select is available on this machine: <name>. Run unikit-ai init and tick it to register it.` (a late registration goes through init — there is no other command).

Last, for each bridge with `docs sources` and no `.unikit/references/bridges/<bridge>/INDEX.md`: recommend `/unikit-bridge-docs` in one line. Never run it from here.
