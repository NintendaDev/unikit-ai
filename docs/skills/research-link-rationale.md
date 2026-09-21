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
research at all; that cost is exactly what moving the read to the gate avoids.

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

## `## What is hashed`

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

## `## Computing the hash` → Normalization

Every one of the five normalization rules exists because its absence produces a **false**
drift report on content nobody changed:

- **UTF-8 BOM** — this project's primary development platform is Windows, where editors commonly
  prepend a BOM; a summary re-saved with one gets a different hash for identical text.
- **CR / LF** — a checkout on Windows without `core.autocrlf` set correctly reintroduces `\r`
  bytes that never appear in the declared requirements.
- **Trailing spaces** — an editor's "trim on save" setting silently changes bytes at the end of
  wrapped lines.
- **One final newline** — the single most common byte-level diff between two saves of the "same"
  file.
- **No reformatting** (line order and leading whitespace preserved) — this is a prohibition on
  the *reader*, not a transformation: the summary carries fenced code blocks and indented list
  structure, and any well-meaning re-indentation of a stored comparison copy would break every
  hash ever recorded. There is no stored copy for this reason — nothing to align a corrected
  indentation against.

Rule 0 — extracting the region between the two markers — is asserted separately from the other
five because it is the only one that can regress **alone** without breaking the other five's
internal consistency: drop it, and the five surviving rules still describe a coherent procedure,
just applied to the wrong object (the whole manifest, whose `## Sessions` grows every save,
making every append report drift). It needs no grant of its own because it runs on text a skill
has *already read* — extraction is not a shell command, so `allowed-tools` is unchanged by the
move from a whole file to one region within it.

## `## Computing the hash` → Digest

`git hash-object` was considered and rejected. It would have reused the `Bash(git *)` grant a
skill already holds instead of adding `shasum`/`sha256sum`, and `.unikit/` is not gitignored so
the manifest is normally tracked — but the object it produces is SHA-1 with a blob header, while
the field is named `Summary SHA256`, and it would make drift detection depend on git in a tool
that explicitly supports `git.enabled: false`.

## `## Writing an entry`

An absent `Summary SHA256` line is honester than a field that looks like a hash and is not one.
The three no-tool/no-source/no-markers branches all omit the line entirely rather than write a
placeholder or fall back to a timestamp, because a placeholder invites exactly the reader
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
itself is deliberate: "no longer byte-identical to the one this plan was built from" claims
identity of *input bytes*, not a claim about the research author's intent — the summary is
rewritten wholesale on every save, so a mismatch proves the bytes changed, not that anyone
changed their mind. Claiming the latter would make a routine save read as a finding about the
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
| `RD-A` | The recorded field name and the full normalization procedure (incl. rule 0) are present in the contract; the two retired fields (`**Attached**`, `Brief SHA256`) survive only where a branch has to name them, in the contract and all four skills alike |
| `RD-B` | The `shasum`/`sha256sum` grant is present in all four skills, regardless of whether a skill still restates the procedure or only points at the contract |
| `RD-C` | One canonical `WARN [research-drift]` label in the contract's reader ladder, never in its writer section; `/unikit-implement` and `/unikit-verify` each project the drift result into their own second surface (the completion summary / the `unikit-gate-result` block) and never read the research brief as a substitute for the plan |
| `RD-D` | A hashless entry's re-link proposal is reachable end to end: raised as a finding in Step 1.5, surfaced in the Step 4 report, selectable, and the Step 5.5 write is gated on that approval — not merely present somewhere in the file |
| `RD-E` | The hashed object is a region (not a whole file) in the contract; the retired-field branch lives only in `## Checking an entry`, never in `## Writing an entry` or in `/unikit-plan`, which never reads an existing entry |
| `RD-F` | No skill or planner reference surface restates the contract — checked three ways: the four fixed procedure tokens are absent, no derived `WARN [...]: <text>` template is copied whole, and no 9-word run of the contract's substantive sections is reproduced (word-shingle detection, ported from `scripts/test-ultra-plan-contract.mjs`'s T17) |
| `RD-G` | The one degradation sentence is verbatim-identical and appears exactly once in each of the four skills |
| `RD-H` | The contract is read only within its research step's own section, never inside Bootstrap; the digest is computed at read/link time (`/unikit-plan` Step 2, `/unikit-improve` Step 1.5), never recomputed at the later write step (`/unikit-plan` Step 5, `/unikit-improve` Step 5.5) |
| `SA-1` | Every `export async function install*` in `system-assets.ts` is called from both `init.ts` and `update.ts` — derived from the source, not a maintained name list |
| `TC-24` | The literal `the same procedure as \`Summary SHA256\`` — the anchor `tree-sha256` shares with the contract: the digest *step* (stdin, `shasum` → `sha256sum`), never rule 0, which has no meaning for a text that is not an Active Summary |
| `Test 1b-rl` | `research-link.md` is delivered into `.unikit/system/` (update-path coverage — this project is set up via `run_update`); carries the region marker and the canonical `WARN [research-drift]` label; is a flat copy (no unresolved `{{vars}}`) |
| `Test 30l` | `research-link.md` is delivered on `update` with no prior `init`, and a tampered copy is refreshed from `data/` on the next `update` |

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
