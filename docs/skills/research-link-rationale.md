[Back to README](../../README.md) · [Skills Reference](../skills.md)

# The research-link contract: reasons behind the rules

A maintainer page. Nothing under `docs/` is delivered into a project by `unikit-ai init` or
`unikit-ai update`: the contract (`data/research-link.md`, installed flat as
`.unikit/system/research-link.md`) keeps what the model executes, this page keeps why.
Grouped by the contract's own sections, plus the two cross-cutting questions its existence as
a system asset answers.

## Why a system asset, not a skill reference

Four skills need this contract — `/unikit-plan` writes the field, `/unikit-implement`,
`/unikit-verify` and `/unikit-improve` check it — and a skill's `references/` directory is
per-skill by construction. The alternative to one owner is four copies, and they had already
diverged: `/unikit-improve`'s branch list was built differently from `/unikit-implement`'s and
`/unikit-verify`'s, measured before this contract existed. A system asset is read the same way
`gate-result-contract.md` and `ultra-plan-read.md` are — flat-copied, no substitution, not
hash-tracked, rewritten on every `init`/`update` — because the alternative (four
`references/research-link.md` files) reintroduces exactly the divergence this page exists to
close.

## Why the contract is read at its research step, and never at Bootstrap

The gate "does this plan link a research" fires at the start of every run — `/unikit-plan`
Step 2, `/unikit-implement` Step 1, `/unikit-verify` Step 0.2, `/unikit-improve` Step 1.5 —
exactly where the drift check already stood before the contract existed. Reading the contract
at Bootstrap instead would charge every plan for it, including the majority that link no
research at all; that cost is exactly what moving the read to the gate avoids. The same reasoning
keeps it out of a look at the index: `/unikit-plan` Step 0.2 reads the table and opens no contract.

`/unikit-plan` is the one exception that needed its own decision. Its old computation happened
in Step 5, at the end of the planning session — the single worst place in that skill to add a
read, because Step 5 is where the session's context is most full. Moving the read there instead
of to the link point would have "fixed" nothing: it would still read the contract late, just
under a new name. So the digest is computed **at link time**, in Step 2, the moment a research
is actually linked; only the resulting 64-character value is carried forward to Step 5, which
writes it into the entry but never recomputes it. This is also the more honest record: the
recorded hash describes the bytes the planner read as input, not bytes re-read an hour later
after other tasks may have shifted the session's attention.

## `## The entry`

An entry's heading is the folder name, whatever that name is — including the pre-dateless-naming
form `YYYY-MM-DD_name`. The on-disk migration merges a folder's contents but never renames the
folder itself, so a heading reading `### 2026-03-15_customer-items-on-scene` is exactly as valid
as a dateless one; the contract does not special-case it.

## `## Finding the folder`

An entry carries a name, not a path, and that is what lets a research move. The address of a
folder is stored once — where the folder lies — and every reader finds it by the same two
steps: the live directory first, the archive second. Archiving a research therefore changes
no plan, open or archived.

Rewriting the entries was rejected for three reasons. It changes the entry format, which four
skills and their guards depend on. It touches archived plans, which stay history: the archive
protocol edits nothing in a plan it moves but one line. And it would still leave a window
between the move and the rewrite in which a link points nowhere. A flag on the research
(`archived: true` in place) and a stub left at the old place were rejected for the reason the
move exists at all: neither makes the live folder or `researches/INDEX.md` any smaller.

The archive is reported with `INFO [research]`, not `WARN [research-drift]`. The place of a
folder says nothing about whether the plan and its source diverged, and `/unikit-verify` raises
its gate to `warn` on every drift line — a warning for the place would taint the gate of every
plan that links an archived research, for a fact that is neither a defect nor a decision. The
two folders existing at once is the one case that does need a rule: the live one is read, because
the live folder is the one a later save of `/unikit-explore` would update, and a stale copy in
the archive must never shadow it. The line printed for that case is what lets the user remove
the extra copy.

