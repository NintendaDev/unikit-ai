# Architecture: Layered Architecture

> This file is the root: when it has a `## Topics` table, its sections apply to every task, and a topic file in `.unikit/architecture/` applies when the work matches its "Load when" — check again when the work moves to a new phase or area, and when unsure, load it.

## Project

A single-player puzzle game for mobile and desktop.

## Dependency Rules

- ✅ Presentation depends on Domain
- ❌ Domain must NOT depend on Presentation or Infrastructure
- ❌ Views never reference the storage layer

## Cross-Module Communication

| From | To | Mechanism |
|------|----|-----------|
| Presentation | Domain | direct calls through interfaces |

## Topics

| Topic | Load when |
|-------|-----------|
| [Networking](architecture/net.md) | sockets, network sync |
| [Save system](architecture/save.md) | saving and loading, save data, migrations |
| [UI views](architecture/ui.md) | UI screens, HUD, view models |

## Detailed Rules

- **`.unikit/RULES.md`** — coding conventions
