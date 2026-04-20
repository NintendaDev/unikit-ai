# [TASK_ID]: [Task title in one line]

## CONTEXT
Project: [Engine, DI framework, key libraries]
Feature: [path to docs/features/XXX.md]
Scope: [2-4 key components separated by +]
Stop condition: [what is NOT implemented in this task]
Research: [path to .unikit/researches/XXX/RESEARCH_RESULT.md]

---
## CONSTRAINTS
<!-- Check before every created/modified file -->
- MUST: [mandatory requirement]
- MUST: [mandatory requirement]
- FORBIDDEN: [what must not be done — specific method/pattern]
- FORBIDDEN: [what must not be done — specific method/pattern]

---
## INTERFACES
<!-- Contracts are fixed here. Implementations must not deviate from these signatures -->

### [IInterfaceName] [NEW | MODIFY | EXTEND]
```csharp
// Namespace.Path
public interface IInterfaceName
{
    // properties and methods with one-line comments
}
```

### [IInterfaceName] [NEW | MODIFY | EXTEND]
```csharp
// Namespace.Path
public interface IInterfaceName
{
    // REMOVE: [what is removed]
    // ADD:
    [new method/property]
}
```

---
## KEY PATTERNS
<!-- Boilerplate code. Agent uses as-is, does not invent alternatives -->

### [Pattern name]
```csharp
// usage context
[code]
```

### [Pattern name]
```csharp
// usage context
[code]
```

---
## DEPENDENCY GRAPH
<!-- Implementation order: start with what others depend on -->

[ClassA]
  <- [Dep1] (direct ctor inject)
  <- [Dep2] (ctor inject)

[ClassB]
  <- [IInterfaceA]
  <- [IInterfaceB]

---
## FILES

### CREATE
| Path | Type | Notes |
|------|------|-------|
| `Module/Path/IInterface.cs` | interface | see INTERFACES |
| `Module/Path/Implementation.cs` | class : IInterface | brief description |

### MODIFY
| Path | Change |
|------|--------|
| `Module/Path/ExistingFile.cs` | [what changes — one line] |

---
## DI BINDINGS
<!-- Insert into [InstallerName].cs -> method [MethodName]() -->
```csharp
// [MethodName]()
Bind<IInterface>().To<Implementation>().AsSingle();
Bind<IInterface>().To<Implementation>().AsSingle();
BindInterfacesTo<Controller>().AsSingle().NonLazy();
```

---
## OUT OF SCOPE
<!-- Agent does not implement this, even if it seems like a logical continuation -->
- [feature/method/system]
- [feature/method/system]
