---
version: 2.0.0
---

# UniTask (multi-version v2)

> **Scope**: Stack rule at v2.0.0 — upgraded snapshot used by sync upgrade tests.
> **Load when**: running rules-cli sync tests that exercise the v1 → v2 upgrade path.

---

This body line is intentionally unique to v2 so tests can grep for
`multi-version v2` after a sync to assert the upgraded content landed on disk.
The v1 snapshot prints a different sentinel line.

sentinel: v2
