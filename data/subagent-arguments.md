# Subagent arguments — the model and the effort of a delegated call

Read by a skill before the first dispatch of a delegation alias, together with `.unikit/config.yaml`, once per skill run and never at Bootstrap. Do not restate this contract inside a skill — a skill names the rule and points here; a copy that repeats it drifts, and no test turns red when the two disagree. The pointer in the skill names this agent's two config keys and its built-in default model; this file says what to do with them.

## Which aliases take arguments

`recon-agent`, `check-agent`, `lens-agent` and `recon-writer-agent` take a model and an effort argument. `develop-agent` and `docs-agent` load a skill and take neither: they run on the model and the effort of the session.

## The two arguments, settled separately

The model and the effort are settled one after the other, each by the same three steps, and the answer for one never depends on the other. A missing config file, block or key is not an error.

1. **The user's explicit word.** The request that started the skill asks for the argument in so many words: "use opus for the subagents", "effort high for the delegated work". That value is passed as written, the effort level in lower case. A remark about depth in general — "think deeper", "be thorough" — is not an instruction.
2. **The config key.** `subagents.model.<agent>` or `subagents.effort.<agent>` holds a value: pass it. It holds `inherit` (in any letter case), or is present and empty: pass nothing — the subagent runs on the model, or the effort, of this session.
3. **No key.** The model falls back to the built-in default named by the pointer: pass it, and when it is `inherit` or an empty string pass nothing. The effort has no built-in default: pass nothing, so a project without the key behaves as it did before.

A value is passed exactly as the runtime's call spells its argument (see the next section); UniKit keeps no list of models or levels, and a version-specific name is never written here.

## Argument names per runtime

| Agent id | Model argument | Effort argument |
|----------|----------------|-----------------|
| `claude` | `model` | `effort` — `low`, `medium`, `high`, `xhigh` or `max` |
| `codex` | `model` | `reasoning_effort` — the valid values depend on the model of the subagent |
| `antigravity` | `Model` | none: the subagent call of this runtime has no effort argument |
| any other id | the runtime's own spelling, when its call has a model argument | none is known |

## Letter case

An effort level goes into the call in lower case: a level the user or the config wrote as `High` or `MEDIUM` is lowercased first, and the word `inherit` is compared without regard to case. A model name is passed as written.

## No argument to pass

The runtime's call has no effort argument and the user asked for one in so many words (step 1): the subagent still runs, without it, and one line is printed:

`WARN [delegation] effort "<value>" is not supported by this runtime's subagent call — not passed`

A value that comes from a config key never prints this line: the template has no such key for these agents.

## A launch that fails

1. A call that carried an effort argument fails to launch: repeat it **once** without the effort and print `WARN [delegation] effort "<value>" rejected — retried on the session effort`. The repeat takes no effort from the request and none from the config.
2. That repeat fails too and a model argument was passed: repeat once more without the model and print `WARN [delegation] model "<name>" rejected — retried on the session model`.
3. A call that carried only a model fails: repeat it once without the model and print the same model line.

The runtimes refuse differently — one rejects a level outside its list before the subagent starts, another answers with an error that names the value and the model — and the rule is the same for both. A model and an effort that do not fit together (a level the chosen model lacks) is for the user to fix in the config; the repeat drops the effort and keeps the model.
