# `+check` validation procedure

This file describes the optional findings-validation pass that runs when `unikit-review` is invoked with the `+check` flag. The parent skill defers to this document so the main `SKILL.md` stays focused on the default review workflow; `+check` is opt-in and most invocations do not need it.

The four severity levels — 🔴 **Critical** / 🟡 **Warning** / 🟠 **Medium** / 🟢 **Suggestion** — and the rules for moving an item between them are defined **inline in `SKILL.md` Step 4 (Severity scale)** and in the validator prompt (`references/VALIDATOR.md`), which carries the same 4-level rubric. `unikit-review` has no separate `SEVERITY.md`; do not invent one.

## Subagent-Delegation carve-out (IMPORTANT)

`+check` is **exempt** from the `## Subagent Delegation — BLOCKING PRE-REQUISITE` rule (the `<!-- unikit:agents codex -->` block in `SKILL.md`). That rule says the assistant MUST ask the user before falling back to an alternative when agent execution is unavailable. For `+check` this does NOT apply: `+check` is an optional validation pass, so an unavailable or blocked validator agent → **render the review as drafted** (keep all findings, emit one `WARN [+check]` line — see Failure modes), **NEVER** ask the user.

## When to run

After the full review is produced internally (all sections, including the gate-result inputs) but **before** anything is rendered to the user. The validator only adjusts which findings reach the user and what the final `unikit-gate-result` block reports.

If `+check` is not set, skip this entire procedure — render the review as-is, with no validator-related lines in the output. "Questions", "Positive notes" (in the Summary), and the "Per-Commit Notes" block are NOT validated even when `+check` is set; neither are commit-structure findings in commits mode (see Procedure step 1).

## Procedure

1. Collect items from the **Findings table** (`| # | Severity | Location | Rule | Issue | Fix |`) into a numbered list — one item per table row, in display order. Render each item under a `### Item N (severity: critical|warning|medium|suggestion)` heading where the parenthetical names the row's current Severity cell, so the validator sees the level it currently sits at. For each item, remember its **original severity** — you need it to detect reclassification and to fall back if the validator response is malformed. In commits mode the reviewed diff handed to the validator is the squashed `git diff <ref>..HEAD` (step 2b) and carries no per-commit boundaries — so exclude from the numbered list any finding tied to an individual commit rather than to the net code change (commit-message accuracy, atomicity, or a change introduced in one commit and reverted within the range), exactly as "Questions" and "Positive notes" are excluded; such findings stay in the rendered review verbatim and are not counted by the `Filtered:` line. **If the list is empty, skip steps 2–5 entirely**: do not dispatch the validator, treat the run as successful with `hidden = 0`, `adjusted = 0`, `reclassified = 0`, and proceed straight to "Output additions" / "Recomputing `unikit-gate-result`".
2. Build the inputs for the validator. **(a) Project context block** — working directory path, plus a short excerpt from `.unikit/DESCRIPTION.md` if that file exists; keep it under ~30 lines. **(b) Reviewed material** — the exact diff the review was produced from, captured verbatim: `git diff --cached` for staged mode, or `git diff` when staged mode found nothing staged and reviewed the unstaged working tree instead; `gh pr diff <N>` for PR mode; `git diff <ref>..HEAD` for commits mode. For **file mode** there is no diff — pass the list of reviewed `.cs` file paths and let the validator `Read` them from disk. The validator judges findings against this material instead of reconstructing the change from disk — in PR mode the PR branch is not checked out, so disk holds the wrong version.
3. Read `references/VALIDATOR.md`. It declares three substitution slots at the top of the file — one for the project context block, one for the reviewed material (both from step 2), and one for the items list from step 1 (each under its own `### Item N (severity: …)` heading). The 4-level severity rubric is **inlined directly in the prompt body** (there is no `{{SEVERITY_RULES}}` slot — `unikit-review` has no `SEVERITY.md`). Replace all three slots before dispatch; the exact placeholder tokens are listed in the VALIDATOR.md header.
4. Dispatch one call: `Agent(subagent_type: Explore, model: sonnet, prompt: <rendered template>)`. The subagent runs with fresh context. `Explore` is **read-only by construction** (its tool set excludes Edit/Write), so the validator cannot modify files or run state-changing commands — the read-only contract is guaranteed by the dispatch.
5. Parse the response by `### Item N` headings. For each item, first determine the **target severity** from `Severity`:
   - `Severity: unchanged` (or field missing) → target = original severity.
   - `Severity: critical|warning|medium|suggestion` → target = that level.

   Then apply `Verdict`:
   - `Verdict: keep` → item text stays. Set its Severity cell to the target level. If target ≠ original, increment `reclassified`.
   - `Verdict: modify` → replace the item text (the Issue/Fix cells) with `Modified-text`. Set its Severity cell to the target level. Increment `adjusted`. If target ≠ original, also increment `reclassified`.
   - `Verdict: drop` → remove the table row. `Severity` is ignored. Increment `hidden`.

   Reclassified items (target ≠ original) get a short note appended to the Issue cell so the user understands the move: ` [+check: promoted to <level>]` or ` [+check: demoted to <level>]`. The note is added by the main skill, not by the validator.

