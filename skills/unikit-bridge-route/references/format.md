# Routing file format

Path: `.unikit/bridge-routing.md`. Optional: no file means no routing rules. The agents read it when they pick a bridge; `unikit-ai init` and `unikit-ai update` never create, read or change it.

## Layout

```markdown
# Bridge routing
<!-- Read by the agents when they choose a bridge. Kept by /unikit-bridge-route or by hand. No file means no routing rules. A row decides only the steps of its own area; every other step follows the order in .unikit/bridges.yaml. -->

| area | when | rule | bridges | why |
|---|---|---|---|---|
| tests | play mode | only | bridge-a | a part started in the background is lost in the other bridge |
| tests | edit mode | first | bridge-b | |
| tests | | never | bridge-c | |
| ui | | first | bridge-b, bridge-a | |
| * | engine code | never | bridge-a | |
```

## Columns

| column | what it holds |
|---|---|
| `area` | One word the planner and the verifier already use: an editor kind or a gate (their lists are in the files named by the skill's Bootstrap step 4), or `*` for any area. It is what an agent searches the file by. |
| `when` | The case in the user's own words, as narrow as they like. Empty means the whole area. Anything engine-specific belongs here, never in `area`. |
| `rule` | `only`, `first` or `never`. |
| `bridges` | Bridge ids as `BRIDGES.md` prints them, separated by commas. |
| `why` | One line, in the project's artifact language. May be empty. |

## Writing rules

- One row per line; a pipe inside a cell is written `\|`.
- The header line and the separator line stay as shown; rows keep the order they were written in, a new row goes last.
- A row never leaves `rule` or `bridges` empty. `area` is never empty (`*` stands for any).
- A row decides only the steps of its own `area`: every other step follows the order of `.unikit/bridges.yaml`, and a bridge that a row names for one area is not promoted anywhere else. To send everything but one area through a bridge, write a `*` row (`first`) next to the row of that area: the row of the area is stronger and decides alone.
- Two rows with the same `area` and `when` and different rules are not written.
- How an agent chooses between rows is not repeated here: `.unikit/system/dev-principles.md` -> **D3** owns it.
