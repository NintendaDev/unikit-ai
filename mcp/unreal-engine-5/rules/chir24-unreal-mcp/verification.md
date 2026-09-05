## Gate calibration

| gate | reachable | what proves it |
|---|---|---|
| structural | yes | a full object listing of the current level, read independently of any editor action that changed it |
| compile | unmeasured | the native-language build tool was found in the catalog but not exercised in this run — establish reachability by trying it |
| console | no | a command sent through the console/test-invocation channel answered with the command it ran and no outcome field, on at least one measured call — indistinguishable in form from a genuine result; read the target state back independently instead |
| runtime | yes | entering and leaving the runtime play mode, confirmed structurally by an independent state read of the running world |
| visual | yes | a captured frame of the editor, confirmed independently by reading the resulting file's own size and resolution off disk |

`GATE LIFTED` is not pre-declared here. Unreachability is established by a run:
you tried, the affordance is absent, you produced the evidence of its absence —
only then is the gate lifted, and with a reason.
