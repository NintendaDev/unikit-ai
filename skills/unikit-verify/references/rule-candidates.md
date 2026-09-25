# unikit-verify — proposing rule candidates

Read by `/unikit-verify` only when the plan manifest's `## Rule Candidates` holds at least one `open` row — at Step 0.2 when the manifest already carries one, otherwise at Step 5 right after this verification recorded its own. A verification with no `open` candidate never reads this file.

1. **Select at most three** `open` candidates. The filter: a general convention for future code; not about one task; not a description of the current code; absent from `.unikit/RULES.md` and from `RULES_INDEX.md`; one line, one directive.
2. **Print the candidates as plain markdown, in a block of their own** — before the question:

   ```
   Project rule candidates:

   1. <the rule text, as it will be written>
      from: verify
   2. <the rule text>
      from: task 4.1
   ```

   **Print first, ask second: the question mechanism carries the options and nothing else.** A question that also holds the payload is invisible on a runtime that has no such mechanism — that is a measured failure, not a supposition.
3. **Ask once, with `AskUserQuestion` and `multiSelect`:** one option per candidate plus an explicit **"Add nothing"**. Three candidates and a refusal are exactly four options, the tool's limit — which is the reason the count is capped at three. Keep the option label short; the full rule text goes in the option's `description`.
4. **No `AskUserQuestion` → the same list as a numbered text question**, answered by number. An agent without a structured-question tool presents the same options as plain text; that is the second and last tier.
5. **Nothing is written without an answer. Do NOT add any rules until the user answers.**
6. **What was selected goes to `/unikit-rules` as one numbered batch**, through the three-tier dispatch: Tier 1 `Skill(skill: "unikit-rules", args: "<batch>")` inline; Tier 2 the inline slash form `/unikit-rules <batch>`, rewritten per agent by the installer; Tier 3 printing the command, only where no inline mechanism exists at all. This is **a real call, not text in backticks**.
7. **Show the user the `## Batch result` table** the delegate returned, and update the statuses in `## Rule Candidates` from it: `added` for the rules it marked `added`, `declined` for those the user did not select. **`declined` is durable:** such a candidate is never offered again on a later run.

**Verbose.** `INFO [rules] open candidates: <n>, proposed: <m>` before the block is printed — the one line explaining why fewer were proposed than recorded. If the dispatch degenerated to Tier 3 (printing), the statuses are **not** set to `added`: the rule was not written, and marking otherwise would be a lie — print `WARN [rules] /unikit-rules was not invoked — candidate statuses unchanged`. If the delegate returned no table, the same holds: the statuses stand, and `WARN [rules] the /unikit-rules report could not be parsed — candidate statuses unchanged`.
