# Experiment scenarios

Fifteen scenarios for `unikit-gd-experiment`, one folder each (`sNN-<name>/README.md`). Every
scenario here is checked by text only: the guards (EXP-10 in `scripts/test-skills.sh`) read the
source files of the skill and assert that the formulations each scenario relies on are still
present. Nothing in this folder was run in a client, and no claim about how a model behaves
follows from a green test.

Each README has five fixed sections — `## Scenario` (what the designer says), `## Setup` (what
exists), `## Expected`, `## Must not` and `## Anchors` — and an optional `## Run it yourself`.
An anchor is a line `- Anchor: <path inside the skill> :: <formulation>`: the guard fails when
the formulation disappears from that file.

A `project/` folder is a miniature project the scenario assumes. Its files are sample artifacts
in the format the skill writes; EXP-9 scans them for technical traces. To run a scenario
yourself, copy `project/` into a scratch project that has the skills installed, give the prompt
from `## Scenario`, and compare what happens with `## Expected` and `## Must not`.
