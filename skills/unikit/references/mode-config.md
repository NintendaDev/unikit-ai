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

When the returning-project menu (mode-menu.md) hands over to this mode it has already carried out Phases A and B: start at Phase C with the result it kept.

## Capability contract

This mode **writes only `.unikit/config.yaml`**, and only through a targeted `Edit` —
**never `Write`**, because a whole-file write would discard the user's own comments and
ordering. Its tools are `Read`, `Edit` and the question tool of your agent (`AskUserQuestion`), and no others. `Read` also covers `.unikit/system/engine-bridges/BRIDGES.md`, which Phase F reads and never writes.

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

Note one more fact for Phase F: whether `engine_bridges.order` — or the whole `engine_bridges` block — is **absent** from the project file.

## Phase B — Classify

Assign every paired key to exactly one bucket. Write nothing and ask nothing in this phase.

1. **Absent, template value is a literal** → append it silently with the template default.
2. **Absent, template value is a `{{PLACEHOLDER}}`** → ask. The template already encodes the
   distinction between "safe to default" and "needs a human"; this mode reads that encoding
   rather than inventing its own.
3. **Present but empty** → treat exactly as absent (literal → append the value; placeholder →
   ask). An empty value is a normal state, not an anomaly: Step 0 itself distinguishes
   "missing **or empty**", and the bootstrap deliberately leaves a placeholder-backed key
   empty when the run has nothing to resolve it from — the no-git case, for instance.

   **Exception — `subagents.model.<agent>.<role>` and `subagents.effort.<agent>.<role>`.** An empty value there
   is a deliberate choice (pass no model argument, pass no effort argument), not a missing one:
   keep it, never fill it from the template, and report it as kept. An absent key is appended
   with its template value, together with its comment, and an agent block with none of its role keys
   is appended whole. An agent that holds one scalar where the template has a map of roles — the form of
   earlier releases — is left as it is and listed under skipped: its role keys are not appended, because
   a key cannot be a value and a map at once.

   **Exception — `engine_bridges.order`.** An empty list there means the default order: never fill it from the template, and report it as kept. An absent key is appended with its block and comment, and Phase F then asks the order when two bridges or more are installed. A non-empty list is left as it is; changing it is the job of the bridge-order mode, not of this one.
4. **Present, value outside a declared domain** → ask. A domain is declared by exactly one
   thing: an inline `# a | b` comment standing beside the value on the same line. Nothing
   else declares one — an `Options:` or `Examples:` list inside a comment block is prose for
   the reader, not a domain, however much it looks like an enumeration. **When no inline
   domain stands beside the value, do not check one and do not invent one.**
   This bucket names no key on purpose. The template is the only place a domain is declared,
   so a key gains or loses one by being edited there and nowhere else; a list of key names
   repeated here would be a second owner of that fact, and it would drift silently the first
   time the template grows a key. The earlier form of this rule also counted an `Options:`
   list, which forced three hand-written exceptions to keep it honest — the exceptions were
   the symptom, the over-broad rule was the defect.
5. **Present in the project, absent from the template** → report it, **never delete it**. This
   is an expected outcome, not a fault: it is usually a key the user added deliberately.
6. **`language.rules` and `language.technical_terms`** → do not touch at all. The template is
   explicit — "SKILLS NEVER TOUCH THIS KEY… never write to it, never prompt for it". Both are
   excluded from every other bucket: not appended, not asked about, not reported as drift.
   Switching either on a live project yields a half-translated rule corpus that agents then
   grep.

## Phase C — Print what was found

Print the full table **before asking anything**.

| Key | Current state | Bucket | What will happen |
|-----|---------------|--------|------------------|
| `some.literal.key` | absent | 1 — literal | append the template value |
| `some.placeholder.key` | empty | 3 → 2 — placeholder | ask |
| `some.domained.key` | `weekly` | 4 — outside domain | ask |
| `your.own.key` | `true` | 5 — not in template | keep, reported only |
| `language.rules` | `en` | 6 — never touched | skipped by invariant |

The bucket-6 row is **printed even though nothing happens to it**. Omitting it would let its
absence read as "checked, all fine", when in fact it was never examined.

The key names above are stand-ins showing the shape of a row; the real ones come out of the
Phase A comparison. Only the bucket-6 row and the bucket-3 exception name actual keys; they
are the two facts the template does not encode positionally, so they have to be written down,
while every other classification is derived and needs no list.

If every bucket is empty, say the configuration already matches the template and **STOP**
without writing.

## Phase D — Ask

Ask only about buckets 2, 3-as-placeholder and 4, with the question tool of your agent
(`AskUserQuestion`). One question per key, or one grouped question when the keys are related and the
options are the same.

Classification decides the **bucket**; it never decides the **value**. Item 2 of
`## Execution Contract` holds literally here: do not infer an answer from context.

Phase F asks one more question, the order of the bridges, and only there.

## Phase E — Write

Apply only what Phase B classified as silent-append and what the user answered in Phase D.
Every write is a targeted `Edit`; never a whole-file `Write`.

A key from a nested block is appended **together with its parent when the parent is absent**:
if the whole `testing:` block is missing, append the entire block from the template; if only
the `testing.plan.checkpoints` group is missing, append just that group under the
existing `testing:`. Carry the template's comments across with the key — they are what makes
the knob discoverable, which is the whole point of this mode.

Never rewrite a value that already sits inside its declared domain. A silent edit of an
existing value is impossible in every bucket: bucket 1 only fills what is absent, and every
change to something already present is the result of a question the user answered.

## Phase F — Bridge order

Runs only when Phase A found the key `engine_bridges.order` **absent** (the whole `engine_bridges` block included — the key this run has just appended) **and** `.unikit/system/engine-bridges/BRIDGES.md` lists two bridges or more; a file that does not exist counts as no bridge. Read `BRIDGES.md`, then carry out **Decide and write** of `{{skills_dir}}/{{self_name}}/references/mode-bridge-order.md` against the file Phase E has just edited, and keep its `INFO [config] bridge order: …` line for Phase G.

The key was already there → this phase asks nothing: an empty list is the default order and stays, a list that is not empty is not touched. When the list is empty and `BRIDGES.md` lists two bridges or more, Phase G gets one more line: the order is the default one (name it, from `default order:` in `BRIDGES.md`) and "change the bridge order" sets your own.

## Phase G — Report, then STOP

Print a final report in three sections — **added**, **changed**, **skipped** — then **STOP**.
"Changed" can only ever contain keys the user was asked about.

When Phase F ran, the order the user chose is part of this report, under **added** next to the key; there is no second report.

Logging follows the repository's component-prefix style:

- `INFO [config]` — one line per key with its bucket, plus a per-bucket summary line.
- `INFO [config]` — a key present in the project but absent from the template (bucket 5).
  This is an expected outcome and must not be logged as a warning.
- `INFO [config]` — one line naming the two bucket-6 keys as untouched by invariant.
- `INFO [config]` — Phase F: the order written, or, when the key was already there and two bridges or more are installed, the default order that stays.
- `WARN [config]` — reserved for a real refusal: a value outside its declared domain that the
  user chose not to correct.

After the report, **STOP**. Steps 1–11 do not run.
