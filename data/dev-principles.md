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

**{{engine_mcp_tool}} availability:** At the start of work, check if {{engine_mcp_tool}} is configured in your agent's MCP configuration. Remember the result — it affects steps 1, 2, and 7 below. If {{engine_mcp_tool}} is not configured, skip all {{engine_mcp_tool}}-related actions silently.

1. Do NOT use {{engine_mcp_tool}} for writing code. Use it only for checking logs and errors
2. After creating or modifying scripts, check engine console via {{engine_mcp_tool}} for compilation errors and fix them before reporting the task as done
3. NEVER write inline comments in code
4. ALWAYS update documentation after editing methods
5. Create unit tests for all functionality. Use {{engine_mcp_tool}} to run tests
6. When you add a `// TODO:` comment in code, also run `/unikit-todo` with the TODO description translated to the language from `.unikit/config.yaml` (`language.artifacts`). The TODO comment in code stays in English (code convention), but the task description is written in the project's configured language
