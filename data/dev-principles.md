# Engine Development Principles

This file is the canonical source of {{engine_name}} development principles. Installed by `unikit-ai init` / `unikit-ai update` into `.unikit/system/dev-principles.md` with `{{engine_*}}` vars substituted. Loaded by `/unikit-implement`, `/unikit-fix`, `/unikit-verify`, `/unikit-improve`, `/unikit-devcontext`, `/unikit-bridge-audit`, and by the `unikit-implement-coordinator` and `unikit-implement-worker` agents.

**How to read it.** Everything **above** the LAZY-READ BOUNDARY marker is read on **every** Bootstrap — a reader finds the marker's line and reads the file only up to it. Everything **below** it is read **once per session**: at plan load when the plan's checklist carries an `Editor:` line, and otherwise at the first task that touches editor state — unconditionally, never gated on which rules happen to be installed.

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

**The unit is the executor, not the call, and a live run session is narrower than either.** Concurrent calls issued inside one lane are governed by the server's own contract and never lift the lane; one server has been measured carrying three at once with no corruption, and that says nothing about a second executor. A run session, where one exists, is single across the machine — hold it as such, and establish what a second attempt does by trying rather than by assuming.

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

**Serialized state is the boundary.** A change is *editor work* — and therefore carries a `kind` — **if and only if** it touches the editor's **serialized state**. A plain text or config file is not editor work, whatever it happens to configure. This one line is the criterion `/unikit-plan` uses to decide whether a task gets an `Editor:` field, and the criterion the executors use to choose between a direct write and an engine bridge.

**Areas — 12.** The key of every check table.

```
by work kind   ui · scene · asset · anim · vfx · settings
cross-cutting  rollback · console · batch · compile · transport · visual
```

An area must survive an engine change: everything engine- or server-specific goes into the **text** of the check, never into the key. Reading rule — kind areas are read by grepping your own `kind` from the task; cross-cutting areas are read always.

### A9. No rules ≠ no rights

The absence of a rules file is not a restriction.

- A missing `INDEX.md` does not switch anything to `⏸️ MANUAL` and does not disable an engine bridge. It means there are no known exceptions, not that there are no capabilities.
- Rules only ever **add** checks. No rule may remove an obligation, pre-declare a gate as lifted, list what a server cannot do, or say "use Y instead of X".
- `⏸️ MANUAL` is for exactly one situation: **there is no route** — the affordance is absent and the fallback is exhausted. Not "no rules", not "unsure", not "the server is weak".
- An honest refusal beats a guessed neighbour. Never call a name you have not seen in the live catalog because it resembles the one you wanted; a name read in the collected documentation of a bridge is a hypothesis, and the first call is its test (D6). The full ladder is below the boundary.

### A10. Which rule file is read, and how

| file | who reads it | how |
|---|---|---|
| `.unikit/system/engine-bridges/<bridge>/INDEX.md` — the base section | everyone using an engine bridge | in full, once, at Bootstrap |
| `.unikit/system/engine-bridges/<bridge>/INDEX.md` — the check table | implement · fix · devcontext · verify | by grep: your `kind`'s area plus every cross-cutting area |
| `.unikit/system/engine-bridges/<bridge>/verification.md` | `/unikit-verify` **only** | in full |
| `.unikit/bridge-notes/<bridge>.md` | implement · fix · devcontext · verify | by grep, the same areas |
| `.unikit/config.yaml` — the bridge order list | implement · fix · devcontext · verify · plan | with the rest of the config, once at Bootstrap |

A file that is absent is skipped: its reader prints one line and keeps every right it had — see A9.

---

## Engine workflow

1. **Source files vs editor state.** Write source files (`{{engine_code_language}}` sources, configs, plain text) **directly** through Read / Edit / Write — an engine bridge is not the tool for that. For **editor-side work** — scenes, prefabs, components, assets, materials, UI, VFX, animation — the engine bridges listed in `.unikit/system/engine-bridges/BRIDGES.md` are the **preferred** path, taken in the order D3 gives, but the choice stays yours. Which of the two a change is, is decided by one criterion and one only: **serialized state is the boundary** (A8).

2. **Confirm by reading, not by the response code.** After every write — a source file or editor state alike — read the changed thing back. `success` is not evidence; the evidence is the read-back of what you claimed to change (A1, A2).

