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

- `RESEARCH_RESULT.md` and `RESEARCH_BRIEF.md`;
- in ultra, additionally every file listed in `## Artifact Index`.

**Chat history and unstored memory are not evidence.** That is the whole mechanism: the gate
checks what will survive the session, not what the session still remembers. Re-read the files
even when you wrote them minutes ago — what you meant to write is not what is on disk.

## The four criteria

1. `RESEARCH_BRIEF.md` is understandable without the conversation that produced it.
2. It does not silently contradict the durable content of `RESEARCH_RESULT.md`; superseded
   conclusions are named as superseded, explicitly.
3. Claims distinguish source evidence from inference and from what remains unknown.
4. Each mismatch quotes **verbatim, both sides** — the affected claim in the brief and the
   conflicting or qualifying passage in the result. A bare assertion is not a finding.

Criterion 4 is what keeps the gate from becoming a formality: quoting both sides is work that
cannot be faked by asserting a pass, and it makes an empty report an honest result rather
than a shrug.

## The procedure

1. Correct or qualify every mismatch found.
2. Where the evidence is insufficient to decide, record it in `## Open Questions` of
   `RESEARCH_RESULT.md` — the home of the `OQ-<n>` prefix — rather than resolving it by
   assertion.
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

- All four criteria met → continue, confirm the save.
- A mismatch found → correct or qualify it, re-run; do not confirm until it passes.
- Evidence insufficient → record it in `## Open Questions`, re-run.
- A durable file cannot be read → this is a **failure of the gate**, not a reason to skip it.
  Report it and hold the confirmation.
