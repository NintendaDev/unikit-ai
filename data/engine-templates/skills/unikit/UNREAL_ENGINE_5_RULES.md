# Engine Rules: Unreal Engine 5

## Engine Detection

Project indicators — if ANY of these exist, this is an Unreal Engine project:
- `*.uproject` file in the project root
- `Source/` directory with `*.Build.cs` files
- `Config/DefaultEngine.ini`

## Project Settings

**File:** `*.uproject` (JSON format, read entire file — typically small)

| Field | Key / Method | Notes |
|-------|-------------|-------|
| Engine version | `EngineAssociation` | Version string like "5.4" or a GUID for source builds |
| Project modules | `Modules` array | Each entry has `Name`, `Type`, `LoadingPhase` |
| Enabled plugins | `Plugins` array | Each entry has `Name` and `Enabled` |
| Target platform | `Config/DefaultGame.ini` → `ProjectSettings` | Or infer from `*.Target.cs` |
| Project name | `.uproject` filename | Filename without extension is the project name |

Also read `Config/DefaultEngine.ini` for renderer settings:
- `[/Script/Engine.RendererSettings]` — rendering features
- `r.DefaultFeature.` prefixed settings — Lumen, Nanite, etc.

**Output format:** `Unreal Engine [version] / C++ / [Lumen+Nanite / Forward / Deferred]`

## Package Dependencies

Unreal Engine does not have a centralized package manager like UPM. Dependencies come from:

**Primary source:** `*.uproject` → `Plugins` array — lists enabled/disabled plugins.

**Secondary sources:**
- `*.Build.cs` → `PublicDependencyModuleNames` / `PrivateDependencyModuleNames` — module-level dependencies
- `Plugins/` directory — project-local plugins (each has `*.uplugin`)

**Lock file:** None standard.

**Categories:**

| Category | Pattern | Action |
|----------|---------|--------|
| Engine modules | Modules listed in `Build.cs` from engine source | Skip — default engine modules |
| Engine plugins | Plugins bundled with the engine (e.g., "Paper2D", "OnlineSubsystem") | Note only if explicitly enabled |
| Project plugins | Folders in `Plugins/` with `*.uplugin` | Key dependencies — note |
| Marketplace plugins | Installed in `Plugins/` or engine's `Marketplace/` folder | Key dependencies — note |

**Section name in output:** "Plugins & Modules"

**Default package filter:** Do not list default engine modules (`Core`, `CoreUObject`, `Engine`, `InputCore`, `EnhancedInput`) — they are always present.

## Plugin Directories

**Path:** `Plugins/`

**Scan command:** `ls Plugins/`

**Detection table:**

| Plugin | Indicator |
|--------|-----------|
| Gameplay Ability System (GAS) | `GameplayAbilities` in `.uproject` plugins or `Build.cs` dependencies |
| Enhanced Input | `EnhancedInput` in `.uproject` plugins |
| CommonUI | `CommonUI` in `.uproject` plugins or `Plugins/CommonUI/` |
| Online Subsystem | `OnlineSubsystem*` in `.uproject` plugins |
| Niagara | `Niagara` in `.uproject` plugins |
| Mass Entity (Mass Framework) | `MassEntity` in `.uproject` plugins |
| StateTree | `StateTree` in `.uproject` plugins |
| Smart Objects | `SmartObjects` in `.uproject` plugins |
| GameplayMessageRouter | `GameplayMessageRouter` in `.uproject` plugins |
| Motion Warping | `MotionWarping` in `.uproject` plugins |
| Chaos Vehicles | `ChaosVehicles` in `.uproject` plugins |
| Water | `Water` in `.uproject` plugins |
| PCG (Procedural Content Generation) | `PCG` in `.uproject` plugins |

Also scan `Plugins/` for custom project plugins — each subfolder with `*.uplugin` is a plugin.

## Third-Party Assets

**Path:** `Content/` subfolders — Marketplace assets are typically installed here.

**Description:** Unreal Marketplace assets and third-party content packs.

