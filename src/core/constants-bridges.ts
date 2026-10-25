// Names of the engine-bridge layer. A leaf module on purpose: `constants.ts` sits at the Part 7i
// ceiling and must not re-export it (a cycle and a TDZ error, the same trap as SV-1c).

/** Subdirectory of the package `mcp/` catalog that holds the universal MCP servers (Context7, GitHub). */
export const UNIVERSAL_MCP_DIR_NAME = 'universal';
