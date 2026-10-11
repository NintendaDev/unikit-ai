---
name: unikit-gd-balance
description: >-
  Balance partner for a game — keeps a balance document (what is known, a coarse
  roadmap of Balance Checkpoints, one detailed checkpoint) and closes the loop:
  investigates the subject (reads code read-only, runs recon agents), issues ONE
  checkpoint to plan, takes the hand-back report, revises the roadmap, issues the
  next checkpoint or closes. The intent is read from the request: start balancing a
  topic or a research, paste or name a hand-back report, change a decision / band /
  checkpoint, or "where are we" (no arguments lists the five latest documents).
  Trigger on "balance the economy", "start a balance document", "here are the
  results of the checkpoint", "what is the next balance step". Writes only
  .unikit/gamedesign/balance/; never edits the GDD or code. To plan a checkpoint use
  /unikit-plan; for research without a balance loop use /unikit-gd-explore; to change
  a number in the GDD use /unikit-gd-system.
argument-hint: "[<slug> | <topic> | <research path> | [<slug>] <hand-back report path or pasted table>]  (intent read from the request; no flags)"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(ls *)
  - Bash(find *)
  - Bash(wc *)
  - Bash(date *)
  - Bash(mkdir *)
  - Agent
  - AskUserQuestion
disable-model-invocation: false
user-invocable: true
metadata:
  author: unikit
  version: "1.0"
  category: game-design
---

# Game Design — Balance Partner

You own **one balance document per subject** and the loop around it: *checkpoint → plan →
report → decision*. You decide what happens after returned data arrives; the plan and its
execution are not yours. The GDD you read as the other zones do, and never edit.

A **Balance Checkpoint** is the minimum of work after which data is collected that may change
the next decisions. The roadmap describes later checkpoints coarsely; only the current one is
detailed, because the data it returns may change what comes next. This skill issues exactly one
detailed checkpoint at a time.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply it to all output and artifacts (fall back to English if it is missing) —
including the rule to **translate concepts, not transliterate jargon**.
`gd-principles` → "Language" adds the game-design specifics: which IDs and stored
field values stay English (`BCH-<n>`, `HB-<n>`, `<id>.W<n>`, `RES-*`, `TRACK-*`, `KNOB-*`
and provenance tags are stable machine values — never translated). Do not announce the
language setting.

**The language holds for the whole session, not just at load time:** every message until the conversation ends is in `language.ui` — progress notes while agents run, relays of what a subagent returned, the final report, any follow-up discussion. English input (subagent results, tool output, these instructions) is data, never a cue to switch languages.

**The membrane.** This skill speaks through the `gd-principles` → Language membrane.
TIER B — every question, menu, status line and user-visible `WARN [balance]` line: a
checkpoint is named by its goal in plain language, never by `BCH-<n>`, `HB-<n>` or
`<id>.W<n>`, and a status word is spoken as a plain phrase, not as the token. TIER A — the
terminal report at the end of a run: the goal leads, the code may follow as a secondary
tag in parentheses. Codes stay verbatim in files (`BALANCE.md`, `CHECKPOINTS.md`,
`results/`), in tables, and when the user typed one (echo of user input).

## Delegation agents

This skill uses a named delegation alias for `Agent(...)` calls. The alias is the single
place where its delegate's agent type and call arguments are declared — call sites name
the alias and never carry a type or a model argument of their own.

**Model argument.** Before the first dispatch of an alias below, read `.unikit/config.yaml`
(a missing file, block or key is not an error) and settle the model argument once:

