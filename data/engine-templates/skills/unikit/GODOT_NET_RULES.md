# Engine Rules: Godot .NET

## Engine Detection

Project indicators — if ALL of these exist, this is a Godot .NET project:
- `project.godot` file
- `.godot/` directory
- `*.csproj` with `Godot.NET.Sdk` reference (required marker for the .NET variant)

## Project Settings

**File:** `project.godot` (INI-like format, read entire file)

| Field | Key / Method | Notes |
|-------|-------------|-------|
| Engine version | `config/features` array or `.godot/editor/` files | Godot 4.x vs 3.x |
| Project name | `application/config/name` | |
| Main scene | `application/run/main_scene` | Entry point |
| Renderer | `rendering/renderer/rendering_method` | forward_plus / mobile / gl_compatibility |
| Target platform | Export presets in `export_presets.cfg` | If exists |

**Output format:** `Godot [version] / C# / [Forward+ / Mobile / Compatibility]`

**Language detection:** C# primary. `*.csproj` with `Godot.NET.Sdk` is the required marker for the .NET variant.

## Package Dependencies

**Primary source:** `addons/` directory — most Godot plugins live here.

**NuGet packages:** Read `*.csproj` for `<PackageReference>` entries.

**Lock file:** `packages.lock.json` if NuGet lock is enabled.

**Categories:**

| Category | Pattern | Action |
|----------|---------|--------|
| Godot addons | Folders in `addons/` with `plugin.cfg` | Note each addon |
| NuGet packages | `<PackageReference>` in `.csproj` | Note third-party packages |
| GDExtensions | `.gdextension` files | Note native extensions |

**Section name in output:** "Addons & Packages"

**Default package filter:** Skip `Godot.NET.Sdk` and `GodotSharp` — they are default engine packages.

## Plugin Directories

**Path:** `addons/`

**Scan command:** `ls addons/`

**Detection table:**

| Plugin | Indicator |
|--------|-----------|
| Dialogue Manager | `addons/dialogue_manager/` |
| Dialogic | `addons/dialogic/` |
| GodotSteam | `addons/godotsteam/` |
| Phantom Camera | `addons/phantom_camera/` |
| SmartShape2D | `addons/smartshape2d/` |
| Terrain3D | `addons/terrain_3d/` |
| GDQuest Trail | `addons/trail_2d/` |
| Limbo AI | `addons/limboai/` |
| Beehave | `addons/beehave/` |
| Godot State Charts | `addons/godot_state_charts/` |
| Godot Jolt | `addons/godot-jolt/` |
| Git Plugin | `addons/gdnative_git/` |

## Third-Party Assets

Godot does not have a separate third-party assets directory like Unity.
All addons live in `addons/` — already covered in Plugin Directories.

Skip this step for Godot .NET projects.

## Custom Modules

**Path:** Check for `modules/`, `src/modules/`, or `scripts/modules/` (no standard convention).

**Scan command:** `ls` on detected modules directory.

If no modules directory exists, check for organizational folders in the scripts root.

## Script Conventions

Auto-detect the main scripts directory. Common locations:

| Path | Convention |
|------|-----------|
| `src/` | Source folder (recommended for .NET projects) |
| `scripts/` | Dedicated scripts folder |
| `scenes/` (with attached .cs) | Scripts alongside scenes |
| Root directory | Small projects, scripts at root |
| `autoload/` | Singleton/autoload scripts |

**Scan command:** `ls` at project root, look for `.cs` files and script directories.

## Module Definitions

**File type:** `.csproj` — primary compilation-unit and module boundary.

**C# projects:** `.csproj` files define compilation units.
**Glob pattern:** `**/*.csproj`

**Namespace convention:** Folder structure typically mirrors namespace hierarchy. Larger projects may split into multiple `.csproj` (main, tests, gameplay, editor).

## Scene Files

**Extensions:** `.tscn` (text scene), `.scn` (binary scene)

**Glob pattern:** `**/*.tscn`

Look for main scene (defined in `project.godot`), UI scenes, and level scenes.

## Project Structure Template

```
project.godot               [project configuration]
*.csproj                    [C# module boundary]
addons/                     [plugins and extensions]
├── [addon1]/               [purpose]
└── ...
scenes/                     [scene files]
├── [folder]/               [purpose]
└── ...
src/                        [C# source code, namespace-structured]
├── [Namespace]/            [purpose]
└── ...
assets/                     [art, audio, resources]
├── sprites/                [2D art]
├── models/                 [3D models]
└── audio/                  [sound files]
export_presets.cfg          [export configurations]
packages.lock.json          [NuGet lock file, if enabled]
.unikit/                    [AI agent context]
```

## Key Entry Points

| File | Purpose |
|------|---------|
| project.godot | Project configuration |
| *.csproj | C# module boundary |
| [main scene .tscn] | Application entry point |
| [autoload scripts] | Global singletons |

## Read-Only Paths

- `project.godot` (modify only through Godot editor)
- `.godot/` (engine-generated cache)
- `packages.lock.json` (managed by NuGet CLI)

---

## Stack Selection Options

### Architecture

| # | Option | Description |
|---|--------|-------------|
| 1 | Node-based OOP | Classic Godot — scenes as components, Node inheritance (recommended) |
| 2 | ECS | Entity Component System — ask ECS Framework follow-up |
| 3 | Other | Specify in text |

### ECS Frameworks

Show only if ECS architecture selected.

| # | Option | Description | Notes |
|---|--------|-------------|-------|
| 1 | Arch ECS | High-performance C# ECS | |
| 2 | LeoECS | Lightweight C# ECS, popular in CIS | |
| 3 | RelEcs | Relationship-based ECS for Godot | |
| 4 | Custom ECS | Hand-rolled implementation | |
| 5 | Other | Specify in text | |

