# unikit — Config Actualization Mode

> Loaded on demand by `/unikit` Step 0 dispatch when `.unikit/config.yaml` already exists
> and the user's intent is to actualize / update / repair the configuration.
> Follow these steps and **STOP** — do not run Steps 1–11.

Bring an existing project's `.unikit/config.yaml` up to the current template. Keys added to
the template after the project was bootstrapped reach it by no other route: the file is
written by this skill alone, never by `unikit-ai init` or `unikit-ai update`. A missing key
is behaviourally harmless — every reader carries its own default — so what this mode fixes
is **discoverability of the knob**, not broken behaviour. Say so in the report rather than
implying the project was misconfigured.

## Capability contract

This mode **writes only `.unikit/config.yaml`**, and only through a targeted `Edit` —
**never `Write`**, because a whole-file write would discard the user's own comments and
ordering. Its tools are `Read`, `Edit` and `AskUserQuestion`, and no others.

It invokes no skill, spawns no subagent, and runs no shell command. It **writes nothing
under `.unikit/system/**`** — `.unikit/system/LANGUAGE_RULES.md` is explicitly **not** written
by this mode, even though Step 3.1 writes it in both bootstrap and merge mode. That step is
not part of this branch.

Unrelated breakage noticed along the way is **reported with a recommended command, never
repaired here**: name what looks wrong and which skill owns it, then carry on.

## Output form

Plain markdown only — no HTML tags, in any phase, as required by item 6 of
`## Execution Contract`. The per-key report is the longest output this branch produces, which
is exactly where a collapsible wrapper looks tempting; render it as a plain markdown table.

## Report language

Read `language.ui` from `.unikit/config.yaml` and write every user-facing line of this mode
in that language. This branch resolves the language itself: it runs on a project whose config
already exists, so the value is on disk and no question is needed.

---

## Phase A — Compare

1. Read `.unikit/config.yaml`.
2. Read `{{skills_dir}}/{{self_name}}/references/config-template.yaml`.
3. Walk **every leaf key** of the template and pair it with the project's value. Do not write
   a count of the keys anywhere in this file or in the report — a number recorded beside a
   list stops matching the list the moment the template grows, and nothing detects it.

Also collect the reverse direction: leaf keys present in the project file but absent from the
template. They belong to bucket 5.

## Phase B — Classify

Assign every paired key to exactly one bucket. Write nothing and ask nothing in this phase.

1. **Absent, template value is a literal** → append it silently with the template default.
2. **Absent, template value is a `{{PLACEHOLDER}}`** → ask. The template already encodes the
   distinction between "safe to default" and "needs a human"; this mode reads that encoding
   rather than inventing its own.
3. **Present but empty** → treat exactly as absent (literal → append the value; placeholder →
   ask). An empty value is a normal state, not an anomaly: Step 0 itself distinguishes
   "missing **or empty**", and Step 2 deliberately leaves `git.base_branch` empty in no-git
   mode.
4. **Present, value outside a declared domain** → ask. A domain counts as declared only when
   the template states it, either as an `Options:` enumeration or as an inline `# a | b`
   comment beside the key. **When the template declares no domain, do not check one and do
   not invent one** — `workflow.research_relevance_days`, `git.create_branches`,
   `git.branch_prefix` and `git.skip_push_after_commit` have no enumeration, and
   `git.base_branch` lists *examples*, which is not a domain.
   **Carve-out:** the language keys' domain is **not** checked in this mode. The template
   offers a short list while the repository carries a much larger ISO code set, and which one
   governs is an open question — checking either would produce a confident wrong answer.
5. **Present in the project, absent from the template** → report it, **never delete it**. This
   is an expected outcome, not a fault: it is usually a key the user added deliberately.
6. **`language.rules` and `language.technical_terms`** → do not touch at all. The template is
   explicit — "SKILLS NEVER TOUCH THIS KEY… never write to it, never prompt for it". Both are
   excluded from every other bucket: not appended, not asked about, not reported as drift.
   Switching either on a live project yields a half-translated rule corpus that agents then
   grep.

## Phase C — Print what was found

Print the full table **before asking anything**. The interactive question mechanism carries
options and does not carry the body they refer to, so a question asked before the report
leaves the user deciding without the subject of the decision in front of them.

**The table and the question are two separate emissions, in that order.** Where the choice is
offered through an interactive question mechanism, that is a separate call made **after** the
report text is already on screen — never in place of it, and never bundled into the same turn
as the only visible output. Emit the table, then ask. This is stated as its own rule because
the paragraph above was not enough on its own: the bundling was observed on a real project
while that rationale was already in the file, and a rationale is not an instruction.

| Key | Current state | Bucket | What will happen |
|-----|---------------|--------|------------------|
| `workflow.research_relevance_days` | absent | 1 — literal | append `7` |
| `git.base_branch` | empty | 3 → 2 — placeholder | ask |
| `testing.plan.checkpoints.full` | `weekly` | 4 — outside domain | ask |
| `git.my_own_key` | `true` | 5 — not in template | keep, reported only |
| `language.rules` | `en` | 6 — never touched | skipped by invariant |

The bucket-6 row is **printed even though nothing happens to it**. Omitting it would let its
absence read as "checked, all fine", when in fact it was never examined.

If every bucket is empty, say the configuration already matches the template and **STOP**
without writing.

## Phase D — Ask

Ask only about buckets 2, 3-as-placeholder and 4, through `AskUserQuestion`, after the table
is on screen. One question per key, or one grouped question when the keys are related and the
options are the same.

Classification decides the **bucket**; it never decides the **value**. Item 2 of
`## Execution Contract` holds literally here: do not infer an answer from context.

## Phase E — Write

Apply only what Phase B classified as silent-append and what the user answered in Phase D.
Every write is a targeted `Edit`; never a whole-file `Write`.

A key from a nested block is appended **together with its parent when the parent is absent**:
if the whole `testing:` block is missing, append the entire block from the template; if only
the `testing.implement.merge_checkpoints` group is missing, append just that group under the
existing `testing:`. Carry the template's comments across with the key — they are what makes
the knob discoverable, which is the whole point of this mode.

Never rewrite a value that already sits inside its declared domain. A silent edit of an
existing value is impossible in every bucket: bucket 1 only fills what is absent, and every
change to something already present is the result of a question the user answered.

## Phase F — Report, then STOP

Print a final report in three sections — **added**, **changed**, **skipped** — then **STOP**.
"Changed" can only ever contain keys the user was asked about.

Logging follows the repository's component-prefix style:

- `INFO [config]` — one line per key with its bucket, plus a per-bucket summary line.
- `INFO [config]` — a key present in the project but absent from the template (bucket 5).
  This is an expected outcome and must not be logged as a warning.
- `INFO [config]` — one line naming the two bucket-6 keys as untouched by invariant.
- `WARN [config]` — reserved for a real refusal: a value outside its declared domain that the
  user chose not to correct.

After the report, **STOP**. Steps 1–11 do not run.
