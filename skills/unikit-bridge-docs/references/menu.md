# The menu

Only when step 2 of the run found something to decide and no argument answered it. The question is asked as `.unikit/system/user-questions.md` says: first a message of your own with the state table (already printed by the status pass) and a numbered list of what each option does, the recommended one first; then the question tool with the same options in the same order. The option texts below are templates: say them in `language.ui`, with the real numbers.

## Which situation

- **No copy at all** - every source in scope is `missing`: situation A.
- **Anything else with a source to fix** - at least one source is `missing`, `outdated` or `damaged`: situation B.
- **Nothing to fix** - never reaches this file.

## Situation A: no copy yet

| # | Option | What it does |
|---|---|---|
| 1 | Collect everything (Recommended) | Collects all `N` sources: `M` from this machine (a command or an installed package), `K` downloaded from `<hosts of the git sources>`. |
| 2 | Only what this machine has | Collects the `M` sources of kind `command` and `package`; the `K` downloads stay missing. Offered only when `M` and `K` are both above 0. |
| 3 | Choose bridges | Asks which bridges, then collects every source of the chosen ones. Offered only when more than one bridge has a source. |
| 4 | Nothing now | Leaves everything as it is. |

## Situation B: something to fix

| # | Option | What it does |
|---|---|---|
| 1 | Fix what was found (Recommended) | Collects the `N` sources that are `missing`, `outdated` or `damaged`; the current ones are not touched. |
| 2 | Choose bridges | Asks which bridges, then collects the sources of the chosen ones that need it. Offered only when more than one bridge has a source to fix. |
| 3 | Rebuild everything | Collects all `T` sources again, the current ones too - the same as the word `force`. |
| 4 | Nothing now | Leaves everything as it is. |

## Choosing bridges

A second question, asked only after option "Choose bridges" is answered: the bridges that have something to collect, as a multi-select with two to four options (a bridge per option: `<bridge id> - <how many sources, and what is wrong>`); with more than four bridges list the first four in the order of the blocks and say so. Say in the message before it that one source alone is collected with `/unikit-bridge-docs <bridge id>/<source id>`. Nothing chosen = "Nothing now".

## After the answer

- "Nothing now" → print `Nothing was changed.` and stop.
- Any other answer fixes the list of sources for step 3 of the run. Downloads are part of the answer: the first and the second option of situation A, and the first and the third of situation B, name them in their text, so the answer is the consent to them.
- Never ask again in the same run.
