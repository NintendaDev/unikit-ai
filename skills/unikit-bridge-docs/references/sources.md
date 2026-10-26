# Collecting one source

A source is one element of the `docs sources` JSON array of a block. Common fields: `id`, `kind`, `into`. The copy lands in `<docs folder><into>/`; it is built first in `<docs folder><into>.new/` and swapped in only when it is complete. Print the line `[n/N] <bridge id> / <source id>: ...` before the first command of a source, and one more before the longest steps (a clone, the loop over the files of a `command` source). Print the result as `INFO [bridge-docs] <bridge id> / <source id>: <result>`, the results being the strings at the end of this file.

## The swap (every kind)

1. Remove a leftover `<into>.new/` of an earlier run, then create it empty.
2. Fill it by the procedure of the kind below. Check it: at least one file, and every file non-empty.
3. Only then remove `<into>/` if it exists and rename `<into>.new` to `<into>`.
4. Any failure before step 3: remove `<into>.new` and keep `<into>/` exactly as it was. Report the reason.
5. After step 3 the source is finished: count its files and bytes (`find <docs folder><into>/ -type f -exec wc -c {} +`, read as in the status pass) and write the index files of the bridge (`stamp-and-report.md`) before the next source starts.

A path that comes out of a list or a glob is used only after it passes rule 2 of the skill (relative, no `..`).

## Kind `command`

The pointer has `list` (a command line whose answer names the files) and `show` (a command line with the slot `<file>`).

1. Run `list` as written. Its answer is one relative path per line (ignore blank lines and lines that start with `#`; when a line has columns separated by a tab, the first column is the path). An error or an empty answer → `unavailable: <first line of the error, or "empty list">` - the usual cause is that the tool is not installed or not on the path.
2. For each path run `show` with `<file>` replaced by the path, **standard output redirected into `<into>.new/<path>`** (create the folders first). Standard error is not redirected: a notice about a newer version goes there and must never reach a copy. **How to redirect depends on the shell tool.** In the Bash tool, `>` writes the bytes as they are. In the PowerShell tool of Windows, `>`, `Out-File` and `Set-Content` re-encode the text (a UTF-8 byte-order mark and CRLF line ends: +129 bytes on a 6 KB file, measured), which is not a verbatim copy: run the redirect through the command interpreter instead - `cmd /c "<show line> > <file>"` - which writes the bytes as they are. After the copy compare the size of the first file with the size the source states, when it states one; a difference is `copy not verbatim` for that source.
3. The stamp of the source is the version number the `probe version` row of the block prints (the status pass ran it; run it once if it did not). No such row → today's date.

## Kind `package`

The pointer has `root` (a project-relative glob of the folder the package is installed in), `path` (relative to that folder) and optionally `include` and `exclude`.

1. `Glob` the `root`. No match → `not found at the pointer: <root>`. Several matches → take the one whose name has the highest version after its last `@` (compare the dotted numbers); a name with no version → the most recently modified. Say which one in the result.
2. The files are everything under `<match>/<path>` that `include` selects (none given = all) minus `exclude`. None → `not found at the pointer: <match>/<path>`.
3. Copy each file to `<into>.new/` keeping its path relative to `<match>/<path>`.
4. The stamp is `<name of the matched folder> (<value>)`, `<value>` being what the `probe package` row yields - read the file that row names, take the value at its key path, and when the file or the key is missing read the fallback it names - and just `<name of the matched folder>` when the block has no such row. The value is copied as written (`0.9.1-exp.1`), never rounded.

## Kind `git`

The pointer has `repo` (an https address), optionally `ref` (a branch or a tag; it may hold `{version}`), `path` (a folder in the repository; `.` or none = the whole), `include` and `exclude`.

1. **The ref.** A `ref` that holds `{version}` takes the version of the bridge in its place (`v{version}` with `2.1.0` is `v2.1.0`): the number the `probe version` row yields, as in the status pass. When no number can be had (the row is missing, no file has a filled number, the files disagree), ask once for it - see "Asking for a version" below. A `ref` with no `{version}` is used as written; none = the default branch of the repository.
2. **The clone.** One clone per `repo` and `ref` per run, in `.unikit/references/bridges/_scratch/<n>/` (remove a `_scratch/` left by an earlier run before the first clone): a shallow, blob-less, sparse clone of `ref`, restricted to `path`, with the line ends left alone - `git clone --config core.autocrlf=false ...`. A later source of the same clone adds its own `path` with `sparse-checkout add`. If the installed `git` refuses the sparse or filter options, clone shallow without them. A failed clone → `unavailable: <first line of the error of git>` (offline, not found, needs a login).
3. **The stamp:** `<ref, or HEAD> @ <short hash of HEAD of that clone, 7 characters>`.
4. The files are everything under `<clone>/<path>` that `include` selects (globs relative to `path`; none given = all) minus `exclude`. None → `not found at the pointer: <repo> <path>`.
5. Copy each file to `<into>.new/` keeping its path relative to `<path>`.
6. **Verbatim check.** Compare the size of the first copied file (in path order) and of the largest one with the size of the same file in the repository, `git -C <clone> ls-tree -r -l HEAD -- <path of the file in the repository>` (the fourth field of its line, the number before the tab; the path in the repository is the pointer's `path` followed by the relative path of the file). A difference in either is `copy not verbatim`: the previous copy is kept.
7. After the last git source of the run remove `_scratch/` - also when a source failed.

### Asking for a version

Ask with the question tool, after reading the contract as the skill says: the question names the bridge and says that its configuration holds no filled version; the options, the recommended first: `<the highest release tag>` (from `git ls-remote --tags <repo>`; compare the dotted numbers of the tags that look like a version) · `The default branch`. The user can type a number of their own. The answer is the `{version}` for every source of that bridge in this run, and it goes into the `versions:` line and the stamp of the sources that used it. The answer "default branch" means a `ref` of none.

## Globs

`*` matches within one path segment, `**` any number of segments, `?` one character. A pattern with no `/` matches a file name at any depth.

## What to report for a source (one result each)

- `copied <n> files (<bytes> bytes)`
- `not found at the pointer: <what was looked for>` - the vendor moved the files, or the package is not installed; the pointer lives in the card of the bridge in the UniKit package
- `unavailable: <reason>` - the command, the network or the clone failed
- `skipped: <reason>` - outside the scope the user asked for
- `too large`, or `rejected path: <path>` - appended to a result when files were left out
- `copy not verbatim` - a saved file differs in size from the one the source states: a shell tool or git re-encoded it; the previous copy is kept
