# Unity Engine Reference

Engine-specific details for the unikit-architecture skill when working with Unity projects.

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

Markers: `ProjectSettings/ProjectVersion.txt` exists, or `*.asmdef` files found in project tree.

## Primary Language

C# (`.cs` files). Version typically C# 9.0+ with Unity 6 / Unity 2022+.

## Scan Targets

**Fixed directories** (scan if they exist):

| Directory | What to look for |
|-----------|-----------------|
| `Assets/Modules/` | Custom reusable modules (SignalBus, SaveSystem, EventBus, etc.) — list each subfolder |
| `Assets/Plugins/` | Third-party plugins (Zenject, DOTween, UniTask, R3, etc.) — identify key frameworks |
| `Assets/Third-Party Assets/` | Store assets and tools (NodeCanvas, Odin, Inventory systems, etc.) |

Run `ls Assets/` first to see the actual top-level structure.

## Script Directories (Auto-Detect)

Scan whichever of these exists — these are common conventions:

| Directory | Convention |
|-----------|-----------|
| `Assets/Scripts/` | Most common default |
| `Assets/Game/Scripts/` | Organized by project name |
| `Assets/_Project/Scripts/` | Underscore-prefix convention |
| `Assets/_Scripts/` | Underscore-prefix variation |
| `Assets/Code/` | Alternative naming |
| `Assets/[ProjectName]/` | Named after the project |

Identify which folder(s) contain project-specific scripts by checking for `.cs` files or
subfolders like `Systems/`, `Controllers/`, `Views/`, `UI/`, `Core/`, etc.

## Module Boundary Mechanism

**Assembly Definition files** (`.asmdef`) — the real dependency graph of the project.

```
Glob: **/*.asmdef
```

Read a representative sample (especially root-level and module-level asmdefs) to understand:
- Module boundaries
- Namespace conventions (typically `Modules.{ModuleName}`)
- Dependency directions between modules
- Which modules reference which plugins

**Best practices:**
- Each module gets its own `.asmdef` — enforces dependency boundaries at compile time
- Test assemblies reference the module they test + test framework
- Avoid circular references — extract a shared interface module instead
- Root game assembly can reference all modules, but modules must NOT reference the game assembly
- Use `internal` access modifier + `[InternalsVisibleTo]` for test access when needed

## DI Frameworks

| Indicator | Framework |
|-----------|-----------|
| `Zenject` or `Extenject` in Plugins or asmdef references | Zenject DI |
| `VContainer` in Plugins or asmdef references | VContainer DI |
| Neither found | Manual DI or no DI |

**Zenject-specific pattern indicators:**
- `Installer.cs` files — installer pattern for DI bindings
- `ScriptableObjectInstaller` — root DI entry points
- `.NonLazy()` bindings for controllers/presenters (self-driven)
- Never `PlaceholderFactory` — plain C# factory classes instead

## Pattern Indicators

Unity-specific files/patterns to look for beyond the generic ones:

| Pattern | File/Folder indicator |
|---------|----------------------|
| MV* pattern | `*View.cs`, `*ViewModel.cs`, `*Presenter.cs`, `*Model.cs` |
| GRASP controllers | `*Controller.cs` |
| Zenject installers | `*Installer.cs` |
| SignalBus / EventBus | `SignalBus/`, `EventBus/`, `MessageBus/` in Modules |
| Save system | `SaveSerializer`, `SaveData` classes |
| Loading system | `ILoadingOperation`, `LoadingOperations/` folder |

## Component Model

**MonoBehaviour** — Unity's base component class attached to GameObjects.
In well-architected projects, MonoBehaviour is used only for:
- Views (visual representation)
- Physics interactions
- Scene bootstrapping

Business logic lives in plain C# classes, using Zenject lifecycle interfaces
(`IInitializable`, `ITickable`, `IDisposable`) instead of `Awake`/`Update`/`OnDestroy`.

## ECS Implementation

**DOTS (Data-Oriented Technology Stack)** — Unity's ECS implementation:
- `IComponentData` — pure data components
- `ISystem` / `SystemBase` — systems that process components
- `Entity` — lightweight entity handle
- Requires `com.unity.entities` package

## UI / MVVM Binding Frameworks

| Framework | Description |
|-----------|-------------|
| ASPID MVVM | `MonoView<TViewModel>` — custom MVVM binding |
| UI Toolkit | Unity's retained-mode UI with data binding (Unity 6+) |
| UGUI | Legacy immediate-mode UI (`Canvas`, `Image`, `Text`) |

## Cross-Module Communication (Engine-Specific)

| Pattern | Mechanism | Notes |
|---------|-----------|-------|
| ScriptableObject Events | SO-based event channels | Designer-friendly, scene-independent |
| ReactiveProperty (R3) | Observable state from R3 library | `.AddTo(this)` for MonoBehaviour, `.AddTo(disposables)` for plain classes |
| Zenject Signals | Zenject's built-in signal system | Some projects use custom SignalBus from Modules instead |
| UnityEvent | Serialized event in Inspector | Good for designer-facing hooks, avoid in code-to-code communication |

## Scene Architecture

| Pattern | Description |
|---------|-------------|
| Bootstrap + Gameplay | Bootstrap scene initializes core systems (DI, services), then loads Gameplay scene |
| Additive scenes | Multiple scenes loaded together via `SceneManager.LoadSceneAsync(Additive)` |
| Addressables-based | Scene loading through Addressables asset management system |

Typical entry point: `Assets/[Project]/Scenes/Bootstrap.unity`

## Asset Loading

| System | Description |
|--------|-------------|
| Addressables | Unity's asset management system — async loading, memory management, remote content |
| Resources | Legacy synchronous loading from `Resources/` folder (avoid in production) |
| AssetBundle | Low-level async loading (Addressables wraps this) |

## Async Patterns

| Approach | Notes |
|----------|-------|
| UniTask | Zero-allocation async/await for Unity. Preferred over Coroutines |
| Coroutines | Legacy Unity async. Avoid in new code |
| C# Tasks | Standard .NET Tasks — avoid in Unity due to threading concerns |

Every async method should accept `CancellationToken cancellationToken` as last parameter.
Use `async UniTask` or `async UniTaskVoid`, never `async void`.

## Key Anti-Patterns

Unity-specific things to watch for in the architecture document:

- **`System.Linq` in hot paths** — causes allocations; use `ZLinq` or explicit `for` loops
- **`SetActive` for UI toggling** — use `canvas.enabled = false` to preserve vertex buffer
- **`async void`** — always `async UniTask` or `async UniTaskVoid`
- **Missing CancellationToken** — every async method must accept it
- **Forgotten R3 subscriptions** — always `.AddTo()` to avoid leaks
- **Dictionary for serialized fields** — use serializable lists with lookup methods
- **Modifying `Assets/Third-Party Assets/` or `Assets/Plugins/`** — never touch third-party code
