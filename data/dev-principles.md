# Engine Development Principles

This file is the canonical source of {{engine_name}} development principles. Installed by `unikit-ai init` / `unikit-ai update` into `.unikit/system/dev-principles.md` with `{{engine_*}}` vars substituted. Loaded by `/unikit-implement`, `/unikit-fix`, `/unikit-verify`, `/unikit-improve`, `/unikit-devcontext`.

**How to read it.** Everything **above** the LAZY-READ BOUNDARY is read on **every** Bootstrap. Everything **below** it is read **once per session**, on the first Editor task — unconditionally, never gated on which rules happen to be installed.

---

## Layer A — the evidence contract

Nothing here names a tool. Tool names live in the live catalog and in the `evidence` field of project notes; a name written anywhere else is a name that will be wrong.

### A1. CLAIM / EVIDENCE / VERDICT

Every report of completed work is a **claim**. A claim carried by no observation is not a weak claim — it is not a claim.

```
CLAIM:     what you say happened
EVIDENCE:  what you observed, raw
VERDICT:   CONFIRMED | NOT CONFIRMED
```

The verdict is **binary**. There is no "mostly", no "should be", no "partially". The verdict is **NOT CONFIRMED** whenever the evidence is:

| defect | meaning |
|---|---|
| **absent** | nothing was observed after the change |
| **ambiguous** | the same observation is equally consistent with the failure |
| **collapsed** | a count or a summary stands where the changed value was asked for |
| **contradictory** | two readings of the same state disagree |

### A2. Claim class → evidence class

| you claimed | the only evidence that closes it |
|---|---|
| a field or property changed | read that field back after the write |
| a parameter took effect | read back the **consequence** of the parameter, not the operation |
| the code compiles | diagnostics with coordinates, taken after the editor re-read the file |
| the behaviour is correct | a run — a test with a readable result, or a deterministic behaviour run |
| it looks right | a frame |
| nothing else changed | a marker before, a delta after |
| the change is undone | read the state back **after** the undo |
| the thing exists in the project | read it from the project, not from a catalog and not from memory |
| the operation covered every item | enumerate what was skipped, yourself |

The lattice is one-way. A stronger evidence class closes a weaker claim; a weaker one never closes a stronger one. When a claim class has **no reachable evidence class**, the verdict is NOT CONFIRMED — say so and stop. Substituting a cheaper observation is how a silent failure becomes a green report.

### A3. The nine failure classes

`false success` · `eaten parameter` · `catalog phantom` · `lying validator` · `fake rollback` · `transport ambiguity` · `opaque aggregate` · `stale read` · `destructive default`

The detectors are below the LAZY-READ BOUNDARY. The names are here because recognising the shape is what makes you go look them up.

### A4. Discipline

- **Read-back.** A response code is not evidence. `success` is not evidence. The evidence is the changed value, read back.
- **Retry guard.** Never retry a non-idempotent call on an ambiguous answer. Re-read the state instead, and decide from what you read.
- **Minimal scope.** Ask for the narrowest thing that closes the claim. A wide call buys a wide answer you then have to disprove.
- **Compression asymmetry.** A summarising answer is allowed to hide; an enumerating answer is not allowed to invent. Prefer the enumerating read. When only a summary exists, treat it as collapsed evidence, not as proof.
- **Transport signals are disqualified.** Timeouts, resets, "queued", "accepted", request identifiers — none of them say whether the world changed. On a transport signal the state is unknown until re-read.

### A5. Phase order

```
code → compilation → editor → wiring → apply → verify
```

A phase is entered only after the previous one is CONFIRMED. Working out of order does not save time — it hides which phase failed.

### A6. Lane

**One executor per editor instance.** Two executors touching one editor produce a corrupted state, not a race you can retry.

Asynchronous job calls **do not hold the lane**: a call that returns a handle and completes later frees the lane immediately, and its result is a separate claim closed by its own read-back.

### A7. Stop-conditions

A stop-condition is a **fact about the world**, not an action of the agent.

| is a stop-condition | is not |
|---|---|
| the editor is not running | I did not try |
| the file does not exist | I am not sure |
| the project has no such type | there are no rules for this |

On a stop-condition: report it as a fact, name the observation that established it, and stop. Do not route around it silently.

### A8. Vocabularies

**`kind` — 6.** The intent vocabulary; it resolves into the plan and never rots.

```
scene · ui · vfx · anim · asset · settings
```

There is no seventh. Input configuration is `asset` when it is a text or config file, `scene` when it is a component holding a reference, and plain code otherwise.

**Serialized state is the boundary.** A change is *editor work* — and therefore carries a `kind` — **if and only if** it touches the editor's **serialized state**. A plain text or config file is not editor work, whatever it happens to configure. This one line is the criterion `/unikit-plan` uses to decide whether a task gets an `Editor:` field, and the criterion the executors use to choose between a direct write and the engine MCP.

