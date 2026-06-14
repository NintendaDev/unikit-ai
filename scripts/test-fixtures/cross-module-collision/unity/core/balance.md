# balance

> **Scope**: project
> **Load when**: never — synthetic collision fixture used only to exercise `rules show` exit 3 (a code rule whose id collides with the bundled gamedesign `balance`).

Synthetic content. This is NOT a real balancing rule — it exists so a bare
`rules show balance` resolves in two modules at once (code here + gamedesign
backfilled from the bundled snapshot) and trips the ambiguous-id guard.
