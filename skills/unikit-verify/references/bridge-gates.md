# Gates across engine bridges

Read this file once, in Step 0, when `.unikit/system/engine-bridges/BRIDGES.md` lists at least one bridge. It keeps the gate contract of `/unikit-verify` — `GATE LIFTED` stays a verdict this skill produces and never a line it reads — and says how that contract runs over several bridges.

## Gate names
Every `verification.md` uses the same seven names: `compilation · console · structure · references · tests · behaviour · visual`. A bridge's file lists the gates it can speak about, not all seven. A name outside the list is read as written and reported as a defect of that file.

## Reading the calibrations
For every bridge listed in `BRIDGES.md` whose block names a rules tree, read `.unikit/system/engine-bridges/<bridge>/verification.md` in full — this skill and no other reads it. A bridge without one has no calibration: every gate applies in full for it (`.unikit/system/dev-principles.md` → A9). A missing calibration is a missing hint, not a missing obligation.

## Running one gate
For the gate a step asks for, walk the bridges in the order `.unikit/system/dev-principles.md` → D3 gives and stop at the first that closes it with evidence of the class A2 requires:

1. The bridge's row for the gate says what proves it there and how far it is reachable (yes · partly · no). **partly** means "closed by the compensation the row names", never "lifted".
2. A bridge whose `available when` row fails is skipped for this gate with one line — `Gate <name>: <bridge> unavailable - <the observation>` — and the walk goes on.
3. A gate ends in one of three outcomes, and only these:
   - **closed** — report the bridge and the evidence, and nothing else;
   - **`GATE LIFTED`** — a verdict this skill produces, never a line it reads. `verification.md` pre-declares nothing. A gate is lifted only when you tried it **on every bridge that was available**, found no affordance on any of them, and can present the evidence of each absence; skip it and note the reason as the observation that established it. Lifting a gate on one bridge while another could close it is a substituted observation: do not do it;
   - **no engine bridge available** — none answers at all: skip with the wording of the step.
4. Do not substitute a cheaper **class of evidence** for a lifted gate (A2) and never report it as passed. Trying the same gate through the next bridge is not a substitution — it is the next route.

## Editor targets (Step 1)
Verify each target by reading the editor state back. Prefer a bridge other than the one that wrote it: a second bridge is an independent detector (D3). The per-target checks come from `ENGINE_RULES.md`; steps 1-3 of D6 run per target on the bridge you read through. A target the bridge cannot read back although you hold the schema is the dead end of the library reference (`.unikit/system/dev-principles.md` → D8): the collected documentation first, then the library the bridge's block names; report it as D8 prescribes.

## The report
One line per gate names the bridge that closed it: `Compilation: ✅ <bridge> · ⏭️ no engine bridge available · gate lifted - <observation>`. The `unikit-gate-result` block keeps its shape; a lifted or unavailable gate stays a warning, as before.
