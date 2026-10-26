# Collecting one source

A source is one element of the `docs sources:` JSON array of a block. Common fields: `id`, `kind`, `into`. The copy lands in `<docs folder><into>/`; it is built first in `<docs folder><into>.new/` and swapped in only when it is complete.

## The swap (every kind)

1. Create `<into>.new/`.
2. Fill it by the procedure of the kind below. Check it: at least one file, and every file non-empty.
3. Only then remove `<into>/` if it exists and rename `<into>.new` to `<into>`.
4. Any failure before step 3: remove `<into>.new` and keep `<into>/` exactly as it was. Report the reason.

A path that comes out of a list or a glob is used only after it passes rule 2 of the skill (relative, no `..`).

## Kind `command`

The pointer has `list` (a command line whose answer names the files) and `show` (a command line with the slot `<file>`).

1. Run `list` as written. Its answer is one relative path per line (ignore blank lines and lines that start with `#`; when a line has columns separated by a tab, the first column is the path). An error or an empty answer → `unavailable: <first line of the error, or "empty list">` - the usual cause is that the tool is not installed or not on the path.
2. For each path run `show` with `<file>` replaced by the path, **standard output redirected into `<into>.new/<path>`** (create the folders first). Standard error is not redirected: a notice about a newer version goes there and must never reach a copy. **How to redirect depends on the shell tool.** In the Bash tool, `>` writes the bytes as they are. In the PowerShell tool of Windows, `>`, `Out-File` and `Set-Content` re-encode the text (a UTF-8 byte-order mark and CRLF line ends: +129 bytes on a 6 KB file, measured), which is not a verbatim copy: run the redirect through the command interpreter instead - `cmd /c "<show line> > <file>"` - which writes the bytes as they are. After the copy compare the size of the first file with the size the source states, when it states one; a difference is `copy not verbatim` for that source.
3. The stamp of the source is the version number the block's `probe version:` line prints (run the line once per bridge per run). No such line → today's date.

## Kind `package`

The pointer has `root` (a project-relative glob of the folder the package is installed in), `path` (relative to that folder) and optionally `include` and `exclude`.

1. `Glob` the `root`. No match → `not found at the pointer: <root>`. Several matches → take the one whose name has the highest version after its last `@` (compare the dotted numbers); a name with no version → the most recently modified. Say which one in the result.
2. The files are everything under `<match>/<path>` that `include` selects (none given = all) minus `exclude`. None → `not found at the pointer: <match>/<path>`.
3. Copy each file to `<into>.new/` keeping its path relative to `<match>/<path>`.
4. The stamp is the name of the matched folder (it carries the version) and, when the block has a `probe package:` line, the version number it yields - read the file that line names, take the value at its key path, and when the file or the key is missing read the fallback it names. The value is copied as written (`0.9.1-exp.1`), never rounded.

## Kind `git`

The pointer has `repo` (an https address), optionally `ref` (a branch or a tag), `path` (a folder in the repository; `.` or none = the whole), `include` and `exclude`.

1. One clone per `repo` and `ref` per run, in `.unikit/references/bridges/_scratch/<n>/`: a shallow, blob-less, sparse clone of `ref` (the default branch when none), restricted to `path`. A later source of the same clone adds its own `path` with `sparse-checkout add`. If the installed `git` refuses the sparse or filter options, clone shallow without them. A failed clone → `unavailable: <first line of the error of git>` (offline, not found, needs a login).
2. The stamp: `commit <short hash of HEAD of that clone>` and the `ref`.
3. The files are everything under `<clone>/<path>` that `include` selects (globs relative to `path`; none given = all) minus `exclude`. None → `not found at the pointer: <repo> <path>`.
4. Copy each file to `<into>.new/` keeping its path relative to `<path>`.
5. After the last git source of the run remove `_scratch/` - also when a source failed.

## Globs

`*` matches within one path segment, `**` any number of segments, `?` one character. A pattern with no `/` matches a file name at any depth.

## What to report for a source (one result each)

- `copied <n> files (<bytes> bytes)`
- `not found at the pointer: <what was looked for>` - the vendor moved the files, or the package is not installed; the pointer lives in the card of the bridge in the UniKit package
- `unavailable: <reason>` - the command, the network or the clone failed
- `skipped: <reason>` - outside the scope the user asked for
- `too large`, or `rejected path: <path>` - appended to a result when files were left out
- `copy not verbatim` - a saved file differs in size from the one the source states: a shell tool re-encoded it; the previous copy is kept
