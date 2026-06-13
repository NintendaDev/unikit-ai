# Game Design Rules Index

Knowledge base rules for the game-design module. Located in `.unikit/memory/gamedesign/`.

## How to use this index

You were directed here by a skill or subagent. The name after "instructions for" in that directive is **your identity** — use it when checking the Required By column below.

### Override Priority (highest wins)

1. **`.unikit/RULES.md`** — project-specific overrides (always wins)
2. **`.unikit/gamedesign/GAME.md`** — the project's own design truth (pillars, anti-pillars, design decisions)
3. **Core rules** (`.unikit/memory/gamedesign/core/`) — collaboration protocol and authoring discipline
4. **Library rules** (`.unikit/memory/gamedesign/library/`) — domain design expertise

When a project rule or a GAME.md pillar conflicts with a core or library rule, the project's own decision wins.

### Step 1: Load RULES.md

Read `.unikit/RULES.md` before loading any rule below. It contains project-specific overrides that take highest priority.

### Step 2: Load Core rules

For each row in the Core table, check the **Required By** column:

- `all` → **MUST load** (mandatory for every game-design skill and subagent)
- Contains your name → **MUST load**
- Does NOT contain your name and is NOT `all` → **skip**

### Step 3: Load Library rules (on demand)

Load ONLY when the current task involves the design domain described in the **Load When** column (e.g. balance work loads `balance.md`, economy systems load `economy.md`).

## Core (`.unikit/memory/gamedesign/core/`)

| File | Description | Required By | Load When |
|------|-------------|-------------|-----------|
<!-- CORE_TABLE -->

## Library (`.unikit/memory/gamedesign/library/`)

| File | Description | Load When |
|------|-------------|-----------|
<!-- LIBRARY_TABLE -->