A known name reads no index. The folder on disk decides the source, so a row could decide
nothing, and reading the index first only added its size to every check. This reverses an
earlier rule that read the index even for a known name; that rule came from a request to read the
index "when they need it", and a reader that already holds the name does not need it. The index
serves search and lists. Ordinary plan discovery still offers active research only; explicitly
requested history reads the archive without restoring it. A named restore goes straight to the
archive's folders, and an existing active destination remains a collision rather than successful
linked-read resolution.

## Why the index rules left this contract

Each scope keeps its own compact table, but its rules no longer live here. The contract grew from
about 6.5 KB to 11.7 KB when they joined it, and every plan paid for that read just to look at an
index, including a plan that links nothing. Measured on 35 real manifests, a table row saves
about 270 bytes against a card, so the read only broke even at 44 researches. The format now
belongs to its one writer, `unikit-explore/references/index-render.md`, and a reader does not need
it: the table explains itself. What a reader does need is one sentence, **Research index**, carried
word for word by `/unikit-plan`, `/unikit-improve`, `/unikit-explore`, `/unikit-archive` and
`/unikit-help` and held equal by `RI:reader`, in the way `RD-G` holds the degradation sentence.

`Summary` is the `Topic:` line. An agent-written sentence with a cache of reusable sentences solved
a cost it had created itself: it needed a fingerprint of the source, a rule version, a language key
and a second hash next to the plan's. A new `Topic:` is one sentence up to 250 characters and an old
long one is cut at render. The price is that a cut row can lose a qualification at its end. It is
accepted because the row only navigates: the manifest is always opened before the research is used.
Old manifests are not rewritten to fit.

The writer takes the fields from one search over the manifests rather than reading them whole:
on those 35 manifests that is about 718 bytes each, against an average manifest of 85 KB. Two
rules of that search exist for measured reasons. `Topic:` counts only between the markers and
the header fields only above the start marker, because a whole-file search also finds those words
in `## Sessions`. And a line the search output leaves out as too long is read on its own, because
5 of 33 old `Topic:` lines exceed 500 characters, which is about where a search tool starts
replacing a line with a notice.

The comparison of index rows with folders went too. It repaired a catalog that the reader was
about to verify anyway by opening the selected manifest. A missing index is an `INFO` and a search of
the folders: navigation failing is not a drift, and it must not change `/unikit-verify`'s gate. The
cards of 3.0.0 stay readable through the same sentence, because `init` and `update` never migrate a
user's research; the next whole render replaces them.

A coherence-gate repair can change what the row shows after Step 4 wrote it, so a repair that
touched a header field or `Topic:` re-renders the index once more before the save is confirmed, with
no further coherence pass. The index stays ahead of the gate because the order of the save is
pinned, and the gate does not read the index.

## `## Computing the hash` → what is hashed

