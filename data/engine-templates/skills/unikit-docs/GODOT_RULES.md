# Godot 4 Documentation Rules

Engine-specific detection, scanning, and analysis rules for Godot 4 projects (GDScript and C# .NET).

## Engine Version Detection

Read `project.godot` — contains `config/features` with Godot version (e.g., `4.3`).
Also check `[application]` section for project name and main scene.

**C# (.NET) detection:** presence of `*.csproj` and `*.sln` files in project root confirms .NET support.

## Package Manifest

- **Addons:** `addons/` directory — each subfolder is a plugin with `plugin.cfg`
- **Asset Library:** check `addons/*/plugin.cfg` for plugin metadata (name, version, author)
- **GDExtension:** `*.gdextension` files in project root or addons/

**C# (.NET) additional:**
- `*.csproj` — NuGet package references (`<PackageReference>`)
- Check `<PackageReference>` in `.csproj` for third-party C# packages

## Tech Stack Detection Tables

### DI / Service Locator

| Detection method | Pattern | Grep pattern |
|-----------------|---------|-------------|
| Autoloads in `project.godot` | Autoload singletons | `[autoload]` section |
| `ServiceLocator` class | Custom service locator | `ServiceLocator`, `get_service` / `GetService` |
| Direct node references | Scene tree injection | `get_node`, `@onready` |

**C# (.NET) additional:**

| Detection method | Framework | Grep pattern |
|-----------------|-----------|-------------|
| NuGet: `Microsoft.Extensions.DependencyInjection` | MS DI | `using Microsoft.Extensions.DependencyInjection` |
| NuGet: `Autofac` | Autofac | `using Autofac` |

**What to document:** Autoload singletons, service access patterns. For .NET: DI container setup, service registration.

### Async Patterns

**GDScript:**

| Detection method | Pattern | Grep pattern |
|-----------------|---------|-------------|
| `await` keyword | GDScript coroutines | `await` |
| Signal-based async | Signal awaiting | `await signal_name` |
| `ResourceLoader.load_threaded_*` | Async resource loading | `load_threaded` |

**C# (.NET):**

| Detection method | Pattern | Grep pattern |
|-----------------|---------|-------------|
| `async Task` / `async ValueTask` | .NET async | `async Task`, `async ValueTask` |
| `await ToSignal()` | Godot signal awaiting | `await ToSignal` |
| `ResourceLoader.LoadThreadedRequest` | Async resource loading | `LoadThreadedRequest` |
| `CancellationToken` | Cancellation support | `CancellationToken` |

**What to document:** Coroutine/async patterns, signal-based async workflows. For .NET: CancellationToken patterns, Task vs ValueTask.

### Event / Signal Systems

**GDScript:**

| Detection method | System | Grep pattern |
|-----------------|--------|-------------|
| `signal` keyword | Built-in signals | `signal ` (declaration) |
| `emit_signal` / `.emit()` | Signal emission | `emit_signal`, `.emit(` |
| `EventBus` autoload | Global event bus | `EventBus` |

**C# (.NET):**

| Detection method | System | Grep pattern |
|-----------------|--------|-------------|
| `[Signal]` attribute | C# Godot signals | `[Signal]` |
| `EmitSignal` | Signal emission | `EmitSignal` |
| `event` keyword | .NET events | `event EventHandler`, `event Action` |
| `IObservable<>` | Reactive Extensions | `using System.Reactive` |

**What to document:** Custom signal declarations, global event bus, signal flow between scenes. For .NET: also .NET event patterns.

### UI Frameworks

| Detection method | Framework | Grep pattern |
|-----------------|-----------|-------------|
| `Control` nodes | Built-in UI | `extends Control` / `: Control` |
| `Theme` resources | Theme system | `*.tres` theme files |
| Custom MVVM | Custom binding | `ViewModel`, `ViewBinding` / `INotifyPropertyChanged` |

### State Management

| Detection method | Pattern | Grep pattern |
|-----------------|---------|-------------|
| `StateMachine` class | Custom FSM | `StateMachine`, `State`, `transition` / `IState` |
| `XSM` addon | XSM state machine | `addons/xsm/` |
| `LimboAI` addon | Behavior trees | `addons/limboai/` |
| `Beehave` addon | Behavior trees | `addons/beehave/` |

### Networking

| Detection method | Framework | Grep pattern |
|-----------------|-----------|-------------|
| `multiplayer` API | Built-in multiplayer | `multiplayer.` / `Multiplayer.`, `@rpc` / `[Rpc]` |
| `ENet` | ENet protocol | `ENetMultiplayerPeer` |
| `WebSocket` | WebSocket | `WebSocketPeer` |
| Nakama addon | Nakama backend | `addons/nakama/` |

**C# (.NET) additional:**

| Detection method | Framework | Grep pattern |
|-----------------|-----------|-------------|
| NuGet: `LiteNetLib` | LiteNetLib | `using LiteNetLib` |
| NuGet: `Nakama.Client` | Nakama (.NET) | `using Nakama` |

### Other Frameworks

| Detection method | Framework | Grep pattern |
|-----------------|-----------|-------------|
| `addons/dialogic/` | Dialogic | `Dialogic` |
| `addons/phantom_camera/` | Phantom Camera | `PhantomCamera` |
| `addons/terrain_3d/` | Terrain3D | `Terrain3D` |

### Testing

**GDScript:**
- GUT addon: `addons/gut/`, test files matching `test_*.gd` or `*_test.gd`
- GdUnit4 addon: `addons/gdUnit4/`, test files in `test/` directory

**C# (.NET):**

| Detection method | Framework | Grep pattern |
|-----------------|-----------|-------------|
| NuGet: `GdUnit4.Api` | GdUnit4 | `using GdUnit4` |
| NuGet: `NUnit` | NUnit | `using NUnit.Framework` |
| NuGet: `xunit` | xUnit | `using Xunit` |
| Test projects | Separate test assembly | `*.Tests.csproj` |

Folder patterns (both): `test/`, `tests/`, `Tests/`

## Folder Structure Patterns

### Script Root Detection

Scripts (`.gd` / `.cs`) can live anywhere in `res://`. Common patterns:

```
src/
scripts/
game/
core/
```

Also check root-level script files — small projects keep scripts at root.

### Modular Structure Detection

```
src/systems/       (or src/Systems/ for .NET)
src/modules/       (or src/Modules/)
src/features/      (or src/Features/)
src/core/          (or src/Core/)
addons/            (plugins — document usage, not internals)
```

### Special Folders

```
addons/           → Plugins (DO NOT document internals)
.godot/           → Engine cache (never commit)
.import/          → Import cache
export_presets/   → Export configurations
```

**C# (.NET) additional:**
```
.mono/            → Mono build cache (never commit)
```

### Scene Detection

```
scenes/
levels/
src/scenes/
```

Look for `.tscn` files — each is a scene. Main scene is defined in `project.godot` under `[application]` → `run/main_scene`.

## Module Boundary Mechanism

Godot has no compile-time module boundaries. Boundaries are enforced by convention:
- Folder structure defines modules
- Autoloads act as service interfaces
- `class_name` declarations define the public API of a script

**C# (.NET) additional:**
- C# namespaces for logical boundaries
- `.csproj` can be split into multiple projects for strict boundaries (rare)

## Deep Analysis Patterns

### Bootstrap Chain

```
Read: project.godot → [autoload] section (initialization order)
```

**GDScript:**
```
Grep: "_ready()" in *.gd → node initialization
Grep: "class_name" in *.gd → public API surface
```

**C# (.NET):**
```
Grep: "_Ready()" in *.cs → node initialization
Grep: "[Signal]" in *.cs → signal declarations
Read: *.csproj → PackageReference list
```

### Communication Map

**GDScript:**
```
Grep: "signal " in *.gd → signal declarations
Grep: "emit_signal\|\.emit(" in *.gd → signal publishers
Grep: "connect(" in *.gd → signal subscribers
Grep: "EventBus\|MessageBus" in *.gd → global event bus
```

**C# (.NET):**
```
Grep: "[Signal]" in *.cs → signal declarations
Grep: "EmitSignal" in *.cs → signal publishers
Grep: "Connect(" in *.cs → signal subscribers
Grep: "event " in *.cs → .NET event declarations
Grep: "EventBus|MessageBus" in *.cs → global event bus
```
