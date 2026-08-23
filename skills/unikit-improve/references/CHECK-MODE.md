# `+check` validation procedure

This file describes the optional findings-validation pass that runs when `unikit-improve` is invoked with the `+check` flag. The parent skill defers to this document so the main `SKILL.md` stays focused on the default refinement workflow; `+check` is opt-in and most invocations do not need it.

## When this runs

`unikit-improve` is invoked with `+check` and **without** `--list`. The pass executes between Step 3 (Identify Improvements) and Step 4 (Present Improvements). Without `+check`, skip this procedure entirely — there are no validator-related lines in the output and the Step 4 / Step 5.8 Summary block stays in its default shape without the two `+check` counter rows.

`+check` together with `--list` is silently ignored (no refinement to validate).

## Subagent-Delegation carve-out (IMPORTANT)

`+check` is **exempt** from the skill-wide `## Subagent Delegation — BLOCKING PRE-REQUISITE` rule (the `unikit:agents codex` guard block in `SKILL.md`). That rule says the assistant MUST ask the user before falling back to an alternative when agent execution is unavailable. For `+check` this does NOT apply: `+check` is an optional validation pass, so an unavailable or blocked validator agent → **silently skip validation** (keep all items, emit one `WARN [+check]` line — see Failure modes), **NEVER** ask the user. The skip-fallback is the documented behavior; do not prompt.

## Validated groups

`unikit-improve`'s Step 3 produces five finding classes, surfaced in the Step 4 report. The validator operates on the four **codebase-traceable** display sections:

| Group key | Step 4 section | Step 3 origin |
|-----------|----------------|---------------|
| `missing` | ⚠️ Missing Tasks | 3.1 |
| `improvements` | 🔍 Task Improvements | 3.2 + 3.7 (everything that rewords or expands existing tasks) |
| `architectural` | 🏗️ Architectural Notes | 3.6 (module-boundary / namespace / SOLID-GRASP concerns) |
| `removals` | 🗑️ Removals | 3.4 + 3.5 (redundant, duplicate, or out-of-scope tasks dropped) |

> Mapping note (porting from `aif-improve`): aif validated `missing / improvements / removals / out_of_scope`. `unikit-improve` has **no** `out_of_scope` display section — useful-but-unrelated/gold-plating tasks become `removals` here — and instead carries a dedicated 🏗️ **Architectural Notes** section. So `architectural` takes the 4th validated-group slot. The count (4 validated groups) is preserved.

Two finding classes are **not** sent to the validator:

- **🔄 Dependency Fixes** — recomputed in phase (b) against the post-(a) plan state, exactly as in `aif-improve`. Not validated, not counted.
- **Research-Based Findings** (`research_improvements`, produced by Step 1.5) — **EXCLUDED from `+check` entirely**. Rationale: these are research-derived deltas (constraint/interface/contradiction findings traced to a `RESEARCH_BRIEF.md`), not codebase-traceable claims the fresh-context validator can verify against the repository. They render in their own Step 4 "Research-Based Findings" section unchanged, and the `+check` counters never include them.

## Procedure

The validation pass has two sequential phases.

### Phase (a) — validate the four findings groups

