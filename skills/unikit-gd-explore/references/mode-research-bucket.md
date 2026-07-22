# Research-bucket mode (input-mode body)

Loaded on demand by `unikit-gd-explore/SKILL.md` → "Input modes" when the argument
resolves to an existing `reviews/*_review-*.md` file. This is the body; the SKILL
keeps only the switch. Develops each finding through the internal-design lens
(`references/internal-design-lens.md`).

## Research-bucket mode — developing a review's open questions IN PLACE

A `unikit-gd-review` report splits its findings into two buckets: **`## Apply-ready`**
goes to `unikit-gd-apply`, and the **`## Research`** bucket — the diagnoses that still
need a decision — is **this skill's** input. It is the "decision factory" in the middle
of the pipeline `review → explore → apply`: it turns each diagnosis into a decided edit,
**written back into the same review file** — never into `researches/`. The review file is
a **living pipeline artifact**: review fills its buckets, explore promotes the research
bucket in place, apply consumes the apply-ready bucket.

When the argument **resolves to an existing** `reviews/*_review-*.md` file, run this mode:

1. **Read the `## Research` bucket** (ignore `## Apply-ready` — that is apply's input, not
   this skill's). Each line is `RF-<date>-n · <the open question to work out>`, naming a
   doc / section / id and the question left open.
2. **Develop each finding through the internal-design lens** (`internal-design-lens.md`):
   deep-read the named target, lay out options, run the closure pass, and **decide the
   edit**. Build the matching **mode-aware brief block** for the target's `doc_status` —
   `## Improvement Plan` / `## New Feature Plan` for a system, or the
   `## Flow Improvement Plan` / `## Flow Feature Plan` / `## Content Improvement Plan` /
   `## Content Feature Plan` variants for a flow / content type.
3. **Promote the finding in place — `## Research` → `## Apply-ready`.** This is the step
   that makes apply act on it: `unikit-gd-apply` reads **only** the `## Apply-ready`
   bucket, so a developed finding left in `## Research` is **silently ignored** (the apply
   run no-ops on it). For each decided finding, **move its line out of `## Research` and
   into `## Apply-ready`**, reformatting from the open-question shape into the **exact
   apply-ready shape** the bucket and `unikit-gd-apply`'s file reader expect:

   ```
   - RF-<date>-n · <target doc / section> · Fix (entailed): <the decided edit>
   ```

   Carry the finding's **`RF-<date>-n` unchanged** so the owner cites the original review
   finding in its changelog (the provenance review-finding → changelog, symmetric with
   `unikit-gd-apply`). **Append the worked-out brief block** for that target to the review
   file (below the buckets) so the owner has the reasoning when apply dispatches it — the
   brief lives **in the review file**, not in a `researches/` folder. A finding you could
   **not** resolve (it still needs a real decision) stays in `## Research`, unpromoted.
4. **End with the one file command (Handoff Tail contract).** The review file's
   `## Apply-ready` bucket now carries the decided edits — the missing link the research
   bucket existed to supply. **Recommend** (print, never invoke — this skill has no `Skill`
   tool) the single file command as the **last block** of the reply, icon in front, with
   **nothing after it**:

   ```
   🛠️ /unikit-gd-apply reviews/<the same file>.md
   ```

   Apply reads the now-populated `## Apply-ready` bucket and lands the whole set in one
   ordered pass (a single-zone set is bounced to its owner by apply's GATE 2). That closes
   the pipeline `review → explore → apply` with **one** file argument — no prose deltas, no
   per-finding list, no second file, and no description of what apply does next.

This mode **never edits the GDD and never applies**. Its only write is the **in-place
promotion inside the review file** (`reviews/*_review-*.md`, owned by `unikit-gd-review`) —
a sanctioned cross-skill write recorded in Ownership below. The subagent-mode bypass
applies as elsewhere (no interactive closure-pass questions when spawned).
