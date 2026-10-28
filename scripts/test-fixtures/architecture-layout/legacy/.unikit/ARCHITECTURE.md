# Architecture: Layered Architecture

## Project

A single-player puzzle game for mobile and desktop.

## Tech Stack

| Category | Technology |
|----------|-----------|
| Engine | Generic engine 1.0 |
| DI | Constructor injection |
| Storage | JSON files |

## Documentation Sources

Use the library documentation through the documentation server when it is connected.

## Architecture Overview

The game is organised in three layers: Presentation, Domain and Infrastructure. Presentation never talks to Infrastructure directly; every call goes through a Domain interface.
A second line of the same paragraph says why: the team is small and the layers keep the review surface narrow.

The patterns in use:
- **Strategy** — the storage backend is chosen at startup
- **Event bus** — Domain announces changes, Presentation listens

## Folder Structure

```
Game/
├── Presentation/   views and navigation
├── Domain/         rules, services, models
└── Infrastructure/ storage, network, platform
```

## Dependency Rules

- ✅ Presentation depends on Domain
- ✅ Infrastructure depends on Domain
- ❌ Domain must NOT depend on Presentation or Infrastructure
- ❌ Views never reference the storage layer
  - not even through a helper class
- ❌ The save module (`Domain/Save`) must NOT call `Infrastructure/Network`

## Cross-Module Communication

| From | To | Mechanism |
|------|----|-----------|
| Presentation | Domain | direct calls through interfaces |
| Domain | Presentation | event bus, `OnChanged` |
| Save | Infrastructure | `IStorage` — `read(a\|b)` |
| Save | Domain | migration steps registered in `SaveMigrations` |

## Module Boundary Strategy

Modules are separated by folders and build files.

### Naming

Each module folder starts with a capital letter. See [the naming guide](docs/naming.md) for exceptions.

### Public API

A module exposes interfaces in `Public/` and keeps the implementation in `Internal/`.

## Save System

The save module writes versioned JSON files:

```json
{ "version": 3,

  "slots": [] }
```

- Each save carries a `version` field
- Migrations are versioned:
1. bump the version
2. add a migration step
- Old files are read, never rewritten in place

  A migration never deletes data it does not understand.

Saves are written on a background thread.

## Key Principles

1. Explicit over implicit
2. Small modules
3. One owner per file

## Anti-Patterns

- ❌ God services

## Reserved For Later

## Detailed Rules

---

For framework-specific rules see:

- **`.unikit/RULES.md`** — coding conventions
- **`.unikit/memory/code/RULES_INDEX.md`** — index of the rule files