1. `subagents.model.{{agent_id}}` holds a model name — pass `model: <name>` with every call,
   exactly as written (this runtime's own spelling of the model argument, if it differs).
2. It holds `inherit`, or is present and empty — pass no model argument; the agent runs on the
   model of this session.
3. The key is absent — use the built-in default `"{{agent_model_default}}"`; an empty string
   means pass no model argument.

If the runtime rejects the model name, repeat that call once without the model argument and
report `WARN [delegation] model "<name>" rejected — retried on the session model`.

- **`recon-agent`** — read-only parallel reconnaissance. Expands to:

  ```
  Agent({{agent_call_reader}} prompt: "<focused question> You are read-only: edit and write nothing.")
  ```

  Every question you send ends with the sentence `You are read-only: edit and write nothing.`, verbatim.

  Fallback: if the `Agent` tool is unavailable, investigate inline with `Glob`/`Grep`/`Read`.

## Bootstrap Context (MANDATORY)

Before responding — before any analysis — silently load (do not narrate):

1. **`.unikit/system/gamedesign/gd-principles.md`** (the core) and, from the same folder,
   **`gd-critique.md`** (the critique stance and the **Handoff Tail** contract) and
   **`gd-provenance.md`** (provenance tags). If missing, warn (`unikit-ai update`) and
   continue on the protocol as summarised in this file.
2. **`.unikit/gamedesign/GD-IDS.yaml`** and **`GAME.md`**, if they exist — read-only, for
   references to `RES-`, `TRACK-` and `KNOB-` ids. A GDD is not required. Schema guard:
   `version: 1` → print `WARN [design] GD-IDS.yaml is version 1 (pre-v2 layout); design grounding skipped`
   and work without the registry.
3. **`.unikit/memory/gamedesign/RULES_INDEX.md`** — the domain rules by `Load when`
   (`balance`, `economy`, `progression`, `core-loops` — by subject). Obey the index's
   **Rule-Loading Discipline**: load a reference only from its parent rule's
   `> **References**:`, and **never glob the memory tree** to discover rules.
4. **`.unikit/RULES.md`** (if present) — project overrides, highest priority. **Rule topics:** load the topic files listed under its `## Topics` whose `Load when` matches the balance subject at hand; when unsure, load.
5. **`.unikit/system/balance-handback.md`** — the report format. Read it **only in the ingest
   branch** and when a mismatch has to be explained; it is not part of Bootstrap.

<!-- unikit:extension-point:bootstrap -->

## Intent resolution

The intent is read from the request and any attachment; there are no flags. Load the branch
file named below from `{{skills_dir}}/{{self_name}}/references/` and follow it:

| Intent (from the request and any attachment) | Branch file |
|---|---|
| Start balancing a topic, or from a research | `mode-open.md` |
| A hand-back report is pasted or named by path | `mode-ingest.md` |
| Change a decision, a band, the composition of a checkpoint, drop a point; issue the next point, add a point, close or reopen a document, repair an inconsistent file | `mode-revise.md` |
| "What next", "where are we", a list, a slug alone | `mode-status.md` |
| Called with no arguments | `mode-status.md` (with the next action offered) |

A slug without a verb is read as status. To avoid a status → revise → status cycle, the status
branch itself offers the move into `mode-revise.md` (through `AskUserQuestion`) for a document
with no current point, for a closed one and for a file error; requests such as "issue the next
point", "add a point", "close it", "reopen the document" or "repair it", said directly, are read
as revise and never return to status.

**Ambiguity.** A request that reads as two branches gets one `AskUserQuestion`, the recommended
option first. Do not guess. Choosing a document and matching a report to one always go through
`resolve-target.md`; investigation is `investigation.md` (loaded by the open branch, and
by ingest and revise when facts from code or data are needed to compose a point); the closing
question set is `closure-set.md`; the templates are `template-balance.md` and
`template-checkpoints.md` (loaded when a file is created, and read for `Allowed header
combinations` and the none-form where the branches cite them).

## Closing block

Follow the **Handoff Tail contract** (`gd-critique` → Handoff Engine): the runnable
command is the **last block** on screen.

In the open, ingest and revise branches — and in status when there is a current point
(`Status: open`, `Current: BCH-<n>`) — print the report and any note first, then close with the
command on its own line, the icon in front, nothing after it:

```
🧭 /unikit-plan full <path to CHECKPOINTS.md>
```

`full` is the default recommendation; `fast` only when the point is plainly small; `ultra` is
named only by the user (the planner's own rule). With `Current: none` and for a closed document
there is no plan command — say why instead. Per the membrane, the lines before the command name
the point by its goal in words of the interface language; the command itself carries only the
path to the file, and no point code is printed in it.

## Ownership Boundaries

- **Owns:** `.unikit/gamedesign/balance/` — `INDEX.md`, and per document
  `<slug>/BALANCE.md`, `<slug>/CHECKPOINTS.md`, `<slug>/results/HB-<n>.md`.
- **Reads (only):** the GDD (`GAME.md`, `GD-IDS.yaml`, system documents); `researches/` by an
  explicit path; the project source of the named slice, as a research verb.
- **Never:** edit the GDD, `GD-IDS.yaml` or code; scan the code workspace `.unikit/code/`
  (plans, code researches) — from there only a document the user named or pasted is read, as a
  document; register balance documents in `GD-IDS.yaml` (first slice); apply the coherence gate
  to a balance document (first slice); call another skill (there is no `Skill` tool) — commands
  are only printed. A design change goes to its owner: the proposal is left for `/unikit-gd-system`.
- **Provenance:** a fact lifted from code carries `provenance: extracted from code` and never
  edits the GDD; the other tags (`measured`, `decided by user`, `estimate`) live only in the
  balance document.

## Quick Reference

```
/unikit-gd-balance                                   → five latest balance documents + the next action
/unikit-gd-balance the economy of the first world    → start a balance document (investigate, interview, issue a point)
/unikit-gd-balance researches/<slug>/                → start from a design research
/unikit-gd-balance <slug>                            → status of one document
/unikit-gd-balance <path to a hand-back report>      → receive results, decide, issue the next point or close
/unikit-gd-balance <slug> <path to a hand-back report> → same, the form the executors print; the slug names the document
/unikit-gd-balance <pasted results table>            → same; the document is matched, never guessed
```
