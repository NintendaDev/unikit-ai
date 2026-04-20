---
version: 1.0.0
---

# Code Style (minimal-valid fixture)

> **Scope**: Minimal core rule used by rules-cli smoke tests — content is synthetic and has no real guidance.
> **Load when**: running rules-cli smoke tests, validating install/sync/status flows against a fake registry.

---

This rule is a fixture. It exists so `unikit-ai rules install code-style` can
write something under `.unikit/memory/core/` during a test run without touching
the bundled production registry snapshot.

The content hash is deterministic: any edit here will change the `installed_hash`
column recorded by install/sync in `.unikit.json`.
