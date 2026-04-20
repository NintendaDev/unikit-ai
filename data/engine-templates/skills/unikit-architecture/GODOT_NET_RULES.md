# Godot .NET Reference (C#)

Engine-specific details for the unikit-architecture skill when working with Godot .NET (C#) projects.
For standard Godot (GDScript) projects, see `godot.md` instead.

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

Markers: `project.godot` file exists in the project root AND `.csproj` files found.

Check `project.godot` → `config/features` to detect Godot version (4.x vs 3.x).
Read `.csproj` to discover NuGet packages and target framework.

## Primary Language

C# (`.cs` files). Godot .NET uses the standard .NET SDK (typically .NET 6+ / .NET 8).

Projects may also include GDScript (`.gd`) files for lightweight scripts, but C# is the primary
language for business logic and architecture.

## Scan Targets

**Fixed directories** (scan if they exist):

| Directory | What to look for |
|-----------|-----------------|
| `addons/` | Third-party and custom plugins — each subfolder is a plugin |
| `autoloads/` or root scripts with `[autoload]` in `project.godot` | Global singletons (event bus, save system, audio manager) |
| `src/` or `scripts/` | Common C# code locations |

Run `ls` on the project root to see the top-level structure.
Parse `project.godot` → `[autoload]` section to discover global singletons.
Read `*.csproj` to discover NuGet package references.

## Script Directories (Auto-Detect)

Scan whichever of these exists — C# Godot projects often follow .NET conventions:

| Directory | Convention |
|-----------|-----------|
| `src/` | .NET-style source organization |
| `scripts/` | Godot default convention |
| `Core/` | Core systems separation |
| `Game/` | Game logic separation |
| `Features/` or `Modules/` | Feature/module-based organization |
| `scenes/` | Scripts alongside scene files |

C# projects tend to be more structured than GDScript — look for namespace-based
folder organization matching `.cs` file namespaces.

## Module Boundary Mechanism

Godot .NET supports multiple approaches to module boundaries:

### .csproj-Based (Recommended for large projects)

Multiple `.csproj` files with project references — enforces dependency direction at compile time.

```
Glob: **/*.csproj
```

Read `.csproj` files to understand:
- Project references (`<ProjectReference>`) — dependency graph
- NuGet packages (`<PackageReference>`) — third-party dependencies
- Target framework and nullable context settings

**Structure example:**
```
MyGame/
├── MyGame.csproj          # Main game project
├── MyGame.Core/
│   └── MyGame.Core.csproj # Core module — no game references
├── MyGame.UI/
│   └── MyGame.UI.csproj   # UI module — references Core
└── MyGame.Tests/
    └── MyGame.Tests.csproj # Test project
```

### Folder + Namespace-Based (Simpler projects)

Single `.csproj`, module boundaries enforced by namespace and folder convention.
Less strict but simpler to set up. Use `internal` access modifier for encapsulation.

### Addon-Based

Reusable code as Godot addons with their own `plugin.cfg`.
Can include C# code alongside GDScript.

**Best practices:**
- Use multiple `.csproj` for medium+ projects — compile-time boundary enforcement
- Use `internal` access modifier to hide implementation details
- NuGet packages for .NET ecosystem libraries (DI, serialization, reactive)
- Avoid circular project references — extract shared interfaces to a common project
- `[InternalsVisibleTo]` for test access when needed

## DI Frameworks

Godot .NET can use standard .NET DI frameworks:

| Framework | NuGet Package | Notes |
|-----------|---------------|-------|
| Microsoft.Extensions.DependencyInjection | `Microsoft.Extensions.DependencyInjection` | Standard .NET DI — lightweight, well-documented |
| Autofac | `Autofac` | Feature-rich DI container |
| Manual DI | — | Constructor injection in plain C# classes |
| Autoloads as service locator | — | Godot's built-in `GetNode<T>("/root/Service")` pattern |
| Chickensoft GoDotDep | `Chickensoft.GoDotDep` | Community Godot-specific DI |

**Detection:** Check `.csproj` for `<PackageReference>` containing DI framework names.
Also check `addons/` for community Godot DI solutions.

If using .NET DI, the typical bootstrap pattern:
```csharp
// Autoload or main scene script
public partial class GameBootstrap : Node
{
    private ServiceProvider _serviceProvider;

    public override void _Ready()
    {
        var services = new ServiceCollection();
        services.AddSingleton<IEventBus, EventBus>();
        services.AddTransient<IPlayerService, PlayerService>();
        _serviceProvider = services.BuildServiceProvider();
    }
}
```

## Pattern Indicators

Godot .NET-specific files/patterns to look for beyond the generic ones:

| Pattern | File/Folder indicator |
|---------|----------------------|
| .NET DI | `ServiceCollection`, `IServiceProvider` in `.cs` files, DI NuGet packages in `.csproj` |
| Reactive (R3/Rx.NET) | `R3`, `System.Reactive` in NuGet packages |
| MV* pattern | `*View.cs`, `*ViewModel.cs`, `*Presenter.cs`, `*Model.cs` |
| Chickensoft patterns | `Chickensoft.*` NuGet packages, `SuperNodes`, `GoDotLog` |
| State machines | `*State.cs`, `States/` folder, `IState` interfaces |
| Source generators | `<Analyzer>` references in `.csproj` |
| Resource-based data | `*.tres` resource files, `Resource`-derived C# classes |
| Autoload singletons | `[autoload]` section in `project.godot` pointing to `.cs` or `.tscn` files |

## Component Model

**Node** — Godot's base building block, same as GDScript variant but with C# syntax.

| Godot .NET concept | Role |
|--------------------|------|
| `Node` (C# partial class) | Base building block — lifecycle via `_Ready()`, `_Process()`, `_ExitTree()` |
| `PackedScene` / `.tscn` | Reusable template — instantiate via `scene.Instantiate<T>()` |
| `Resource` (C# class) | Data container — `[Export]` properties, serializable, shared state |
| Autoload (C# class) | Global singleton — `GetNode<T>("/root/ServiceName")` |
| Plain C# class | Business logic — no Godot dependency, testable, injectable |

In well-architected Godot .NET projects, business logic lives in plain C# classes (not Nodes).
Nodes serve as views/controllers that delegate to plain C# services.
This mirrors the "Non-MonoBehaviour First" pattern from Unity architecture.

## ECS Implementation

Godot has **no built-in ECS**, but C# enables several options:

| Library | NuGet Package | Description |
|---------|---------------|-------------|
| Arch | `Arch` | High-performance C# ECS |
| DefaultEcs | `DefaultEcs` | Simple and fast ECS |
| Flecs.NET | `Flecs.NET` | .NET bindings for Flecs |
| LeoECS | `Leopotam.EcsLite` | Lightweight ECS popular in CIS |
| Custom | — | Hand-rolled ECS using Godot Groups + plain C# |

Check `.csproj` for ECS NuGet packages.

## UI / MVVM Binding Frameworks

| Framework | Description |
|-----------|-------------|
| Control nodes | Godot's built-in UI system (Control, Label, Button, etc.) |
| CommunityToolkit.Mvvm | NuGet `CommunityToolkit.Mvvm` — standard .NET MVVM toolkit with source generators |
| ReactiveUI | NuGet `ReactiveUI` — reactive MVVM framework |
| R3 + custom binding | Reactive properties with hand-rolled data binding |
| Custom MVVM | Hand-rolled using C# events/delegates and `[Export]` properties |

C# enables proper MVVM with `INotifyPropertyChanged` and data binding from the .NET ecosystem:
```csharp
public partial class PlayerViewModel : ObservableObject
{
    [ObservableProperty] private int _health;
    [ObservableProperty] private string _name;
}
```

## Cross-Module Communication (Engine-Specific)

| Pattern | Mechanism | Notes |
|---------|-----------|-------|
| Godot Signals (C#) | `[Signal] delegate void HealthChangedEventHandler(int health)` | Godot's built-in system with C# syntax |
| C# events/delegates | Standard `event Action<T>` or `EventHandler<T>` | .NET-native, no Godot dependency |
| .NET DI interfaces | `IEventBus`, `IMessenger` injected via DI | Decoupled, testable |
| Reactive streams (R3/Rx) | `Observable<T>`, `ReactiveProperty<T>` | Powerful composition, familiar to Unity R3 users |
| MediatR | NuGet `MediatR` — mediator pattern | Request/notification, decoupled handlers |
| Autoload Event Bus | Autoload singleton routing C# events | Simple global bus |
| Resources as shared state | `.tres` resources referenced by multiple nodes | Shared data without direct coupling |

## Scene Architecture

Same as standard Godot (scenes and nodes), but C# enables additional patterns:

| Pattern | Description |
|---------|-------------|
| Main scene + subscenes | Main scene loads subscenes via `scene.Instantiate<T>()` |
| `SceneTree.ChangeSceneToPacked` | Full scene replacement for level transitions |
| Additive loading | Multiple scenes loaded simultaneously as children |
| DI-bootstrapped scenes | Scene root node initializes DI container, resolves services |

Typical entry point: defined in `project.godot` → `run/main_scene`.
Bootstrap node often creates `ServiceProvider` in `_Ready()`.

## Asset Loading

Same as standard Godot, plus .NET-specific patterns:

| System | Description |
|--------|-------------|
| `GD.Load<T>()` | Runtime loading — synchronous, C# generic syntax |
| `ResourceLoader.LoadThreadedRequest()` | Async loading (Godot 4+) |
| `PackedScene` | Scene as resource — `Instantiate<T>()` with type safety |
| Embedded resources | .NET embedded resources via `Assembly.GetManifestResourceStream()` |

## Async Patterns

| Approach | Notes |
|----------|-------|
| `async Task` / `async ValueTask` | Standard .NET async — preferred for business logic |
| `ToSignal()` + `await` | Bridge between Godot signals and C# async — `await ToSignal(timer, Timer.SignalName.Timeout)` |
| `ResourceLoader` threaded | Background loading with progress tracking |
| `Task.Run()` | Offload CPU-heavy work to thread pool (careful with Godot thread safety) |
| Channels / `IAsyncEnumerable` | .NET standard async streams |

**Important:** Godot's scene tree is **not thread-safe**. Only the main thread can modify nodes.
Use `CallDeferred()` or `Callable.From()` to marshal back to the main thread.

Unlike Unity (where UniTask replaces Tasks), Godot .NET works naturally with standard `Task`-based async.

## Key Anti-Patterns

Godot .NET-specific things to watch for:

- **Putting all logic in Nodes** — business logic belongs in plain C# classes, not in Node scripts; Nodes are for scene tree interaction only
- **Ignoring .NET DI** — using Autoload singletons for everything when proper DI would improve testability
- **Mixing GDScript and C# arbitrarily** — pick a primary language for architecture; mixing causes confusion and hard-to-trace signal connections
- **Not using `partial` on Node classes** — Godot source generators require `partial` keyword
- **Thread-unsafe node access** — modifying Nodes from `Task.Run` threads; always marshal back via `CallDeferred`
- **Too many autoloads** — same as GDScript, leads to global state spaghetti
- **Deep scene tree coupling** — using `GetNode("../../some/deep/path")`; use DI, signals, or exported NodePaths
- **Ignoring NuGet ecosystem** — reinventing serialization, DI, validation when mature .NET libraries exist
- **GC pressure in hot paths** — avoid LINQ allocations in `_Process()`; use `Span<T>`, `stackalloc`, or pooling
- **Missing `Dispose()` patterns** — plain C# services need `IDisposable` when holding resources; Nodes auto-cleanup but injected services don't
