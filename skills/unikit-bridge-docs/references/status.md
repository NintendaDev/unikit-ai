# The status pass

Read only: this pass downloads, copies and writes nothing. For every source of every bridge in scope it decides one state, and prints the state table once, at the end.

## What is read

- From the block of each bridge in `BRIDGES.md`: the `docs` row (the folder of its copy), `docs sources` (the JSON array of pointers), `probe version`, `probe package`, `floor` and the `setup` table. A bridge with no `docs sources` has nothing to collect: it gets one line in the table, `no documentation pointers`, and no source row.
- From the copy: `<docs folder>INDEX.md` (the `versions:` line, the `## Sources` table, the `pointer` comments) and the folders on disk. A file is counted by `find <folder> -type f -exec wc -c {} +`: the number of lines without the `total` line is the number of files, the `total` line is the number of bytes (several `total` lines are added; a single file prints no `total`, its own size is the answer; no output means 0 files and 0 bytes).

## The version of a bridge, and the stamp of a source "now"

Each probe runs once per bridge, however many sources use it.

- **`probe version`.** A command: run it; the version number it prints is the version of the bridge. A settings instruction (an MCP server): read the settings files the row names; a file counts when it has the entry and its number is filled in; the first file that counts gives the number. Two files that count with different numbers → the version is unknown, reason `settings disagree: <file> <number>, <file> <number>`; none counts → unknown, reason `no filled version in the settings`. The tool does not answer (not installed, not on the path) → unknown, reason `<first line of the error>`.
- **`probe package`.** Read the file the row names, take the value at its key path, and when the file or the key is missing take the fallback the row names. The value is kept as written, never rounded.

The stamp of a source now, by the kind of its pointer. The stamp recorded in `INDEX.md` has the same shape, so the two are compared as text:

| kind | stamp now | unknown when |
|---|---|---|
| `command` | the version of the bridge | the bridge has no `probe version`, or the version is unknown |
| `package` | `<folder> (<package value>)`, or just `<folder>` when the bridge has no `probe package`; `<folder>` is the name of the folder `Glob` finds for `root` (several: the one whose name has the highest version after its last `@`) | no folder matches `root`: reason `not installed` |
| `git`, its `ref` holds `{version}` | the `ref` with the version of the bridge put in place of `{version}` (the part before ` @ ` of the recorded stamp is compared; no network) | the version of the bridge is unknown |
| `git`, any other `ref` or none | `<ref, or HEAD> @ <first 7 characters of the hash>` from `git ls-remote <repo> <ref, or HEAD>` | the call fails (offline, not found, needs a login): reason `<first line of the error>` |

## The state of a source

Take the first line that applies:

1. No folder for the source and no row for it in `INDEX.md` → **missing**.
2. Any of these → **damaged**: a folder with no row; a row with no folder; a row whose `state` is not `complete`; a number of files or bytes on disk different from the row; a `<into>.new` folder next to the source while its folder is absent. An `INDEX.md` written by an earlier version of this skill has no `bytes` and `state` columns: none of its sources has a row, so every existing folder is **damaged** - say so under the table, in one line, as `index of an earlier version`; one run rebuilds them.
3. The stamp now cannot be told → **unknown**, with the reason. The copy is left as it is.
4. The stamp now differs from the recorded one, or the pointer in `BRIDGES.md` differs from the recorded `pointer` comment (compared as values, not as text: the block prints the pointer over several lines, the comment keeps it in one) → **outdated**, with `in the project <X>, in the copy <Y>` (for a changed pointer: `the pointer changed`).
5. Otherwise → **current**.

A `<into>.new` folder next to a whole source and a `_scratch/` folder are leftovers of an interrupted run: they are named under the table and removed when that source is collected (`_scratch/` before the first clone of a run); they change no state. Anything else that no source row and no index file explains - a file or a folder inside a bridge's folder, a folder under `bridges/` that no selected bridge names - is named under the table as `not written by this skill`; it is never touched.

## Below the floor

When the block has a `floor` row, compare the version of the bridge and the package value with its `CLI` and `package` parts; the `engine` part is not checked here. **How to compare versions:** split each into dotted numbers and compare them as numbers, part by part; a tag after a hyphen puts a version below the same version without it (`0.9.0-exp.1` is below `0.9.0`), and a number inside a tag is a number (`beta.9` is below `beta.14` - never compare the two strings letter by letter). A version below its floor is a note on any state: `below the floor: <what> <value> < <floor>`. Under the table print, once per such bridge, the rows of its `setup` table that are written for you, as the block has them; this skill upgrades nothing.

## The table

Print one message, in `language.ui`; the state words are translated, the stamps are shown as they are:

| bridge | source | in the copy | now | state |
|---|---|---|---|---|

- `in the copy`: the recorded stamp and the number of files, or `-` when there is no copy.
- `now`: the stamp now, or `-` when it was not worked out (a `missing` source needs none).
- Under the table, one line each: the reason of every `unknown`, every leftover, every `below the floor`, and every bridge with no documentation pointers.

Hand the list of states to step 2 of the run.
