# Project Rules

Project-specific rules that override or extend the base knowledge rules in `.unikit/memory/`.
One rule per line, one directive per rule. No sections.

---

## Architecture

- Never use var — always declare explicit types
- Event subscriptions go before any fallible operation in OnInit;
  unsubscribe in OnExit even when OnInit threw.

## UI

* Use canvas.enabled instead of SetActive for UI toggling
+ Views never reference services directly <!-- @no-migrate -->
1. Screens open through the navigator
2) Popups close through the navigator

Some prose that is not a list item
but spans two lines.

## Save system

- Save data goes through the SaveService:
```csharp
saveService.Save(data);

saveService.Flush();
```
- Migrations are versioned:
1. bump the version
2. add a migration step

| Key | Value |
|-----|-------|
| a   | b     |

- Save files are JSON

  and carry a second paragraph as continuation
