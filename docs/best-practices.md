[← Agents](agents.md) · [Back to README](../README.md) · [Development Workflow →](workflow.md)

# Best Practices

### Always improve your plans

Always run `/unikit-improve` at least once after creating a plan. For complex tasks - run it 2-3 times.

LLM struggles to cover all code touchpoints and edge cases in a single pass, even with a 1M context window. The improve step lets the agent look at the plan from a different angle - finding problematic spots, missing tasks, and lost dependencies between components.

A plan that hasn't been through improve is a draft, not a plan.

### Use explore when you don't know where to start

If you have no clear understanding of how to implement new functionality in the game - run `/unikit-explore`. It's your best assistant for this.

It's configured for deep analysis of architectural decisions and delivers results as clear diagrams and logical chains. With it you can refine a vague idea into a concrete approach.

The exploration result can be saved to a file for reference, or you can immediately run `/unikit-plan` to create tasks from the exploration in the current session.

### Explore first, then fix unknown bugs

When facing a complex bug with unclear root cause - start with `/unikit-explore` and describe the problem. Explore will dig through the architecture, trace the logical chains, and pinpoint where things go wrong.

If explore finds the issue, run `/unikit-fix` right in the same session and ask it to fix the bug based on the exploration results. Fix will create the necessary patches, and through the evolve mechanism the framework's memory will be updated - so the framework accounts for these patterns in the future.

Nothing stops you from running `/unikit-fix` directly - that's a perfectly valid approach too. The explore step simply helps you understand the problem deeper and potentially uncover more complex interdependencies that a direct fix might miss.

This explore-then-fix pipeline turns an unknown bug into a documented fix with lasting knowledge.

### Execute plans in phases, not all at once

After creating a plan, implement it in separate phases rather than running full execution. This way the agent can focus better on each part and produce higher quality code.

### Review early, teach the agent

In the early stages it's highly recommended to review all the code the agent writes. If something doesn't look right - add project rules via `/unikit-rules`. If there are systematic mistakes - run them through `/unikit-fix` to create patches for self-learning.

The more you review the agent's work and tune its memory to your preferences, the fewer mistakes it makes in the future - and the less you'll need to supervise it over time.

### You are still the architect

Even a well-trained agent doesn't free you entirely from code review and project architecture decisions. The work simply transforms - it becomes different, not less.

Always read the plan the agent created. Does everything look right? If not - go back to exploration and update the plan. Ideally, scan through the code the agent produced and identify potential bottlenecks. These bottlenecks can be addressed again through the explore-plan cycle, or added as rules via `/unikit-rules` and processed through `/unikit-fix`.

The agent is a powerful tool, but the architectural vision and quality bar remain yours.

UniKit automates code writing, but a quality project requires quality documentation. Ideally you should create a game design document describing the MVP - written in plain language, explaining how the game will function. This document can then be broken down into strategic parts using `/unikit-roadmap`.

Each roadmap item may require research. `/unikit-explore` can help, but only partially. Sometimes you as the architect need to decide which frameworks and technologies to use, whether they'll work well together, and what combination fits best. This can be done in other AI tools as well - Claude, Gemini, and others. The important thing is to develop a clear project vision and have a description of the core gameplay loop in hand.

With these documents ready, you can start working with UniKit on solid ground. That's the ideal starting point.

### Test the game after each phase

Test the game after every completed plan phase. A plan can have many phases - execute them one at a time or in small groups, and verify everything works as intended after each one.

UniKit AI can write code, check for compilation errors, and even fix them automatically. But real behavior needs to be tested in the game itself, especially anything involving scene objects or UI.

It's much better to catch issues at phase one and apply a fix than to execute all 10 phases at once and discover that a fix would affect half of the completed work.

### Review code against project rules

Don't forget to run `/unikit-review`. It's your personal reviewer that knows all the project rules and checks written code for compliance. Run it at least once - ideally until it reports no issues, but even a single pass catches a lot.

After review you can run `/unikit-fix` - it will pick up the review results and offer to fix everything or specific items. And the fixes feed back into the self-learning cycle through the evolve mechanism.

### Run evolve regularly

Run `/unikit-evolve` when you accumulate more than 10 patches. This is essential for the framework's self-learning - evolve distills fix patterns into permanent rules, so the agent doesn't repeat the same mistakes across sessions.

## See Also

- [Development Workflow](workflow.md) - how to use the workflow skills
- [Skills Reference](skills.md) - full reference for all skills
- [Configuration](configuration.md) - `.unikit.json`, MCP servers, project structure
