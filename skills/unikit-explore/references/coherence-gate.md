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
5. **One fact, one owning section.** A fact stated twice is a discrepancy *even when the two
   statements agree*: the second one is obliged to be a reference by ID, not a retelling.
   Two agreeing copies are not a coherent research — they are a research that has not yet
   contradicted itself.

Criteria 2 and 3 are the substance of the gate, and they are deliberately mechanical:
resolving a reference either succeeds or fails, whereas comparing two prose retellings of the
same fact has no terminating condition. That is why the pass now converges.

Each mismatch quotes **verbatim, both sides** — the affected claim and the conflicting or
qualifying passage, each with the section it came from. A bare assertion is not a finding.
This is what keeps the gate from becoming a formality: quoting both sides is work that cannot
be faked by asserting a pass, and it makes an empty report an honest result rather than a
shrug.

## The procedure

1. Correct or qualify every mismatch found.
2. Where the evidence is insufficient to decide, record it as an `OQ-<n>` in
   `## Active Summary` of `RESEARCH.md` — the home of the `OQ-` prefix — rather than
   resolving it by assertion.
3. Re-run the gate.
4. Confirm the save to the user **only after it passes**.

## Delegation

Give the read-only pass to a fresh context: the `check-agent` alias, handed nothing
but the durable file paths and the criteria above. Fresh context is the point — the session
that wrote the files is the one that cannot tell what they leave unsaid.

If the `Agent` tool is unavailable or the pass fails to launch, run it yourself, inline. The
criteria do not change, and **the gate is never skipped or delayed**. Print one line:

```
WARN [coherence] fresh-context pass unavailable — running inline
```

## When it fails

- All five criteria met → continue, confirm the save.
- A mismatch found → correct or qualify it, re-run; do not confirm until it passes.
- Evidence insufficient → record it as an `OQ-<n>` in `## Active Summary`, re-run.
- A durable file cannot be read → this is a **failure of the gate**, not a reason to skip it.
  Report it and hold the confirmation.
