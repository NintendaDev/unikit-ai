# Engine Rules: Godot 4 .NET

Engine-specific verification checks for Godot 4 .NET (C#) projects.

## C# Compilation Check

Verify the C# project compiles after implementation:

```bash
dotnet build --no-restore 2>&1
```

If compilation fails — display errors with file:line references. This is a blocking check in both normal and strict mode.

## .csproj Module Boundary Validation

If the project uses multiple `.csproj` files (multi-project layout):

### Check project references

```bash
# Find all .csproj files
find . -name '*.csproj' -not -path './.godot/*' 2>/dev/null
```

For each `.csproj`, read `<ProjectReference>` entries to build a dependency graph. Verify:
1. No circular project references
2. New `using` statements in changed files reference namespaces from declared project dependencies
3. Core/shared projects don't reference game-specific projects

### Single-project layout

If only one `.csproj` exists — defer module boundary checks to `.unikit/ARCHITECTURE.md` convention-based rules.

## C# Namespace Conventions

For each new or modified `.cs` file:

1. **Namespace presence** — every `.cs` file should declare a namespace
2. **Namespace-to-folder alignment** — namespace should match the file's directory path (e.g., `MyGame.Systems.Combat` for `Systems/Combat/`)
3. **Consistent root namespace** — all files should share a common root namespace matching the `.csproj` `<RootNamespace>`

Missing namespace is a warning (strict mode: failure).

## Companion File Checks

Godot .NET does not use companion files. **Skip companion file checks.**

## Scene File Consistency (.tscn)

Same as standard Godot — for each modified `.tscn` file in `CHANGED_FILES`:

1. **Script references** — verify that `[ext_resource]` entries pointing to `.cs` or `.gd` scripts reference files that exist
2. **Node structure** — check that `[node]` entries reference valid types
3. **Removed scripts** — if a `.cs` file was deleted, check that no `.tscn` still references it

```bash
# Find script references in changed .tscn files
grep -n 'path="res://.*\.\(cs\|gd\)"' <changed_tscn_files>
```

## project.godot Settings

If `project.godot` was modified in `CHANGED_FILES`:

1. **Autoload entries** — verify each autoload script/scene exists at the referenced path
2. **Main scene** — verify `run/main_scene` points to an existing `.tscn`
3. **Feature tags** — check `config/features` is consistent with the Godot version and .NET support

## Autoload Validation

For each autoload defined in `project.godot` → `[autoload]` section:

- Verify the referenced file (`.cs`, `.gd`, or `.tscn`) exists
- If it's a `.cs` file, verify it's a `partial` class extending `Node`

## addons/ Directory Structure

Same as standard Godot — each addon subfolder should contain `plugin.cfg` with required fields.
Flag changes to third-party addons.

## Module Boundary Checks

If multi-project layout: use `.csproj` references (see above).
If single-project: defer to `.unikit/ARCHITECTURE.md`.

Godot's native scene tree has no compile-time boundary enforcement beyond `.csproj` references.

## Read-Only Paths

These directories must NOT be modified. Ignore them during checks and flag any changes as errors:

- `.godot/`
- `addons/` (third-party only — project-owned addons are fine)
- `obj/`
- `.mono/`

## Strict Mode Items

Items that are **always checked** (both normal and strict mode) and always fail on violation:

| Check | Details |
|-------|---------|
| C# compilation | `dotnet build` must succeed |
| C# namespace conventions | Every `.cs` file must declare a namespace aligned to folder structure |
| .csproj boundary violations | No circular project references, no forbidden dependency directions |
| Scene file consistency | Script references in `.tscn` must point to existing files |