There is no standard third-party assets directory convention. Marketplace assets are placed directly in `Content/`.

Scan `Content/` top-level directories and cross-reference with the `.uproject` plugins list. Most Marketplace code plugins appear in `Plugins/`, while content-only packs appear in `Content/`.

**Skip detailed scan** — the `Plugins` array in `.uproject` and `Plugins/` directory are the primary indicators.

## Custom Modules

**Path:** `Source/` — each subfolder with a `*.Build.cs` file is a module.

**Scan command:** `ls Source/`

The main game module is `Source/[ProjectName]/`. Additional modules are sibling directories under `Source/`.

Each module follows the `Public/` + `Private/` directory split:
- `Public/` — headers exposed to other modules
- `Private/` — implementation files, internal headers

## Script Conventions

Source code location follows UE conventions:

| Path | Convention |
|------|-----------|
| `Source/[ProjectName]/` | Main game module (always present) |
| `Source/[ProjectName]/Private/` | Implementation files (`.cpp`) |
| `Source/[ProjectName]/Public/` | Public headers (`.h`) — module API |
| `Source/[ModuleName]/` | Additional game modules |
| `Plugins/[PluginName]/Source/[ModuleName]/` | Plugin source code |

**Scan command:** `ls Source/`

Also check for Blueprint-heavy projects:
- `Content/Blueprints/` — Blueprint assets
- `Content/[ProjectName]/Blueprints/` — organized by project name

## Module Definitions

**File type:** Build scripts (`.Build.cs`) and target files (`.Target.cs`)

**Glob pattern:** `**/*.Build.cs`

These define:
- Module dependencies (`PublicDependencyModuleNames`, `PrivateDependencyModuleNames`)
- Module type and loading phase
- Include paths and compiler defines
- Plugin dependencies

Also check `**/*.Target.cs` for build target configuration.

## Scene Files

**Extension:** `.umap` (levels/maps)

**Glob pattern:** `Content/**/*.umap`

Look for the default map in `Config/DefaultEngine.ini`:
```ini
[/Script/EngineSettings.GameMapsSettings]
GameDefaultMap=/Game/Maps/[MapName]
EditorStartupMap=/Game/Maps/[MapName]
```

Identify the entry map, main gameplay map, menu maps, and any streaming sublevels.

## Project Structure Template

```
[ProjectName].uproject       [project configuration]
Source/
├── [ProjectName]/            [main game module]
│   ├── [ProjectName].Build.cs
│   ├── [ProjectName].h       [module header]
│   ├── [ProjectName].cpp     [module implementation]
│   ├── Public/               [public headers]
│   │   └── [folder]/         [purpose]
│   └── Private/              [implementation files]
│       └── [folder]/         [purpose]
├── [OtherModule]/            [additional modules]
│   └── ...
├── [ProjectName].Target.cs   [game build target]
└── [ProjectName]Editor.Target.cs [editor build target]
Plugins/                      [project-local plugins]
├── [PluginName]/             [each plugin has .uplugin]
│   └── Source/               [plugin source code]
Content/                      [assets, blueprints, levels]
├── Maps/                     [level files]
├── Blueprints/               [Blueprint assets]
├── UI/                       [UI widgets]
└── [folder]/                 [purpose]
Config/                       [engine/project configuration]
├── DefaultEngine.ini         [engine settings]
├── DefaultGame.ini           [game settings]
├── DefaultInput.ini          [input mappings]
└── DefaultEditor.ini         [editor settings]
.unikit/                      [AI agent context]
```

## Key Entry Points

| File | Purpose |
|------|---------|
| `[ProjectName].uproject` | Project configuration and plugin list |
| `Config/DefaultEngine.ini` | Engine settings, default map |
| `Source/[ProjectName]/[ProjectName].Build.cs` | Main module build rules |
| `Source/[ProjectName].Target.cs` | Build target configuration |

## Read-Only Paths

- `Config/` (modify through Project Settings in the editor, or carefully by hand)
- `Intermediate/` (generated files)
- `Binaries/` (compiled output)
- `DerivedDataCache/` (engine cache)

