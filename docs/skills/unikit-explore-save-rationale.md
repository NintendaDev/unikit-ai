# unikit-explore — the save pipeline: rules and their rationale

A maintainer page. Nothing under `docs/` is delivered into a project by `unikit-ai init` or
`unikit-ai update`, so this page is read by whoever edits `skills/unikit-explore/`, never by
the model running the skill. The skill keeps what the model executes; this page keeps why.

The split follows one criterion: **a line is executable if deleting it changes what the model
does; otherwise it is rationale.** A guard on an executable line stays pointed at `SKILL.md`; a
guard on rationale moves with the rationale. Not being able to decide where a guard goes means
the line was misclassified, not that the rule has a gap.

## Rule classification

### Method

- **Scope.** `skills/unikit-explore/SKILL.md` → `## Saving Research Results` (35 273 B) and
  `skills/unikit-explore/references/ULTRA-RESEARCH-FORMAT.md` → `## Identifiers` and
  `## Write order`. Line numbers are those of commit `20f9694`; they are a snapshot for this
  pass and go stale with the first edit — the row IDs are the stable handle.
- **Unit.** A rule, split into clauses where a paragraph mixes an instruction with its reason.
- **Bytes.** UTF-8 of the clause with every whitespace run collapsed to one space, so line
  wrapping does not move the number; whole blocks are measured as raw line ranges. Every clause
  was matched against the file and found exactly once. Rewording a sentence after a cut adds a
  few bytes back; that is not subtracted here.
- **Guard.** The `scripts/test-skills.sh` assert whose literal sits inside the row. "none" means
  no assert reads anything in the row.

A row's **class** is the class of its rule: *imperative* (it says what to do) or *prohibition*
(it says what not to do). Rationale inside a row is split by what may happen to it:

| Code | Rationale that is… | Fate |
|------|--------------------|------|
| **H** | history — a retired format, command or name | moves here (task 13) |
| **D** | a duplicate — the rule is stated in full elsewhere in the same loaded file, and that copy stays | cut; the canonical copy is named |
| **M** | addressed to the maintainer — why the text is shaped this way, what the gate does *not* add, why a tool is not used | cut, moves here |
| **W** | a why-clause that decides no edge — the rule it motivates is absolute and stays | cut, moves here |
| **K** | a why-clause that decides an edge, carries a writing rule the gate's convergence rests on, or names a silent failure | **kept** in the skill |

### Result

| | Bytes | Share of the section |
|---|---:|---:|
| Section `## Saving Research Results` | 35 273 | 100 % |
| Rationale by the criterion above (H + D + M + W + K) | 11 927 | 33,8 % |
| **H** — history | 2 339 | 6,6 % |
| **D + M + W — tangled rationale that is removed** | **7 331** | **20,8 %** |
| **K** — rationale that stays | 2 257 | 6,4 % |

**The number that decides the phase-5 gate is 7 331 B** (D 2 791 · M 1 662 · W 2 878). The gate
threshold is 3 KB, so tasks 14 and 15 run.

Two corrections to the estimates this measurement replaces:

- **The research estimate was "~60 % rationale and history", leaving "~53 % tangled".** Measured
  by clause, rationale is 33,8 % of the section. The rest of the difference is executable text
  the estimate read as prose: the two templates alone are 4 395 B (the manifest 3 078 B,
  `SOURCE.md` 1 317 B).
- **The floor of task 13 is 2 072 B, not 2 232 B.** The plan measured "why the date left the
  folder name" as lines 453-459 (506 B); lines 453-454 carry the executable half — the date lives
  in `Created:` / `Updated:` — and 459 is blank. The rationale is 455-458, 346 B. The three
  blocks are therefore 1 060 + 666 + 346 = 2 072 B, and H is larger than that by three history
  clauses inside other rows (S-07, S-72, S-76 — 267 B) which move with task 14.

### Special cases

- **(a) Guarded rationale.** S-30: SF-7 greps `gd-provenance` inside a sentence addressed purely
  to the maintainer. The token stays in a one-sentence carrier (93 B, counted as K); the rest
  goes. R-12 in the reference is the same shape — SF-6 reads its pointer — and is settled by
  task 12, which removes the pointer's object.
- **(b) Guards on formulations.** S-22: SF-6 on `the line number is a hint`; S-46: SF-1 on
  `An answer is a quotation, never a digest.`; S-82 / S-83: CG-11 reads the Step 5 window for
  `stopped at budget` and forbids `Only once the gate has passed`. The prose around them may be
  rephrased; the claim may not.