3. **A written source is not a re-read source.** Claiming "the source is written and clean on diagnostics" requires the evidence to be taken **after the editor has confirmably re-read the file**. Diagnostics gathered over a file the editor has not re-read describe the previous state — that is `stale read` wearing the mask of `lying validator`, and it reports green.

4. **Preview before applying; ask for the schema instead of recalling it.** Any change you cannot cheaply undo is previewed first; where no built-in preview exists, assemble one out of state reads — build the preview, do not enumerate what is missing. Argument shapes come from the bridge at run time — the live schema of the call you chose — never from memory and never from vendor documentation.

5. **Tests.** Write unit tests for the logic and the system values the code owns, and run them where the server can report results. What a test may pin follows who owns the thing:

   - **Logic and system values** — calculations, state transitions, parsing and serialization, contracts between modules; identifiers, keys, serialized field names, format versions, protocol constants. Test exact outcomes on inputs the test supplies. Pin one key, id or field name exactly; never pin a total or a full set that grows with content (catalog rows, schema sheets, fields, enemies, golden files, word lists) — assert the invariant ("every X has a Y", "ids are unique", "no key outside the list") and take the expected value from the fixture's own data.
   - **Tunable data** — whatever game design owns: balance, costs, durations, probabilities, curves, config entries, in whatever format they are stored. A live number is never written into a test. Logic is tested on values the test sets itself. Live data gets at most one aggregate validity check per data family — range, order, required keys, uniqueness, references resolve — with bounds taken from the design source (a knob's range, a "Safe range", an acceptance criterion) or from limits in the code, never from today's number. Where design numbers must be pinned (a port, a migration), they live in one marked passport fixture that is allowed to go red.
   - **Authored content** — prefabs, scenes, materials, shaders, animation, VFX, UI layouts, and shader sources, UI markup, art and audio files: no unit test; the evidence is a frame or a read-back (A2). The one exception is a single aggregate test for a defect class that was actually found.
   - **Lookup by name** — the code finds an object, node or tag by a string: at most one aggregate reference check per module, or fail fast at load; never one test per constant.

   Everything else — the engine and its frameworks, trivial accessors, generated code — gets no tests. **Smell check:** if a designer changing a number, or a new catalog row, field or enemy, turns a test red while the system is intact, the test is pinned to a tunable value or to a growing list — rewrite it as bounds or an invariant, or take the expected value from the fixture.

   If the tests gate is **GATE LIFTED** — a verdict `/unikit-verify` reaches only after it tried the gate on every bridge that was available — that overrides the run-through-a-bridge part of this rule: the requirement to *have* tests stands, only the way to execute them changes. `GATE LIFTED` is a **runtime verdict of `/unikit-verify`**: it is established by trying, finding no affordance, and presenting the evidence of absence. It is never pre-written into a rules file. No bridge available, or this skill does not read the calibration → the base rule applies.

5a. **Tests follow acceptance.** A result you have handed over — a phase, a plan, a fix — is under review while the user looks at it and answers with edits. The review loop is defined by that state, not by the kind of edit: visuals, feel, layout, tuning and code changes all wait alike. Inside the loop make the edit and compile; for a visual or data edit also take the read-back or the frame (A2). Write no new test and run no suite. Say `INFO [testing] review loop: tests deferred until you accept` once, at the first edit of the loop, and do not repeat it.

   *Accepted* means the user's own words — "accepted", "ok, next", "write the tests"; silence is never acceptance, and calling `/unikit-verify` or `/unikit-commit` is not acceptance either. On acceptance, unless the plan says `Testing: no`: write the tests once, for the final form of the logic changed since the last commit (found with git, no ledger), by the classes of item 5, and run the suite once — in a plan with `Testing: yes` and a manifest, record that run like a test checkpoint so that `/unikit-verify` does not ask to repeat it; otherwise one run without a record. An explicit "write the tests now" overrides the loop; after a loop closed by a commit without acceptance, such a request takes the logic from the `INFO` line and from the diff of the closing commit; a plan with `Testing: no` is outside the loop (an explicit request to write tests is still an instruction).

   The loop closes when the next message is not an answer to the handed-over result but a new request — a command of another skill, `/unikit-verify` and `/unikit-commit` included, or a new feature; `/unikit-fix` on a defect of the handed-over result is an answer and stays inside the loop. Closing without acceptance writes and runs nothing, but names what is left in one line: `INFO [testing] review loop closed without acceptance: no tests written for <changed logic>`. In doubt, stay in the loop: deferring is reversible.

6. **An engine bridge talks to a running editor.** The editor being unavailable is a stop-condition (A7), not the absence of a capability: report the fact with the observation that established it, and stop. Do not conclude from an unreachable editor that the capability does not exist. A bridge that does not answer while the editor does is another fact — see the cross-bridge rules in D3.

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

## Deep reference — read once per session, when the work touches editor state

Read this section **unconditionally**, once per session — at plan load when the plan's checklist carries an `Editor:` line, or otherwise the first time the session touches editor state — and do not read it again. It is **never** gated on the installed rules: a profile that marks some classes live only shifts your emphasis, it never narrows what you read here. Otherwise the universal safety net disappears exactly where no rules exist — a direct violation of A9.

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

Ask the live catalog of **each bridge in play** once per session — for a bridge of kind cli by the forms of its block in `BRIDGES.md`, from the narrow to the wide as D6 step 1 says (a word, then the tags, then the groups), never the whole catalog at once. Each line is a **decision the pipeline makes**; if a line is not a pipeline decision, it does not belong here. Not one question names a tool — the answers have a shelf life of months ("is there a test run"), the names have a shelf life of days.

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

### D3. The route ladder

For every check, take the route in this order and stop at the first that yields evidence of the class the claim needs (A2).

**The order of the bridges.** Bridges are tried in the order the user set in the bridge order list of `.unikit/config.yaml`, restricted to the bridges `BRIDGES.md` lists; the listed bridges that list does not name follow in the default order `BRIDGES.md` states. A name in the list that `BRIDGES.md` does not list is skipped silently. No list, or an empty one, means the default order. An instruction from the user in this session ("only the second bridge", "leave the CLI out") beats the order.

1. **A dedicated route, bridge by bridge.** In the live catalog of each bridge, in that order, an affordance whose answer closes the claim class (A2) — chosen by the evidence class it gives, never by a name that looks right. The first bridge that has one wins; a dedicated route in the second bridge beats a code snippet in the first.
2. **Engine code, bridge by bridge.** Only when no bridge has a dedicated route: executing engine code through the first bridge that offers it (D2, last row). A snippet has no schema and no read-back of its own, so the claim is closed by a separate read-back.
3. **By hand.** `⏸️ MANUAL` — describe the editor action precisely enough for a human to perform and for you to verify afterwards. Only when the affordance is genuinely absent on every bridge and the fallback is exhausted (A9).
4. **An honest refusal.** Report NOT CONFIRMED, naming the observation that closed the route.

Never, at any rung:

- guess a name because it resembles the one you wanted — an unseen name is not a route, it is a `catalog phantom` you invented;
- retry a non-idempotent call to see whether it works this time;
- report a claim with no evidence and let the next phase discover it;
- quietly downgrade the claim to the one thing you *can* prove and report **that** as the result.

**Across bridges.**

- **A marker and its delta come from one bridge.** Take the marker before the change and the delta after it through the same bridge, and choose that bridge at the start of the phase: the marker of one bridge does not bound a read through another (`stale read`).
- **Handles do not cross bridges.** Of everything a bridge handed you, only the engine's own identifier — an asset path, a GUID — may be used through another bridge (D5).
- **A read-back through another bridge is allowed, and stronger.** A bridge that checks its own write is a dependent detector; another bridge reading the same state is independent (`lying validator`).
- **A domain reload closes every bridge.** A reload caused through one bridge makes all of them unavailable until the editor is ready again; wait for it - by the `ready` row of the bridge's block when it has one - and do not read the other bridge as a way around it. An answer of "no editor found" that arrives right after a compile or a play-mode change is this wait, not a missing editor: repeat once after the editor is ready before you call it unavailable.
- **A bridge that does not answer stops itself, not the editor.** Rule out the sandbox and Safe Mode first (A7), mark that bridge unavailable until the editor is ready again, go on to the next bridge without asking the user, and put one line about it into the report. When no bridge answers, the editor is unavailable: a stop-condition (A7).
- **Suspected Safe Mode: try each bridge.** Compile errors make Safe Mode likely; the availability of every bridge is then established by trying, a bridge that fails stops only itself, and the project files and the editor log remain a route.
- **A mixed phase is rolled back by reading back through each bridge that wrote.** Undo stacks differ; the undo of one bridge does not reach the writes of another (`fake rollback`).
- **The lane (A6) is per editor instance, not per bridge.** Two bridges of one executor do not widen it.

### D4. Group calls, and the economics of reads

The read economy and the evidence discipline of a group are already written down: **A4** (minimal
scope, compression asymmetry, read-back) and **D1**/**D2** (the `opaque aggregate` detector, and
the question about avoiding a full re-read). What follows is only what does not reduce to them;
the server's own half of the rule is the `batch-1` row of the check table in the `INDEX.md` of the bridge you call.

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

### D6. Carrying out an editor change through an engine bridge

The procedure every executor follows when a change to the editor's serialized state (A8) goes through an engine bridge — an `Editor:` task under `Editor tasks: engine-bridge`, a fix that touches editor state, a target verified by reading the editor back. In this order, on **every** such change:

1. **Candidates from the live catalog, by intent — from the narrow to the wide.** Choose the bridge by D3. Take the change's area — for an `Editor:` task, the one its `kind` names — and its action, and look for candidate affordances in what that bridge lists *now*. For a bridge of kind mcp that is the client's tool list. For a bridge of kind cli take these steps, in this order, and stop at the first that gives a short list to judge (a handful, not dozens); a step that finds nothing, or too many, is followed by the next:
   1. **a word** from the task, by the `catalog search` row of the bridge's block;
   2. **the tags** — the list of tags (the `catalog tags` row), then the commands of one tag out of that list (the `catalog tag` row);
   3. **the groups** — the list of groups (the `catalog groups` row), then the commands of one group out of that list (the `catalog group` row).

   A tag or a group is taken from the list you have just read — never from memory, from this file or from the documentation of the bridge: a value that is not in the list answers with an empty result and no error, and an empty answer means *nothing found here*, not a failed call. The whole catalog is never read. Print one line for every step you take — `INFO [bridge-search] <bridge>: <word|tag|group> "<value>" -> <n> commands` (for the tool list of a bridge of kind mcp: `INFO [bridge-search] <bridge>: tool list, word "<value>" -> <n> tools`). That live list is the only place a name may come from — not this file, not a rules file, not memory. A name read in the collected documentation of the bridge (D8) is a hypothesis: it becomes a candidate only after a call has proved it.
2. **Ask the bridge for the schema** of the 1-3 candidates you keep, before calling any of them — always, whatever the documentation says: the declaration the client holds for a bridge of kind mcp, the `schema of one command` row of its block for a bridge of kind cli. A one-line or empty declaration does not mean "no parameters". Then, when the verdict of D8 for this bridge is `current`, read what the collected documentation says about the command you chose (D8).
3. **Grep by area.** Read the `## Check` table of that bridge's `INDEX.md` and of its notes file `.unikit/bridge-notes/<bridge>.md`, filtered to the change's own area **plus every cross-cutting area**: `rollback · console · batch · compile · transport · visual`. The cross-cutting six are read **always**: the lines are short, and the moment one becomes applicable is not knowable in advance.
4. **Execute, then read the changed state back** — through the same bridge or, stronger, through another one (D3). Before the call print the choice: `INFO [bridge-search] <target>: <bridge> -> <command> (found by <word|tag|group|tool list>; schema read; documentation <read|not read>)`. Close the claim with the evidence class its claim class requires (A2). A response code is not evidence; the evidence is the read-back of what you claimed to change. Name the bridge of the call and of the read-back in your report.

**No candidate in this bridge** — every step of step 1 ended at 0, or nothing it found fits — **goes on to the next bridge**: take the next bridge by D3 and repeat steps 1-3 there. Only when no bridge has a candidate: engine code (D3, rung 2), then by hand, then refusal — and only then print `WARN [bridge-search] <target>: no bridge offers a route - engine code, then by hand`.

**No rules file, or no check line for this area → nothing changes.** Every right you had, you keep (A9). `⏸️ MANUAL` is reached only by trying, finding no route at all on any bridge, and having the evidence of that absence to show (D3).

### D7. A call that misled you — the finding

A call whose answer misled you is a **finding**, and it goes in two places, neither of them the notes file:

- your own report — the run, fix or verification report — as a candidate line: the `area`, what has to be confirmed, and the raw call with the raw answer it gave;
- the plan's `## Engine Bridge Findings` table, when you work against a plan — the half that survives the session.

**When: at the change that produced it, never at the end of the run** — in the same `Edit` that ticks the task's checkbox, or, where nothing is ticked, on finishing the step or the target that produced it. A table filled only at the end is lost to every `/clear`, every context overflow and every session that simply stops.

The row:

- **id** `F<n>`, one more than the highest already in the table — read the table before appending, so a re-run does not restart the numbering and collide with rows written earlier;
- **`bridge`** — the id of the bridge the call went through, as `BRIDGES.md` lists it; `—` when you cannot tell. It decides which bridge's notes the row ends up in;
- **`observed`** — the date you observed it, taken from the system clock, never recalled: the `unikit-bridge-trap` skill copies the column verbatim, so an empty or recalled date makes the notes record the transfer instead of the observation;
- **dedup is semantic, not mechanical** — drop a candidate that says the same thing about the same `area` as a row already there, judged by meaning rather than by string match. Being loose is deliberate: a duplicate that slips through costs one line, a wrong merge destroys the `evidence` of an observation, and evidence cannot be reconstructed;
- the columns and their contract: `unikit-plan/references/TASK-FORMAT.md` → `### Engine bridge findings section`.

**Never write `.unikit/bridge-notes/<bridge>.md` yourself.** One observation is a bad sample and a bad line lives for months; the durable surface passes through a human running the `unikit-bridge-trap` skill.

### D8. The library reference

Two sources, in this order, for the bridge you are calling. **Never at Bootstrap.**

1. **The collected documentation of the bridge** — the copy under `.unikit/references/bridges/<bridge>/`, written by `/unikit-bridge-docs` for the installed versions. Its `INDEX.md` lists the folders of the copy and the versions it was taken from; its `FILES.md` lists every file with its size and a caption and is searched for a word, never read whole. Read the heading lines of the file you need (grep the lines that start with `#`), then the section by line numbers: the copies run to hundreds of kilobytes and are never read whole. A name taken from the copy is a hypothesis (D6).
   - **The version check — once per session, at the first task that touches the editor, for each bridge in play.** Compare the `versions` line of the bridge's `INDEX.md` with what the `probe version` and `probe package` rows of its block in `BRIDGES.md` answer: they agree → `current`; they differ → `older`; there is no copy → `none`; a bridge with no probe row is never `older`. Put one line into your report: `Docs: <bridge> - current`, `Docs: <bridge> - older (copy: <its versions line>; installed: <the answers>) - run /unikit-bridge-docs to refresh it`, or `Docs: <bridge> - none collected`. A copy older than the installed versions is **still used**; the line is the notice, and it is given once per session.
   - **The section about the command you chose.** After D6 step 2 has chosen the command, and when the verdict is `current`, search the copy for that command's name and read the section about it. It answers *how* to call the command, never *whether* it exists: the live catalog and the live schema decide that.
2. **The documentation library** the bridge's block in `BRIDGES.md` names (its `context7` row). **Only a reader granted that server reaches for it**; for every other reader of this file the library is inert — the same as an unconfigured reference (below).

Beyond the section about the command you chose, reach for either source on exactly two occasions:

1. **an unfamiliar area** — what approaches the authors propose; once per area per session;
2. **a dead end** — you hold the schema and the capability still is not there.

With a collected copy present, the library is for the dead end only. Without one, it serves the unfamiliar area (once per area per session) and the dead end.

**Never routinely.** The library is a network dependency inside the editor lane, a few thousand tokens per query, and it makes the run irreproducible; retrieval returns what is most relevant, and a caveat is almost never the most relevant answer to "how do I do this".

**Say when you reached for either, and why** — one line into your report, at the moment of the call:

```
Reference: trigger <1|2> — <the area, or the dead end>
```

**How the answer is treated.** The reference describes **intent, not behaviour**: anything taken from it carries the same evidence obligations as anything else, with heightened attention — it has been caught presenting a structurally broken path as an exemplary example. It never closes a claim; only an observation does (A2).

**The reference is optional in the wizard.** A bridge with no collected copy and no library id has no reference: trigger 2 simply has no fallback — descend the route ladder (D3) and reach `⏸️ MANUAL` at its proper rung only, by absence of a route, established by trying. An unconfigured reference is not itself a missing capability.
