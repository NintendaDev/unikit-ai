# Unreal Engine 5 Reference

Engine-specific details for the unikit-architecture skill when working with Unreal Engine 5 projects.

## Table of Contents

- [Engine Detection](#engine-detection)
- [Primary Language](#primary-language)
- [Scan Targets](#scan-targets)
- [Script Directories (Auto-Detect)](#script-directories-auto-detect)
- [Module Boundary Mechanism](#module-boundary-mechanism)
- [DI Frameworks](#di-frameworks)
- [Pattern Indicators](#pattern-indicators)
- [Component Model](#component-model)
- [ECS Implementation](#ecs-implementation)
- [UI / MVVM Binding Frameworks](#ui--mvvm-binding-frameworks)
- [Cross-Module Communication (Engine-Specific)](#cross-module-communication-engine-specific)
- [Scene Architecture](#scene-architecture)
- [Asset Loading](#asset-loading)
- [Async Patterns](#async-patterns)
- [Key Anti-Patterns](#key-anti-patterns)

## Engine Detection

Markers: `*.uproject` file in the project root, or `Source/` directory with `*.Build.cs` files,
or `Config/DefaultEngine.ini` exists.

Read `*.uproject` (JSON) — `EngineAssociation` field gives the engine version (e.g., `"5.4"` or a GUID for source builds).

## Primary Language

C++ (`.h` / `.cpp` files). Blueprints (`.uasset`) are used alongside C++ for designer-facing logic.

Projects range from pure C++ to Blueprint-heavy with a thin C++ layer. Check `Source/` for C++
and `Content/Blueprints/` for Blueprint assets to gauge the balance.

## Scan Targets

**Fixed directories** (scan if they exist):

| Directory | What to look for |
|-----------|-----------------|
| `Source/` | Game modules — each subfolder with `*.Build.cs` is a module |
| `Plugins/` | Project-local plugins — each subfolder with `*.uplugin` is a plugin |
| `Content/` | Assets, Blueprints, levels, UI widgets |
| `Config/` | Engine and project configuration (`DefaultEngine.ini`, `DefaultGame.ini`, etc.) |

Run `ls` on the project root first to see the top-level structure.
Read `*.uproject` for the list of enabled plugins and project modules.

## Script Directories (Auto-Detect)

UE has a strict convention — source code lives under `Source/`:

| Directory | Convention |
|-----------|-----------|
| `Source/[ProjectName]/` | Main game module (always present) |
| `Source/[ProjectName]/Public/` | Public headers — module API |
| `Source/[ProjectName]/Private/` | Implementation files (`.cpp`) |
| `Source/[OtherModule]/` | Additional game modules (sibling folders) |
| `Plugins/[PluginName]/Source/[ModuleName]/` | Plugin source code |

Each module follows the `Public/` + `Private/` split. Public headers define the module's API;
private files contain implementation details invisible to other modules.

Also check for Blueprint-heavy projects: `Content/Blueprints/` or `Content/[ProjectName]/Blueprints/`.

## Module Boundary Mechanism

**Build scripts** (`*.Build.cs`) — the real dependency graph of the project.

```
Glob: **/*.Build.cs
```

Read a representative sample to understand:
- Module dependencies (`PublicDependencyModuleNames`, `PrivateDependencyModuleNames`)
- Module type and loading phase
- Include paths and compiler defines
- Which plugins each module depends on

Also check `**/*.Target.cs` for build target configuration (Game, Editor, Server targets).

**Best practices:**
- Each module gets its own `*.Build.cs` — enforces dependency direction at compile time
- `Public/` headers define the module API; `Private/` hides implementation
- `PublicDependencyModuleNames` exposes transitive headers; `PrivateDependencyModuleNames` does not
- Avoid circular dependencies — extract shared types to a common module
- Root game module can reference all modules, but utility modules should not reference the game module
- Use `MODULENAME_API` macro on classes/functions that must be visible to other modules

## DI Frameworks

Unreal Engine does not have mainstream DI frameworks. Service resolution relies on engine-native patterns:

| Approach | Description |
|----------|-------------|
| Subsystems | Scoped service objects — `UGameInstanceSubsystem`, `UWorldSubsystem`, `ULocalPlayerSubsystem` (UE's closest analogue to DI-registered services) |
| Gameplay Framework | `AGameModeBase` / `AGameStateBase` / `APlayerController` / `APlayerState` — the engine's built-in service hierarchy |
| Component injection | `UActorComponent` added to Actors — composition over inheritance |
| Manual DI | Constructor injection for non-UObject plain C++ classes (rare, but possible) |

**Detection:** Check `*.Build.cs` dependencies for `"GameplayAbilities"`, `"MassEntity"`, or subsystem patterns.
Grep for `UGameInstanceSubsystem`, `UWorldSubsystem` to see if subsystem-based architecture is in use.

If no explicit DI is detected, note "Subsystems + Gameplay Framework (engine-native)".

## Pattern Indicators

UE5-specific files/patterns to look for beyond the generic ones:

| Pattern | File/Folder indicator |
|---------|----------------------|
| Gameplay Ability System (GAS) | `GameplayAbilities` in `Build.cs` deps, `UGameplayAbility`, `UAttributeSet` classes |
| Subsystem-based services | `*Subsystem.h` files, classes inheriting `UGameInstanceSubsystem` / `UWorldSubsystem` |
| MV* pattern | `*ViewModel.h`, `UMVVMViewModelBase` (UE 5.3+ MVVM plugin) |
| Component architecture | `*Component.h` — `UActorComponent` / `USceneComponent` derivatives |
| GameMode / GameState | `*GameMode.h`, `*GameState.h` — Gameplay Framework pattern |
| Manager / Subsystem | `*Manager.h` or `*Subsystem.h` — centralized service pattern |
| Interface-based abstraction | `*Interface.h` — UE interfaces with `UINTERFACE()` / `IInterface` |
| Data Assets | `UDataAsset`, `UPrimaryDataAsset` — data-driven configuration |

## Component Model

**Actor + Component** — UE's core entity model.

| UE concept | Role |
|------------|------|
| `AActor` | Base entity placed in the world — has transform, lifecycle, replication |
| `UActorComponent` | Logic component attached to an Actor — no transform, pure behavior |
| `USceneComponent` | Component with transform — can be nested in a hierarchy |
| `UObject` | Base class for all engine objects — reflection, serialization, GC |
| `USubsystem` | Scoped singleton service — tied to GameInstance, World, or LocalPlayer lifetime |
| `UDataAsset` | Data container — designer-friendly configuration objects |

In well-architected UE5 projects:
- **Actors** represent world entities with visible presence
- **Components** add modular behaviors (movement, health, interaction)
- **Subsystems** provide scoped services (inventory backend, quest system, save manager)
- **Plain C++ classes** handle math, algorithms, and engine-independent logic
- **Blueprints** extend C++ base classes for designer iteration — heavy logic stays in C++

## ECS Implementation

**Mass Entity (Mass Framework)** — UE5's built-in data-oriented framework for large-scale simulation:
- `FMassFragment` — pure data components (analogous to ECS components)
- `FMassProcessor` — systems that operate on fragments
- `FMassEntityHandle` — lightweight entity handle
- `FMassArchetypeHandle` — groups entities with the same fragment layout
- Requires `MassEntity` plugin enabled in `.uproject`

Mass Entity is designed for crowd simulation, large AI groups, and traffic — not a general-purpose
replacement for Actor/Component architecture.

## UI / MVVM Binding Frameworks

| Framework | Description |
|-----------|-------------|
| UMG (Unreal Motion Graphics) | Primary UI system — `UUserWidget` Blueprint or C++ widgets, `UWidgetBlueprint` |
| CommonUI | Plugin for cross-platform UI — input routing, navigation stack, gamepad/mouse agnostic |
| Slate | Low-level C++ UI framework — used for editor tools and advanced runtime UI |
| UMG + MVVM (UE 5.3+) | Built-in MVVM plugin — `UMVVMViewModelBase`, declarative bindings in UMG |

**CommonUI indicators:** `CommonUI` in `.uproject` plugins or `Build.cs` dependencies,
`UCommonActivatableWidget`, `UCommonButtonBase` in source.

**MVVM indicators:** `ModelViewViewModel` plugin enabled, `UMVVMViewModelBase` subclasses,
`MVVM` in `Build.cs` dependencies.

## Cross-Module Communication (Engine-Specific)

| Pattern | Mechanism | Notes |
|---------|-----------|-------|
| Delegates (Dynamic) | `DECLARE_DYNAMIC_MULTICAST_DELEGATE` | Blueprint-compatible, slower, flexible |
| Delegates (Native) | `DECLARE_MULTICAST_DELEGATE` | C++-only, fast, zero overhead |
| Gameplay Tags | `FGameplayTag` / `FGameplayTagContainer` | Data-driven categorization and event matching |
| Gameplay Message Router | `UGameplayMessageSubsystem` | Decoupled message passing via gameplay tags (plugin) |
| Subsystem API | `GetSubsystem<T>()` | Direct service access scoped to GameInstance/World/LocalPlayer |
| Interfaces | `UINTERFACE()` + `IInterfaceName` | Polymorphic cross-module communication without hard dependencies |
| Event Dispatchers | `BlueprintAssignable` delegates on Actors/Components | Designer-friendly event hooks exposed in Blueprint |
| GAS Gameplay Events | `UAbilitySystemComponent::SendGameplayEventToActor` | Tag-based events within GAS ecosystem |

## Scene Architecture

| Pattern | Description |
|---------|-------------|
| Persistent + Streaming Levels | Persistent level always loaded, sublevels stream in/out based on proximity or triggers |
| World Partition | UE5 — automatic spatial streaming, replaces manual sublevel management for open worlds |
| Level Instances | Reusable level templates placed in the world (instanced sublevels) |
| Game Mode / Game State | `AGameModeBase` controls level rules and flow, `AGameStateBase` holds shared state |
| World Subsystems | `UWorldSubsystem` — services scoped to the current world/level |

Default map configured in `Config/DefaultEngine.ini`:
```ini
[/Script/EngineSettings.GameMapsSettings]
GameDefaultMap=/Game/Maps/[MapName]
EditorStartupMap=/Game/Maps/[MapName]
```

Typical entry points: `Config/DefaultEngine.ini` → `GameDefaultMap`, and the project's `AGameModeBase` subclass.

## Asset Loading

| System | Description |
|--------|-------------|
| Soft References | `TSoftObjectPtr<T>` / `TSoftClassPtr<T>` — lazy references resolved on demand |
| `FStreamableManager` | Async loading with callbacks — primary async asset loading API |
| Asset Manager | `UAssetManager` — high-level loading for `UPrimaryDataAsset` types with bundles |
| Hard References | Direct `UObject*` pointers — loaded immediately, increases memory footprint |
| Pak / IoStore | Packaged asset containers for shipping builds |

**Best practices:**
- Use `TSoftObjectPtr` for assets that are not always needed — avoids loading everything at startup
- `FStreamableManager::RequestAsyncLoad` for async loading with progress and completion callbacks
- `UAssetManager` for data-driven asset bundles (items, abilities, levels)
- Avoid hard references to large assets from always-loaded classes — this pulls entire asset chains into memory

## Async Patterns

| Approach | Notes |
|----------|-------|
| Delegates + Callbacks | UE's primary pattern — `FStreamableManager`, dynamic/native multicast delegates |
| Gameplay Tasks | `UAbilityTask` / `UGameplayTask` — scoped async tasks within GAS or gameplay lifecycle |
| Latent Actions | `UBlueprintAsyncActionBase` — Blueprint-friendly async nodes with execution pins |
| `FRunnable` / `FAsyncTask` | Low-level threading for CPU-heavy computation off the game thread |
| `Async()` / `AsyncThread()` | UE5 lambda-based task scheduling API |
| Timers | `FTimerManager` — deferred and repeating execution (not true async, runs on game thread) |

**Important:** UE's game thread owns all UObject operations. Background threads must not modify
UObjects directly — use `AsyncTask(ENamedThreads::GameThread, ...)` to marshal back.

UE does not use C++ coroutines (`co_await`) in production — delegates and task objects are the standard pattern.

## Key Anti-Patterns

UE5-specific things to watch for in the architecture document:

- **Hard references everywhere** — causes massive memory footprint; use `TSoftObjectPtr` for assets not always needed
- **God Actors** — single Actor class with thousands of lines; split into Components and Subsystems
- **Blueprint-only architecture** — complex logic in Blueprint spaghetti instead of C++ base classes; keep heavy logic in C++, expose knobs to Blueprint
- **Tick-heavy code** — everything in `Tick()` instead of event-driven; use delegates, timers, or `SetActorTickEnabled(false)` when not needed
- **Raw `new` for UObjects** — UObjects must be created with `NewObject<T>()` or `CreateDefaultSubobject<T>()` for GC to track them
- **Circular module dependencies** — Module A depends on Module B and vice versa; extract shared types to a common module
- **Casting instead of interfaces** — `Cast<ASpecificActor>()` everywhere creates hard coupling; use `UINTERFACE` for polymorphism
- **Ignoring Subsystems** — reinventing singletons with static pointers instead of using `UGameInstanceSubsystem` / `UWorldSubsystem`
- **Public headers in Private/** — placing headers in `Private/` that other modules need; move to `Public/` with `MODULENAME_API`
- **Modifying engine source or Marketplace plugins** — never touch `Engine/Source/` or third-party plugin code; extend through inheritance or composition
- **`UPROPERTY()` without proper specifiers** — forgetting `EditAnywhere`, `BlueprintReadOnly`, etc. leads to invisible or uneditable fields
- **GC reference leaks** — holding raw `UObject*` without `UPROPERTY()` — GC doesn't see the reference and may collect the object
