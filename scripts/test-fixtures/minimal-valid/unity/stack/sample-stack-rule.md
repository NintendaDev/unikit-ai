---
version: 1.0.0
---

# Sample Stack Rule (minimal-valid fixture)

> **Scope**: Minimal stack rule used by rules-cli smoke tests — referenced by a single quickref doc.
> **Load when**: running rules-cli smoke tests that exercise stack install, sync, or reference fetching.
> **References**: .unikit/memory/stack/references/sample-stack-rule-quickref.md

---

This fixture rule ships one reference file (`sample-stack-rule-quickref.md`) so
reference-handling paths in `installOneRule` and `syncRulesState` are exercised
without pulling real framework docs into the test tree.
