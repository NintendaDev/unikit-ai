# Scenarios, Routing & Diagnostics

This is the navigator's routing brain: how to turn a vague or mixed question into a single
intent and a concrete next step, plus worked examples and the fallback for the unknown.

---

## The diagnostic tree (no-args / "I'm lost")

When the user gives nothing concrete, ask **one** `AskUserQuestion` with four buckets (the
tool always adds a free-text "Other"):

```
"What are you trying to figure out right now?"
  1. Start / set up a project
  2. Write or test code
  3. Game design
  4. Which skill / how it fits
```

Then narrow with **at most one** follow-up:

- **1 Start** → Is the framework installed yet (`.unikit/config.yaml` present)?
  - no  → `/unikit` (one-time setup)
  - yes → "Do you have a game idea / GDD?" → no → `/unikit-gd-brainstorm`; yes → `/unikit-plan`
- **2 Code** → "Plan/implement a feature · test existing code · fix a bug?"
  - feature → `/unikit-explore` (if direction unclear) → `/unikit-plan` → `/unikit-implement`
  - test    → `/unikit-verify` (vs plan) and/or the test phase in `/unikit-implement`
  - bug     → `/unikit-fix` (deep/unknown bug → `/unikit-explore` first)
- **3 Game design** → "Decide what game · write the GDD · detail/revise a system · design/revise a flow · new mechanic · edit GAME.md?"
  - what game             → `/unikit-gd-brainstorm`
  - write GDD             → `/unikit-gd-spec`
  - detail/revise system  → `/unikit-gd-system`
  - design/revise a flow  → `/unikit-gd-flow`   (onboarding, session arc, pacing, funnel)
  - new mechanic          → `/unikit-gd-explore` (routes onward)
  - edit GAME.md content  → `/unikit-gd-spec`
- **4 Which skill** → read `skill-map.md`, answer the comparison directly.

Keep it to one question + one follow-up. Never fan out into a questionnaire.

---

## Routing table (question → intent → route)

| User says (any language) | Interpreted intent | Route | Clarify only if... |
|--------------------------|--------------------|-------|--------------------|
| "where do I start", "I'm new" | onboard | `.unikit/config.yaml` present? no→`/unikit`; yes→ask idea/GDD | framework installed? |
| "how do I start coding" | begin a feature | have a plan? yes→`/unikit-implement`; no→`/unikit-plan` | is there a plan / research? |
| "how do I plan a feature" | plan | `/unikit-plan [fast\|full] <feature>` | fast vs full (throwaway vs real) |
| "the plan looks rough / wrong" | refine plan | `/unikit-improve` (run 1-3x) | — |
| "how do I test my code" | verify/test | `/unikit-verify`; tests come from `/unikit-implement` test phase; failures→`/unikit-fix` | unit vs vs-plan vs manual (see QA note) |
| "fix this bug" / error pasted | bug | `/unikit-fix <bug>`; deep→`/unikit-explore` first | is it deep/unknown-location? |
| "review my code" | code review | `/unikit-review` → `/unikit-fix` | staged / PR / branch / file? |
| "did I finish everything" | completeness | `/unikit-verify [--strict]` | — |
| "commit this" | commit | `/unikit-commit` | — |
| "make the AI smarter from my fixes" | learn | `/unikit-evolve` | ≥3 patches accumulated? |
| "I don't know what game to make" | ideate concept | `/unikit-gd-brainstorm` | — |
| "how do I create the game design" | author GDD | `/unikit-gd-spec` (import? pass the file/URL) | from scratch or import? |
| "detail / spec out a system" | per-system GDD | `/unikit-gd-system <system>` | is the system on the map? |
| "find / invent a new mechanic" | design research | `/unikit-gd-explore <intent>` (routes onward) | genre, target emotion, constraints, refs |
| "improve / tune / rework a system" | design delta | `/unikit-gd-system <system> "<change>"` | tuning vs rework? |
| "design the flow / onboarding / pacing / player journey / funnel" | per-flow GDD (dynamics) | `/unikit-gd-flow <flow>` | create vs revise (inferred) |
| "retune the pacing / add a branch / rework the onboarding" | flow delta | `/unikit-gd-flow <flow> "<change>"` | tuning vs rework? |
| "is this design good / fun / balanced" | design review | `/unikit-gd-review <scope>` | single system or all? |
| "is the design consistent / what did this affect" | design check | `/unikit-gd-verify <scope>` | — |
| "add a rule" / "always do X" | capture convention | `/unikit-rules <rule>` | — |
| "make rules from this book/article/docs/PDF" | distil sources | `/unikit-memory <source(s)>` (`--module gamedesign` for design) | code or design knowledge? |
| "share my rules across projects" | registry | `/unikit-rules-registry create\|update\|sync` | local folder registry? |
| "the MCP said ok but nothing changed" / "the server lied" | record an MCP finding | `/unikit-mcp-trap [finding]`; curate later with `/unikit-mcp-audit` | is the observation already in this session? |
| "are these MCP findings still true" / "the server was updated" | curate MCP findings | `/unikit-mcp-audit [id\|stamp\|replay\|retire\|upstream]` | replay needs a live editor |
| "write the docs" / "update the README" | project documentation | `/unikit-docs` | code docs or GDD export (`/unikit-gd-docs`)? |
| "keep a task list" / "what was I doing" | task checklist | `/unikit-todo` | — |
| "customize how a skill behaves" | skill override | `/unikit-skills-context <skill> "<rule>"` | — |
| "which skill do I use for X" | navigation | answer from `skill-map.md` | — |
| "how does code relate to game design" | architecture of the framework | explain the one-way boundary (`pipelines.md` §3) | — |

