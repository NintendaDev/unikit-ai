# Unity Documentation Rules

Engine-specific detection, scanning, and analysis rules for Unity projects.

## Engine Version Detection

Read `ProjectSettings/ProjectVersion.txt` — contains the exact Unity version (e.g., `6000.0.68f1`).
Package versions: `Packages/manifest.json`.

## Package Manifest

- **Primary:** `Packages/manifest.json` — all UPM packages with versions
- **Manual plugins:** `Assets/Plugins/` — third-party plugins installed manually
- **Store assets:** `Assets/Third-Party Assets/` — Unity Asset Store purchases

## Tech Stack Detection Tables

### DI Frameworks

| Package ID / Folder | Framework | Grep pattern |
|---------------------|-----------|-------------|
| `com.svermeulen.extenject` | Zenject/Extenject | `using Zenject` |
| `Plugins/Zenject/` | Zenject (manual) | `using Zenject` |
| `com.cysharp.container` | VContainer | `using VContainer` |
| `Plugins/VContainer/` | VContainer (manual) | `using VContainer` |
| `Plugins/StrangeIoC/` | StrangeIoC | `using strange` |
| `com.gustavopsantos.reflex` | Reflex | `using Reflex` |
| `com.danielcambronern.manualdi` | ManualDi | `using ManualDi` |

**What to document:** Installer classes, lifecycle interfaces (`IInitializable`, `ITickable`, `IDisposable`), binding patterns, sub-containers.

### Async Libraries

| Package ID | Library | Grep pattern |
|-----------|---------|-------------|
| `com.cysharp.unitask` | UniTask | `using Cysharp.Threading.Tasks` |
| None (built-in) | Coroutines | `StartCoroutine`, `IEnumerator` |

**What to document:** Async conventions (UniTask vs UniTaskVoid), CancellationToken patterns.

### Event Systems

| Detection method | System | Grep pattern |
|-----------------|--------|-------------|
| `ISignal` + `SignalBus` | Custom SignalBus | `ISignal`, `SignalBus` |
| `MessageBroker` | UniRx MessageBroker | `MessageBroker.Default` |
| `EventBus<>` | Custom EventBus | `EventBus<` |
| `UnityEvent` only | Unity Events | `UnityEvent` |

**What to document:** All signal/event structs, publishers, subscribers, signal flow diagrams.

### UI Frameworks

| Detection method | Framework | Grep pattern |
|-----------------|-----------|-------------|
| `MonoView<>` | ASPID MVVM | `MonoView<` |
| `UIDocument` | UI Toolkit | `using UnityEngine.UIElements` |
| `Canvas` + UGUI | UGUI (standard) | `using UnityEngine.UI` |
| `*Presenter.cs`, `*ViewModel.cs` | Custom MVP/MVC | — |

### Reactive Libraries

| Package ID | Library | Grep pattern |
|-----------|---------|-------------|
| `com.cysharp.r3` | R3 | `using R3` |
| `com.neuecc.unirx` | UniRx | `using UniRx` |

### Asset Management

| Package ID | System | Grep pattern |
|-----------|--------|-------------|
| `com.unity.addressables` | Addressables | `using UnityEngine.AddressableAssets` |
| `Assets/Resources/` exists | Resources (legacy) | `Resources.Load` |
| `Assets/StreamingAssets/` | StreamingAssets | `Application.streamingAssetsPath` |

### AI & Behaviour

| Detection method | System | Grep pattern |
|-----------------|--------|-------------|
| `ParadoxNotion.NodeCanvas` | NodeCanvas | `using NodeCanvas` |
| `com.unity.ai.navigation` | NavMesh | `using UnityEngine.AI` |
| `Plugins/BehaviorDesigner/` | Behavior Designer | `using BehaviorDesigner` |
| Custom FSM | Custom FSM | `StateMachine`, `IState` |

### Networking

| Package ID / Folder | Framework | Grep pattern |
|---------------------|-----------|-------------|
| `com.unity.netcode.gameobjects` | Netcode for GameObjects | `using Unity.Netcode` |
| `Plugins/Mirror/` | Mirror | `using Mirror` |
| `Plugins/Photon/` | Photon | `using Photon` |
| `com.fishnetworking.fishnet` | FishNet | `using FishNet` |

### Other Frameworks

| Detection method | Framework | Grep pattern |
|-----------------|-----------|-------------|
| `com.unity.localization` | Localization | `using UnityEngine.Localization` |
| `com.unity.cinemachine` | Cinemachine | `using Unity.Cinemachine` |
| `com.unity.inputsystem` | New Input System | `using UnityEngine.InputSystem` |
| `com.unity.timeline` | Timeline | `using UnityEngine.Timeline` |
| `com.demigiant.dotween` or `Plugins/DOTween/` | DOTween | `using DG.Tweening` |
| `com.opsive.ultimateinventorysystem` | Opsive UIS | `using Opsive` |
| `Plugins/Odin/` | Odin Inspector | `using Sirenix` |
| `Plugins/PixelCrushers/` | Dialogue System | `using PixelCrushers` |

## Folder Structure Patterns

### Script Root Detection

Check these paths — record all that exist:

```
Assets/Scripts/
Assets/_Scripts/
Assets/Code/
Assets/Source/
Assets/Game/
Assets/_Game/
Assets/_Project/
Assets/App/
Assets/Runtime/
```

### Modular Structure Detection

```
Assets/Modules/
Assets/Features/
Assets/Systems/
Assets/Core/
Assets/Packages/          (local packages)
```

### Special Folders (do NOT document internals)

```
Assets/Editor/            → Editor scripts (custom tools)
Assets/Plugins/           → Third-party plugins
Assets/Third-Party Assets/ → Vendor assets
Assets/ThirdParty/
Assets/Vendor/
Assets/Resources/         → Legacy resource loading
Assets/StreamingAssets/   → Raw files for runtime
Assets/AddressableAssetsData/ → Addressables config
Assets/Settings/          → Project settings, URP, templates
```

### Scene Detection

```
Assets/Scenes/
Assets/Game/Scenes/
Assets/_Scenes/
Assets/Levels/
```

### Test Detection

Look for `.asmdef` files with:
- `includePlatforms: ["Editor"]` → EditMode tests
- `defineConstraints: ["UNITY_INCLUDE_TESTS"]` → test helpers
- References to `com.unity.test-framework` → NUnit tests
- Folder patterns: `Tests/`, `Test/`, `EditMode/`, `PlayMode/`

## Module Boundary Mechanism

**Assembly Definition files** (`.asmdef`) — the dependency graph of the project.

```
Glob: **/*.asmdef
```

Read a representative sample to understand:
- Module boundaries and namespace conventions
- Dependency directions between modules
- Which modules reference which plugins

## Deep Analysis Patterns

### Bootstrap Chain

```
Glob: Assets/**/Bootstrap*.unity, Assets/**/Main*.unity
Grep: "ProjectContext|SceneContext" in *.cs
Grep: "ScriptableObjectInstaller" in *.cs
Glob: **/*Installer*.cs (exclude Plugins/, Third-Party Assets/)
Grep: "ILoadingOperation" in *.cs
Grep: "IInitializable" in *.cs
```

### Communication Map

```
Grep: ": ISignal" in *.cs → signal structs
Grep: "Invoke<" in *.cs → signal publishers
Grep: "Subscribe<" in *.cs → signal subscribers
Grep: "ReactiveProperty<>|Subject<>|ReadOnlyReactiveProperty<>" in *.cs → reactive state
Grep: ".Subscribe(" in *.cs → reactive subscribers
```
