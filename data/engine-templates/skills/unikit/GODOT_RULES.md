# Engine Rules: Godot

## Engine Detection

Project indicators — if ANY of these exist, this is a Godot project:
- `project.godot` file
- `.godot/` directory

## Project Settings

**File:** `project.godot` (INI-like format, read entire file)

| Field | Key / Method | Notes |
|-------|-------------|-------|
| Engine version | `config/features` array or `.godot/editor/` files | Godot 4.x vs 3.x |
| Project name | `application/config/name` | |
| Main scene | `application/run/main_scene` | Entry point |
| Renderer | `rendering/renderer/rendering_method` | forward_plus / mobile / gl_compatibility |
| Target platform | Export presets in `export_presets.cfg` | If exists |

**Output format:** `Godot [version] / [GDScript] / [Forward+ / Mobile / Compatibility]`

## Package Dependencies

**Primary source:** `addons/` directory — most Godot plugins live here.

**Lock file:** None standard.

**Categories:**

| Category | Pattern | Action |
|----------|---------|--------|
| Godot addons | Folders in `addons/` with `plugin.cfg` | Note each addon |
| GDExtensions | `.gdextension` files | Note native extensions |

**Section name in output:** "Addons & Packages"

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

Skip this step for Godot projects.

## Custom Modules

**Path:** Check for `modules/`, `src/modules/`, or `scripts/modules/` (no standard convention).

**Scan command:** `ls` on detected modules directory.

If no modules directory exists, check for organizational folders in the scripts root.

## Script Conventions

Auto-detect the main scripts directory. Common locations:

| Path | Convention |
|------|-----------|
| `scripts/` | Dedicated scripts folder |
| `src/` | Source folder |
| `scenes/` (with attached .gd) | Scripts alongside scenes |
| Root directory | Small projects, scripts at root |
| `autoload/` | Singleton/autoload scripts |

**Scan command:** `ls` at project root, look for `.gd` files and script directories.

## Module Definitions

**File type:** No direct equivalent to assembly definitions.

**GDScript projects:** No module boundary files. Folder structure defines organization.
Use directory listing to understand boundaries.

## Scene Files

**Extensions:** `.tscn` (text scene), `.scn` (binary scene)

**Glob pattern:** `**/*.tscn`

Look for main scene (defined in `project.godot`), UI scenes, and level scenes.

## Project Structure Template

```
project.godot               [project configuration]
addons/                     [plugins and extensions]
├── [addon1]/               [purpose]
└── ...
scenes/                     [scene files]
├── [folder]/               [purpose]
└── ...
scripts/                    [game scripts]
├── [folder]/               [purpose]
└── ...
assets/                     [art, audio, resources]
├── sprites/                [2D art]
├── models/                 [3D models]
└── audio/                  [sound files]
export_presets.cfg          [export configurations]
.unikit/                    [AI agent context]
```

## Key Entry Points

| File | Purpose |
|------|---------|
| project.godot | Project configuration |
| [main scene .tscn] | Application entry point |
| [autoload scripts] | Global singletons |

## Read-Only Paths

- `project.godot` (modify only through Godot editor)
- `.godot/` (engine-generated cache)

---

## Stack Selection Options

### Architecture

| # | Option | Description |
|---|--------|-------------|
| 1 | Node-based OOP | Classic Godot — scenes as components, Node inheritance (recommended) |
| 2 | ECS | Entity Component System — ask ECS Framework follow-up |
| 3 | Other | Specify in text |

### ECS Frameworks

Show only if ECS architecture selected. ECS is uncommon in Godot — explain trade-offs.

| # | Option | Description | Notes |
|---|--------|-------------|-------|
| 1 | RelEcs | Relationship-based ECS for Godot | |
| 2 | Custom ECS | Hand-rolled implementation | |
| 3 | Other | Specify in text | |

### Networking

| # | Option | Description |
|---|--------|-------------|
| 1 | None | |
| 2 | Built-in MultiplayerAPI | High-level Godot networking with RPCs and sync |
| 3 | ENet | Low-level, reliable UDP via ENetMultiplayerPeer |
| 4 | WebSocket | Browser-compatible via WebSocketMultiplayerPeer |
| 5 | WebRTC | Peer-to-peer via WebRTCMultiplayerPeer |
| 6 | Steam Networking | Via GodotSteam addon |
| 7 | Nakama | Open-source game server |
| 8 | Other | Specify in text |

### DI Frameworks

DI is less common in Godot — Autoloads and scene injection are the native patterns.

| # | Option | Description |
|---|--------|-------------|
| 1 | None — Autoloads | Use Godot Autoloads as global singletons (most common) |
| 2 | Pure DI | Manual constructor injection, no framework |
| 3 | Other | Specify in text |

### Async Patterns

| # | Option | Description |
|---|--------|-------------|
| 1 | Signals + await | GDScript `await signal` pattern (recommended for GDScript) |
| 2 | Coroutines | GDScript coroutines via `yield` (Godot 3.x legacy) |

### UI Framework

| # | Option | Description |
|---|--------|-------------|
| 1 | Built-in Control | Godot's native Control nodes + Theme system (recommended) |
| 2 | Custom UI | Hand-rolled UI framework on top of Control nodes |

<!-- unikit-additional-sections -->

### Dialogue System

| # | Option | Description |
|---|--------|-------------|
| 1 | None | |
| 2 | Dialogue Manager | Node-based, signals-first dialogue system |
| 3 | Dialogic | Full visual novel system |
| 4 | Other | Specify in text |

### AI / Behavior Trees

| # | Option | Description |
|---|--------|-------------|
| 1 | None | |
| 2 | Limbo AI | Feature-rich BT+FSM, GDScript-first |
| 3 | Beehave | Lightweight BT |
| 4 | Other | Specify in text |

<!-- /unikit-additional-sections -->

### Additional Frameworks Examples

Examples for the "Additional frameworks?" question:
`"Beehave, Dialogic, Godot State Charts, Godot Jolt, FMOD, Wwise, GDExtension"`

---

## Package Display Names

Godot does not have a centralized package registry with distinct package ids and display names. Addons in `addons/` are identified by their folder name (the same string serves as both id and display name). This section is **not applicable** for Godot projects — all scan-detected addons use the folder name verbatim in the `required` set.
