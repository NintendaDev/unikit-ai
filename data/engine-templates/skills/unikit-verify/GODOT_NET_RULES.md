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

## Editor Target Checks

Applies to plan tasks carrying an `Editor:` line. These targets changed the editor's **serialized state**, so there is nothing in the sources to grep — each is confirmed by **reading the state back through the MCP**, one signal per `kind`.

The right column names the **class of evidence** the signal requires, never the call that produces it. A class survives a server change; a name does not, and a name that has gone stale reads as an instruction to do the wrong thing. Resolve the affordance from the live catalog by intent.

Before you resolve it, read the project's rules for this server: grep the check table in `.unikit/system/engine-mcp/INDEX.md` for your task's `kind` area plus every cross-cutting area, and read `.unikit/system/engine-mcp/verification.md` in full — that file is read by this skill and no other. Both are optional. Their absence means there are no known exceptions for this server, never that there are no capabilities, and it never turns a target into `⏸️ MANUAL`. Report `⏭️ SKIPPED (editor target, MCP unavailable)` only when the affordance is absent and you established that by trying; never substitute a lookalike.

| kind | signal to confirm | what closes it (`dev-principles.md` → A2) |
|------|-------------------|-------------------------------------------|
| `scene` | the node exists at the stated path | *the thing exists in the project* — read it from the project, not from a catalog and not from memory |
| `scene` | the script is attached and the node is of the expected type | *the thing exists in the project* — read the node's own property set back |
| `scene` / `asset` | the exported property holds the intended value | *a field or property changed* — read that field back after the write |
| `scene` / `ui` | the wired node path or resource reference **resolves** | *a field or property changed* — read the reference field back off the object itself. A structural checker that answers "clean" is a `lying validator` candidate: it may corroborate, never close |
| `ui` / `vfx` / `anim` | the node is present in the scene and carries the change | both classes, in that order — *exists in the project*, then *a field or property changed* on it |
| `asset` | the resource exists at the stated path and is of the expected type | *the thing exists in the project* — read it back from the project by its path. A typed resource is backed by a class marked `[GlobalClass]`, so the type is carried by the script path the resource points at: compare that path, not a display name |
| `settings` | the layer, autoload, or input action is registered | *the thing exists in the project* — read the setting back out of the project's own settings state |

Three rules that keep this honest:

1. **A `success` response is not evidence.** Every one of these is a *read*, taken after the write, precisely because success codes are unreliable (`false success`). Do not accept the writing call's own answer.
2. **A field left at its default is indistinguishable from a field never set.** When the intended value equals the type default, confirm through a second signal (the node's presence, or a neighbouring property) rather than reporting a pass on an ambiguous read.
3. **A read-back reflects the editor's state, not the disk.** If the file was written behind the editor's back, the editor may not have re-read it, and its diagnostics then describe the previous contents. Read a contradiction between diagnostics and a file you just wrote as a missing reload, not as a defect in the change — that is a stale read wearing the mask of a `lying validator` (`dev-principles.md`, the false-success entry and D1). On this engine that read costs a full project rebuild — seconds per call — so **batch it**: make all the edits, then take one diagnostic pass at the end, never one per target.

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