**Areas — 12.** The key of every check table.

```
by work kind   ui · scene · asset · anim · vfx · settings
cross-cutting  rollback · console · batch · compile · transport · visual
```

An area must survive an engine change: everything engine- or server-specific goes into the **text** of the check, never into the key. Reading rule — kind areas are read by grepping your own `kind` from the task; cross-cutting areas are read always.

### A9. No rules ≠ no rights

The absence of a rules file is not a restriction.

- A missing `INDEX.md` does not switch anything to `⏸️ MANUAL` and does not disable the engine MCP. It means there are no known exceptions, not that there are no capabilities.
- Rules only ever **add** checks. No rule may remove an obligation, pre-declare a gate as lifted, list what a server cannot do, or say "use Y instead of X".
- `⏸️ MANUAL` is for exactly one situation: **there is no route** — the affordance is absent and the fallback is exhausted. Not "no rules", not "unsure", not "the server is weak".
- An honest refusal beats a guessed neighbour. Never call a name you have not seen in the live catalog because it resembles the one you wanted. The full ladder is below the boundary.

### A10. Which rule file is read, and how

| file | who reads it | how |
|---|---|---|
| `.unikit/system/engine-mcp/INDEX.md` — the base section | everyone using the engine MCP | in full, once, at Bootstrap |
| `.unikit/system/engine-mcp/INDEX.md` — the check table | implement · fix · devcontext · verify | by grep: your `kind`'s area plus every cross-cutting area |
| `.unikit/system/engine-mcp/verification.md` | `/unikit-verify` **only** | in full |
| `.unikit/MCP-RECHECK-NOTES.md` | implement · fix · devcontext · verify | by grep, the same areas |

A file that is absent is skipped **silently** — see A9.

---

## Engine workflow

1. **Source files vs editor state.** Write source files (`{{engine_code_language}}` sources, configs, plain text) **directly** through Read / Edit / Write — MCP server `{{engine_mcp_tool}}` is not the tool for that. For **editor-side work** — scenes, prefabs, components, assets, materials, UI, VFX, animation — MCP server `{{engine_mcp_tool}}` is the **preferred** path, but the choice stays yours. Which of the two a change is, is decided by one criterion and one only: **serialized state is the boundary** (A8).

2. **Confirm by reading, not by the response code.** After every write — a source file or editor state alike — read the changed thing back. `success` is not evidence; the evidence is the read-back of what you claimed to change (A1, A2).

3. **A written source is not a re-read source.** Claiming "the source is written and clean on diagnostics" requires the evidence to be taken **after the editor has confirmably re-read the file**. Diagnostics gathered over a file the editor has not re-read describe the previous state — that is `stale read` wearing the mask of `lying validator`, and it reports green.

4. **Preview before applying; ask for the schema instead of recalling it.** Any change you cannot cheaply undo is previewed first; where no built-in preview exists, assemble one out of state reads — build the preview, do not enumerate what is missing. Argument shapes come from the server at run time, never from memory and never from vendor documentation.

5. **Tests.** Create unit tests for all functionality, and run them where the server can report results. If `.unikit/system/engine-mcp/verification.md` marks the tests gate **GATE LIFTED** for the configured server, that overrides the run-through-MCP part of this rule — the requirement to *have* tests stands, only the way to execute them changes. `GATE LIFTED` is a **runtime verdict of `/unikit-verify`**: it is established by trying, finding no affordance, and presenting the evidence of absence. It is never pre-written into a rules file. File absent, or this skill does not read it → the base rule applies.

6. **The engine MCP talks to a running editor.** The editor being unavailable is a stop-condition (A7), not the absence of a capability: report the fact with the observation that established it, and stop. Do not conclude from an unreachable editor that the capability does not exist.

## Code conventions

1. Write clear, concise, well-documented {{engine_code_language}} code adhering to {{engine_name}} best practices
2. Prioritize performance, scalability, and maintainability in all decisions
3. Leverage the engine's component-based architecture for modularity and efficiency
4. Implement robust error handling, logging, and debugging practices
5. Consider cross-platform deployment and optimize for various hardware
6. NEVER write inline comments in code
7. ALWAYS update documentation after editing methods
8. When you add a `// TODO:` comment in code, also run `/unikit-todo` with the TODO description translated to the language from `.unikit/config.yaml` (`language.artifacts`). The TODO comment in code stays in English (code convention), but the task description is written in the project's configured language
9. Respond in the configured language — use `language.ui` from `.unikit/config.yaml` (default: English)

---

<!-- === LAZY-READ BOUNDARY === -->

## Deep reference — read once, on the first Editor task

Read this section **unconditionally** the first time a session touches editor state, and do not read it again. It is **never** gated on the installed rules: a profile that marks some classes live only shifts your emphasis, it never narrows what you read here. Otherwise the universal safety net disappears exactly where no rules exist — a direct violation of A9.

