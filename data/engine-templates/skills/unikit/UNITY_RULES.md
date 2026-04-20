# Engine Rules: Unity

## Engine Detection

Project indicators — if ANY of these exist, this is a Unity project:
- `ProjectSettings/` directory
- `Assets/` directory
- `Packages/manifest.json`

## Project Settings

**File:** `ProjectSettings/ProjectSettings.asset` (read first ~50 lines)

| Field | Key / Method | Notes |
|-------|-------------|-------|
| Engine version | `m_EditorVersion` | Or infer from project structure |
| Target platform | `m_BuildTarget` | |
| Render pipeline | Look for URP/HDRP references | |
| Company name | `companyName` | |
| Product name | `productName` | |

**Output format:** `Unity [version] / C# [version] / [URP/HDRP/Built-in]`

## Package Dependencies

**Primary source:** `Packages/manifest.json` — single source of truth for Unity Package Manager (UPM).

**Lock file:** `Packages/packages-lock.json` (if exists) — resolved versions and transitive dependencies.

**Categories:**

| Category | Pattern | Action |
|----------|---------|--------|
| Core modules | `com.unity.modules.*` | Skip — default engine modules |
| Feature packages | `com.unity.render-pipelines.*`, `com.unity.addressables`, etc. | Note these |
| Third-party UPM | git URLs, scoped registries | Key dependencies — note |
| Test framework | `com.unity.test-framework` | Note if present |

**Section name in output:** "UPM Packages"

**Default package filter:** Do not list `com.unity.modules.*` — they are default Unity modules.

## Plugin Directories

**Path:** `Assets/Plugins/`

**Scan command:** `ls Assets/Plugins/`

**Detection table:**

| Plugin | Indicator |
|--------|-----------|
| Zenject / Extenject | `Zenject/` folder |
| UniTask | `UniTask/` folder |
| R3 | `R3.Unity/` folder |
| DOTween | `DOTween/` or `Demigiant/` folder |
| Odin Inspector | `Sirenix/` folder |
| ZLinq | `ZLinq.Unity/` folder |
| ASPID MVVM | `Aspid/` folder |

## Third-Party Assets

**Path:** `Assets/Third-Party Assets/`

**Description:** Unity Asset Store packages and commercial tools.

**Scan command:** `ls "Assets/Third-Party Assets/"`

**Detection table:**

| Asset | Indicator |
|-------|-----------|
| NodeCanvas | `ParadoxNotion/` folder |
| Dialogue System for Unity | `Pixel Crushers/` folder |
| Ultimate Inventory System | `Opsive/` folder |
| RNGNeeds | `RNGNeeds/` folder |
| TextAnimator | `Febucci/` folder |

## Custom Modules

**Path:** `Assets/Modules/` (if exists)

**Scan command:** `ls Assets/Modules/`

For domain modules, also check one level deeper (e.g., `Assets/Modules/Domain/`).

## Script Conventions

Auto-detect the main scripts directory. Common locations:

| Path | Convention |
|------|-----------|
| `Assets/Game/Scripts/` | Project-name prefix |
| `Assets/Scripts/` | Default |
| `Assets/_Project/Scripts/` | Underscore prefix |
| `Assets/_Scripts/` | Underscore variation |
| `Assets/[ProjectName]/` | Named after the project |

**Scan command:** `ls Assets/`

## Module Definitions

**File type:** Assembly Definition (`.asmdef`)

**Glob pattern:** `**/*.asmdef`

These reveal the dependency graph and module boundaries. Note the count and naming patterns.

## Scene Files

**Extension:** `.unity`

**Glob pattern:** `**/*.unity`

Look for Bootstrap scene, main gameplay scene, and any additive scenes.

## Project Structure Template

```
Assets/
├── Game/Scripts/          [organization pattern]
│   ├── [folder]/          [purpose]
│   └── ...
├── Modules/               [module boundaries]
│   ├── [Module1]/         [purpose]
│   └── ...
├── Plugins/               [third-party frameworks]
├── Third-Party Assets/    [store assets and tools]
└── Scenes/                [scene files]
Packages/                  [UPM dependencies]
ProjectSettings/           [engine project settings]
.unikit/                   [AI agent context]
```