---

## Stack Selection Options

### Architecture

| # | Option | Description |
|---|--------|-------------|
| 1 | Actor/Component OOP | Classic UE — Actors in the world, Components add behavior (recommended) |
| 2 | Gameplay Ability System | GAS — data-driven abilities, effects, attributes, tags |
| 3 | Mass Entity (ECS) | UE5's data-oriented framework for large-scale simulation |
| 4 | Other | Specify in text |

### ECS Frameworks

Show only if Mass Entity (ECS) architecture selected.

| # | Option | Description | Notes |
|---|--------|-------------|-------|
| 1 | Mass Entity | UE5 built-in — FMassFragment, FMassProcessor, FMassEntityHandle | |
| 2 | Custom ECS | Hand-rolled data-oriented implementation | |
| 3 | Other | Specify in text | |

### Networking

| # | Option | Description |
|---|--------|-------------|
| 1 | None | |
| 2 | Built-in Replication | UE's native replication — `DOREPLIFETIME`, RPCs, GameMode/GameState |
| 3 | Online Subsystem + Sessions | UE's platform-agnostic online services layer |
| 4 | EOS (Epic Online Services) | Epic's cross-platform backend — matchmaking, lobbies, voice |
| 5 | Steam Online Subsystem | Steamworks integration via OnlineSubsystemSteam |
| 6 | Photon | Photon SDK for UE — room-based or relay networking |
| 7 | Nakama | Open-source game server — matchmaking, accounts, storage |
| 8 | Other | Specify in text |

### DI Frameworks

UE does not have mainstream DI frameworks. Subsystems and the Gameplay Framework are the native patterns.

| # | Option | Description |
|---|--------|-------------|
| 1 | None — Subsystems | Use UE Subsystems as scoped services (most common, recommended) |
| 2 | Gameplay Framework | Rely on GameMode/GameState/PlayerController architecture |
| 3 | Pure DI | Manual constructor injection for non-UObject classes |
| 4 | Other | Specify in text |

### Async Patterns

| # | Option | Description |
|---|--------|-------------|
| 1 | Delegates + Callbacks | UE's primary pattern — `FStreamableManager`, dynamic delegates |
| 2 | Gameplay Tasks | `UAbilityTask` / `UGameplayTask` — scoped to GAS or gameplay lifecycle |
| 3 | Latent Actions | `UBlueprintAsyncActionBase` — Blueprint-friendly async nodes |
| 4 | FRunnable / AsyncTask | Low-level threading for heavy computation |
| 5 | Other | Specify in text |

### UI Framework

| # | Option | Description |
|---|--------|-------------|
| 1 | UMG (UWidget) | Unreal Motion Graphics — primary UI system with UUserWidget (recommended) |
| 2 | CommonUI | Plugin for cross-platform UI with input routing and navigation |
| 3 | Slate | Low-level C++ UI — editor tools and advanced runtime UI |
| 4 | UMG + MVVM | UE 5.3+ built-in MVVM binding framework with UMG |
| 5 | Other | Specify in text |

### Additional Frameworks Examples

Examples for the "Additional frameworks?" question:
`"GAS, Enhanced Input, CommonUI, Niagara, Mass Entity, PCG Framework, Motion Warping"`

---

## Package Display Names

Only plugins listed here get a short display name; unknown plugins keep their id as-is. Plugins from `Plugins/` and the `Plugins` array in `.uproject` not in this table use their id verbatim in the `required` set.

| Plugin Id | Display Name |
|-----------|--------------|
| GameplayAbilities | Gameplay Ability System (GAS) |
| EnhancedInput | Enhanced Input |
| CommonUI | CommonUI |
| OnlineSubsystemSteam | Steam Online Subsystem |
| OnlineSubsystemEOS | Epic Online Services |
| MassEntity | Mass Entity |
| StateTree | StateTree |
| Niagara | Niagara |
| ModelViewViewModel | UE MVVM |
