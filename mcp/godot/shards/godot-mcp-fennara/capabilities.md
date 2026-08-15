### Bootstrap — none needed

All **14** tools are visible from the first call. There is no category unlock,
no activation group, no tiering. If a tool name is not in the list below, it
does not exist on this server — report that rather than looking for a switch
that would reveal it.

```
fennara_status · get_scene_tree · get_node_properties · get_class_info
write_or_update_file · run_scene_edit_script · run_asset_import_script
project_settings · script_diagnostics · validate_scene
screenshot_scene · runtime_session · runtime_script · scrape_editor
```

### The shape of this server

Fennara is a **code executor**, not a catalog of operations. There is no
`create_node` / `set_property` / `add_animation` family — one tool,
`run_scene_edit_script`, takes GDScript and runs it against a scene, and that
one tool covers scene, UI, VFX, animation and asset work alike. Expect to write
short scripts, not to look up an operation name.

Two consequences worth internalising up front:

- `get_class_info` returns version-accurate Godot documentation, read from the
  branch of the editor actually attached. Consult it before writing script
  bodies — it is the cheapest available defence against inventing an API that
  does not exist in this Godot version.
- Script execution is **not sandboxed**. `is_read_only` guards exactly six
  `ctx` helpers; `FileAccess`, `OS`, `ResourceSaver` and `EditorInterface` stay
  reachable regardless. Treat every script you send as running with the
  editor's full privileges, and keep destructive calls out of scripts whose
  only job is inspection.

### The editor must be open

There is no headless mode. Every tool goes through the running editor, so if
the editor is closed the correct report is "the Godot editor is not running",
not "the change failed".

One daemon serves the account (port 41287). With two Godot projects open, the
target project is whichever is selected in the Fennara dock — the MCP call
cannot pick it. If results appear to land in the wrong project, that is the
reason.

### C# projects (`godot-net`) — diagnostics are expensive

On a `godot-net` project, C# diagnostics only work through
`script_diagnostics scan_project:true`, which runs a full `dotnet build` into
an isolated directory. That is **seconds** per iteration, against fractions of
a second for GDScript through the LSP.

Do not fire it after every edit. Batch the C# changes, then diagnose once.
GDScript diagnostics stay cheap and can be run freely.

### Not exposed to this pipeline

`save_skill` / `use_skill` are deliberately excluded from `allowed-tools`.
They are `execute_code` in another guise and their storage namespace collides
with the agent's own skills directory. Do not ask for them.