## Key Entry Points

| File | Purpose |
|------|---------|
| [bootstrap scene] | Application entry point |
| [main scene] | Main gameplay scene |
| [root installer] | DI composition root |
| Packages/manifest.json | Package dependencies |

## Read-Only Paths

- `ProjectSettings/`

---

## Stack Selection Options

### Architecture

| # | Option | Description |
|---|--------|-------------|
| 1 | OOP | Classic object-oriented with MonoBehaviour / plain C# classes |
| 2 | Atomic Framework | By starkre22 |
| 3 | ECS | Entity Component System — ask ECS Framework follow-up |
| 4 | Other | Specify in text |

### ECS Frameworks

Show only if ECS architecture selected.

| # | Option | Description | Notes |
|---|--------|-------------|-------|
| 1 | Unity DOTS | Official Unity ECS, Burst, Jobs | |
| 2 | Photon Quantum | Deterministic ECS with networking | Skip Networking question |
| 3 | Entitas | Mature, code-generation based | |
| 4 | LeoECS Lite | Lightweight, zero-allocation | |
| 5 | LeoECS Proto | Next-gen LeoECS | |
| 6 | Morpeh | Unity-friendly, C# idiomatic | |
| 7 | Other | Specify in text | |

### Networking

Skip if Photon Quantum was selected as ECS framework.

Show options based on the selected architecture:

**If ECS architecture:**

| # | Option | Description |
|---|--------|-------------|
| 1 | None | |
| 2 | Photon Quantum | Deterministic ECS networking |
| 3 | Netcode for Entities | Official Unity, DOTS-based |
| 4 | Other | Specify in text |

**If non-ECS architecture (OOP, Atomic Framework, etc.):**

| # | Option | Description |
|---|--------|-------------|
| 1 | None | |
| 2 | Photon Fusion 2 | State sync, tick-based |
| 3 | Photon PUN 2 | Room-based, legacy |
| 4 | Netcode for GameObjects | Official Unity, MonoBehaviour-based |
| 5 | Mirror | Open-source HLAPI replacement |
| 6 | FishNet | Modern open-source, feature-rich |
| 7 | Other | Specify in text |

### DI Frameworks

| # | Option | Description |
|---|--------|-------------|
| 1 | None | |
| 2 | Zenject | Feature-rich, installer patterns |
| 3 | VContainer | Lightweight, fast compilation |
| 4 | Reflex | Minimal, zero-allocation |
| 5 | ManualDI | Manual approach, no framework |
| 6 | Other | Specify in text |

### Async Patterns

| # | Option | Description |
|---|--------|-------------|
| 1 | UniTask | Zero-allocation, CancellationToken support |
| 2 | Awaitable | Unity 6+ built-in async, no third-party dependency |
| 3 | Coroutines | Legacy pattern |

### UI Framework

| # | Option | Description |
|---|--------|-------------|
| 1 | uGUI | Canvas-based, mature, wide asset support |
| 2 | UI Toolkit | Modern, CSS-like styling, retained mode |
| 3 | IMGUI | Immediate mode — debug/editor tools only |

### Additional Frameworks Examples

Examples for the "Additional frameworks?" question:
`"DOTween, Addressables, R3, Odin Inspector"`

---

## Package Display Names

Only packages listed here get a short display name; unknown packages keep their id as-is. Plugins (from `Assets/Plugins/`) and Third-Party Assets come directly from the Step 6 scan with folder name verbatim — they are **not** listed here.

| Package Id | Display Name |
|-----------|--------------|
| com.unity.render-pipelines.universal | URP |
| com.unity.render-pipelines.high-definition | HDRP |
| com.unity.inputsystem | Unity Input System |
| com.unity.addressables | Addressables |
| com.unity.test-framework | Test Framework |
| com.unity.entities | Unity DOTS |
| com.unity.netcode | Netcode for Entities |
| com.unity.netcode.gameobjects | Netcode for GameObjects |
