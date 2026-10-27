[← Back to README](../README.md) · [Configuration →](configuration.md)

# Migrating to 3.0.0 - engine bridges

3.0.0 replaces "one engine MCP server per project" with an **ordered set of engine bridges**. A bridge is a way for an agent to reach the editor: an MCP server (kind `mcp`) or a command line (kind `cli`). The Unity CLI is the first command-line bridge. You can select several bridges; the agents use them in an order you set, and a check that one bridge cannot do is tried on the next.

## What `unikit-ai update` does for you

| Before (2.x) | After (3.0.0) |
|---|---|
| `.unikit.json`: engine and universal servers together in `mcp.servers`, plus `engineMcpKey` | `mcp.servers` holds only the universal servers (Context7, GitHub); the engine servers moved to `engineBridges.selected`; `engineMcpKey` is gone |
| `.unikit/MCP-RECHECK-NOTES.md` and `MCP-RECHECK-NOTES.archive.<server>.md` | `.unikit/bridge-notes/<bridge>.md` and `.unikit/bridge-notes/archive/<bridge>.md`; the header line `server:` became `bridge:` |
| `## MCP Findings` in every plan | `## Engine Bridge Findings` with a new last column `bridge`: an unfinished plan gets the server it had when that was the only one selected, otherwise `—`; an archived plan gets `—` |
| `Editor tasks: mcp` in plans | `Editor tasks: engine-bridge` |
| `.unikit/system/engine-mcp/` | `.unikit/system/engine-bridges/` - `BRIDGES.md` and one folder per bridge |
| skills `/unikit-mcp-trap` and `/unikit-mcp-audit` | `/unikit-bridge-trap` and `/unikit-bridge-audit` - installed in their place, no `--install-new` needed (only for agents that had the old ones) |
| skill `/unikit-devcontext` | `/unikit-execute` - installed in its place, no `--install-new` needed (only for an agent that had the old one). The skill now does one task from a description with no plan. A folder `.unikit/skill-context/unikit-devcontext/` is not moved: `update` names it in a warning, move it to `.unikit/skill-context/unikit-execute/` yourself. A rule of a studio registry whose `Required By` names `unikit-devcontext` stops matching until it names `unikit-execute` |

The migration is idempotent: a second `update` changes nothing. The plan files are rewritten **in your working tree and are not committed** - review the diff and commit it yourself.

If the package catalog cannot be read, the migration stops before it changes the config; reinstall the package and run `update` again.

Until a 2.x project has been updated, `unikit-ai rules sync` and `rules install` stop with exit code 8 ("project out of date"): run `unikit-ai update` first.

## What it does not do

- It does not install the Unity CLI or the `com.unity.pipeline` package. `init` prints the setup lines; `/unikit` checks the environment at the end of setup and asks before it runs `unity pipeline install`.
- It does not install the new skill `/unikit-references`. Answer "yes" to the new-skills question of `update`, run `unikit-ai update --install-new`, or tick it in `init` (group Tools).
- It does not choose an order. A migrated project has one bridge, so the default order is that bridge. The setting `engine_bridges.order` (see [Configuration](configuration.md#engine_bridges-section)) is added to your `.unikit/config.yaml` by `/unikit` in its config-update mode.

## Steps for a Unity project

1. Run `unikit-ai update` and commit the plan changes it made.
2. To add the Unity CLI: install it, run `unikit-ai init` and tick **Unity CLI** in the group "Engine bridges". Then run `/unikit` and pick the environment check from its returning-project menu - it checks the CLI and the package and offers `unity pipeline install`, which runs only after you confirm.
3. With more than one bridge, `/unikit` asks the order the first time it adds the setting: ask it to "update the config" and it appends `engine_bridges.order` and asks the order in the same run. Change it any time: say "make Biome the main bridge" to `/unikit`, or edit `engine_bridges.order` in `.unikit/config.yaml`. No `init`, no `update`, no reinstall.

A bridge you install **after** `init` is registered by running `unikit-ai init` again and ticking it; `/unikit` tells you when it finds one on the machine that you did not select.

## For extension authors (breaking)

Four public template variables were replaced. The old names are no longer substituted; a token with an old name stays in your text as written and is named only under `--verbose`.

| Removed | Use instead |
|---|---|
| `{{system_engine_mcp_dir}}` | `{{system_engine_bridges_dir}}` - `.unikit/system/engine-bridges` |
| `{{engine_mcp_rules_index}}` | `{{engine_bridges_manifest}}` - `.unikit/system/engine-bridges/BRIDGES.md`; the rules tree of a bridge is `<bridge>/INDEX.md` under the directory variable |
| `{{engine_mcp_rules_verification}}` | none - `<bridge>/verification.md` under `{{system_engine_bridges_dir}}` |
| `{{engine_mcp_tool}}` | `{{engine_bridge_mcp_code}}` - the vendor code of the MCP-kind bridge with the lowest default order, `EngineMCP` when none is selected |

A manifest that names a renamed skill (`replaces`, `injections[].target`: `unikit-mcp-trap`, `unikit-mcp-audit`, `unikit-devcontext`) is read as the new name, with a warning - update the manifest.

## Unity's own agent plugin

When an AI agent runs the Unity CLI, the CLI suggests Unity's own agent plugin: under Claude Code it prints one line on stderr (`<claude-code-hint … value="unity@claude-plugins-official" />`, which Claude Code turns into an install offer), and for other agents the tip travels inside the JSON answer (`AGENT_PLUGIN_AVAILABLE`). That plugin carries a second set of rules for the same CLI, and two rule sets in one project may disagree. UniKit does not install or require the plugin. The call forms UniKit prints carry `--quiet`, which hides the hint line (measured on 1.0.0-beta.14), so UniKit's own calls do not show it; a command you or an agent run without `--quiet` may. If you do not want the hint at all, set the environment variable Unity documents for it (`UNITY_NO_AGENT_HINTS`) in your own shell. If you do use the plugin, keep in mind that the agent follows both sets of instructions.
