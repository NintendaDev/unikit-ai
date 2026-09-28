<!-- unikit:plan-mode:ultra -->
# Legacy — Tasks

Created: 2026-09-01
Updated: 2026-09-01

## Settings
- Testing: yes
- Test checkpoints: phase

## Phase Index
1. [Phase 1: One](phase-01-one.md) — Tasks 1.1-1.2
2. [Phase 2: Two](phase-02-two.md) — Tasks 2.1-2.2
3. [Phase 3: Three](phase-03-three.md) — Tasks 3.1-3.2

## Checklist
### Phase 1: One
**Dependencies:** None

- [x] Task 1.1 — One ([details](phase-01-one.md#task-11-one))
  Files: `a`
- [x] Task 1.2 — PR one ([details](phase-01-one.md#task-12-pr-one)) → skipped
  PR checkpoint: One → main

### Phase 2: Two
**Dependencies:** Phase 1

- [x] Task 2.1 — Two ([details](phase-02-two.md#task-21-two))
  Files: `b`
- [x] Task 2.2 — PR two ([details](phase-02-two.md#task-22-pr-two)) → PR
  PR checkpoint: Two → main

### Phase 3: Three
**Dependencies:** Phase 2

- [ ] Task 3.1 — Three ([details](phase-03-three.md#task-31-three))
  Files: `c`
- [ ] Task 3.2 — full test run ([details](phase-03-three.md#task-32-full-test-run))
  Test checkpoint: plan

## Commit Plan
### Commit 1: after tasks 1.1-2.2
### Commit 2: after tasks 3.1-3.2
