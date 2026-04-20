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