The rule is a content signal, not a clock: hash the declared requirements, never the append-only
session log. Before this contract, `## Based on` carried a link timestamp compared against a
research index timestamp — two clocks written by the same class of agent with the same care,
which is exactly the shape of check that goes stale silently. Hashing the `## Active Summary`
region instead means an appended session (`## Findings`, `## Sessions`, the header's `Updated:`)
never reports drift that did not happen, because none of that text is in the hashed bytes.

The region is hashed, not the whole `RESEARCH.md` file, and that was a reversal: an earlier
revision of this rule rejected start/end markers on the grounds that splitting the summary into
its own file was already a marker. That file split was retired because it created the exact
obligation the markers exist to avoid — keeping two documents in sync, paid on every save — so
markers inside one file replaced a second file, not the other way around.

## `## Computing the hash` → why a script

The hash was once a procedure the agent carried out: extract the region, normalize it, pipe it into
`shasum`. Three things were wrong with that. It made the agent read the summary, an average 30 KB,
for a check that only compares two strings. It needed `shasum`, `awk` or `sed`, which on Windows come
with Git Bash, and Git Bash may not be installed. And the result depended on the shell: the same
`awk | sha256sum` over one Cyrillic file gave `f0dcdff4…` from Git Bash and `9e7a833a…` from
PowerShell 5.1, with UTF-8 forced as well, while Node gave `f0dcdff4…` from both.

`data/research-hash.mjs` reads the manifest itself and works on bytes, so neither a code page nor a
shell can touch them. Node is present wherever `unikit-ai` is installed. It is a system asset because
four skills run it at one path, whichever of them the wizard installed. Each of them holds a grant
for that one script in both shells, never for all of `node`: a skill that checks a hash gains no
general interpreter, and without Git Bash a `Bash(...)` grant means nothing.

Two alternatives were rejected. A copy of `Updated` in place of the hash loses the check on existing
plans and misses a hand edit of a summary, and it warns on a save that did not change the summary.
A shell one-liner with a date as a fallback still needs the utilities and still depends on the shell.

`git hash-object` was rejected earlier and stays rejected. The object it produces is SHA-1 with a
blob header, while the field is named `Summary SHA256`, and it would make drift detection depend on
git in a tool that explicitly supports `git.enabled: false`.

`tree-sha256` is a separate matter and still uses `shasum`. It is a digest of git's own output, not
of a file, and it shares only the algorithm with this field. Without Git Bash a plan with
`Testing: yes` can therefore still keep `/unikit-verify` at `warn` for that reason.

Every normalization rule exists because its absence produces a **false** drift report on content
nobody changed:

- **UTF-8 BOM** — this project's primary development platform is Windows, where editors commonly
  prepend a BOM; a summary re-saved with one gets a different hash for identical text.
- **CR / LF** — a checkout on Windows without `core.autocrlf` set correctly reintroduces `\r`
  bytes that never appear in the declared requirements.
- **Trailing spaces** — an editor's "trim on save" setting silently changes bytes at the end of
  wrapped lines. Spaces only, as the rule has always read, so a hash computed correctly before the
  script stays valid. A trailing tab stays in the text; none of the 35 measured summaries has one.
- **One final newline** — the single most common byte-level diff between two saves of the "same"
  file.
- **No reformatting** (line order and leading whitespace preserved) — the summary carries fenced code
  blocks and indented list structure, and any re-indentation would break every hash ever recorded.

Extracting the region comes before all of them and is the one rule that could regress alone: without
it the others still describe a coherent procedure, over the wrong object, the whole manifest, whose
`## Sessions` grows on every save. `scripts/test-research-hash.mjs` pins every rule against digests
computed once by an independent pipeline, never by the script under test.

## `## Writing an entry`

An absent `Summary SHA256` line is honester than a field that looks like a hash and is not one.
Every case with no digest (no markers, no readable file, the script could not run) omits the line
entirely rather than write a placeholder or fall back to a timestamp, because a placeholder invites exactly the reader
mistake the contract exists to prevent: treating a field that merely resembles a digest as if it
carried the guarantee a real digest does.

## `## Checking an entry`

The precondition — recompute *only* when the entry carries a `Summary SHA256` — is read before
the first comparison specifically so a pre-manifest entry (one written before this field
existed) is reported as **unknown**, never as **drift**. Skipping that ordering is how an entry
with no comparable digest at all ends up compared against nothing and reported as changed.

One label, `WARN [research-drift]`, covers every outcome so a log can be grepped for drift in
aggregate; a per-outcome label would make the outcomes indistinguishable in that grep. The two
**unknown** outcomes are still worded apart from each other — "recorded against the retired
brief field" versus "no hash recorded" — because they need different repairs (one replaces a
dead line, the other records a first hash), and the log line is the only place a human sees
which one applies.

**unavailable** is the one outcome outside that label, and it is an `INFO` on purpose: the script
did not run, so nothing is known about the research. A warning there would hold `/unikit-verify` at
`warn` for something no command in the workflow can clear, and that is the state the script was
written to end. `/unikit-verify` still puts the line in its report, because a report silent about a
check that did not run reads as a check that passed.