1. Collect items from the four validated groups built in Step 3 (`missing`, `improvements`, `architectural`, `removals`). Number them across all four groups in display order — the group label is carried alongside each item. **If the combined list is empty, skip steps 2–5 of phase (a) entirely**: do not dispatch the validator, treat phase (a) as successful with `hidden = 0`, `adjusted = 0`, and proceed directly to phase (b) (Dependency Fixes still get recomputed normally).
2. Build the project context block: working directory path, optional excerpt from `.unikit/DESCRIPTION.md`, a one-line summary of the plan being refined (plan path — the folder's `.unikit/code/plans/<folder>/PLAN.md` or the flat `.unikit/code/PLAN.md` — plus task count), and the user's improvement prompt parsed in Step 0 — verbatim when the run had one, or the literal marker `none — bare auto-review` when `$ARGUMENTS` carried no prompt text. The validator needs the prompt to tell a user-requested task apart from agent-invented gold-plating.
3. Read `references/VALIDATOR.md`. The reference declares two substitution slots at the top of the file — one for the project context block from step 2 and one for the items list from step 1 (each under its own `### Item N (group: …)` heading). Replace both before dispatch; the exact placeholder tokens are listed in the VALIDATOR.md header.
4. Dispatch one `check-agent` call with the rendered template as its prompt. The alias is declared in `SKILL.md` under `## Delegation agents`, which is also the only place its model is named. The subagent runs with fresh context. The alias expands to `Explore`, which is **read-only by construction** (its tool set excludes Edit/Write), so the validator cannot modify files or run state-changing commands — the read-only contract is guaranteed by the dispatch, not merely requested in the prompt.
5. Parse the response by `### Item N` headings. The group of each item is always its **original** group from step 1 — the validator is forbidden by `references/VALIDATOR.md` from changing it. The `Group:` line in the response is an integrity check, not a control field: if its value differs from the original group, treat the whole item block as malformed (see failure modes below). For each well-formed item:
   - `Verdict: keep` → keep the item unchanged in its original group.
   - `Verdict: modify` → replace the item text with `Modified-text`, put it back in its original group. Increment `adjusted`.
   - `Verdict: drop` → remove the item from the output. Increment `hidden`.

### Phase (b) — recompute dependencies on the filtered list

After phase (a) finishes, the main skill (not the validator) recomputes the 🔄 Dependency Fixes group against the **post-(a) plan state**:

- start from the original plan tasks (the manifest's `## Checklist`),
- add tasks introduced by `missing.keep` and `missing.modify` (these are confirmed new tasks),
- remove tasks targeted by `removals.keep` and `removals.modify` (the validator confirmed the proposal to drop the task from the plan),
- tasks rescued by `removals.drop` stay in the plan — the validator overruled the proposal — and remain valid dependency targets,
- `improvements` and `architectural` only reword existing tasks; they never add or remove anything from the graph.

Any dependency that points at a task absent from the post-(a) plan is discarded. Dependencies are NOT sent to the validator — the short form (`Phase X should depend on Phase Y. Reason: …`) is preserved and the counters from phase (a) do not include this group.

## Failure modes

- **Per-item malformed response** (heading missing, no `Verdict` line, unknown verdict token, missing `Modified-text` line when `Verdict` is `modify`, or `Group:` value that differs from the item's original group): treat that item as `keep` and append one extra line at the very end of the Step 4 output: `WARN [+check]: validator response for item N was malformed, kept as-is`. Continue with the remaining items.
- **Whole-dispatch failure** (agent unavailable/blocked, empty response, exception, timeout, validator refusal): treat **all** items in phase (a) as `keep`, skip the `Hidden by +check` / `Adjusted by +check` Summary rows, and append one line at the end of Step 4: `WARN [+check]: validator failed (<reason>), all items kept as-is`. Phase (b) still runs against the unfiltered list — dependencies are recomputed normally.

**The skip-fallback is NOT inline analysis.** On whole-dispatch failure the skill does NOT re-do the validator's work itself with Glob/Grep/Read — it keeps every finding as-is and emits the single `WARN` line. (This is deliberately the *opposite* of the `unikit-verify` Step 1 inline-Glob/Grep fallback; do not conflate the two.)

## Output additions

When phase (a) ran successfully (no whole-dispatch failure), the Step 4 / Step 5.8 Summary block gains two extra rows at the end:

```
- Hidden by +check: N
- Adjusted by +check: M
```

The counters cover the four validated groups (`missing`, `improvements`, `architectural`, `removals`) — `Dependencies to fix` is computed after validation and is not part of the counters, and `Research-based changes` is never counted (research findings are excluded from `+check`). Skip both rows entirely when `+check` was not set, when the whole-dispatch failure path applies (the single `WARN [+check]` line replaces them), or when Step 4 takes the no-improvements branch (the "Plan Review Complete" / "Plan looks good" path has no Summary block to extend).

## Examples

### Success

```
User: /unikit-improve +check

→ Found plan: .unikit/code/plans/2026-03-08_customers-system/
→ Step 3 produced 4 missing, 3 improvements, 1 architectural, 2 removals
→ +check validator dispatched (Agent Explore, see procedure above)
→ Validator returned: 8 keep, 1 modify, 1 drop
→ Dependencies recomputed against the post-(a) plan state

Step 4 report:
- Missing tasks: 3
- Tasks to improve: 3
- Dependencies to fix: 2
- Architectural notes: 1
- Tasks to remove: 2
- Hidden by +check: 1
- Adjusted by +check: 1

Apply? → Yes → Changes applied
```

### Whole-dispatch failure

```
User: /unikit-improve +check

→ Step 3 produced 4 missing, 3 improvements, 1 architectural, 2 removals
→ +check validator dispatched
→ Validator failed (agent unavailable)
→ Phase (a): all items treated as keep (no Hidden/Adjusted counters emitted)
→ Phase (b): dependencies still recomputed normally against the unfiltered list

Step 4 report (original counters, no +check rows appended):
- Missing tasks: 4
- Tasks to improve: 3
- Dependencies to fix: 2
- Architectural notes: 1
- Tasks to remove: 2

WARN [+check]: validator failed (agent unavailable), all items kept as-is

Apply? → Yes → Changes applied
```
