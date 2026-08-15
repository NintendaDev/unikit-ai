### One tool, 1381 actions

`ListTools` returns exactly one name: **`unreal`**. Everything goes through it
via four operations:

| operation | use |
|---|---|
| `search` | find the action that does what you want |
| `describe` | read its exact parameter schema |
| `execute` | run it |
| `configure` | server-side configuration, incl. category loading |

Behind that single name sit 23 internal parent tools and 1381 actions.

### 🔴 `allowed-tools` gives you no scoping here

Granting `unreal` grants **all 1381 actions**, including
`system_control.execute_python` (which carries `policy.consent: "none"` and
runs under the `Admin` principal by default). There is no way to narrow this
through the tool allow-list, and the UniKit config does not pretend otherwise.
Scope your own behaviour: only run the action the task calls for.

### Bootstrap — load the category you need

On the native transport only the `core` category is loaded
(`McpDynamicToolManager.cpp` disables non-root categories). Load the rest
explicitly:

```json
{"operation":"configure","tool":"manage_tools","action":"enable_category",
 "params":{"category":"gameplay" | "world" | "utility"}}
```

An action that "does not exist" is usually an action in an unloaded category.
Enable the category, then search again.

### Consent protocol — refusal then retry

154 of the 1381 actions refuse the first call and demand explicit consent:

```
1. execute the action        → refused, with the required capability named
2. re-execute the same call, adding
   consent: { capability: "<the one named in the refusal>", acknowledge: true }
```

The first refusal is part of the protocol, not an error. Read the capability
name out of the refusal rather than guessing it.

### Do not guess action names

With 1381 actions and 6 recent renames, guessing is unreliable. Always go
`search` → `describe` → `execute`. If `search` finds nothing, say so — do not
substitute a similar-looking action.
