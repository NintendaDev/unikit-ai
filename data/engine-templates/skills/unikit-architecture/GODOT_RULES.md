# Godot Engine Reference (GDScript)

Engine-specific details for the unikit-architecture skill when working with Godot GDScript projects.
For Godot .NET (C#) projects, see `godot-net.md` instead.

## Table of Contents

- [Engine Detection](#engine-detection)
- [Primary Languages](#primary-languages)
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

Marker: `project.godot` file exists in the project root AND no `.csproj` files found.

Check the file for `config/features` to detect Godot version (4.x vs 3.x).
If `.csproj` files are found alongside `project.godot`, use `godot-net.md` instead.

## Primary Language

| Language | File extension | Notes |
|----------|---------------|-------|
| GDScript | `.gd` | Primary language for standard Godot |
| C++ (GDExtension) | `.cpp` / `.h` | Native extensions, Godot 4+ |

GDExtension may be used alongside GDScript for performance-critical code.

## Scan Targets

**Fixed directories** (scan if they exist):

| Directory | What to look for |
|-----------|-----------------|
| `addons/` | Third-party and custom plugins — each subfolder is a plugin |
| `autoloads/` or root scripts with `[autoload]` in `project.godot` | Global singletons (event bus, save system, audio manager) |

Run `ls` on the project root to see the top-level structure.
Then parse `project.godot` → `[autoload]` section to discover global singletons.

## Script Directories (Auto-Detect)

Scan whichever of these exists — these are common conventions:

| Directory | Convention |
|-----------|-----------|
| `src/` | Common organized projects |
| `scripts/` | Simple projects |
| `scenes/` | Scene-organized (scripts alongside scenes) |
| `game/` | Game logic separation |
| `core/` | Core systems |
| `[feature_name]/` | Feature-based folders at root level |

Godot doesn't enforce a script directory — scripts often live alongside their `.tscn` scene files.
Look for `.gd` files to identify where code lives.

## Module Boundary Mechanism

Godot has **no compile-time module boundary enforcement** like Unity's `.asmdef`.

Module boundaries are enforced by convention:

- **Folder-based**: each top-level folder is a logical module
- **Addon-based**: reusable code goes into `addons/` with a `plugin.cfg`
- **GDExtension**: native modules compiled separately, declared in `.gdextension` files

**Best practices:**
- Organize by feature: `player/`, `inventory/`, `combat/`, `ui/`
- Shared utilities go in `core/` or `common/`
- Reusable systems go in `addons/` with `plugin.cfg`
- Avoid circular dependencies between feature folders
- Use autoloads sparingly — only for truly global singletons

## DI Frameworks

Godot does not have mainstream DI frameworks like Unity's Zenject/VContainer.

| Approach | Description |
|----------|-------------|
| Autoloads | Global singletons accessible via `get_node("/root/ServiceName")` — Godot's built-in service locator |
| Manual DI | Constructor injection or setter injection in plain classes |
| Node injection | Parent nodes pass dependencies to children via `_ready()` or exported properties |
| GodotInject (community) | Rare community DI framework — check `addons/` |

If no DI framework is found, document the autoload-based service pattern.

## Pattern Indicators

Godot-specific files/patterns to look for beyond the generic ones:

| Pattern | File/Folder indicator |
|---------|----------------------|
| Autoload singletons | `[autoload]` section in `project.godot` |
| State machines | `*_state.gd`, `states/` folder, `StateMachine` nodes |
| Signal-based architecture | Heavy use of `signal` declarations in `.gd` files |
| Resource-based data | `*.tres` resource files used as data objects |
| Scene composition | `.tscn` files with attached scripts — component-like pattern |
| Plugin architecture | `addons/*/plugin.cfg` files |

## Component Model

**Node** — Godot's base building block. Scenes are trees of Nodes.

| Godot concept | Role |
|---------------|------|
| Node | Base building block — attached to the scene tree, has lifecycle callbacks |
| Scene (`.tscn`) | Reusable template — tree of Nodes saved as a resource, instantiated at runtime |
| Resource (`.tres`) | Data container — serializable object for configs, stats, shared state |
| Autoload | Global singleton — persists across scene changes, accessible from anywhere |

Godot encourages scene composition: small, reusable scenes as "components" added to parent scenes.
Unlike Unity, scripts are attached to Nodes directly (one script per node).

## ECS Implementation

Godot has **no built-in ECS**. Community options:

| Library | Description |
|---------|-------------|
| Godot ECS (community) | Various community ECS implementations |
| Scene tree as pseudo-ECS | Using Groups + process functions as lightweight ECS pattern |

If no ECS indicators found, the project likely uses Godot's native node/scene architecture.

## UI / MVVM Binding Frameworks

| Framework | Description |
|-----------|-------------|
| Control nodes | Godot's built-in UI system (Control, Label, Button, etc.) |
| Custom MVVM | Hand-rolled data binding using signals and setget/properties |
| Theme system | Godot's built-in theming for consistent UI styling |

Godot's signal system naturally supports a reactive pattern for UI binding:
```gdscript
@export var health: int:
    set(value):
        health = value
        health_changed.emit(value)
```

## Cross-Module Communication (Engine-Specific)

| Pattern | Mechanism | Notes |
|---------|-----------|-------|
| Signals | Godot's built-in observer pattern | `signal my_signal(data)` — primary communication mechanism |
| Autoload Event Bus | Global singleton that defines and routes signals | Common pattern for decoupled systems |
| Groups | `add_to_group()` / `get_tree().call_group()` | Broadcast to all nodes in a group |
| Resources as shared state | `.tres` resources referenced by multiple nodes | Shared data without direct coupling |
| `call_deferred` | Deferred method calls | Safe cross-frame communication |

## Scene Architecture

| Pattern | Description |
|---------|-------------|
| Main scene + subscenes | Main scene loads subscenes via `add_child(scene.instantiate())` |
| SceneTree.change_scene | Full scene replacement for level transitions |
| Additive loading | Multiple scenes loaded simultaneously as children |
| Resource preloading | `preload()` / `load()` for scene and resource management |

Typical entry point: defined in `project.godot` → `run/main_scene`.

## Asset Loading

| System | Description |
|--------|-------------|
| `preload()` | Compile-time loading — fast, but inflexible |
| `load()` | Runtime loading — synchronous |
| `ResourceLoader.load_threaded_request()` | Async loading (Godot 4+) |
| `PackedScene` | Scene as resource — instantiate on demand |

## Async Patterns

| Approach | Notes |
|----------|-------|
| Signals + `await` | GDScript 4 native async — `await signal_name` |
| `ResourceLoader` threaded | Background loading with progress tracking |
| Coroutine-like with `yield` | Godot 3 pattern (deprecated in Godot 4) |

## Key Anti-Patterns

Godot-specific things to watch for in the architecture document:

- **Too many autoloads** — leads to global state spaghetti; prefer dependency injection via nodes
- **Deep scene tree coupling** — using `get_node("../../some/deep/path")` creates fragile dependencies; use signals or exported NodePaths
- **Monolithic scenes** — one massive scene instead of composed subscenes; break into reusable pieces
- **Processing when idle** — `_process()` running on nodes that don't need per-frame updates; use `set_process(false)` when inactive
- **String-based node paths everywhere** — use `@onready` references or exported `NodePath` for type safety
- **Ignoring the scene tree lifecycle** — accessing nodes before `_ready()` is called
- **Circular signal connections** — A signals B signals A — leads to infinite loops
