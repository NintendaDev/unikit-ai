# Project Rules

Project-specific rules that override or extend the base knowledge rules in `.unikit/memory/`.
One rule per line, one directive per rule. When this file has a `## Topics` table, the rules under `## Common` apply to every task, and a topic file applies when the work matches its "Load when" — check again when the work moves to a new phase or area, and when unsure, load it.

## Topics

| Topic | Load when |
|-------|-----------|
| [Networking](rules/net.md) | sockets, network sync |
| [Save system](rules/save.md) | saving and loading, save data |
| [UI views](rules/ui.md) | UI screens, HUD, view models |

## Common

- Never use var — always declare explicit types
- Log through the project logger, never Debug.Log
