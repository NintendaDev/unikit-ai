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
