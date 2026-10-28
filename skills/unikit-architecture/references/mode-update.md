# Mode B — Update the Architecture Document (`update`)

Read **only** when SKILL.md → `## Modes` selected Mode B — the request asks to update, or names no intent and the file has content — and never otherwise. The mode announcement is already printed, and Steps 0–2 of SKILL.md have run: the engine rules, the project context and the project scan.

The layout — the two shapes of the root, the table row, the topic file, the marker — is SKILL.md → `## Layout of the architecture files`. This mode adds to what is written; it does not regenerate the file from the Step 4 template. **Nothing already written is removed, reworded or reordered** — under any outcome.

## U.1 Read

1. Read the root. Its state (`topics`, `flat` or `legacy`; `empty` never reaches this file) comes from SKILL.md → `## Modes`. Print its `WARN` lines about drift between the table and the topic files; fix none of them.
2. Open a topic file only when a fact has to be placed in its area, or when the area has to be compared with the scan (U.2). The root alone is enough for everything else.

## U.2 Rescan

Run Steps 2.1–2.4 of SKILL.md. Compare what they found with what the file says:

- **new** — present in the project, absent from the file: a module, a directory, a layer, a dependency edge, a contract or channel between modules, a package.
- **stale** — the file names a path or a module the scan did not find. It is **not** removed and not edited. It goes into the report as `WARN [architecture] update: <path> is named in the file and not found in the project (left as written)`.

## U.3 Place

Every `new` fact gets exactly one place, by its kind. Placement is a targeted `Edit` — one table row or one list line in the right section — never a `Write` of the whole file.

| Kind of fact | Where it goes |
|--------------|---------------|
| a new module, directory or layer | the topic whose `Load when` matches its area, else one line in the root's `## Folder Structure` |
| a new edge or prohibition | touching several areas → the root's `## Dependency Rules`; one area → that topic's rules |
| a new contract or channel between modules | that topic's contracts table; a general pattern → the root's `## Cross-Module Communication` |
| a new package or library | one row in the root's `## Tech Stack` |
| a principle, an anti-pattern, a pattern choice | not found by a scan: only from a hand-off block (U.4), or after asking the user where it goes |
| how a mechanism works (narrative) | only from a hand-off block, into the topic of its area (the root when no topic fits); never written from a guess |

When unsure, the root.

## U.4 Hand-off block

A request may carry a fact or a text of its own: "module X may not depend on Y", a pasted paragraph, or what `unikit-rules` prune hands over — a line describing how the code is built. That text is the **block** to record; a request that only asks for an update carries none.

1. Classify the block by the table of U.3.
2. Write it **word for word** — no rewording, no shortening, no merging with a neighbour.
3. A decision (a principle, an anti-pattern) has no obvious home: ask where it goes, with the question tool of your agent (`AskUserQuestion`), the root section that fits best first and marked as recommended.

## U.5 A new topic

A fact that does not fit one line, in an area that has no topic yet, is previewed as `new topic <slug> — Load when: …, receives: …` and asked once: `Create the topic` / `Put it in the root` / `Not now`, with the question tool of your agent (`AskUserQuestion`). No answer → `Put it in the root`. Only this mode and `optimise` create a topic.

A new topic file follows the layout; its row joins the table in alphabetical order of slug. If the root had no table yet, give it the shape the layout describes: the table directly above `## Detailed Rules`, the header quote under the title, and remove the `flat` marker if there was one.

## U.6 Report

Print one line `INFO [architecture] update: added=<n> stale=<k> new-topics=<t>`, then a table `# | Fact | Placed in`, then the list of `stale` paths. Not one word about the length of the file and no advice to move anything into the knowledge base.

If this run gave the file its first topic (U.5), run Step 5 of SKILL.md: the `AGENTS.md` row names the topic directory.

## U.7 Offer

State `legacy` only: follow `## Offer` in `{{skills_dir}}/{{self_name}}/references/mode-optimise.md` now, after the report and without an announcement of its own. States `flat` and `topics` make no offer.
