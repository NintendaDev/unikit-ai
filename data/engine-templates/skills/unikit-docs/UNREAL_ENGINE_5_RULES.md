# Unreal Engine 5 Documentation Rules

Engine-specific detection, scanning, and analysis rules for Unreal Engine 5 projects.

## Engine Version Detection

Read `*.uproject` file in project root — contains `EngineAssociation` with the engine version (e.g., `5.4`).
Also check `DefaultEngine.ini` for renderer and feature settings.

## Package Manifest

- **Primary:** `*.uproject` → `Plugins` array — lists enabled plugins with versions
- **Marketplace plugins:** `Plugins/` directory — each subfolder with `.uplugin` file
- **C++ modules:** `Source/` directory — each subfolder with `*.Build.cs` file
- **Content plugins:** `Plugins/*/Content/` — Blueprint-only plugins

## Tech Stack Detection Tables

### Module Types

| Detection method | Type | Pattern |
|-----------------|------|---------|
| `Source/<Module>/` with `*.Build.cs` | C++ Game Module | `PublicDependencyModuleNames` |
| `Plugins/<Plugin>/Source/` | Plugin Module | `.uplugin` + `*.Build.cs` |
| `Plugins/<Plugin>/` without Source/ | Content-only Plugin | `.uplugin`, no `Build.cs` |
| `Source/<Module>/` with `*.Target.cs` | Build Target | `SetupBinaries` |

**What to document:** Module dependency graph from `Build.cs`, plugin dependencies, target configurations.

### Gameplay Frameworks

| Detection method | Framework | Grep pattern |
|-----------------|-----------|-------------|
| `AGameModeBase` subclass | Game Mode | `: public AGameModeBase` |
| `AGameStateBase` subclass | Game State | `: public AGameStateBase` |
| `UGameInstance` subclass | Game Instance | `: public UGameInstance` |
| `APlayerController` subclass | Player Controller | `: public APlayerController` |
| `UAbilitySystemComponent` | GAS (Gameplay Ability System) | `#include "AbilitySystemComponent.h"` |
| `UGameplayEffect` | GAS Effects | `UGameplayEffect` |

**What to document:** Game mode chain, player lifecycle, ability system setup.

### AI Systems

| Detection method | System | Grep pattern |
|-----------------|--------|-------------|
| `UBehaviorTree` | Behavior Trees | `#include "BehaviorTree/` |
| `UBlackboardComponent` | Blackboard | `UBlackboardComponent` |
| `UEnvQueryManager` | EQS (Environment Query) | `UEnvQuery` |
| `UAIPerceptionComponent` | AI Perception | `UAIPerceptionComponent` |
| `UStateTree` | StateTree | `#include "StateTree` |
| `MassEntity` | Mass AI (Crowds) | `#include "MassEntity` |

### UI Frameworks

| Detection method | Framework | Grep pattern |
|-----------------|-----------|-------------|
| `UUserWidget` subclasses | UMG (standard) | `: public UUserWidget` |
| `UCommonActivatableWidget` | CommonUI plugin | `#include "CommonActivatableWidget.h"` |
| `UMVVMViewModelBase` | MVVM (UE5.3+) | `UMVVMViewModelBase` |
| Slate widgets | Slate (C++) | `SNew(`, `SLATE_BEGIN_ARGS` |

### Networking

| Detection method | Framework | Grep pattern |
|-----------------|-----------|-------------|
| `UFUNCTION(Server)` | Replication RPCs | `UFUNCTION(Server`, `UFUNCTION(Client` |
| `UPROPERTY(Replicated)` | Property replication | `Replicated` |
| `AOnlineBeacon` | Online Beacons | `AOnlineBeacon` |
| `UOnlineSubsystem` | Online Subsystem | `IOnlineSubsystem` |
| EOS plugin | Epic Online Services | `OnlineSubsystemEOS` |

### Animation

