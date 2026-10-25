# The stamp file and the report

## `INDEX.md` of a bridge

Written after all the sources of that bridge were handled - also for a source whose previous copy was kept. A bridge with nothing collected writes no file.

```
<!-- Written by /unikit-bridge-docs. The next run replaces everything under this folder; keep your own material in .unikit/references/user/ (see /unikit-references). -->
# Collected documentation: <bridge id>

bridge: <bridge id>
collected: <date>
versions: <label> <value>; <label> <value>

## Sources

| source | kind | stamp | files | folder |
|---|---|---|---|---|
| <source id> | <kind> | <stamp> | <n> | <into>/ |

## Files

- <into>/<path> - <bytes> bytes - <the first heading of the file, or "no heading">
```

- `versions:` for a command-line bridge: `cli <the number the probe version line printed>; package <the number the probe package line printed>`, `unknown` for a number that could not be read. For a bridge with no `probe` lines: the commits of its git sources (`commit <hash>`) joined with `; `, or `none`. Agents compare this line with the answers of the same probes to decide whether a copy is older than the installed versions; a bridge without probes is never called older.
- `## Files` lists every file of every kept copy, sorted by path; above 200 files: the first 200, then `... and <n> more under <folder>/`.
- The first heading is the first line of the file that starts with `#` (find it with `Grep`); the name of the file is not a heading.

## `INDEX.md` of the engine-level block

The same form in `_engine/`, with `bridge: _engine` and `versions:` built from the commits of its git sources.

## The report

Print one table and the lines under it, in the language of the user:

| bridge | source | was -> is | result |
|---|---|---|---|

- `bridge`: the id, or `_engine`; the catalog part is a row with the source `catalog`.
- `was -> is`: the `versions:` value (or the stamp of the source) before the run - `none` when there was no copy - then the stamp now; the same value on both sides is shown as `unchanged`.
- `result`: the strings of the procedures.

Under the table, in this order:

1. one line for each source whose result is `not found at the pointer` - the vendor moved something; the pointers live in the bridge cards of the UniKit package;
2. a line when a catalog part was skipped: what to start (the editor with the project open) and what to run again, `/unikit-bridge-docs catalog`;
3. `The agents use these copies on their own; /unikit-references keeps your own documents.`
