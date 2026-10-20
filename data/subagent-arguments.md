# Subagent arguments — the model and the effort of a delegated launch

Read before the first subagent a run launches — by a skill, through a delegation alias or on its own decision, and by a file agent that launches other agents — together with `.unikit/system/subagent-roles.md` and `.unikit/config.yaml`, once per run and never at Bootstrap. Do not restate this contract inside a skill — a skill names the rule and points here; a copy that repeats it drifts, and no test turns red when the two disagree. The pointer in the skill names this agent's two config keys and its built-in default model; this file says what to do with them.

## Every launch takes both arguments

Every subagent a skill launches takes a model and an effort argument — through a delegation alias, through a launch that carries no alias, or on a launch the skill decides on by itself or an extension adds. A file agent that launches other agents passes them as the `model` and `effort` parameters of its call. The call block of a skill draws each argument as a slot — `model: <model>` and `effort: <effort>` — spelled with the names of this runtime's call. A runtime whose call takes no model argument shows no model slot, and one whose call takes no effort argument shows no effort slot.

## The role of a launch

The role of a launch — reader, validator or executor — decides which config key it reads. The role comes from `.unikit/system/subagent-roles.md`: its table names the launch, and the rule at its end places a launch the table does not name. If that file cannot be read, print `WARN [delegation] subagent-roles table missing — every launch treated as an executor` and settle every launch as an executor.

## The two arguments, settled separately

The model and the effort are settled one after the other, each by the same three steps, and the answer for one never depends on the other. A missing config file, block or key is not an error.

1. **The user's explicit word.** The user has asked for the argument in so many words, in the request that started the skill or earlier in this session: "use opus for the subagents", "launch every subagent with effort high". That value is passed as written, the effort level in lower case, to every launch of the session whatever its role. A remark about depth in general — "think deeper", "be thorough" — is not an instruction.
2. **The config key.** `subagents.model.<agent>.<role>` or `subagents.effort.<agent>.<role>` holds a value: pass it. It holds `inherit` (in any letter case), or is present and empty: pass nothing — the subagent runs on the model, or the effort, of the agent that launches it. A key that does not hold a map of roles, such as the single value of an earlier release written under `subagents.model.<agent>`, is read as no key; a role missing from the map is no key either.
3. **No key.** The model falls back to the built-in default of the role: a reader and a validator use the default named by the pointer — pass it, and when it is `inherit` or an empty string pass nothing — and an executor uses `inherit`: pass nothing. The effort has no built-in default: pass nothing, so a project without the key behaves as it did before.

## Filling the slots

A slot with a value is filled with it, exactly as the runtime's call spells the argument; UniKit keeps no list of models or levels, and a version-specific name is never written here. A slot with nothing to pass is removed from the call together with its comma, and the text `<model>` or `<effort>` is never sent as written.

## Letter case

An effort level goes into the call in lower case: a level the user or the config wrote as `High` or `MEDIUM` is lowercased first, and the word `inherit` is compared without regard to case. A model name is passed as written.

## A subagent that launches subagents

A launch that passes no effort runs on the effort of the agent that launched it, so a subagent started by a subagent follows its launcher and not the session. A level the user named (step 1) does not reach a nested launch by itself: when the subagent you launch can launch subagents itself — it loads a skill, or it is a file agent that has the `Agent` tool — begin its prompt with one sentence, `The user asked for effort <level> for every subagent.`, and add `The user asked for model <name> for every subagent.` when a model was named. The subagent reads the sentence as the user's explicit word (step 1).

## No argument to pass

The user asked for an effort in so many words (step 1) and the call block shows no effort slot — the runtime's call takes no effort argument: the subagent still runs, without it, and one line is printed:

`WARN [delegation] effort "<value>" is not supported by this runtime's subagent call — not passed`

A value that comes from a config key never prints this line: the template has no such key for these agents.

## A launch that fails

1. A call that carried an effort argument fails to launch: repeat it **once** without the effort and print `WARN [delegation] effort "<value>" rejected — retried on the session effort`. The repeat takes no effort from the request and none from the config.
2. That repeat fails too and a model argument was passed: repeat once more without the model and print `WARN [delegation] model "<name>" rejected — retried on the session model`.
3. A call that carried only a model fails: repeat it once without the model and print the same model line.

The runtimes refuse differently — one rejects a level outside its list before the subagent starts, another answers with an error that names the value and the model — and the rule is the same for both. A model and an effort that do not fit together (a level the chosen model lacks) is for the user to fix in the config; the repeat drops the effort and keeps the model.