### D1. The nine failure classes — detectors

| class | how it presents | detector |
|---|---|---|
| `false success` | the call reports done, the state is unchanged | read back the changed field |
| `eaten parameter` | the call succeeds, one argument was ignored | read back the **consequence of the parameter**, not the operation |
| `catalog phantom` | the catalog lists what is not actually callable — or is silent about what is | the catalog is a hypothesis; the first call **is** the test. It runs both ways: absence from the catalog is not absence of the capability, and the same call settles that direction too |
| `lying validator` | a checker reports clean over a broken state | a validator is not evidence; close the claim with an independent gate |
| `fake rollback` | undo reports done, the state stays | read back **after** the undo; for anything that reached disk, only version control is a rollback |
| `transport ambiguity` | the answer says nothing about the world | re-read; **never** retry a non-idempotent call |
| `opaque aggregate` | a batch reports a total and hides what it skipped | enumerate the skipped items yourself |
| `stale read` | the read predates the change it is supposed to prove | evidence is the delta from a marker; demand a truncation flag and treat its absence as collapsed evidence |
| `destructive default` | an omitted argument means "everything" | anchor in version control before the phase; snapshot the state before the call |

Every detector is universal. A server profile may mark which classes are alive **on that server** — that changes what you check first, never whether the detector applies.

### D2. The catalog checklist — 13 questions

Ask the live catalog once per session. Each line is a **decision the pipeline makes**; if a line is not a pipeline decision, it does not belong here. Not one question names a tool — the answers have a shelf life of months ("is there a test run"), the names have a shelf life of days.

| decision | question to the catalog |
|---|---|
| can I do this at all | is there a way to do `<kind>` + `<action>` — the only domain-shaped line |
| can I prove I did it | reading state back |
| are these side effects mine | marker → delta |
| does the code build | compilation with coordinates |
| does it behave — by test | a test run with a readable result |
| does it behave — by observation | a deterministic behaviour run |
| can I show it | a frame |
| can I show it changed nothing | comparison against a baseline |
| can I undo it inside the editor | an editor-level undo |
| can I undo what reached disk | an undo that covers the file system |
| can I fail cheaply | a check that runs before the write |
| can I avoid a full re-read | a fingerprint or a diff |
| is there a way out of a dead end | executing engine code |

### D3. The degradation ladder

When the intended route is unavailable, descend one rung at a time and stop at the first that yields evidence:

1. **Another route you can see.** A different affordance in the live catalog that closes the same claim class (A2).
2. **By hand.** `⏸️ MANUAL` — describe the editor action precisely enough for a human to perform and for you to verify afterwards. Only when the affordance is genuinely absent and the fallback is exhausted (A9).
3. **An honest refusal.** Report NOT CONFIRMED, naming the observation that closed the route.

Never, at any rung:

- guess a name because it resembles the one you wanted — an unseen name is not a route, it is a `catalog phantom` you invented;
- retry a non-idempotent call to see whether it works this time;
- report a claim with no evidence and let the next phase discover it;
- quietly downgrade the claim to the one thing you *can* prove and report **that** as the result.

### D4. Group calls, and the economics of reads

The read economy and the evidence discipline of a group are already written down: **A4** (minimal
scope, compression asymmetry, read-back) and **D1**/**D2** (the `opaque aggregate` detector, and
the question about avoiding a full re-read). What follows is only what does not reduce to them;
the server's own half of the rule is the `batch-1` row of the check table in the engine-MCP `INDEX.md`.

- **Group two or more compatible actions, never one.** A group of one is a call with a wrapper around it: it costs the same and it buys an aggregate report where a direct answer was available.
- **A group is a list, not a script.** There are no references between its elements. Order does not carry a result from one element to the next, and an element that needs the outcome of another is a second call, not a later line in the same one.
- **Runs, frames and waits go as separate calls.** Each has an execution discipline of its own — a duration, a lane, a result read on its own terms — and a group flattens all three into a single summary.
- **Validation and mutation are two calls.** Merged into one they give either a mutation nothing checked or a check that executed nothing, and the report cannot tell you which of the two you got.

### D5. Derived handles

An index, a cursor or an identifier you were handed **before** a change does not survive
that change. After a mutation it may address a different thing, a thing that no longer
exists, or a thing of a different kind altogether — and none of those three announce
themselves: the handle is still well-formed, and the call that uses it still returns.

- **Re-derive, do not carry.** A handle is valid for the state it was read from. Once you
  have written, read the handle again from the new state before you use it.
- **A handle handed back by a creating call is not exempt.** It names what the call decided
  to name, which is not always the thing you asked to be created; confirm what it addresses
  before you build the next step on it.
- **Positional handles are the least durable of all.** An offset into an ordered collection
  moves when anything before it is added or removed, and nothing in the answer reports that
  the collection was reordered.
