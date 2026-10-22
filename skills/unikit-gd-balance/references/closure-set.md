# The closing set and the closing rule

The single definition of what a balance document must answer, and of when it is closed. The
interview of the open branch asks Q1–Q5 first; the rest are filled as points return data. Every question of the table is asked with the question tool of your agent (`AskUserQuestion`): its options are the likely answers drawn from the investigation and from what the document already holds, the recommended one first, and the user writes their own answer in the free-text answer.

| Q | Question |
|---|----------|
| Q1 | The goal and the kind of balance; the audience and its skill level; what "balanced" means here |
| Q2 | The subject: units, roles; levers that are pinned and levers that are free |
| Q3 | The reference resource, the reference curve, the band (its own or borrowed — marked) |
| Q4 | Measurement: metrics; what can be obtained now and what needs a tool; what is frozen by a constant; the sample; the known-answer check |
| Q5 | Diagnosis by layer (access / issue → value of choices → numbers → situation / geometry → meta), with the level of proof |
| Q6 | Levers and variants, with the cost of change and side effects; one recommended |
| Q7 | Experiments: baseline, variants, the switching channel, acceptance bands |
| Q8 | Use of references: what is portable, what is incidental; another game's numbers are not cloned without identity of systems |
| Q9 | The roadmap: points, dependencies by data, the critical path |
| Q10 | The register of the unverified and of conflicts |
| Q11 | Out of scope |

Every answer carries a tag — `measured` · `extracted from code` · `decided by user` ·
`estimate` · `from playtest` — or an explicit deferral with an owner.

## Closing rule

`Status: closed` is set when all three hold at once: `Current: none`; the `## Roadmap` has no
`planned` and no `current` rows (every point is `done` or `dropped`; a leftover `planned` row is
dropped by the user's decision, with a log entry); Q1–Q5 and Q9–Q10 are closed or deferred with
an owner. Q6–Q8 and Q11 may stay open — they are listed in `BALANCE.md`.

**Softness.** Nothing unclosed blocks anything — neither issuing points nor saving. A question
is either closed or deferred with an owner, and deferring is always available, so the rule above
never stands in the user's way: when the user closes a document, any of Q1–Q5 and Q9–Q10 still
open is written as deferred with the owner `user` (in the log and in `## Closing set` of
`BALANCE.md`), the user is told so in one line, and closing is never refused.

**Reopening.** A new point in a closed document (the revise branch) turns it back to `open`.
