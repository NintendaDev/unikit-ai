<!-- unikit:plan-mode:ultra -->
# Merchant trade — Tasks

Created: 2026-09-28
Updated: 2026-09-28
Planned at: abc1234

## Overview
Players trade items with merchants, and bought items land in the inventory.

## Settings
- Testing: yes
- Test checkpoints: phase
- Docs: no
- PR checkpoints: yes
## Modules
- M1 · Торговля · phase 1 · delivers: players can buy and sell at a merchant · PR: task 1.3
- M2 · Inventory · phase 2 · delivers: bought items land in the inventory

## Phase Index
1. [Phase 1: Торговля](phase-01-trade.md) — Tasks 1.1-1.3
2. [Phase 2: Inventory](phase-02-inventory.md) — Tasks 2.1-2.2

## Cross-Phase Dependencies
- Task 2.1 depends on Task 1.1 because the inventory receives what the merchant sells.

## Checklist
### Phase 1: Торговля
**Effort:** S
**Dependencies:** None
**Status:** [ ] Not started

- [ ] Task 1.1 — Цены у торговца ([details](phase-01-trade.md#task-11-цены-у-торговца))
  WHY: without prices nothing can be sold
  Files: `src/trade.ts`
- [ ] Task 1.2 — test checkpoint for phase 1 ([details](phase-01-trade.md#task-12-test-checkpoint-for-phase-1))
  WHY: the trade module is checked before its PR
  Test checkpoint: phase 1
- [ ] Task 1.3 — PR for trade ([details](phase-01-trade.md#task-13-pr-for-trade))
  WHY: the base branch takes the trade module whole
  PR checkpoint: Торговля → main
### Phase 2: Inventory
**Effort:** S
**Dependencies:** None
**Status:** [ ] Not started

- [ ] Task 2.1 — Items land ([details](phase-02-inventory.md#task-21-items-land))
  WHY: bought items must go somewhere
  Files: `src/inventory.ts`
- [ ] Task 2.2 — full test run ([details](phase-02-inventory.md#task-22-full-test-run))
  WHY: the final full run
  Test checkpoint: plan

## Commit Plan
### Commit 1: after tasks 1.1-1.3
feat(trade): players can trade with merchants
### Commit 2: after tasks 2.1-2.2
feat(inventory): bought items land in the inventory

## MCP Findings

## Rule Candidates

| id | rule | full formulation | from | status |
|---|---|---|---|---|

## Test Runs

---

## Technical Context
### CONTEXT
Demo.
