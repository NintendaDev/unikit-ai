# The table of contents of the command catalog

Only for a bridge whose block has a `catalog groups:` line - a command-line bridge. The table of contents is a **hint**: planning reads it to see which kinds of work the bridge covers, and the executors read it to pick a place to look. A name found through it is a hypothesis; the live schema is read before every call. It holds no parameters, no schemas and no examples.

## Steps

1. **Is the bridge reachable?** Run the `status:` line of the block. An error → `skipped: the editor is not reachable - <first line of the error>`; the existing `CATALOG.md` stays as it is; go on to the next bridge. When the block has `probe` lines and a `floor:` line and an answer is below the floor → `skipped: below the floor (<what> <answer> < <floor>)`.
2. **List the groups.** Run the `catalog groups:` line. Read its answer as a listing of groups: one row per group, usually with the name of the group, the number of its commands and a short description - the columns are whatever the live listing gives. A listing in which every row is a single command (no groups) → write the file with `shape: flat`, the number of rows, and no table.
3. **Fill a missing count.** For a group whose count the listing did not give, run the `catalog group:` line with the name of the group and count its rows. At most 60 such queries per bridge; a group beyond that gets `?`.
4. **Write** `<docs folder>CATALOG.md` with `Write`, in this form:

   ```
   <!-- Written by /unikit-bridge-docs from the running editor. A hint, never a guarantee: a name found here is a hypothesis - read the live schema before a call. -->
   # Command catalog: <bridge id>

   bridge: <bridge id>
   written: <date>
   versions: <the same value as in the INDEX.md of this bridge>
   shape: groups

   | group | commands | what it covers |
   |---|---|---|
   | <name> | <count or ?> | <the words of the listing, or -> |
   ```

   Never write a description the listing did not give; never add a row for a command.
5. The result for the report: `catalog written: <n> groups` · `catalog written: flat, <n> commands` · `skipped: <reason>`.

## Notes

- The commands of the project itself show up in the live listing as soon as the editor has compiled them; after adding some, run the button again with the argument `catalog`.
- The file is replaced whole on every run.
