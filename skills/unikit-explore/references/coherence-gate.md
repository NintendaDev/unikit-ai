# unikit-explore — Research Coherence Gate

Read this file at the moment of saving, and only then. It specifies one gate: does the
research that was just written to disk stand on its own, without the conversation that
produced it?

## When it runs

Every save — regular and ultra alike — and every update of an existing research. It is not
a mode, an option or a flag: a saved research that needs the chat log to be understood is
a research that dies at the next `/clear`.

In ultra the gate runs **after** the integrity checks of
`{{skills_dir}}/{{self_name}}/references/ULTRA-RESEARCH-FORMAT.md` → `## Integrity`, never
instead of them. Integrity asks whether the bundle is whole; this gate asks whether its
content coheres. Passing one says nothing about the other.

## What counts as evidence

Re-read **only the durable scope, from disk**:

- `RESEARCH.md`, in full — the header, `## Active Summary`, `## Findings` and `## Sessions`;
- in ultra, additionally every file listed in `## Artifact Index`.

`SOURCE.md` is **not** in scope. It is a log of the conversation, not a derived
representation of the research, and admitting it would hand the gate back the job it was
just relieved of: reconciling two texts written in different genres. A log is allowed to be
redundant with the manifest — that is what a log is for.

**Chat history and unstored memory are not evidence.** That is the whole mechanism: the gate
checks what will survive the session, not what the session still remembers. Re-read the files
even when you wrote them minutes ago — what you meant to write is not what is on disk.

## The criteria

1. `## Active Summary` is understandable without the conversation that produced it.
2. **Forward resolvability.** Every ID cited in `## Active Summary` is defined below — in
   `## Findings`, or in an artifact listed in `## Artifact Index`.
3. **Backward resolvability.** Every requirement-bearing ID defined in `## Findings` or in an
   artifact is present in `## Active Summary`. A superseded item is named superseded
   explicitly and keeps its own number.
4. Claims distinguish source evidence from inference and from what remains unknown.
5. **One value, one owning section.** A **value** — a number, a threshold, a set of
   parameters, an enumeration, a path, a signature, the membership of a list — is written
   in exactly one section. Everywhere else it is a reference by ID.

   **A characterization is not a value.** Prose that says what a referenced item *means*,
   without restating what it *is*, is not a duplicate. A table cell, a diagram label, a
   consequence line and an ADR `## Context` are obliged to stay readable where they stand:

   ```
   | step 3 by hand | overwrites the zone size (`RISK-1`)                  |   ← not a finding
   | step 3 by hand | overwrites the zone size to 356.4 × 356.4 (`RISK-1`) |   ← a finding
   ```

   The second is repaired by deleting `356.4 × 356.4`. Collapsing the cell to `RISK-1`
   removes the duplicate by removing the cell, and leaves a "symptom" column with no
   symptom in it.

   The reason the line is drawn at values: a duplicate is dangerous because it can go stale
   on its own, and only a value can. When a characterization stops being true, the ID it
   characterizes has stopped being true with it, and the two are repaired together.

   **Scope.** On a first save, every value in the folder is in scope — values are
   enumerable, so they are grepped rather than noticed. On a continuation, the scope is the
   values this session changed, read from the `What changed` line of the session entry
   being written. What was consistent before the session and was untouched by it is
   consistent after it.

Criteria 2, 3 and 5 are mechanical by construction: resolving a reference either succeeds
or fails, and a value either appears in a second place or it does not. Comparing two prose
retellings of the same fact is the operation that has no terminating condition, and
criterion 5 is worded so that it never asks for one — which is why the pass converges.

**The scope of the gate is these five criteria and nothing else.** A defect outside the
list is not a finding: not formatting, not diagram alignment, not wording, not the column
widths of a table. Under a gate that will not pass, the search widens on its own and starts
returning what it was never asked for; this sentence is what stops it.

Each mismatch quotes **verbatim, both sides** — the affected claim and the conflicting or
qualifying passage, each with the section it came from. A bare assertion is not a finding.
This is what keeps the gate from becoming a formality: quoting both sides is work that cannot
be faked by asserting a pass, and it makes an empty report an honest result rather than a
shrug.

## The procedure

The gate runs at most **two passes**. The budget is not a quality setting. A pass that keeps
returning new instances of one class is not closing in on a defect — it is redrawing the
boundary of that class in a new place, and a third pass costs more than it returns.

**Pass 1 — the full gate.**

