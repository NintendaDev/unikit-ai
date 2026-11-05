# Tests in a run with no plan

Loaded by Step 4 of `/unikit-execute`, once, only when the description mentions tests or a test run, or this run changed logic or a system value. The policy is item 5 of `.unikit/system/dev-principles.md`: whether tests are written and whether a run is started is the user's choice. The delegate mode does not read this file: Step 0 decides there.

## What the task says

Read the description by its meaning, in any language. The first row that fits decides:

| The description | Tests | Run |
|---|---|---|
| anything, in a session under a prototype plan with `Testing: no` (Step 1) | none | none, no question |
| orders tests ("with tests", "add a test for …") | written after acceptance | one question once they are written |
| orders tests and a run ("with tests, and run them") | written after acceptance | right after they are written, no question |
| orders a run only ("run the tests of this module") | none | after the last step of Step 4, no question |
| says nothing, and logic or a system value changed (item 5) | `## The question` | `## The question` |
| says nothing, and nothing of that kind changed: authored content, tunable data, a rename, a comment, formatting, a trivial accessor | none | none, no question |

A rule of the project, or a test file beside the source, is not an order. A change that breaks the compilation of a test assembly is a compilation error: fix it in Step 4 without asking; that is not a run.

Tests that wait for acceptance print `INFO [testing] tests wait for acceptance: <logic>`, once. The wait lives in this session only: no file records it.

## The question

Ask once, after the last step of Step 4 and before the report, with the scope already worked out (`## The width of a run`). Use the question tool of your agent (`AskUserQuestion`): `Changed logic: <what changed, in a few words>. Tests for it?`

- `No tests (recommended)` — nothing is written and nothing is run. The report says `Tests: none`.
- `Write them after you accept the result` — the tests wait for acceptance (`## After acceptance`).
- `Only run the existing tests — <scope>` — no test is written; `## The run` follows.

The code of this run does not compile, or a line stayed in `Not done` → no question, `Tests: none`. No bridge offers a test run → the third option is left out and the scope is not worked out.

## The width of a run

Before working out a scope, read the rule of the `testing` row in `.unikit/memory/code/RULES_INDEX.md`, then `{{skills_dir}}/unikit-implement/references/test-runs.md` → `## Run width`, that section alone, once. A run with no plan has no coverage: it follows the section's `phase` row, and its changed files are `git status --porcelain` plus the running list of Step 4.

The question names the scope as `the whole project` or as `<n> test suites: <names>`.

- The file or the section is missing → print `WARN [testing] test-run reference missing — every test is run; run unikit-ai update`; the scope is the whole project.
- The project has no `testing` rule → go on with no warning: tests are written by the classes of item 5, and `## Run width` itself chooses a full run when it has no way to narrow.

## The run

Take the route **D3** gives; green is what `### What counts as green` says.

An answer covers this run and one repeat after the cause of a red result is fixed. The repeat works out the scope again and starts without a question, even if the scope grew. A bridge that splits the scope into parts spends nothing by that. Any further run takes a new answer. The same holds for a run the task's words ordered.

- The cause of the red result is in code this run did not write → no fix and no repeat; the report names it.
- No route → the report says `Tests: <…> not run — no bridge offers a test run`.

## After acceptance

Acceptance is the user's own words (`dev-principles.md` item 5a) or the option of Step 5.5. An edit asked for before it, and a loop that closes without it, follow item 5a.

1. Read the rule of the `testing` row as `## The width of a run` says, write the tests once for the final form of the logic by the classes of item 5, and add their files to the running list of Step 4.
2. The task ordered the run too → `## The run`, no question. Otherwise ask once, with the question tool of your agent (`AskUserQuestion`): `Run the tests? Scope: <scope>`. A narrowed scope: `Run them (recommended)` · `Do not run`. The whole project: `Do not run (recommended)` · `Run them`.
3. Print the `Tests:` line again: the report of Step 5.3 is out of date by now.

`What next?` was not asked (no `git`) → the last line of the report says that the tests wait for acceptance. A request to "write the tests now" ends the wait (item 5a).

## The report line

The `Tests:` line of Step 5.3 takes one of these values:

- `none`
- `waiting for acceptance — <logic>`
- `written, run through <bridge> — <passed>/<total>`
- `written, not run — your choice`
- `written, not run — no bridge offers a test run`
- `not written; existing tests run through <bridge> — <passed>/<total>`
- `no tests in the project`
