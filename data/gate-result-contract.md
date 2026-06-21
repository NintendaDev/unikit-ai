# Machine-Readable Quality Gate Result Contract

Quality gate skills keep their human-readable markdown report first, then append one final fenced JSON block for orchestrators.

Orchestrators must parse the last `unikit-gate-result` fenced block in the final gate output. Earlier fences in documentation, examples, or quoted prior output are illustrative and are not the gate result.

Supported gates:
- `verify` for `/unikit-verify`
- `review` for `/unikit-review`

The fenced block language must be exactly `unikit-gate-result`.

```unikit-gate-result
{
  "schema_version": 1,
  "gate": "verify",
  "status": "fail",
  "blocking": true,
  "blockers": [
    {
      "id": "verify-task-1",
      "severity": "error",
      "file": "Assets/Scripts/Example.cs",
      "summary": "Required behavior is missing."
    }
  ],
  "affected_files": ["Assets/Scripts/Example.cs"],
  "suggested_next": {
    "command": "/unikit-fix",
    "reason": "Blocking implementation gaps remain."
  }
}
```

## Schema

```text
"schema_version": 1
"gate": "verify|review"
"status": "pass|warn|fail"
"blocking": true|false
"blockers": [
  {
    "id": "stable-finding-id",
    "severity": "error|warning",
    "file": "optional/path",
    "summary": "short human-readable summary"
  }
]
"affected_files": ["path/to/file"]
"suggested_next": {
  "command": "/unikit-fix|/unikit-rules|/unikit-architecture|/unikit-roadmap|/unikit-commit|null",
  "reason": "short rationale or null"
}
```

Rules:
- The fenced block contains JSON only. Do not include comments, trailing commas, Markdown bullets, or prose inside it.
- `status` must be one of `pass`, `warn`, or `fail`.
- `blocking` must be a boolean.
- `blockers` contains only findings that should block the current quality gate. Non-blocking notes stay in the human summary.
- `blockers[].severity` uses the shared gate scale: `error` for blocking findings and `warning` only when policy treats a warning-class finding as blocking. A review's 4-level severity rubric maps to this scale (`Critical`/`Warning` -> `error`; `Medium`/`Suggestion` -> non-blocking human note unless policy escalates them).
- `affected_files` is a predictable top-level array of files the gate actually evaluated or cited in the result. It is not limited to blocker files, and it should not include unrelated repository files. Use an empty array when no specific files apply.
- `suggested_next.command` must come from the global allowlist: `/unikit-fix`, `/unikit-rules`, `/unikit-architecture`, `/unikit-roadmap`, `/unikit-commit`, or `null`. Each gate may document a narrower subset for its own outputs.
- The JSON block appears after the human-readable summary so manual workflows remain readable.

## Status Semantics

- `pass`: the gate completed without blocking or warning findings.
- `warn`: the gate completed with non-blocking findings, missing optional context, ambiguous evidence, accepted skips, or advisory rules notes.
- `fail`: the gate found at least one blocker that should stop commit, merge, deploy, or implementation handoff.

## Suggested Next Command

Allowed commands by gate:
- `verify`: `/unikit-fix`, `/unikit-rules`, `/unikit-architecture`, `/unikit-roadmap`, `/unikit-commit`, or `null`.
- `review`: `/unikit-fix`, `/unikit-rules`, `/unikit-architecture`, `/unikit-roadmap`, `/unikit-commit`, or `null`.

- `/unikit-fix`: code, tests, config, or documentation must be corrected.
- `/unikit-rules`: rules are missing, ambiguous, or need a writer-owned update.
- `/unikit-architecture`: architecture context is stale or violated.
- `/unikit-roadmap`: roadmap context is stale, missing, or contradicted.
- `/unikit-commit`: the gate is clean and committing is the natural next step.
- `null`: no UniKit command is appropriate.
