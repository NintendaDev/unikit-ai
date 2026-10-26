# The index files and the report

## When they are written

After every source that finished - never at the end of the bridge - rewrite both files of its bridge whole: `INDEX.md` and `FILES.md` in `<docs folder>`. A bridge with no finished source writes neither. A source whose collection failed changes nothing in them: its previous copy and its previous row stay. This is what makes an interrupted run resumable: a source is in `INDEX.md` only when its copy is whole.

## `INDEX.md` of a bridge

```
<!-- Written by /unikit-bridge-docs. The next run replaces the copies it rebuilds; keep your own material in .unikit/references/user/ (see /unikit-references). -->
# Collected documentation: <bridge id>

bridge: <bridge id>
collected: <date>
versions: <label> <value>; <label> <value>

## Sources

| source | kind | stamp | files | bytes | state | folder |
|---|---|---|---|---|---|---|
| <source id> | <kind> | <stamp> | <n> | <bytes> | complete | .unikit/references/bridges/<bridge id>/<into>/ |

<!-- pointer <source id>: <the pointer of the source, one line, as the `docs sources` JSON of the block has it> -->

## Folders

| folder | files | what it holds |
|---|---|---|
| .unikit/references/bridges/<bridge id>/<into>/<sub folder>/ | <n> | <description, or -> |

Every file, with its size and a caption: `.unikit/references/bridges/<bridge id>/FILES.md`. Search it for a word with `Grep`; do not read it whole.
```

- `collected:` is today's date. `versions:` joins the labels that apply, in this order: `cli <the number the probe version row printed>` (a command), `package <the value of the probe package row>`, `server <the number of the probe version row>` (an MCP server), and for a bridge with no probe row the stamps of its git sources (`<ref> @ <hash>`) and nothing else; `unknown` stands for a number that could not be read, `none` for a bridge with nothing at all. Agents compare this line with the answers of the same probes to decide whether a copy is older than the installed versions (D8); a bridge without probes is never called older.
- `## Sources` has one row per source that has a whole copy on disk, in the order of the block. `files` and `bytes` are counted after the swap as the status pass counts them. The row of a source this run did not touch is copied from the old `INDEX.md` as it stands. The `pointer` comment right below the table is one per source, in the same order.
- `## Folders` has one row per directory under the copies that holds files **directly**, sorted by path; `files` counts those files only. `what it holds` is the `description:` of the `SKILL.md` directly inside, as written (first line, a `|` written `\|`); without one, the first heading of the `SKILL.md` or `README.md` directly inside; without one, `-`. Never write a description of your own. The three passes of the recipe below give the descriptions and the headings for this table too; run them first.

## `FILES.md` of a bridge

```
<!-- Written by /unikit-bridge-docs together with INDEX.md. Search it for a word with Grep; do not read it whole. -->
# Files of the collected documentation: <bridge id>

| path | bytes | caption |
|---|---|---|
| .unikit/references/bridges/<bridge id>/<into>/<relative path> | <bytes> | <caption> |
```

One row per file of every copy of the bridge (not `INDEX.md` and not `FILES.md`), sorted by path, with no limit on the number of rows. Build it from the disk, never from memory:

1. **Paths and sizes.** `find <docs folder> -mindepth 2 -type f -exec wc -c {} +`; the paths come out from the project root, as in the table; the `total` lines are not files.
2. **Captions of the Markdown files** (`*.md`; any other file gets `no heading`), three passes over the whole folder, each printing at most one line per file (the lines of the two index files in the root of the folder are not rows):
   - `grep -r -n -m 1 -H --include='*.md' -e '^description:' <docs folder>`
   - `grep -r -n -m 1 -H --include='*.md' -e '^name:' <docs folder>`
   - `grep -r -n -m 1 -H --include='*.md' -e '^#' <docs folder>`
3. **Which caption.** The value of `description:`; otherwise the value of `name:`; otherwise the first heading, without its leading `#` characters and the space after them; otherwise `no heading`. A `description:` or `name:` counts only when it is on line 20 or earlier (the line number is in the output) and its value is not empty and not only a block-scalar sign (`>`, `>-`, `|`, `|-`). The caption is taken as written, cut at the end of its line, a `|` in it written `\|`.

## The report

Print one table and the lines under it, in the language of the user:

| bridge | source | was -> is | result |
|---|---|---|---|

- `bridge`: the id.
- `was -> is`: the recorded stamp before the run (`none` when there was no copy) and the stamp now; the same value on both sides is shown as `unchanged`.
- `result`: the strings of the procedures; a source that was current and was not collected in this run shows `current - not collected`.

Under the table, in this order:

1. one line for each source whose result is `not found at the pointer` - the vendor moved something; the pointers live in the bridge cards of the UniKit package;
2. one line for each source that was `unavailable` or `copy not verbatim`: its previous copy was kept; what to start or fix, and the command to run again, `/unikit-bridge-docs <bridge id>/<source id>`;
3. one line for each `below the floor`, with the `setup` rows written for you, as the status pass printed them;
4. `The agents use these copies on their own; /unikit-references keeps your own documents.`
