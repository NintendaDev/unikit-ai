## Gate calibration

| gate | reachable | what proves it |
|---|---|---|
| compilation | yes | errors with coordinates, available before the domain reload |
| console | yes | a marker before the change and the delta after |
| structure | yes | reading the state back; cheap in summary form, expensive in full. It does not tell a state left by a failed build from a successful one — the compilation gate does |
| references | yes | the built-in integrity check |
| tests | yes | a run with a readable result. **Require: number of tests > 0**, a scene that is not dirty, and discovery finished |
| behaviour | partly | the scenario run does not start in this version; closed by an engine test |
| visual | partly | a frame — yes. Comparison proves "nothing changed". The baseline lives in the client's working directory: **the gate is per-session, not per-project** |

`GATE LIFTED` is not pre-declared here. Unreachability is established by a run:
you tried, the affordance is absent, you produced the evidence of its absence —
only then is the gate lifted, and with a reason.
