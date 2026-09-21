# Research link — the `## Based on` contract

`/unikit-plan` and `/unikit-improve` write entries under a plan's `## Based on` section. `/unikit-implement`, `/unikit-verify` and `/unikit-improve` check them. Read this file only when a plan links at least one research, never at Bootstrap. The hashed region is declared by `/unikit-explore`'s manifest template.

Do not restate this contract inside a skill — that is the failure mode this file exists to prevent. A skill **names** the rule and points here; a skill that **repeats** the rule drifts from it, and nothing turns red when the two disagree.

## The entry

One entry per linked research, under `## Based on`:

```
### <slug>
- **Summary SHA256**: <64 hex chars>
- `RESEARCH.md` — the manifest; its `## Active Summary` is the declared input
- `CONTRACTS.md` — interfaces, patterns, files, DI bindings (include only if the file exists)
- `SOURCE.md` — original exploration dialogue (include only if the file exists)
```

Example:

```
### customer-items-on-scene
- **Summary SHA256**: 9f2c1d4e7a05b83c6e1f0a94d27b5c38ea6417d9b0c25f83a1e46d7c92b0f5a1
- `RESEARCH.md` — the manifest; its `## Active Summary` is the declared input
- `CONTRACTS.md` — interfaces, patterns, files, DI bindings
- `SOURCE.md` — original exploration dialogue
```

The heading is the folder name, whatever that name is. A folder created before dateless naming keeps the form `YYYY-MM-DD_name` — an entry reading `### 2026-03-15_customer-items-on-scene` is exactly as valid as the example above. Full paths resolve from `.unikit/code/researches/<slug>/`.

An entry carrying `- **Brief SHA256**: …` predates this field — the retired brief field, hashed `RESEARCH_BRIEF.md`. It is never recomputed against the summary; see `## Checking an entry` → **unknown (retired field)**.

## What is hashed

The bytes between the `## Active Summary` markers of `RESEARCH.md`, and nothing else.

| Region / file | Hashed |
|---|---|
| `RESEARCH.md` → between the `## Active Summary` markers | yes |
| `RESEARCH.md` → `## Findings`, `## Sessions`, the header | no |
| `SOURCE.md`, `CONTRACTS.md`, ADR, C4, the dependency graph | no |

## Computing the hash

### Normalization

0. Extract the text between `<!-- unikit:active-summary:start -->` and `<!-- unikit:active-summary:end -->`, excluding the marker lines themselves. Both markers are matched as whole lines. If either is missing, or either occurs more than once, the region is undefined: omit the `Summary SHA256` line and print `WARN [research] <folder>: Active Summary markers missing or duplicated — drift detection disabled for this link`.
1. Strip a leading **UTF-8 BOM** if present.
2. LF line endings — strip every carriage return (`CR`, byte `0x0D`).
3. Trim trailing spaces from every line.
4. Exactly **one final newline**.
5. Preserve line order and leading whitespace — do not reformat.

HTML comments inside the region are kept in the hashed text; only the two marker lines are excluded, by rule 0. Rule 0 runs on text already read, not by a separate shell command — it needs no grant of its own.

### Digest

Feed the normalized text through stdin, **never a temp file**:

```
… | shasum -a 256 | awk '{print $1}'
```

Fall back to `sha256sum` when `shasum` is unavailable. This is the one digest step every `Summary SHA256` uses — the same step other short texts are hashed by, `tree-sha256` among them. Normalization above is specific to the region this contract defines; the digest step is not.

## Writing an entry

Compute the digest when the summary is read; write it when the entry is written.

These branches omit the `Summary SHA256` line entirely rather than write a placeholder:

- No SHA256 tool available: print `WARN [research] no SHA256 tool available — drift detection disabled for this link`.
- No `RESEARCH.md` for the linked research: print `WARN [research] <folder>: no RESEARCH.md`.
- `## Active Summary` markers missing or duplicated: print `WARN [research] <folder>: Active Summary markers missing or duplicated — drift detection disabled for this link`.

No placeholder, no timestamp: an absent field is honester than a field that looks like a hash and is not one. Drift detection is a convenience, not a gate — none of these branches blocks the write that carries the rest of the entry.

## Checking an entry

Only when the entry carries a `Summary SHA256`. An entry with neither hash field is resolved by the **unknown (no hash)** outcome below, without recomputing anything.

Recompute the digest over the linked research's current `## Active Summary`, by the procedure above, and compare it against the recorded `Summary SHA256`:

- **match** — say nothing, continue.
- **drift** — recomputed ≠ the recorded `Summary SHA256`. Print `WARN [research-drift]: <folder> — the linked Active Summary is no longer byte-identical to the one this plan was built from`.
- **source missing** — `RESEARCH.md` is missing or unreadable, or its `## Active Summary` markers are absent or duplicated. Print `WARN [research-drift]: <folder> source missing`.
- **unknown (retired field)** — the entry carries a `Brief SHA256` and no `Summary SHA256`; nothing is recomputed. Print `WARN [research-drift]: <folder> drift unknown (recorded against the retired brief field)`. Never read a digest recorded against the retired brief field as a `Summary SHA256`.
- **unknown (no hash)** — no hash field of either name is recorded. Print `WARN [research-drift]: <folder> drift unknown (no hash recorded)`.
- **no tool** — neither `shasum` nor `sha256sum` is available. Print `WARN [research-drift]: no SHA256 tool available — drift checks skipped` once for the whole run.

`WARN [research-drift]` is the one label for every outcome above. Do not fall back to any older timestamp field. Every outcome continues against the plan, never against the research: a reader does not widen scope, add work or rewrite a recorded hash. The fix for both **unknown** outcomes is a re-link through `/unikit-improve`.

## Who writes the field

- `/unikit-plan` — on create, for every research the plan links.
- `/unikit-improve` — on attaching a new research; on an approved re-link, writing an entry that carries none; on an explicit rebase request.
- A stale hash is evidence of drift and is never silently rewritten.
- The on-disk plan migration does not fill this field.
- A reader never writes it while reading.

<!-- Why each rule exists: docs/skills/research-link-rationale.md in the UniKit repository. -->
