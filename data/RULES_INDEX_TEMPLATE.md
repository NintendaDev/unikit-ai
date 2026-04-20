# Rules Index

Knowledge base rules for the project. Located in `.unikit/memory/`.

## How to use this index

You were directed here by a skill or subagent. The name after "instructions for" in that directive is **your identity** — use it when checking the Required By column below.

### Override Priority (highest wins)

1. **`.unikit/RULES.md`** — project-specific overrides (always wins)
2. **`.unikit/ARCHITECTURE.md`** — project architecture decisions
3. **Core rules** (`.unikit/memory/core/`) — universal best practices
4. **Stack rules** (`.unikit/memory/stack/`) — framework-specific knowledge

When a project rule in RULES.md or ARCHITECTURE.md conflicts with a core or stack rule, the project rule wins.

### Step 1: Load RULES.md
Read `.unikit/RULES.md` before loading any rule below. It contains project-specific overrides that take highest priority.

### Step 2: Load Core rules
For each row in the Core table, check the **Required By** column:
- `all` → **MUST load** (mandatory for every skill and subagent)
- Contains your name → **MUST load**
- Does NOT contain your name and is NOT `all` → **skip**

### Step 3: Load Stack rules (on demand)
Load ONLY when the current task involves the framework described in the **Load When** column.

## Core (`.unikit/memory/core/`)

| File | Description | Required By | Load When |
|------|-------------|-------------|-----------|
<!-- CORE_TABLE -->

## Stack (`.unikit/memory/stack/`)

| File | Description | Load When |
|------|-------------|-----------|
<!-- STACK_TABLE -->