There is no bundle-validation branch. `## Based on` always names a folder under
`.unikit/code/researches/`, and the hashed object is always one fixed section of one fixed
file — one shape, one region, every time. A branch for "is this a bundle entry point or a
single file" would exist only if the source path could vary that way; UniKit's does not.

Fallback is forbidden in both directions: a reader never substitutes an older timestamp field
for a missing `Summary SHA256`, and never reads a digest recorded against the retired brief
field as if it were a `Summary SHA256`. Both directions describe different objects, and treating
either as interchangeable with the current field reports a change nobody made.

**"Continue against the plan, not against the research"** is the operative instruction for
every drift outcome: a reader does not widen scope, add tasks, or rewrite the recorded hash —
that is `/unikit-improve`'s job, and only on the user's explicit request. The drift wording
itself is deliberate: "Active Summary changed since the plan was built" is a claim about the
*input*, not about the research author's intent — the summary is rewritten wholesale on every
save, so a mismatch proves the bytes changed, not that anyone changed their mind. Claiming the latter would make a routine save read as a finding about the
plan.

A stale hash is evidence, and is never silently rewritten. It is the record of what the plan
was actually built against; overwriting it on a drift result erases the only trace that the plan
and its source diverged, at the exact moment that trace is needed. Rewriting it is
`/unikit-improve`'s job alone, and only together with the corresponding task and
`## Technical Context` updates a rebase requires.

## `## Who writes the field` — the re-link defect and why consent is gathered in Step 4

An entry with no `Summary SHA256` — one written before this field existed — needs a writer, and
`/unikit-improve` is the only skill positioned to supply one: the on-disk plan migration
rewrites the manifest's structure but never touches `## Based on`, so without a dedicated writer
a pre-manifest plan reports `drift unknown` on every run, forever, and `/unikit-verify` holds
its gate at `warn` with no command able to clear it.

That writer existed before this contract did, but was unreachable in the one case it was built
for. Both **unknown** branches in `/unikit-improve`'s Step 1.5 *offered* the user a re-link, but
the write lived in Step 5.5, gated on `research_improvements` being non-empty — and neither
branch put anything into that list, so the write was never reached. The pointer describing where
the write happened was also wrong, naming "Step 5.5 item 3" — the "do NOT rewrite a drifted
hash" branch, not the writer. A plan whose only problem was a hashless entry — exactly the case
this writer exists for — surfaced no way to reach it.

The fix routes the offer through the same mechanism every other improvement uses: a `Re-link:
<folder>` finding, raised into `research_improvements`, presented in the Step 4 report, and
selectable like any other finding (`Choose which` needed a `Research-Based` category it did not
have, for the same reason). The write in Step 5.5 is gated on that Step 4 answer, not on a
question asked back in Step 1.5 — consent gathered *before* the report is on screen is consent
to something the user has not yet seen written out. Never performing the write without that
answer matters concretely: silently hashing the summary at read time would claim "no drift" over
a period nobody actually examined.

## Guard map

