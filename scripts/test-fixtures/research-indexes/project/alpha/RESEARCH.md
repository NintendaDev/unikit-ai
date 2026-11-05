# Save routing proposal

Created: 2026-10-01 10:00
Updated: 2026-11-05 12:34
Status: completed
Lifecycle: active
Target: SYS-save

## Active Summary
<!-- unikit:active-summary:start -->
Topic: Compare asynchronous save routing for Unity and Godot projects with multiple save slots, shared serializer ownership, concurrent scene transitions, cancellation during shutdown, and recovery after a failed write; the proposal remains conditional on measuring allocation costs and is not an accepted implementation decision.
- F-1: Existing serializer ownership is shared.
- OQ-1: Are cancellation allocations acceptable? Measure before accepting the proposal.
Next step: Measure allocations before choosing a route.
<!-- unikit:active-summary:end -->

## Findings
### F-1
The existing serializer has multiple callers.
### OQ-1
No allocation measurements have been made.

## Sessions
<!-- unikit:sessions:start -->
### 2026-11-05 12:34 — Compare approaches
- Gate: passed (1 passes)
<!-- unikit:sessions:end -->
