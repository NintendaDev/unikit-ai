# Engine Rules: Unreal Engine 5

Engine-specific verification checks for Unreal Engine 5 projects.

## Structural Checks (UE5 Macros)

New C++ header files (`.h`) that define gameplay classes must include proper UE5 reflection macros. This is an early warning — without these macros, Unreal Header Tool (UHT) compilation will fail.

### UCLASS / USTRUCT / UENUM presence

For each new `.h` file in `CHANGED_FILES`:

```bash
# Check if file defines a class inheriting from UObject/AActor/etc.
grep -l 'class.*:.*public\s\+\(UObject\|AActor\|UActorComponent\|USceneComponent\|AGameModeBase\|APlayerController\|UUserWidget\|UGameInstanceSubsystem\|UWorldSubsystem\)' <new_h_files>
```

For each matched file, verify:
1. `UCLASS()`, `USTRUCT()`, or `UENUM()` macro is present before the class declaration
2. `GENERATED_BODY()` is present inside the class body
3. A paired `.cpp` file exists in the corresponding `Private/` directory

### UPROPERTY / UFUNCTION on exposed members

For new classes with `UCLASS()`: check that public/protected member variables have `UPROPERTY()` and exposed functions have `UFUNCTION()`. Missing macros mean the member is invisible to the editor, Blueprints, and serialization.

## Module Boundary Checks (Build.cs)

Verify module dependencies are correctly declared in `*.Build.cs` files.

### Check

For each new `#include` of a header from another module:
1. Identify the source module and target module
2. Verify the target module is listed in `PublicDependencyModuleNames` or `PrivateDependencyModuleNames` in the source module's `Build.cs`

```bash
# Find Build.cs files
find Source/ -name '*.Build.cs' 2>/dev/null
```

Defer to `.unikit/ARCHITECTURE.md` for the authoritative dependency rules. Flag circular dependencies.

### Public/Private directory split

New `.h` files that define the module's public API must be in `Public/`. Implementation-only headers should be in `Private/`.

Check: if a new `.h` file in `Private/` is `#include`-d by another module → it should be in `Public/` with `MODULENAME_API` export macro.

## Include Ordering

UE5 convention for `#include` ordering in `.cpp` files:

1. Matching header (`MyClass.h`)
2. Engine headers
3. Project headers
4. Third-party headers

Flag files where the matching header is not the first include.

## Editor Target Checks

Applies to plan tasks carrying an `Editor:` line. These targets changed the editor's **serialized state**, so there is nothing in the sources to grep — each is confirmed by **reading the state back through the MCP**, one signal per `kind`.

The right column names the **class of evidence** the signal requires, never the call that produces it. A class survives a server change; a name does not, and a name that has gone stale reads as an instruction to do the wrong thing. Resolve the affordance from the live catalog by intent.

Before you resolve it, read the project's rules for this server: grep the check table in `.unikit/system/engine-mcp/INDEX.md` for your task's `kind` area plus every cross-cutting area, and read `.unikit/system/engine-mcp/verification.md` in full — that file is read by this skill and no other. Both are optional. Their absence means there are no known exceptions for this server, never that there are no capabilities, and it never turns a target into `⏸️ MANUAL`. Report `⏭️ SKIPPED (editor target, MCP unavailable)` only when the affordance is absent and you established that by trying; never substitute a lookalike. Read those two files rather than reasoning from what you remember of the server: the exceptions that matter here are the ones written down there.

| kind | signal to confirm | what closes it (`dev-principles.md` → A2) |
|------|-------------------|-------------------------------------------|
| `scene` | the Actor exists in the level under the stated label | *the thing exists in the project* — read it from the project, not from a catalog and not from memory |
| `scene` | the component is present on that Actor | *the thing exists in the project* — read the Actor's own component set back |
| `scene` / `asset` | the property holds the intended value | *a field or property changed* — read that property back after the write |
| `ui` | the widget exists in the tree **and** its graph is compiled | both classes — *exists in the project*, then *a field or property changed*; compiling the graph and saving the package are **separate actions**, and the absence of either reads as "the change was not saved", not as "the change was not made" |
| `vfx` / `anim` | the asset exists and the track or module was added | both classes, in that order — *exists in the project*, then *a field or property changed* on it |
| `asset` | the asset exists and is of the expected class | *the thing exists in the project* — read it back from the project |
| `settings` | the key is present in the configuration | *the thing exists in the project* — read `Config/Default*.ini` directly |

Three rules that keep this honest:

1. **A `success` response is not evidence.** Every one of these is a *read*, taken after the write, precisely because success codes are unreliable (`false success`). Do not accept the writing call's own answer.
2. **A field left at its default is indistinguishable from a field never set.** When the intended value equals the type default, confirm through a second signal (the Actor's presence, or a neighbouring property) rather than reporting a pass on an ambiguous read.
3. **An edit in the editor marks a package dirty; it does not write it.** Until the graph is compiled and the package saved, the change does not exist on disk — and `git diff` is what shows that. So the base pair of evidence on this engine is **read-back plus `git diff`**: the read-back says the editor holds the change, the diff says the project does. Neither one alone closes a target here.

## Read-Only Paths

These directories must NOT be modified. Ignore them during checks and flag any changes as errors:

- `Intermediate/`
- `Binaries/`
- `DerivedDataCache/`
- `Saved/`
- `Config/` (engine-generated configs — manual edits are fragile)

## Strict Mode Items

Items that are **always checked** (both normal and strict mode) and always fail on violation:

| Check | Details |
|-------|---------|
| UE5 macro presence | `UCLASS`/`USTRUCT`/`UENUM` + `GENERATED_BODY()` on gameplay classes |
| Module boundary violations (Build.cs) | Dependencies must be declared in `PublicDependencyModuleNames`/`PrivateDependencyModuleNames` |