| Guard | Holds |
|-------|-------|
| `test-research-hash.mjs` | The normalization by behaviour: LF, CRLF and BOM spellings of one region give one digest, a trailing tab and a leading blank line stay, the exit codes 2 and 3, a real research and a Cyrillic path; every expected digest comes from an independent pipeline; the markers of the script equal the constants of the installer |
| `RD-A` | The recorded field name, the script, the file and the region marker are present in the contract; the two retired fields (`**Attached**`, `Brief SHA256`) survive only where a branch has to name them, in the contract and all four skills alike |
| `RD-B` | The script's grant in both shells is present in all four skills; `shasum`/`sha256sum` stay only in `/unikit-plan`, `/unikit-implement` and `/unikit-verify`, where another command needs them |
| `RD-C` | One canonical `WARN [research-drift]` label in the contract's reader ladder, never in its writer section; `/unikit-implement` and `/unikit-verify` each project the drift result into their own second surface (the completion summary / the `unikit-gate-result` block) and never read the research brief as a substitute for the plan; a skipped check is `INFO [research-hash]` and `/unikit-verify` reports it |
| `RD-D` | A hashless entry's re-link proposal is reachable end to end: raised as a finding in Step 1.5, surfaced in the Step 4 report, selectable, and the Step 5.5 write is gated on that approval — not merely present somewhere in the file |
| `RD-E` | The hashed object is a region (not a whole file) in the contract; its markers in the contract and in the script equal the constants of the installer; the retired-field branch lives only in `## Checking an entry`, never in `## Writing an entry` or in `/unikit-plan`, which never reads an existing entry |
| `RD-F` | No skill or planner reference surface restates the contract — checked three ways: the four fixed procedure tokens are absent, no derived `WARN [...]: <text>` template is copied whole, and no 9-word run of the contract's substantive sections is reproduced (word-shingle detection, ported from `scripts/test-ultra-plan-contract.mjs`'s T17) |
| `RD-G` | The one degradation sentence is verbatim-identical and appears exactly once in each of the four skills |
| `RD-H` | The contract is read only within its research step's own section, never inside Bootstrap and never for `/unikit-plan`'s early look at the index; the digest is computed at read/link time (`/unikit-plan` Step 2, `/unikit-improve` Step 1.5), never recomputed at the later write step (`/unikit-plan` Step 5, `/unikit-improve` Step 5.5) |
| `RD-I` | The name of an entry is resolved in `researches/` first and `archive/researches/` second, in the contract only: `## Finding the folder` sits between `## The entry` and `## Computing the hash`, raises no `WARN` for the place of a folder, is pointed at by `## Checking an entry` and by `/unikit-improve`, and no consuming skill names the archive path |
| `RD-J` | The contract stays within its size limit, computes the hash through the script, carries no digest utility and no index rules; no shipped file names its retired sections |
| `RI:*` | The index: the format, the `Topic:` rule and the one search live in `index-render.md`, which does not read the contract; the **Research index** sentence is word for word once in each of the five readers; no cache in anything shipped and no digest grant in `/unikit-explore` or `/unikit-archive`; a gate repair re-renders before the save is confirmed; `/unikit-plan` shows `Updated`; thirteen replay cases |
| `SA-1` | Every `export async function install*` in `system-assets.ts` and `system-contracts.ts` is called from both `init.ts` and `update.ts` — derived from the source, not a maintained name list |
| `TC-24` | The literal `the one tree-hash command` in `test-runs.md` and in `/unikit-verify`: one command named in two places, never two commands that merely agree today. It shares nothing with `Summary SHA256` but the algorithm |
| `Test 1b-rl` | `research-link.md` is delivered into `.unikit/system/` (update-path coverage — this project is set up via `run_update`); carries the region marker and the canonical `WARN [research-drift]` label; is a flat copy (no unresolved `{{vars}}`) |
| `Test 1b-rh` | `research-hash.mjs` is delivered, is a flat copy, and the installed copy prints the expected digest of a real research |
| `Test 30l`, `Test 30l2` | `research-link.md` and `research-hash.mjs` are delivered on `update` with no prior `init`, and a tampered copy is refreshed from `data/` on the next `update` |

## Why the degradation is verbatim in four places

A missing or unreadable contract cannot describe what to do about its own absence — there is
nothing to read. That sentence has to live in each of the four consuming skills by necessity,
the same shape `ultra-plan-read.md` and `UP_DEGRADATION` already established for a missing
system asset. Given four skills each need their own copy of one unavoidable sentence, the choice
is between four independent wordings that can drift apart and one wording copied verbatim; `RD-G`
holds the second choice by checking the sentence taken from `/unikit-implement` appears,
unchanged, exactly once in each of the other three.

## See Also

- [unikit-implement rationale](unikit-implement-rationale.md) — the post-completion steps this contract's `Research drifted` line is now correctly attributed to
- [unikit-explore save rationale](unikit-explore-save-rationale.md) — the rule classification this page's own split follows
- [Skills Reference](../skills.md) — what `/unikit-plan`, `/unikit-implement`, `/unikit-verify` and `/unikit-improve` do, for the people who use them
