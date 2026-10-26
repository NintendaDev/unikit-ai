# unikit — Returning-Project Menu

> Loaded on demand by `/unikit` Step 0 dispatch when `.unikit/config.yaml` already exists and the intent of the prompt names neither the config actualization nor the bridge order.

A project that is already set up almost always needs one specific thing, not the whole setup again. This mode reads what the project looks like, offers the actions that fit it, and hands over to the one the user picks. It writes nothing itself.

## Capability contract

Its own tools are `Read`, `Glob` and the question tool of your agent (`AskUserQuestion`). It writes nothing itself, runs no command and spawns no subagent: every write belongs to the branch it hands over to, under that branch's own contract. Plain markdown only, no HTML tags, in every line it prints (item 6 of `## Execution Contract`).

## Report language

Read `language.ui` from `.unikit/config.yaml` and write every line of this mode in that language.

## Phase 1 — Read the state

Read, and nothing more:

1. `.unikit/config.yaml`: `language.ui` and the list under `engine_bridges.order`.
2. What the config lacks: carry out Phases A and B of `{{skills_dir}}/{{self_name}}/references/mode-config.md` without writing or asking, and keep their result — the keys that would be appended, and whether `engine_bridges.order` is absent.
3. `.unikit/system/engine-bridges/BRIDGES.md`, when it exists: the bridge ids (the `##` blocks that name a bridge — not `Not selected`, not the engine documentation block) and the line `default order:`.
4. Whether `.unikit/DESCRIPTION.md`, `AGENTS.md` and `.unikit/ARCHITECTURE.md` exist.

Print `INFO [config] menu state: missing-keys=<n>, bridges=<ids or none>, order=<default|set>, documents=<all present|missing: …>`.

When the prompt already names one of the actions below ("check the bridges", "create rules for the new libraries"), go to Phase 4 with that action: no list and no question. The prompt text is read for that and for nothing else.

## Phase 2 — Print the state and the list

Print the state in a few lines — the keys the config lacks, the bridges and their order (the default one when the list is empty), the documents that exist — then the actions that apply, as a numbered list, one line each: what it does and what it writes. The numbers run through the lines shown; a hidden action leaves no gap. Under the list, one line for what only the CLI does: adding or removing an engine bridge or an agent is `unikit-ai init`, updating the package is `unikit-ai update`.

| Action | Shown when | What it does | After it |
|--------|------------|--------------|----------|
| **Config** | always | adds the missing settings to `.unikit/config.yaml`; when it adds the bridge order key and two bridges or more are installed, it asks the order | the config mode, from Phase C on, then STOP |
| **Order** | two bridges or more, and **Config** will not ask the order (the key is already in the file) | sets `engine_bridges.order` | the bridge order mode, from **Decide and write** on, then its report and STOP |
| **Environment** | `BRIDGES.md` exists | checks the CLI, the package and the editor of every bridge; installs only after a confirmation | `bridge-setup.md`, then STOP |
| **Rules** | always | scans the project and creates the stack rules for the frameworks it uses and has none for; writes under `.unikit/memory/code/stack/` | Steps 5, 6 and 9, then STOP |
| **Description** | always | scans the project again and rewrites `.unikit/DESCRIPTION.md` and `AGENTS.md`, updates `.unikit/ARCHITECTURE.md`; it is named **Finish the setup** when any of the three documents is missing | Steps 1-11 |

The first of these that applies is the recommended one: any of the three documents missing → **Description** (as **Finish the setup**); the config lacks keys → **Config**; two bridges or more and the order list empty → **Order**. When none applies, no action is marked.

## Phase 3 — Ask

Ask once with the question tool of your agent (`AskUserQuestion`): `What should I do?` — the recommended action first, then at most three more in the order of the table; the others are chosen by their number or name in the free answer.

## Phase 4 — Hand over

Print `INFO [config] returning-project menu: <action>` and carry out the branch:

- **Config** — follow `mode-config.md` from Phase C with the result kept in Phase 1.
- **Order** — follow `mode-bridge-order.md` from **Decide and write**, then its report.
- **Environment** — follow `bridge-setup.md` as it stands.
- **Rules** — Step 5; Step 6 (print its analysis; when there is no engine project, say so and stop); then Step 9 with `required` made of `detected_from_scan` alone, because Steps 7 and 8 are not run. After Step 9.9 print how many rules were installed, generated and left alone. Steps 10 and 11 do not run.
- **Description** — Step 1 onward in merge mode, through Step 11. The text of the prompt, when it has any, stands for the answer of Step 4: it is the project description, and Step 4 does not ask for it again.

Every branch ends with its own report; the menu is not shown again in the same run.
