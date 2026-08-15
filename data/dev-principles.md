# Engine Development Principles

This file is the canonical source of {{engine_name}} development principles and workflow. Installed by `unikit-ai init` / `unikit-ai update` into `.unikit/system/dev-principles.md` with `{{engine_*}}` vars substituted. Loaded by `/unikit-implement`, `/unikit-fix`, `/unikit-verify`, `/unikit-improve`, `/unikit-devcontext`.

## Core Principles

1. Write clear, concise, well-documented {{engine_code_language}} code adhering to {{engine_name}} best practices
2. Prioritize performance, scalability, and maintainability in all decisions
3. Leverage the engine's component-based architecture for modularity and efficiency
4. Implement robust error handling, logging, and debugging practices
5. Consider cross-platform deployment and optimize for various hardware
6. Respond in the configured language — use `language.ui` from `.unikit/config.yaml` (default: English)

## Workflow

**{{engine_mcp_tool}} availability:** At the start of work, check if {{engine_mcp_tool}} is configured in your agent's MCP configuration. Remember the result — it affects steps 1, 2, and 5 below. If {{engine_mcp_tool}} is not configured, skip all {{engine_mcp_tool}}-related actions silently.

**Per-MCP overrides:** the four supported engine MCP servers differ sharply in what they can actually do. Where a project has one configured, its profile lives in `.unikit/system/engine-mcp/` (`capabilities.md`, `scene-authoring.md`, `verification.md`) and **overrides** the generic guidance below. Example: with Fennara on Godot, `.gd` files must be written through `write_or_update_file` — it is the only call that triggers the editor rescan, so a direct write leaves the editor out of sync. If the file is absent, or this skill does not read it, the base rules here apply unchanged.

1. **Source files vs editor state.** Write source files (`.cs` / `.gd` / `.cpp`) **directly** through Read / Edit / Write — {{engine_mcp_tool}} is not the tool for that. For **editor-side work** — scenes, prefabs, components, assets, materials, UI, VFX, animation — {{engine_mcp_tool}} is the **preferred** path, but the choice stays yours. The criterion: use {{engine_mcp_tool}} when the change touches the editor's **serialized state**; edit directly when the target is a plain text or config file.
2. **Confirm by reading, not by the response code.** After creating or modifying scripts, check the engine console via {{engine_mcp_tool}} for compilation errors and fix them before reporting the task as done. The same rule holds for every editor-side write: read the changed state back. A `success` response is not evidence — silent no-ops are confirmed on two of the four supported MCP servers.
3. NEVER write inline comments in code
4. ALWAYS update documentation after editing methods
5. Create unit tests for all functionality. Run them through {{engine_mcp_tool}} where it can report results. If `.unikit/system/engine-mcp/verification.md` marks the tests gate **GATE LIFTED** for the configured server, that overrides the run-through-MCP part of this rule (some servers start a test run and never return a result) — the requirement to *have* tests stands, only the way to execute them changes. File absent, or this skill does not read it → the base rule applies.
6. When you add a `// TODO:` comment in code, also run `/unikit-todo` with the TODO description translated to the language from `.unikit/config.yaml` (`language.artifacts`). The TODO comment in code stays in English (code convention), but the task description is written in the project's configured language
