HEAD: abc1234
Question: How does trading reach the inventory?

## Summary
- The trade service writes through the inventory facade.
- Touches: src/trade.ts, src/inventory.ts
- Forces: nothing
- Gaps: none

## Contents
| Section | Lines | Covers |
|---------|-------|--------|
| ## Current-Code Evidence | 21-24 | src/trade.ts, src/inventory.ts |
| ## Interfaces | 25-27 | TradeService.sell |
| ## Tests and Fixtures | 28-30 | none |
| ## Logging | 31-33 | none |
| ## Gaps | 34-35 | none |

## Current-Code Evidence
| Path | Symbols / lines | Why it matters |
|------|-----------------|----------------|
| src/trade.ts | TradeService.sell | writes the sold item |
## Interfaces
sell(itemId: string): void

## Tests and Fixtures
none

## Logging
none

## Gaps
none