| Detection method | System | Grep pattern |
|-----------------|--------|-------------|
| `UAnimInstance` | Animation Blueprints | `: public UAnimInstance` |
| `FAnimNode_*` | Custom Anim Nodes | `FAnimNode_` |
| Control Rig | Control Rig | `UControlRig` |
| IK Retargeter | IK system | `UIKRetargeter` |

### Other Systems

| Detection method | System | Grep pattern |
|-----------------|--------|-------------|
| `UDataAsset` subclasses | Data Assets | `: public UDataAsset` |
| `UPrimaryDataAsset` | Asset Manager | `: public UPrimaryDataAsset` |
| `USaveGame` | Save System | `: public USaveGame` |
| `UGameplayTagsManager` | Gameplay Tags | `FGameplayTag` |
| Niagara files | Niagara VFX | `.uasset` with Niagara |
| `UNiagaraSystem` | Niagara (C++) | `#include "NiagaraSystem.h"` |
| `UEnhancedInputComponent` | Enhanced Input | `#include "EnhancedInputComponent.h"` |
| `USubsystem` subclasses | Subsystems | `: public UGameInstanceSubsystem` |

## Folder Structure Patterns

### Source Root Detection

```
Source/                    → Main C++ source root
Source/<ProjectName>/      → Primary game module
Source/<ProjectName>Editor/ → Editor-only module
Source/<ModuleName>/       → Additional game modules
```

### Content Structure Detection

```
Content/                   → Primary content root
Content/Blueprints/       → Blueprint assets
Content/Maps/             → Level maps
Content/UI/               → UMG widgets
Content/Characters/       → Character assets
Content/VFX/              → Visual effects
Content/Audio/            → Sound assets
Content/Materials/        → Materials and textures
```

### Plugin Structure

```
Plugins/                   → Project plugins
Plugins/<Name>/Source/    → C++ plugin source
Plugins/<Name>/Content/   → Plugin content
Plugins/<Name>/<Name>.uplugin → Plugin descriptor
```

### Special Folders

```
Binaries/         → Compiled binaries (do NOT commit)
Intermediate/     → Build intermediates (do NOT commit)
Saved/            → Local saves and logs (do NOT commit)
DerivedDataCache/ → Shader/asset cache (do NOT commit)
Config/           → .ini configuration files
```

### Test Detection

- Automation framework: `FAutomationTestBase` subclasses
- Folder patterns: `Tests/`, `Test/` under Source/
- `*.Build.cs` with test module dependencies (`AutomationController`)
- Functional tests: `AFunctionalTest` actors in test maps

## Module Boundary Mechanism

**Build.cs files** — each module's `*.Build.cs` defines dependencies:

```
Glob: Source/**/*.Build.cs
```

Read `PublicDependencyModuleNames` and `PrivateDependencyModuleNames` to build dependency graph.

Key conventions:
- `Public` dependencies are transitive (expose headers to dependents)
- `Private` dependencies are local only
- Cross-module access requires explicit dependency declaration
- `MODULENAME_API` macro for exported classes

## Deep Analysis Patterns

### Bootstrap Chain

```
Read: *.uproject → modules and plugins list
Grep: "AGameModeBase\|AGameMode" in *.h → game mode hierarchy
Grep: "UGameInstance" in *.h → game instance setup
Read: Config/DefaultGame.ini → default game mode, maps
Read: Source/**/*.Build.cs → module dependency graph
```

### Communication Map

```
Grep: "DECLARE_DYNAMIC_MULTICAST_DELEGATE" in *.h → delegate declarations
Grep: "DECLARE_EVENT" in *.h → event declarations
Grep: "Broadcast()" in *.cpp → event publishers
Grep: "AddDynamic\|BindUFunction" in *.cpp → event subscribers
Grep: "FGameplayTag" in *.h → gameplay tag usage
Grep: "UAbilitySystemComponent" in *.h → GAS communication
```
