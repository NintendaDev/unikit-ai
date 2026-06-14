# Game Design Rules Index

Knowledge base rules for the game-design module. Located in `.unikit/memory/gamedesign/`.

## How to use this index

You were directed here by a game-design skill or subagent. Both tiers are
**load-on-demand** — load a rule only when the current task matches its **Load
When** column; nothing here is mandatory-gated.

The cross-skill *working contract* (collaboration protocol, section-cycle
authoring discipline, one-way boundary, delta discipline, severity rubric) is NOT
a rule in this index — it is the `gd-principles` system asset
(`.unikit/system/gd-principles.md`), loaded once at Bootstrap. This index holds
domain *knowledge*, not process.

### Override Priority (highest wins)

1. **`.unikit/RULES.md`** — project-specific overrides (always wins)
2. **`.unikit/gamedesign/GAME.md`** — the project's own design truth (pillars, anti-pillars, design decisions)
3. **Library rules** (`.unikit/memory/gamedesign/library/`) — the studio's own custom design rules
4. **Core rules** (`.unikit/memory/gamedesign/core/`) — canonical, official-backed design knowledge

When a project decision (RULES.md / GAME.md) or a studio custom library rule conflicts with canonical core knowledge, the project's / studio's decision wins.

### Step 1: Load RULES.md

Read `.unikit/RULES.md` before loading any rule below. It contains project-specific overrides that take highest priority.

### Step 2: Load Core rules (on demand)

Core rules are canonical design knowledge (frameworks, balance, economy, progression, level design, narrative, UX, accessibility, liveops, monetization ethics). Load a core rule ONLY when the current task involves the design domain described in its **Load When** column.

The **Origin** column tells you where each installed rule resolved from (per-rule B-merge):

- `custom` — a studio override of the canonical rule; this project's version wins and does NOT auto-update from upstream
- `official` — the canonical rule from the official registry
- `bundled` — the canonical rule from the packaged fallback snapshot

### Step 3: Load Library rules (on demand)

Library is the studio's own custom-rule slot — empty by default. Load a library rule when the task involves the design topic in its **Load When** column.

## Core (`.unikit/memory/gamedesign/core/`)

| File | Description | Origin | Load When |
|------|-------------|--------|-----------|
<!-- CORE_TABLE -->

## Library (`.unikit/memory/gamedesign/library/`)

| File | Description | Load When |
|------|-------------|-----------|
<!-- LIBRARY_TABLE -->
