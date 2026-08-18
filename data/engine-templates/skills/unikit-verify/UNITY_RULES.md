# Engine Rules: Unity

Engine-specific verification checks for Unity projects.

## Companion File Checks (.meta pairing)

Every file and directory under `Assets/` **MUST** have a paired `.meta` file. This is a Unity hard requirement — missing `.meta` files cause broken references and GUID conflicts.

### New files without .meta

For each new file in `CHANGED_FILES` under `Assets/`:

```bash
# Find new files without .meta pair
git diff --name-only --diff-filter=A $BASE_BRANCH...HEAD | grep '^Assets/' | grep -v '\.meta$' | while read f; do
  if [[ ! -f "${f}.meta" ]] && ! git diff --name-only --diff-filter=A $BASE_BRANCH...HEAD | grep -q "^${f}.meta$"; then
    echo "MISSING .meta: $f"
  fi
done
```

### Orphan .meta for deleted files

For each deleted file, verify the paired `.meta` is also deleted:

```bash
git diff --name-only --diff-filter=D $BASE_BRANCH...HEAD | grep '^Assets/' | grep -v '\.meta$' | while read f; do
  if ! git diff --name-only --diff-filter=D $BASE_BRANCH...HEAD | grep -q "^${f}.meta$"; then
    echo "ORPHAN .meta: ${f}.meta not deleted"
  fi
done
```

### Directories

New directories under `Assets/` must also have `.meta` files.

## Module Boundary Checks (asmdef)

Verify new/modified files don't violate module boundaries defined in `.unikit/ARCHITECTURE.md`.

### Fallback rules (if ARCHITECTURE.md unavailable)

- `Assets/Modules/` → `Assets/Game/` — **FORBIDDEN**
- `Assets/Game/Scripts/` → `Assets/Modules/` — allowed
- `Assets/Modules/` → `Assets/Modules/` — allowed through interfaces

### Check

For each modified `.cs` in `Assets/Modules/`:

```bash
grep -rn 'using Game\.' Assets/Modules/ --include='*.cs'
```

If found — boundary violation.

## Leftover Debug Artifacts

Check for `Debug.Log` calls not wrapped in conditional compilation:

```bash
# Find Debug.Log outside #if DEBUG blocks
grep -rn 'Debug\.Log' --include='*.cs' <changed_cs_files>
```

Each finding should be cross-referenced with surrounding `#if DEBUG` / `#endif` blocks. Unwrapped `Debug.Log` in production code is a warning (strict mode: failure).

## Editor Target Checks

Applies to plan tasks carrying an `Editor:` line. These targets changed the editor's **serialized state**, so there is nothing in the sources to grep — each is confirmed by **reading the state back through the MCP**, one signal per `kind`.

Tool names below are the Unity Biome set (`order: 1`, the default Unity server). On any other configured server, take the equivalent from its `verification.md` / `scene-authoring.md` shard — **the shard wins over this table**. If a signal has no tool on the configured server, report `⏭️ SKIPPED (editor target, MCP unavailable)`; never substitute a lookalike.

| kind | signal to confirm | read it back with |
|------|-------------------|-------------------|
| `scene` | the object exists at the stated hierarchy path | `get_hierarchy` · `find_objects` · `get_object_detail` |
| `scene` | the component is present on that object | `get_component` · `inspect` |
| `scene` / `asset` | the serialized field holds the intended value | `inspect` · `get_object_detail` |
| `scene` / `ui` | the wired reference is **not** `null` (no missing-reference) | `validate_references` · `lint_scene_refs` · `inspect` |
| `ui` / `vfx` / `anim` | the object exists inside the prefab and carries the change | `prefab` · `get_hierarchy` |
| `asset` | the asset exists at the stated path and is of the expected type | `asset` |
| `settings` | the layer, tag, or input axis is registered | `project_settings` |

Two rules that keep this honest:

1. **A `success` response is not evidence.** Every one of these is a *read*, taken after the write, precisely because success codes are unreliable. Do not accept the writing call's own answer.
2. **A field left at its default is indistinguishable from a field never set.** When the intended value equals the type default, confirm through a second signal (the object diff, or the component's presence) rather than reporting a pass on an ambiguous read.

### `.meta` is verified but never planned

The two statements below are not in conflict — they are about different phases:

- **Planning:** `.meta` files are never planned as tasks. Unity generates and maintains them on refresh, so a task that creates or edits one is always wrong (see the planning vocabulary in the `unikit-plan` skill's `ENGINE_RULES.md`, section 4).
- **Verification:** `## Companion File Checks (.meta pairing)` above still runs in full. A missing or orphaned `.meta` is a real defect regardless of whether anyone planned it — that is exactly why it is checked after the fact rather than before.

## Read-Only Paths

These directories must NOT be modified. Ignore them during checks and flag any changes as errors:

- `Assets/Third-Party Assets/`
- `Assets/Plugins/`
- `Library/`
- `Temp/`

## Strict Mode Items

Items that are **always checked** (both normal and strict mode) and always fail on violation:

| Check | Details |
|-------|---------|
| `.meta` file pairing | Every file/directory under `Assets/` must have `.meta` |
| Module boundary violations (asmdef) | No forbidden cross-assembly references |
