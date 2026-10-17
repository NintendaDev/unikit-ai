# Manage — the catalog

Read **only** when the request manages saved experiments — list, filter, compare, best, failed, retest, update, archive, lessons across several, or repair the index. Load also `{{skills_dir}}/{{self_name}}/references/storage-and-index.md` in the same turn, and `{{skills_dir}}/{{self_name}}/references/lookup.md` when the request names an experiment by words.

## Source of truth

The saved files are the source of truth. Do not fabricate missing history: a claim the files do not support is not made, and when the data is not there, say so.

## Requests

- **List all** — every experiment, archived ones included (marked as archived).
- **Filter** — not yet evaluated (`Evaluation status: Not Tested`); ready for planning; by topic or "the latest" — the matching is the rule of `{{skills_dir}}/{{self_name}}/references/lookup.md` (it also matches the variant names; relevance the text does not support is not claimed). A request that shows a list or a comparison does not ask the lookup's confirmation: it prints a result, it does not change course; a request that acts on one card found by words (update, archive, retest) keeps it.
- **Compare several** — side by side: hypothesis, what is tested, status, outcome, score, confidence; only comparable ones are compared and an invalid comparison is flagged.
- **Highest-rated** — by the current score (`Evaluation status: Evaluated`); ties are listed together; `Outdated` ones are marked.
- **Failed hypotheses** — assessments `Not Supported` and what each taught.
- **Requiring retesting** — `Outdated`; outcome `Inconclusive`; `Partially Supported` with Low confidence; cards `Ready for Testing` with no rounds.
- **Update** — the editing rules of `{{skills_dir}}/{{self_name}}/references/mode-specify.md` (`Changing an existing card`).
- **Archive** — `Status` becomes `Archived`; the row stays in the index; the number is never reused; the card and the records do not change.
- **Lessons across several** — tell repeated evidence (confirmed by independent sources and by several rounds) from a single observation (seen once); no averages and no conclusions beyond the files.

## Printing

Lists and tables are printed as your own message; the columns are title, what is tested, status, outcome, score (the code as a separate table column). In questions and menus an experiment is named by its title (TIER B).

## Checking the index

`list` and compare check `index.md` against the cards and the results by the rules of `storage-and-index.md` (`index.md`); on a difference — `WARN [experiment] index out of date — not repaired` and the differences are shown. `repair-index` runs on an explicit request: rebuild each row from the cards, show the difference, get approval, write only the index.

## Duplicate numbers

Two folders with one number are an error (`storage-and-index.md`): merging and evaluation for them are blocked until the user says which is which; there is no silent renumbering.

## Reads and writes

- The branch reads the cards (sections 1 and 14), `results.md` (`Current Assessment`) and the index; it writes only for an update, an archive or an index repair, and always after approval.
- "Current score" and "current outcome" come from `Current Assessment` of the latest round on the current `Version`; otherwise the value is `Not assessed on the current version`.

## Failures

- No store or no cards → say "experiments are not created yet" and offer Discover or Specify; create nothing.
- An unreadable card → skipped with `WARN [experiment] a card could not be read — listed as unreadable`; the rest works.
- Logs carry file names and counters only; the content of feedback is not copied.
