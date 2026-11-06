# Research link — the `## Based on` contract

Read only when a plan links a research.

## The entry

```
### <folder name>
- **Summary SHA256**: <64 hex chars>
- `RESEARCH.md` — the manifest; its `## Active Summary` is the declared input
- `CONTRACTS.md` — interfaces, patterns, files, DI bindings (if the file exists)
- `SOURCE.md` — original exploration dialogue (if the file exists)
```

## Finding the folder

`.unikit/code/researches/<slug>/`, else `.unikit/code/archive/researches/<slug>/` (`INFO [research] <slug> is archived`). Both: `INFO [research] <slug> exists in researches/ and in archive/researches/ — reading researches/`. Neither exists: **source missing**. Ordinary discovery searches active research only.

## Computing the hash

`node .unikit/system/research-hash.mjs <folder>/RESEARCH.md` prints the digest of the text between the `## Active Summary` markers (`<!-- unikit:active-summary:start -->`, `<!-- unikit:active-summary:end -->`). Exit 2: markers missing or duplicated. Exit 3: no readable file. Any other failure, no `node` included: **unavailable**.

## Writing an entry

Run it when the summary is read. No digest: omit the line and print `WARN [research]: <folder> — <reason> — no drift detection for this link`.

## Checking an entry

`## Finding the folder`, run the script, compare with the recorded `Summary SHA256`:

- **match** — silent.
- **drift** — `WARN [research-drift]: <folder> — Active Summary changed since the plan was built`.
- **source missing** — neither folder exists, exit 2 or 3: `WARN [research-drift]: <folder> source missing`.
- **unknown (retired field)** — only `Brief SHA256`: `WARN [research-drift]: <folder> drift unknown (recorded against the retired brief field)`.
- **unknown (no hash)** — `WARN [research-drift]: <folder> drift unknown (no hash recorded)`.
- **unavailable** — `INFO [research-hash] <folder>: check skipped — <reason>`.

A reader continues against the plan and never rewrites a hash. **unknown** is fixed by a re-link through `/unikit-improve`.

## Who writes the field

`/unikit-plan` on create; `/unikit-improve` on attach, approved re-link or explicit rebase. A stale hash is never silently rewritten.
