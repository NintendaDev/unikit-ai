# Document Templates

Content guidelines and templates for each documentation page type.

## Language Note

All templates below show English examples. When the project language (from `.unikit/config.yaml`, keys `language.ui` / `language.artifacts`) is not English, translate all prose — headings, descriptions, table header labels, bullet text, navigation links — into the configured language. Keep code identifiers, file paths, class names, and framework names in English.

Example with `"language": "ru"`:
- `## Tech Stack` → `## Технологический стек`
- `| Category | Technology |` → `| Категория | Технология |`
- `## Quick Start` → `## Быстрый старт`
- `## See Also` → `## См. также`
- `[Getting Started](docs/getting-started.md)` → `[Начало работы](docs/getting-started.md)` (file name stays English)

## Table of Contents

1. [README.md](#readmemd)
2. [getting-started.md](#getting-startedmd)
3. [architecture.md](#architecturemd)
4. [project-map.md](#project-mapmd)
5. [di-bindings.md](#di-bindingsmd)
6. [events.md](#eventsmd)
7. [save-system.md](#save-systemmd)
8. [game-systems.md](#game-systemsmd)
9. [testing.md](#testingmd)
10. [editor-tools.md](#editor-toolsmd)
11. [build.md](#buildmd)
12. [ui-system.md](#ui-systemmd)

---

## README.md

**Goal:** Landing page. User decides in 30 seconds whether this project is relevant.

**Template (~80-120 lines):**

```markdown
# Project Name

> One-line tagline describing the project.

Brief 2-3 sentence description of what this project does and why it exists.

## Tech Stack

| Category | Technology |
|----------|-----------|
| Engine | {{engine_name}} X (version) |
| Rendering | URP / HDRP / Built-in |
| DI | Zenject / VContainer / none |
| Async | UniTask / Coroutines |
| ... | ... |

## Quick Start

### Prerequisites

- {{engine_name}} Hub with {{engine_name}} **X.Y.Z** installed
- [Other requirements]

### Setup

\`\`\`bash
git clone <repo-url>
\`\`\`

Open the project in {{engine_name}} Hub. Wait for package resolution. Open `Assets/Scenes/Bootstrap.{{engine_name}}` and press Play.

## Key Features

- **Feature 1** — brief description
- **Feature 2** — brief description
- **Feature 3** — brief description

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/getting-started.md) | Installation, setup, first steps |
| [Architecture](docs/architecture.md) | Project structure and patterns |
| [Project Map](docs/project-map.md) | Modules, assemblies, namespaces |
| ... | ... |

## License

[License type]
```

**Key rules:**
- Tech Stack table populated from `detected_stack`
- {{engine_name}} version from `ProjectSettings/ProjectVersion.txt`
- Scene path from actual scene detection
- Features from `.unikit/DESCRIPTION.md` or codebase analysis
- Documentation table links to all generated docs/ pages
- **NO long descriptions, NO full reference, NO configuration details**

---

## getting-started.md

**Goal:** From zero to running project.

**Sections:**

### Prerequisites
- {{engine_name}} version (exact, from ProjectVersion.txt)
- Required {{engine_name}} modules (Android Build Support, iOS Build Support if mobile)
- IDE (Rider, VS Code with {{engine_name}} extension)
- Git LFS (if large assets)

### Installation
- Clone command
- Git LFS pull (if applicable)
- Open in {{engine_name}} Hub
- Wait for package resolution and compilation

### First Run
- Which scene to open (detected entry scene)
- Press Play
- What to expect (brief description of initial state)

### Project Structure Overview
- Brief folder map (3-5 key folders with one-line descriptions)
- Link to architecture.md for details

### Common Issues
- Package resolution failures
- Compilation errors on first open
- Missing render pipeline assets

---

## architecture.md

**Goal:** Understand the project's technical design decisions.

**Sections:**

### Overview
- Architecture pattern name (Modular Monolith, Feature-based, etc.)
- High-level diagram (ASCII)

### Dependency Flow
- What depends on what
- Forbidden dependencies
- ASCII or Mermaid diagram

### Folder Structure
- Tree view with descriptions for each key folder
- Depth: 2-3 levels

### Key Patterns
- DI conventions (if DI framework detected)
- Naming conventions
- Communication patterns between systems

### System Interaction Overview
- ASCII diagram showing how major systems communicate
- Legend: DI (direct injection), Signal (SignalBus events), R3 (reactive streams)
- Highlight hub systems — the ones with the most connections
- Source: cross-system interaction matrix from Step 1.5.4

### Data Flow Overview
- How data moves through the system: user action → controller → service → model → view
- Show the typical lifecycle of data (creation → mutation → persistence → restoration)
- Identify the key data entities that cross multiple system boundaries

### Assembly Definitions
- Strategy (per-module, per-feature, etc.)
- Naming convention
- Test assembly structure

**Source:** Enrich from `.unikit/ARCHITECTURE.md` if available. Don't copy verbatim — adapt for docs/ format with navigation and See Also. Use Step 1.5 analysis for interaction diagrams and data flow.

---

## project-map.md

**Goal:** Quick reference for "where is what" — modules, assemblies, namespaces.

**Sections:**

### Module Catalog

| Module | Namespace | Assembly | Purpose |
|--------|-----------|----------|---------|
| Wallets | `Modules.Wallets` | `Pawnshop.Wallets` | Currency management |
| ... | ... | ... | ... |

### Assembly Dependency Graph
- ASCII diagram showing assembly references
- Or table: Assembly → References

### Namespace Convention
- Pattern (how namespace maps to folder)
- Examples

### Scenes
| Scene | Path | Purpose |
|-------|------|---------|
| Bootstrap | `Assets/Game/Scenes/Bootstrap.{{engine_name}}` | App entry point |
| ... | ... | ... |

---

## di-bindings.md

**Goal:** Map of what is bound where in the DI container.

**Only generate if DI framework detected.**

**Sections:**

### Installer Map

| Installer | Scope | Key Bindings |
|-----------|-------|-------------|
| `ApplicationInstaller` | Global | `ISaveService`, `IAudioService` |
| `GameplayInstaller` | Scene | `IPlayerModel`, `ITradeService` |
| ... | ... | ... |

### Interface → Implementation Map

| Interface | Implementation | Installer | Scope |
|-----------|---------------|-----------|-------|
| `IPlayerTradeSystem` | `PlayerTradeSystem` | `GameplayInstaller` | Scene |
| ... | ... | ... | ... |

This section is critical — it answers "what concrete class handles this interface?" which is the most common question when reading unfamiliar code. Source: Step 1.5.2 DI analysis.

### Dependency Chains

For key controllers (bound with `.NonLazy()`), show their transitive dependency tree 2-3 levels deep:

```
GameLoopController
  ├─ ICustomersService → CustomersService
  │    ├─ ICustomerFactory → ...
  │    └─ ICustomerPool → ...
  ├─ ISignalBus → SignalBus
  └─ IPlayerTradeSystem → PlayerTradeSystem
       ├─ IWallet → Wallet
       └─ ...
```

### Hub Services

Services injected by 3+ consumers — the connective tissue of the architecture:

| Service | Consumer Count | Key Consumers |
|---------|---------------|---------------|
| `SignalBus` | N | GameLoopController, SaveLoadController, ... |
| ... | ... | ... |

### Binding Conventions
- When to use `.AsSingle()` vs `.AsTransient()`
- When to use `.NonLazy()`
- Sub-container patterns (if used)

### Lifecycle
- Initialization order (source: Step 1.5.1 bootstrap chain analysis)
- Which interfaces are used (`IInitializable`, `ITickable`, `IDisposable`)

---

## events.md

**Goal:** Complete catalog of ALL inter-system communication — signals, reactive streams, and their chains.

**Only generate if event system detected.**

**Completeness requirement:** This page must document EVERY signal in the project. Use the Step 1.5.2 analysis as the authoritative source. If the analysis found N signals, this page must list N signals. A partial catalog is worse than no catalog — it gives a false sense of completeness.

**Sections:**

### Signal Catalog

| Signal | Type | Namespace | Publisher(s) | Subscriber(s) | Payload |
|--------|------|-----------|-------------|---------------|---------|
| `GameplayInitializedSignal` | `class` | `Modules.SignalBus` | `GameplayInitializeSignalOperation` | `GameLoopController`, `GameInitializableEffect` | none |
| ... | ... | ... | ... | ... | ... |

### Signal Chains

When one signal handler triggers another signal, document the full chain:

```
SignalA → HandlerClass.OnSignalA()
  └─ fires SignalB → AnotherHandler.OnSignalB()
       └─ fires SignalC → ...
```

These chains reveal hidden coupling and are among the hardest things to discover by reading code. Source: Step 1.5.2 signal chain analysis.

### R3 Reactive Streams

R3 observables are a second major communication channel alongside SignalBus. Document ALL reactive data flows:

| Source Class | Property | Type | Subscriber(s) | Purpose |
|-------------|----------|------|---------------|---------|
| `CustomerModel` | `OfferSayCompleted` | `Observable<Unit>` | `GameLoopController` | Offer completion notification |
| ... | ... | ... | ... | ... |

Show the reactive chain with operators:
```
Model.SomeProperty
  .Where(x => x != null)
  .Select(x => x.InnerObservable)
  .Switch()
  .Subscribe(handler)
```

### Signal Flow Diagrams

ASCII diagrams showing how signals and reactive streams connect systems. Group by feature/flow rather than by signal type. Source: Step 1.5.3 end-to-end flows.

### Conventions
- Signal naming rules
- Where to define signals (module-internal vs cross-module)
- Subscription cleanup patterns (Subscribe + Unsubscribe in Dispose)
- R3 disposal patterns (`.AddTo(this)` for MB, `.AddTo(_disposables)` for plain classes)

---

## save-system.md

**Goal:** What gets saved, how, and where.

**Only generate if save system detected.**

**Sections:**

### Save Architecture
- Save format (JSON, binary, PlayerPrefs)
- Save triggers (auto-save, manual)
- Save file location

### Save Data Map

| SaveSerializer | Data Class | What's Saved |
|---------------|------------|-------------|
| `WalletSaveSerializer` | `WalletSaveData` | Currency balances |
| ... | ... | ... |

### Adding New Save Data
- Step-by-step guide for adding a new serializer

---

## game-systems.md

**Goal:** Explain how gameplay systems work together — not just what each system does in isolation, but how they interact to produce the game experience.

**Only generate if gameplay systems detected.**

**Key principle:** A catalog of systems is a phone book — useful but boring. What makes this page valuable is showing the connections: "when the player accepts a trade, here's exactly what happens across 5 systems in 8 steps." Source: Step 1.5.3 end-to-end flows and Step 1.5.4 interaction matrix.

**Sections:**

### System Overview
- High-level diagram of game systems with connections between them
- Game loop description
- Cross-system interaction matrix (from Step 1.5.4) — which systems talk to which, and how

### Core Systems

For each major system:
- **Purpose** — what it does
- **Key Classes** — main classes involved (with file paths)
- **Dependencies** — what it injects via DI (from Step 1.5.2 analysis)
- **Communication** — what signals it fires/subscribes to, what reactive properties it exposes/observes
- **Integration Points** — how other systems interact with this one

### End-to-End Scenarios

Trace 2-3 key gameplay flows from trigger to completion. These are the most valuable part of this page because they show the real architecture in action:

```
Scenario: Customer Visit Lifecycle
1. GameLoopController.SpawnCustomerAsync()     [DI → ICustomersService]
2. CustomersService.SpawnAsync()               [creates customer, assigns point]
3. Customer walks to position                  [NodeCanvas behaviour tree]
4. CustomerDialogues starts conversation       [Dialogue System integration]
5. Customer makes offer                        [R3: OfferSayCompleted fires]
6. GameLoopController.OnOfferSayComplete()     [R3 Subscribe]
7. SignalBus.Invoke<ShowMiniGameButtonsSignal>  [Signal → UI]
8. Player accepts/rejects                      [ViewModel → PlayerTradeSystem]
9. ...
```

For each step: show the class name, method, and the communication mechanism used to reach the next step.

### State Management
- FSM / behaviour tree structure (if detected)
- Game states and transitions
- What triggers each transition

---

## testing.md

**Goal:** How to run tests, what's covered, testing patterns.

**Only generate if test assemblies detected.**

**Sections:**

### Test Infrastructure

| Assembly | Type | Test Count | Coverage Area |
|----------|------|-----------|--------------|
| `Game.Tests.EditMode` | EditMode | ~N | Game logic |
| ... | ... | ... | ... |

### Running Tests
- {{engine_name}} Test Runner instructions
- CLI commands (if available)
- CI integration (if detected)

### Testing Patterns
- AAA pattern examples
- Fake/stub conventions
- MonoBehaviour testing approach

### Adding New Tests
- Which assembly to use
- Naming conventions
- Helper utilities available

---

## editor-tools.md

**Goal:** Custom {{engine_name}} Editor extensions in the project.

**Only generate if Editor scripts detected.**

**Sections:**

### Custom Editors

| Tool | Path | Purpose |
|------|------|---------|
| `SpriteAtlasEditor` | `Editor/Sprites/` | Sprite atlas management |
| ... | ... | ... |

### Menu Items
- Custom menu entries and what they do

### Custom Inspectors
- Which components have custom inspectors

---

## build.md

**Goal:** Build process, platforms, asset management.

**Only generate if Addressables or build pipeline detected.**

**Sections:**

### Build Targets
- Supported platforms
- Platform-specific settings

### Addressables
- Group structure
- Build pipeline
- Loading strategy

### Build Steps
- Pre-build checklist
- Build commands
- Post-build verification

---

## ui-system.md

**Goal:** UI framework patterns and screen management.

**Only generate if UI framework beyond basic UGUI detected.**

**Sections:**

### UI Architecture
- Framework used (ASPID MVVM, UI Toolkit, etc.)
- View-ViewModel binding approach
- Screen management

### Screen Catalog

| Screen | View Class | ViewModel Class | Purpose |
|--------|-----------|----------------|---------|
| `MainMenu` | `MainMenuView` | `MainMenuViewModel` | Main menu |
| ... | ... | ... | ... |

### UI Conventions
- How to create new screens
- Animation approach (DOTween, Animator, etc.)
- Performance patterns (canvas.enabled vs SetActive)
