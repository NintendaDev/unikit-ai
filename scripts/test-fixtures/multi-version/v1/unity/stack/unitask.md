---
version: 1.0.0
---

# UniTask (multi-version v1)

> **Scope**: Stack rule at v1.0.0 — baseline snapshot used by sync upgrade tests.
> **Load when**: running rules-cli sync tests that exercise the v1 → v2 upgrade path.

---

This body line is intentionally unique to v1 so tests can grep for
`multi-version v1` after an install or sync to assert the correct content
reached disk. The v2 snapshot prints a different sentinel line.

sentinel: v1
