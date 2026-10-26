# Mode — bridge order

Sets or changes the order in which the engine bridges are tried. Chosen by intent alone, like the config actualization mode; it STOPs when done and Steps 1-11 do not run.

## Capability contract
- It **writes only `.unikit/config.yaml`**, and only through a targeted `Edit` of the order list under the bridge settings block — **never `Write`**.
- Its tools are `Read`, `Edit` and the question tool of your agent (`AskUserQuestion`), and no others. It runs no shell command, invokes no skill, spawns no subagent, and writes nothing under `.unikit/system/**`.

## Phases
1. **Read** `.unikit/system/engine-bridges/BRIDGES.md` (the bridges and their default order) and `.unikit/config.yaml`. No `BRIDGES.md` → print `No engine bridge is installed in this project: run unikit-ai init and tick one.` and STOP.
2. **One bridge listed, or none** → print `The order matters from two bridges on; this project has <n>.` and STOP, writing nothing.
3. **Decide and write.** The block that sets the order. Step 3.2 of `SKILL.md`, the config actualization mode and the returning-project menu carry it out by this name, on the files they have already read, so it neither stops the run nor prints a report of its own.
   - **Decide.** The prompt names the order ("make the CLI first", "Biome before the others") → take the named bridge(s) first and keep the rest in their current order (the current list, or the default order when the list is empty). Otherwise print the numbered list of the bridges (id, one line from its block) and ask once with the question tool of your agent (`AskUserQuestion`): `Which bridge should be tried first?` — one option per bridge, the first in the current order marked recommended; a full order can be given in words through the free answer. Anything not named keeps its current relative order.
   - **Write.** Always write the complete order: every bridge `BRIDGES.md` lists, the chosen ones first. A list that is not empty is what every caller reads as "the order is decided", and a user who is happy with the default order gets it written out by accepting the recommended answer. The list exists → replace it in place with a flow list (`order: [a, b]`). The bridge settings block is absent (an older config) → append the block from `{{skills_dir}}/{{self_name}}/references/config-template.yaml` with the new list. Every write is a targeted `Edit`.
4. **Report, then STOP.** `INFO [config] bridge order: a > b (was: x > y)`; one line: the order is read at the start of every command, nothing is reinstalled. A caller of **Decide and write** prints that `INFO` line in its own report and does not run this phase.