### Networking

| # | Option | Description |
|---|--------|-------------|
| 1 | None | |
| 2 | Built-in MultiplayerAPI | High-level Godot networking with RPCs and sync |
| 3 | ENet | Low-level, reliable UDP via ENetMultiplayerPeer |
| 4 | WebSocket | Browser-compatible via WebSocketMultiplayerPeer |
| 5 | WebRTC | Peer-to-peer via WebRTCMultiplayerPeer |
| 6 | LiteNetLib | High-performance UDP networking library for C# |
| 7 | Mirage | Mirror-descended high-level networking for C# |
| 8 | Steam Networking | Via GodotSteam addon |
| 9 | Epic Online Services | Multiplayer + services SDK via EOS plugin |
| 10 | Google Play Games | Google Play Games services plugin |
| 11 | Nakama | Open-source game server |
| 12 | Other | Specify in text |

### DI Frameworks

| # | Option | Description |
|---|--------|-------------|
| 1 | None — Autoloads | Use Godot Autoloads as global singletons |
| 2 | Microsoft.Extensions.DependencyInjection | Standard .NET DI container |
| 3 | Autofac | Mature, feature-rich .NET DI container |
| 4 | Chickensoft AutoInject | Reflection-free, source-generator-based DI for Godot C# |
| 5 | Pure DI | Manual constructor injection, no framework |
| 6 | Other | Specify in text |

### Async Patterns

| # | Option | Description |
|---|--------|-------------|
| 1 | C# async/await | Standard .NET async with Task (recommended) |
| 2 | Signals + await | Godot signal await via `ToSignal` in C# |
| 3 | Coroutines | Legacy Godot 3.x pattern |

### UI Framework

| # | Option | Description |
|---|--------|-------------|
| 1 | Built-in Control | Godot's native Control nodes + Theme system (recommended) |
| 2 | Custom UI | Hand-rolled UI framework on top of Control nodes |

<!-- unikit-additional-sections -->

### Reactive

| # | Option | Description |
|---|--------|-------------|
| 1 | None | |
| 2 | R3 | `Observable<T>`, `ReactiveProperty<T>` — modern reactive library for C# |
| 3 | Chickensoft Sync | Single-threaded reactive primitives with fluent bindings for Godot C# |
| 4 | Other | Specify in text |

### Serialization

| # | Option | Description |
|---|--------|-------------|
| 1 | Built-in Godot resources | Use Godot `.tres` / `.res` for saveable state |
| 2 | Newtonsoft.Json | Classic flexible JSON serializer |
| 3 | MemoryPack | High-performance binary serializer |
| 4 | Chickensoft Serialization | `[Id]`-attribute-based, AOT-friendly serializer |
| 5 | Other | Specify in text |

### AI / Behavior Trees

| # | Option | Description |
|---|--------|-------------|
| 1 | None | |
| 2 | Limbo AI (.NET) | Feature-rich BT+FSM with .NET bindings |
| 3 | Other | Specify in text |

### Chickensoft Plugins

**Presentation:** numbered-multi-select

Curated list of Chickensoft ecosystem packages for Godot .NET.
AutoInject, Serialization and Sync are NOT in this list — AutoInject is part of the DI Frameworks question, Chickensoft Serialization is part of the Serialization question, Chickensoft Sync is part of the Reactive question.

| # | Plugin | Description | Category |
|---|--------|-------------|----------|
| 1 | LogicBlocks | Hierarchical, serializable state machines for games and apps | Architecture |
| 2 | GameDemo | Fully tested third-person 3D game as a reference implementation | Reference |
| 3 | GodotGame | Pre-configured C# game template for Godot 4 | Template |
| 4 | GodotEnv | Command-line Godot version and addon manager | Tooling |
| 5 | GoDotTest | C# test runner for Godot with coverage and debugging | Testing |
| 6 | GodotTestDriver | Integration testing with simulated input and fixtures | Testing |
| 7 | GodotNodeInterfaces | Node/scene adapters for comprehensive test coverage | Testing |
| 8 | setup-godot | Headless Godot setup action for CI/CD runners | CI/CD |
| 9 | SaveFileBuilder | Composable chunked save data container | Persistence |
| 10 | Introspection | Build-time metadata mixins and type information | Code Generation |
| 11 | Collections | Lightweight collections and utility interface types | Collections |
| 12 | GameTools | Resource loading, feature tags, and DPI utilities | Utilities |
| 13 | Platform | Platform-specific native extensions for Godot | Platform |
| 14 | Log.Godot | Opinionated logging interface for C# in Godot | Logging |

<!-- /unikit-additional-sections -->

### Additional Frameworks Examples

Examples for the "Additional frameworks?" question:
`"R3, MemoryPack, Newtonsoft.Json, LiteNetLib, Mirage, Epic Online Services"`

---

## Package Display Names

Only packages listed here get a short display name; unknown packages keep their id as-is. Addons (from `addons/`) and NuGet `<PackageReference>` entries not in this table use their id/folder name verbatim in the `required` set.

| Package Id | Display Name |
|-----------|--------------|
| Chickensoft.LogicBlocks | Chickensoft LogicBlocks |
| Chickensoft.AutoInject | Chickensoft AutoInject |
| Chickensoft.Serialization | Chickensoft Serialization |
| Chickensoft.Log.Godot | Chickensoft Log.Godot |
| Chickensoft.GodotTestDriver | Chickensoft GodotTestDriver |
| Chickensoft.GoDotTest | Chickensoft GoDotTest |
| Chickensoft.SaveFileBuilder | Chickensoft SaveFileBuilder |