---

## Worked examples (answer shapes)

These are the canonical Q&A shapes. Keep real answers this short.

### "А с чего мне начать?" / "Where do I start?"
First check whether the user even has a game idea, and whether the framework is installed.
```
You're starting out. UniKit has two on-ramps: the design track and the code track.

If the framework isn't set up yet:  /unikit   (one-time setup)

Then, depending on what you have:
  • No game idea yet      → /unikit-gd-brainstorm   (concept, pillars, core loop)
  • Idea, no GDD          → /unikit-gd-spec          (master GDD + system map)
  • Just want to build    → /unikit-plan → /unikit-implement

A typical full path: brainstorm → gd-spec → gd-system → plan → implement → verify → commit.
```
Clarify if unknown: "Do you already have a game idea, or starting from zero?"

### "Как мне начать писать код?" / "How do I start coding?"
Check for an existing plan first.
```
Coding always goes through a plan in UniKit.

  No plan yet → /unikit-plan full <describe the feature>
                (direction unclear? /unikit-explore <topic> first to work out the approach)
  Have a plan → /unikit-implement

After building: /unikit-verify  →  /unikit-commit
```

### "Как мне протестировать код?" / "How do I test my code?"
There is no single "test" skill — name the kind, then route.
```
UniKit handles testing in a few ways:
  • Automated tests       → ask for them in /unikit-plan (test phase); /unikit-implement writes them
  • "Did I build what the plan says + does it compile + do tests pass?" → /unikit-verify [--strict]
  • Failing tests / bugs  → /unikit-fix

There is no dedicated manual-QA runner skill — for exploratory/manual testing, do it in the
editor and feed any bug to /unikit-fix.
```

### "Как мне создать геймдизайн?" / "How do I create the game design?"
```
The design module owns this (.unikit/gamedesign/).

  Don't know the game yet → /unikit-gd-brainstorm   (idea, pillars, loops, motivation, pre-mortem)
  Ready to write the GDD  → /unikit-gd-spec          (GAME.md + system map)
  Have an existing GDD     → /unikit-gd-spec <path-or-url>   (import)

Per system afterwards: /unikit-gd-system <system>  →  /unikit-gd-review  →  /unikit-gd-verify
```

### "Как найти новую механику?" / "How do I find a new mechanic?"
Do not list random mechanics. Gather context, then route to the design-research lens.
```
Let's research it rather than guess. /unikit-gd-explore studies references and works out a
mechanic that fits *your* game, then routes it into the GDD for you.

  → /unikit-gd-explore <the mechanic / problem / target feeling>

To make it good, it'll want: genre, the emotion you're after, constraints, and 1-2 reference games.
It then hands off: new system → /unikit-gd-spec (add-system) → /unikit-gd-system.
```
Clarify if unknown: genre? target emotion? hard constraints? reference games?

---

## Fallback behaviour (intent unclear or out of scope)

- **Unclear intent** → don't guess. Run the diagnostic (one `AskUserQuestion`).
- **Spans several intents** → name the 2-3 routes and ask which they want first; or give the
  natural order (e.g. "design first, then plan, then implement").
- **No matching skill** → say so honestly and offer the closest fit. Known gaps to be honest about:
  - No dedicated manual-QA / playtest-runner skill → use the editor + `/unikit-fix` for found bugs.
  - No "deploy/build/release" skill → out of UniKit's scope; suggest the engine's own tooling.
  - Live code research/debugging is `/unikit-explore`, not a separate analytics skill.
- **Asking about the framework itself** (how rules/memory/registry work) → read `knowledge-base.md`
  and point them at `docs/` (`docs/dynamic-memory.md`, `docs/rules-registry.md`,
  `docs/getting-started.md`).
- **Never invent** a command or a skill. If you can't verify it in `skill-map.md`, don't say it.
