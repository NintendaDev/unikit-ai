# The index of your references

`.unikit/references/INDEX.md` is kept by `/unikit-references`. It lists your own entries only; the folder `bridges/` is written by `/unikit-bridge-docs` and is not listed.

```
<!-- Kept by /unikit-references. The collected documentation of the engine bridges lives in bridges/ and is written by /unikit-bridge-docs - it is not listed here. -->
# References

Your own reference material. An agent reads an entry when you name it or when a project rule points to it.

| name | what it is for | kind | origin | updated |
|---|---|---|---|---|
| [<name>](user/<name>/) | <one line> | copy | <the path or the address it was taken from> | <date> |
| <name> | <one line> | link | <the address> | <date> |
```

- `kind` is `copy` (the files are under `user/<name>/`; the name is a link to that folder) or `link` (nothing is stored but the address).
- A row is replaced in place on refresh and on replace; a deleted entry loses its row and its folder.
- The `origin` of a copy is the path (absolute, or relative to the project) or the address. `refresh` copies again from it; when the origin is gone, say so and keep the current copy.