- **(c) Load-bearing rules with no guard.** The plan counted two before task 1. The measurement
  finds five: S-15 (`Readback` never empty — guarded by SF-15 since task 1), S-18 (a fact lives in
  exactly one of `## Findings` / `## Active Summary`), S-25 (the log is verbatim before an anchor
  is put on it), S-28 (`diverges` is invalid without a paired `DEC-` — SF-7 holds the token, not
  the pairing), S-39 (a discipline of writing, not a sixth criterion of the gate — SF-8 counts
  criteria in the gate file and never opens the skill). After task 1, four. Task 14 keeps all
  four verbatim; none of them is cut, only clauses beside them.

### `SKILL.md` → `## Saving Research Results`

| ID | Lines | Rule | Class | Guard | Rationale in the row | Cut (B) |
|----|-------|------|-------|-------|----------------------|--------:|
| S-01 | 430 | Offer to save when the conversation crystallizes | imperative | SF-3 | — | 0 |
| S-02 | 455-458 | Why the date left the folder name | rationale | none | H 346 → task 13 | 0 |
| S-03 | 451-454 | The folder is `<slug>`, no date; the date lives in the header | imperative | RM-5 (negatives, file-wide) | W 67 | 67 |
| S-04 | 434-447 | Folder layout | imperative | RM-5 (`researches/<slug>`) | — | 0 |
| S-05 | 462-488 | The save question; the slug; a pinned folder is renamed before the manifest | imperative | none | W 206 · K 33 ("once the manifest exists, it has") | 206 |
| S-06 | 490-504 | Slug collision → ask; two `WARN [research]` lines | imperative | none | — | 0 |
| S-07 | 506-510 | Lines after the answer; no automatic suffix; no refusal | prohibition | none (NM-6 holds the suffix ban in `unikit-plan` only) | H 160 · W 78 | 78 |
| S-08 | 512-515 | Create the folder | imperative | none | — | 0 |
| S-09 | 517 | The write order is owned by the reference; items 1 and 5 skip in a standard research | imperative | none — object of task 12 | M 140 | 140 |
| S-10 | 519 | Ultra: artifacts first, `RESEARCH.md` second | imperative | none — object of task 12 | W 105 | 105 |
| S-11 | 521-523 | Write `RESEARCH.md`; the ultra marker and `## Artifact Index` by pointer | imperative | UR-1 (file-wide) | — | 0 |
| S-12 | 525 | `Created:` / `Updated:` from `date`, never from memory | prohibition | none (NM-5 holds the grant) | K 183 (a silent failure) | 0 |
| S-13 | 527-595 | The manifest template | imperative | RM-1, SF-6, SF-7, CG-10, SF-10, SF-15 | K 123 (the `What changed` placeholder: prose is paid for in gate passes) | 0 |
| S-14 | 597-602 | Filling `What changed` — the example | imperative | none | — | 0 |
| S-15 | 604-610 | `Readback` is never empty; what `K` counts; counters, not a second home | prohibition | SF-15, SF-10 | W 132 | 132 |
| S-16 | 612-615 | Two state axes; `Status` values never change | imperative | none here (RM-2 reads the reference) | K 131 (the field is grepped by name) | 0 |
| S-17 | 617-620 | The table of contents is mandatory and reflects the actual sections | imperative | none | W 99 | 99 |
| S-18 | 622-628 | `## Active Summary`: the planner's input, read cold, a fact lives in one of two sections | imperative | none — **load-bearing, unguarded**; the identifier pointer is an object of task 12 | K 170 (a layout pointer is not a retelling) | 0 |
| S-19 | 630-641 | A `REQ-` line is quotation + anchor + gloss | imperative | SF-6 (`SOURCE.md:`) | — | 0 |
| S-20 | 643-646 | 1. Quote the words that distinguish | imperative | none | D 302 (canonical: S-50) | 302 |
| S-21 | 647-651 | 2. What is checked is that the phrase is present | imperative | none | M 122 | 122 |
| S-22 | 652-657 | 3. The anchor is the quotation; drifted numbers are not a finding | imperative | SF-6 (`the line number is a hint`) | M 367 | 367 |
| S-23 | 658-659 | 4. No user source, no anchor | imperative | none | K 77 | 0 |
| S-24 | 660-661 | 5. Up to three places in the log; more means split | imperative | none | — | 0 |
| S-25 | 663-665 | The log is verbatim before an anchor is put on it | imperative | none — **load-bearing, unguarded** | K 120 | 0 |
| S-26 | 667-674 | Three provenance markers | imperative | SF-7 | — | 0 |
| S-27 | 676-678 | 1. The marker is an attribute of the line, not a prefix | imperative | none here (SF-7 counts the prefixes in the reference) | D 69 (canonical: the reference's closed vocabulary) | 69 |
| S-28 | 679-681 | 2. `diverges` without its `DEC-` is a defect | prohibition | none — **load-bearing, unguarded** | W 201 | 201 |
| S-29 | 682-684 | 3. An unmarked requirement is read as `stated` | imperative | none | W 50 | 50 |
| S-30 | 685-688 | 4. The vocabulary mirrors `gd-provenance` | rationale | SF-7 (`gd-provenance`) — **case (a)** | M 255 · K 93 (carrier) | 255 |
| S-31 | 690-698 | Two settled cases: partly the user's; agreement to a proposal | imperative | none | W 75 | 75 |
| S-32 | 700-703 | A structural requirement is tested for two readings; closed trigger list | imperative | SF-11 (`structure, layout, order`) | K 53 (the expected rate) | 0 |
| S-33 | 705-712 | Write out both readings — the example | imperative | SF-11 (`write out both readings`) | — | 0 |
| S-34 | 714-716 | A second reading that does not write passes | imperative | none | M 85 | 85 |
| S-35 | 718-721 | Ladder, rung 1: the distinguishing word | imperative | none | D 88 (canonical: S-50) | 88 |
| S-36 | 722-730 | Ladder, rung 2: a normative diagram | imperative | none | M 125 | 125 |
| S-37 | 731-732 | Ladder, rung 3: an `OQ-` | imperative | none | — | 0 |
| S-38 | 734-739 | Three notes on the trigger | imperative | none | D 53 · W 49 · K 74 (the cost asymmetry) | 102 |
| S-39 | 741-742 | A discipline of writing, not a sixth criterion of the gate | imperative | none — **load-bearing, unguarded** | K 96 | 0 |
| S-40 | 744-748 | Language rules for `RESEARCH.md`; machine-read tokens stay English | imperative | none | — | 0 |
| S-41 | 750-767 | Where the previous sections went; `## References` stays standalone | rationale | none | H 1 060 → task 13 | 0 |
| S-42 | 769-771 | `SOURCE.md` for prompt-based explorations | imperative | none | W 133 | 133 |
| S-43 | 773-777 | `SOURCE.md` is a log: not hashed, not gated, may be redundant | imperative | none | M 136 | 136 |
| S-44 | 779 | When to generate `SOURCE.md` | imperative | none | — | 0 |
| S-45 | 781-819 | The `SOURCE.md` template | imperative | SF-1 (`Offered:`, negative `**Answer**: <`) | D 225 (the template comment; canonical: S-47) | 225 |
| S-46 | 821-824 | An answer is a quotation, never a digest | imperative | SF-1 | D 218 | 218 |
| S-47 | 826-830 | A choice with no recorded menu is not an answer | imperative | none (SF-1 holds `Offered:`) | K 225 | 0 |
| S-48 | 832-834 | The menu's second effect | rationale | none | W 249 | 249 |
| S-49 | 836-840 | Mark your own cuts, and only your own | imperative | SF-2 (`[…]`) | W 143 | 143 |
| S-50 | 842-846 | Never cut inside a noun phrase that names a structure | prohibition | SF-2 (`noun phrase`) | K 326 (the canonical modifiers example) | 0 |
| S-51 | 848-849 | When in doubt, do not cut | imperative | none | K 138 (the cost asymmetry) | 0 |
| S-52 | 851-854 | A secret is the one admissible cut | imperative | none | M 137 | 137 |
| S-53 | 856-860 | On a continuation, append — never rewrite | imperative | none | W 145 | 145 |
| S-54 | 862 | Language rules for `SOURCE.md` | imperative | none | — | 0 |
| S-55 | 864 | `**Important**` — the recap of S-46 and S-49 | rationale | none | D 348 | 348 |
| S-56 | 866-870 | Step 3.5: put back the requirements the user has not seen | imperative | SF-9 (heading position) | W 119 | 119 |
| S-57 | 872-878 | Three classes go in | imperative | none | — | 0 |
| S-58 | 880-882 | A `stated` requirement that passed is not shown | imperative | none | W 139 | 139 |
| S-59 | 884-886 | A printed block, not `AskUserQuestion` | imperative | none | W 171 · M 65 | 236 |
| S-60 | 888-889 | The block is written in English | rationale | none | D 183 (canonical: the Language Awareness prerequisite) | 183 |
| S-61 | 891-900 | The readback block | imperative | none | — | 0 |
| S-62 | 902-912 | What the answers do | imperative | none | W 49 | 49 |
| S-63 | 914-916 | Where this stands is a property | rationale | none (SF-9 holds the position) | M 230 | 230 |
| S-64 | 918-924 | Nobody answered → demote to `OQ-`, one `WARN` | imperative | SF-10 (`WARN [readback]`) | — | 0 |
| S-65 | 926-927 | Why the unconfirmed are demoted | rationale | none | W 175 | 175 |
| S-66 | 929-930 | Nothing to show → skip in silence | imperative | none | W 58 | 58 |
| S-67 | 932-936 | Step 4: the registry is generated, never edited | imperative | SF-9, CG-3 (heading) | W 31 | 31 |
| S-68 | 938-944 | List the folders; read the manifest fields | imperative | none | — | 0 |
| S-69 | 946-953 | An unfinished exploration → the `NOTE` line | imperative | SF-3 (`NOTE [research]`) | — | 0 |
| S-70 | 955-956 | `NOTE`, not `WARN` | imperative | none; its anchor is an object of task 10 | W 28 | 28 |
| S-71 | 958-962 | Any other folder → the `WARN` line | imperative | UR-2 (`no readable RESEARCH.md`) | — | 0 |
| S-72 | 964-967 | Skipping in silence is forbidden; a folder is skipped for a missing manifest only | prohibition | UR-2 (the property) | K 185 · H 48 | 0 |
| S-73 | 969-975 | Overwrite whole; the header | imperative | none | — | 0 |
| S-74 | 977-991 | The record | imperative | none | — | 0 |
| S-75 | 993-995 | Sort by `Updated` | imperative | none | K 158 (what `Updated` means) | 0 |
| S-76 | 997-1005 | The reconciliation summary | imperative | RM-4 (`Kept:` / `Added:` / `Removed:`) | H 59 | 0 |
| S-77 | 1007-1015 | Reconciliation is no longer a separate verb | rationale | none (RM-4 holds `## Init` absent) | H 666 → task 13 | 0 |
| S-78 | 1017-1023 | Run the gate | imperative | CG-3 (`run the gate it specifies`) — object of task 11 | — | 0 |
| S-79 | 1025-1028 | The gate runs after Step 4, before Step 5 | imperative | CG-3 (positions) | W 236 | 236 |
| S-80 | 1030 | Ultra: after the integrity checks | imperative | none | — | 0 |
| S-81 | 1032-1035 | Reference missing → `WARN`, continue | imperative | CG-4 | D 158 (canonical: the ultra degradation line in `### Input handling`) | 158 |
| S-82 | 1037-1042 | Step 5: confirm once the gate has **finished** | imperative | CG-11 (window + negative), CG-3 (heading) | W 98 | 98 |
| S-83 | 1044-1046 | An authorised override is confirmed; the entry reads `stopped at budget` | imperative | CG-11 (`stopped at budget` in the window) | K 72 | 0 |
| S-84 | 1050 | Don't auto-save; pinning is outside the ban | prohibition | SF-5 (`**Don't auto-save**` == 2, `Always offer and let the user decide`), CG-4 | W 42 | 42 |
| S-85 | 1051, 1060 | Generate the name, don't ask; the user may edit it | imperative | none | — | 0 |
| S-86 | 1052-1054 | One manifest | rationale | none | D 204 (canonical: S-11, S-18) | 204 |
| S-87 | 1055 | `SOURCE.md` only for prompt-based explorations | rationale | none | D 284 (canonical: S-44, S-53, `## Pinning`) | 284 |
| S-88 | 1056 | The folder may already exist | rationale | none (SF-3's `<slug>/SOURCE.md` also stands in `## Pinning`) | D 301 (canonical: S-05, S-06) | 301 |
| S-89 | 1057-1058 | The registry is re-rendered whole | rationale | none | D 178 (canonical: S-67) | 178 |
| S-90 | 1059 | Run the coherence gate | rationale | CG-4 (`auto-save` also stands in S-84) | D 180 (canonical: S-78) | 180 |
| | | | | | **Total** | **7 331** |

### `ULTRA-RESEARCH-FORMAT.md` → `## Identifiers`, `## Write order`

The input to task 12. These two sections move into `SKILL.md`, and the bytes below are what the
move does not have to bring. They are not part of the phase-5 gate number.

| ID | Lines | Rule | Class | Guard | Rationale in the row | Cut (B) |
|----|-------|------|-------|-------|----------------------|--------:|
| R-01 | 167-169 | `Applies to: every research` and its note | rationale | SF-13 (adjacency) | M 111 | 111 |
| R-02 | 171-173 | IDs are optional; add one only when something references it | imperative | none | W 51 | 51 |
| R-03 | 175-185 | A closed vocabulary of six prefixes | imperative | SF-7 (six rows), UR-3 (the rows) | — | 0 |
| R-04 | 187-191 | A plan-affecting ID lives in `## Active Summary` | imperative | UR-3 (`must exist in …`) | W 177 · M 76 | 253 |
| R-05 | 193-196 | One value, one owning section | imperative | CG-7 (positive and negative) | — | 0 |
| R-06 | 198-203 | Characterizing an item in your own words is not a duplicate | imperative | none — a convergence rule | — | 0 |
| R-07 | 205-207 | Why that makes the gate decidable | rationale | none | K 213 (a value is what is grepped) | 0 |
| R-08 | 209-221 | A value in an artifact carries `rev.<n>` in the summary | imperative | CG-10 (`rev.<n>`) | W 262 · K 133 (the markers feed the value sweep) | 262 |
| R-09 | 223-225 | An ID is stable and never reused | imperative | UR-3 (`never reused`) | W 70 | 70 |
| R-10 | 227-229 | A superseded item keeps its ID | imperative | none | — | 0 |
| R-11 | 231-232 | Numbering per folder; `ADR-` zero-padded | imperative | none | W 70 | 70 |
| R-12 | 234-237 | The `REQ-` line shape lives in `SKILL.md` | rationale | SF-6 (`the requirement line contract lives in`) — **case (a)** | M 358 | 358 |
| R-13 | 241-243 | `Applies to: every research` and its note | rationale | SF-13 (adjacency) | M 105 | 105 |
| R-14 | 245-252 | The six-step order | imperative | SF-12 (negative on the old item 3, positive `already on disk before the save begins`) | — | 0 |
| R-15 | 254-257 | Never write the index before the artifacts; the registry before the gate | prohibition | none | W 268 | 268 |
| | | | | | **Total** | **1 548** |

### Notes for the tasks that consume this table

**Task 12 breaks more guards than the plan names.** The plan lists SF-14, SF-7 and UR-1. Measured
on the reference, the literals of these asserts stand **only** inside the sections that move or
are deleted, so each goes red with the move unless it is retargeted in the same commit:

| Section | Guard | Literal that stands only there |
|---------|-------|--------------------------------|
| `## Manifest layout` | RM-1 | the four `unikit:active-summary:*` / `unikit:sessions:*` markers ("declared in the spec") |
| `## Manifest layout` | RM-2 | `Status: completed \| in-progress \| needs-follow-up`, `Lifecycle: active \| paused \| superseded` |
| `## Manifest layout` | RD-E | `unikit:active-summary:start` / `:end` ("declared by the owner") |
| `## Identifiers` | SF-7 | the six-row window |
| `## Identifiers` | CG-7 | `One value is stated in exactly one owning section` (and its negative) |
| `## Identifiers` | CG-10 | `rev.<n>` |
| `## Identifiers` | UR-3 | the `## Identifiers` window, `must exist in … of RESEARCH.md`, `never reused` |
| `## Identifiers` | SF-6 (third assert) | `the requirement line contract lives in` — a pointer from the reference to `SKILL.md`, which has no object once the section itself is in `SKILL.md` |
| `## Write order` | SF-12 | `already on disk before the save begins` |
| preamble | SF-12 | `a standard research reads the sections marked` — and its negative, ``when the leading token is `ultra` ``, becomes the truth once the file is ultra-only again |

CG-6 (`Active Summary`) survives: the phrase also stands in `## Integrity`.

**The dedup the plan relies on moves away first.** The plan counts "never reused / keeps its
number" as already carried by `SKILL.md`, in `## Continuing a research`. Task 10 moves that
section into `references/continuing.md`, which an ordinary save never reads. After task 10 the
identifier stability rules (R-09, R-10) have no copy in `SKILL.md`, and task 12 has to bring them
rather than drop them as duplicates.
