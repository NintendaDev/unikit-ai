## Gate calibration

| gate | reachable | what proves it |
|---|---|---|
| compilation | yes | errors with coordinates, and only through the journal — the editor state snapshot carries no error field |
| console | yes | clearing as a marker before the change and the delta after; there are no timestamps and no watermark |
| structure | yes | reading the state back, one level per call; two independent domain checks rather than a single aggregate button |
| references | yes | the built-in integrity check finds exactly two classes of defect — lost scripts and broken prefab instances. "Clean" here means those two are absent |
| tests | yes | a run with a readable result. **Require: number of tests > 0** — a project with no tests reports passed |
| behaviour | partly | a deterministic stepped physics run with the full post-state of the bodies. Scripted behaviour and input are out of reach |
| visual | partly | a frame — yes, including a six-angle sheet. There is no baseline and no comparison |

`GATE LIFTED` is not pre-declared here. Unreachability is established by a run:
you tried, the affordance is absent, you produced the evidence of its absence —
only then is the gate lifted, and with a reason.