> Edge case: the reviewed diff covers the change itself. A finding about how the change interacts with **unchanged** surrounding code is still verified against disk, and in PR mode disk is the current branch, not the PR branch — that residual mismatch is an acceptable compromise, since checking out the PR branch would break the read-only contract.

## Failure modes

- **Per-item malformed response** (heading missing, no `Verdict` line, unknown verdict token, unknown `Severity` value, or missing `Modified-text` line when `Verdict` is `modify`): treat that item as `keep` with `Severity: unchanged` and append one line after all review sections, just before the `unikit-gate-result` fence: `WARN [+check]: validator response for item N was malformed, kept as-is`. Continue processing remaining items.
- **Whole-dispatch failure** (agent unavailable/blocked, empty response, exception, timeout, validator refusal): treat **all** items as `keep` with `Severity: unchanged` and append one line in the same position (before the `unikit-gate-result` fence): `WARN [+check]: validator failed (<reason>), all items kept as-is`. In this case the `unikit-gate-result` block is assembled from the **unfiltered** original Findings table — do NOT recompute `status`, `blockers`, `affected_files`, or `suggested_next`. **The skip-fallback is NOT inline analysis** — the skill does not re-run the validator's work itself; it keeps the draft and emits the single `WARN`.

In both failure paths the `unikit-gate-result` fence stays the **last** thing in the output. WARN lines always go above it.

## Output additions

When `+check` ran successfully (no whole-dispatch failure), append exactly one line at the end of the human-readable review, after all sections and before the `unikit-gate-result` fence:

```
Filtered: N hidden, M adjusted, K reclassified by +check
```

`N`, `M`, `K` are zero when nothing happened in that bucket — still emit the line so the user sees the validator ran. Skip this line entirely when `+check` was not set or when the whole-dispatch failure path applies (the `WARN` line replaces it).

## Recomputing `unikit-gate-result` after `+check`

`unikit-gate-result` is computed by the **Machine-readable gate result** section of `SKILL.md` — that section is the single owner of the projection (Findings table → `status` / `blocking` / `blockers` / `affected_files` / `suggested_next`). `+check` does **not** define its own projection; it only changes the input the projection runs on.

Apply the `SKILL.md` rules unchanged, with two `+check`-specific points:

- **Input is the post-filter Findings table.** Recompute `status`, `blockers`, and `affected_files` from the table *after* every keep/modify/drop and severity move. A dropped 🔴/🟡 row or a row demoted to 🟠/🟢 can lower `status`; a row promoted to 🔴/🟡 can raise it. (Blocking levels are 🔴 Critical and 🟡 Warning → `blockers`/`error`; 🟠 Medium and 🟢 Suggestion are non-blocking.)
- **`suggested_next.reason`** gains a short note mentioning `+check` and the three counters, e.g. `"After +check filtering: 2 hidden, 1 adjusted, 1 reclassified; remaining blockers require a fix pass."`.

Whole-dispatch failure is the exception: keep the unfiltered draft and do NOT recompute (see "Failure modes" above).

## Examples

### Success

```
User: /unikit-review +check

→ Review drafted: 2 Critical, 1 Warning, 3 Medium/Suggestion in the Findings table
→ +check validator dispatched (Agent Explore, see procedure above)
→ Validator returned: 4 keep (1 promoted from Medium → Warning), 1 modify, 1 drop
→ unikit-gate-result recomputed against the post-filter table

Rendered review:
- Findings table: 5 rows (1 dropped), Severity cells reflect the moves
- Questions / Positive notes: unchanged (not validated)

Filtered: 1 hidden, 1 adjusted, 1 reclassified by +check

unikit-gate-result (post-filter):
- status: fail, blocking: true
- suggested_next: /unikit-fix
- reason: "After +check filtering: 1 hidden, 1 adjusted, 1 reclassified; remaining blockers require a fix pass."
```

### Whole-dispatch failure

```
User: /unikit-review +check

→ Review drafted: 2 Critical, 3 Suggestion
→ +check validator dispatched
→ Validator failed (agent unavailable)
→ All items kept as-is; unikit-gate-result NOT recomputed (kept from the draft)

Rendered review (unchanged from the draft).

WARN [+check]: validator failed (agent unavailable), all items kept as-is

unikit-gate-result (assembled from the unfiltered original table):
- status: fail, blocking: true
- suggested_next: /unikit-fix
- reason: original draft reason, no +check counters appended
```