1. Produce the **whole** list of findings before repairing anything. A pass that repairs its
   first finding and restarts has thrown away the findings it had already paid to read.
2. Classify every finding:

   | Class | What it is | What it costs |
   |---|---|---|
   | **blocking** | two active statements disagree such that a reader would decide differently; `## Active Summary` asserts what the folder refutes | repair, then pass 2 |
   | **material** | a value diverges; the reader would act on the wrong one | repair in the same batch |
   | **cosmetic** | a restatement that does not diverge | **record, do not repair** |

3. Repair every blocking and material finding **as one batch**.

**Pass 2 — the repair check.** Verify the repairs of pass 1 and look for findings those
repairs introduced. Scope is the files the batch touched, plus the files that reference them
— not a fresh sweep of the folder. Zero blocking findings → **the gate passes**; record any
material or cosmetic remainder and continue.

**After pass 2 there is no pass 3 without the user.**

### What a repair may do

A closed list. A repair is **contractive** — it reduces what the folder states. A repair that
adds prose is the mechanism by which a gate stops converging: the sentence written to close
one finding becomes the second copy that the next pass reports.

- delete the duplicated value;
- replace a duplicated value with a reference by ID;
- mark an item superseded and name what replaced it;
- change an artifact's `Status` in `## Artifact Index`.

Not permitted:

- **New explanatory prose.** If a repair seems to need an explanation, the explanation is an
  `OQ-<n>`, not a repair.
- **Leaving a table cell, a diagram label or a consequence line whose entire content is an
  ID.** Delete the value; keep the sentence.
- **Writing the gate's own outcome into the research.** `## Findings` is about the subject. A
  note explaining how this folder satisfies criterion 5 is not a finding about the subject,
  and the next pass reads it as an assertion and checks it — including whether it is true.
- **Building a detector.** An ad-hoc grep is fine. An ad-hoc grep that disagrees with a direct
  read of the file is discarded, not debugged. The gate is not where tooling is developed.

### When the budget is spent

If blocking findings remain after pass 2, **stop and ask**. Do not run a third pass on your
own judgement, and do not confirm the save.

Show the user, in `ui_language`:

- every unresolved finding, with its class and both sides quoted;
- **the count per pass** — `pass 1: 6 · pass 2: 4`. The shape of the sequence is the evidence:
  a falling count says the folder is converging and one more pass is worth its cost; a flat
  count says the criterion is matching something it was not meant to match, and no number of
  passes will end it;
- four options — save with the remainder recorded · one more pass, then ask again · show the
  full list · do not save.

**The remainder is written down, never dropped.** Surviving blocking and material findings
become `OQ-<n>` in `## Active Summary`; the rest goes into the session entry, whose `Gate:`
field then reads `stopped at budget: 2 unresolved — OQ-12, OQ-13` and not `passed`. A gate
that is overridden leaves the override in the artifact. A gate that is overridden silently
was never a gate.

## Delegation

Give the read-only pass to a fresh context: the `check-agent` alias. Fresh context is the
point — the session that wrote the files is the one that cannot tell what they leave unsaid.

Hand it four things, and only these:

1. the durable file paths;
2. the five criteria, **and the statement that they are the entire scope**;
3. **the findings already adjudicated in this save**, each with what was decided about it.
   Fresh context must not mean a fresh opinion on a question already answered — without this
   ledger every pass re-draws the same boundary in a new place, and the sequence has no end;
4. **which pass this is, and the budget.** Pass 2 is told that it is the last one before the
   user is asked, and that its object is the repairs of pass 1 and what those repairs
   introduced.

If the `Agent` tool is unavailable or the pass fails to launch, run it yourself, inline. The
criteria do not change, and **the gate is never skipped or delayed**. Print one line:

```
WARN [coherence] fresh-context pass unavailable — running inline
```

## When it fails

- All five criteria met → continue, confirm the save.
- **Zero blocking findings → the gate passes**, even with material or cosmetic findings left
  over. Record them and continue: a research is not required to be free of every
  imperfection, it is required not to lie.
- Blocking findings after pass 1 → repair the batch, run pass 2.
- Blocking findings after pass 2 → stop, ask the user, record the remainder as above.
- Evidence insufficient to decide → record it as an `OQ-<n>` in `## Active Summary`. This
  does not spend a pass.
- A durable file cannot be read → this is a **failure of the gate**, not a reason to skip it.
  Report it and hold the confirmation.
