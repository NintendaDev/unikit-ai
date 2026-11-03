# Architecture — Save system

## Dependency Rules

- ❌ The save module must NOT call the network layer

## Contracts

| From | To | Mechanism |
|------|----|-----------|
| Save | Storage | `IStorage` |
| Save | Domain | migration steps registered in `SaveMigrations` |

## Mechanism

Saves are versioned JSON; a migration never deletes data it does not understand.
