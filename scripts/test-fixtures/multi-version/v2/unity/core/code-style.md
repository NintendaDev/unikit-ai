---
version: 1.1.0
---

# Code Style (multi-version v2)

> **Scope**: Core rule at v1.1.0 used by multi-version smoke tests — bumped snapshot.
> **Load when**: running rules-cli sync upgrade tests against the multi-version fixture.

---

Fixture content changed from v1. The version bump in the frontmatter AND in
the manifest entry above is the signal Phase 2 of sync uses to decide "update
this rule".

sentinel: v2-core
