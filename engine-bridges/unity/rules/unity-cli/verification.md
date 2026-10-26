## Gate calibration

| gate | reachable | what proves it |
|---|---|---|
| compilation | yes | errors with file, line, column and code from the compile call; the compilation-failed field lags one compile behind, so judge by the failed flag and the error list |
| console | yes | a cursor taken before the change and the delta after; the buffer holds two thousand entries, so compare with the dropped flag and the editor's own counters |
| structure | partly | narrow reads of objects, components and the open-scene list; the whole-scene read has no bound and fails above a nesting depth of sixty-two |
| references | partly | no call finds a lost reference - it reads as an empty field; closed by a scan written for the purpose and run through the code route |
| tests | yes | a run with a readable result. **Require: number of tests > 0** and every open scene saved first. A failed test is still a successful call: read the failed count and the status of each test |
| behaviour | partly | play mode with a wait on a condition inside the editor and a read of the state afterwards; scripted input is out of reach without the input package |
| visual | partly | a frame as an image at the size asked; there is no baseline and no comparison, and an overlay canvas is outside a camera frame |

`GATE LIFTED` is not pre-declared here. Unreachability is established by a run:
you tried, the affordance is absent, you produced the evidence of its absence —
only then is the gate lifted, and with a reason.
