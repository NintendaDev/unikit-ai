import { applyAgentFilter } from './agent-filter.js';
import { getAgentConfig } from './agents.js';
import type { AgentInstallation } from './config.js';
import { EXTENSION_POINT_ANCHOR_OPEN, EXTENSION_REFERENCE_PLACEHOLDER } from './constants.js';
import { containsBlockMarker } from './extension-markers.js';
import { buildEngineVars, buildTemplateVars, processTemplate } from './template.js';
import { getTransformer } from './transformer.js';

// The text of an extension block or reference file goes through the same steps the text of the base
// skill goes through at install time, in the same order: the agent filter, the `{{…}}` variables,
// then the agent transformer's reference rewrite (today only Codex has one: `/unikit-*` → `$unikit-*`).
// A pure function of its inputs — the caller reads and writes files.

export interface RenderContext {
  agent: AgentInstallation;
  engine: string;
  engineMcpKey: string | null | undefined;
  /** Becomes `{{self_name}}`: the skill the text is delivered to. */
  target: string;
  /** Project-relative, `/`-separated directory the extension's reference copies live in. */
  referenceBaseDir: string;
  /** File names allowed in `{{ext_reference:<name>}}` — the basenames of the entry's `references[]`. */
  referenceNames: ReadonlySet<string>;
}

export type RenderResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'render-failed' | 'reference-unresolved'; detail: string };

const REFERENCE_PLACEHOLDER_PATTERN = new RegExp(`\\{\\{${EXTENSION_REFERENCE_PLACEHOLDER}:([^}\\s]+)\\}\\}`, 'g');

/**
 * Render one text. `mode: 'block'` also runs the agent filter (the text of a skill does); a
 * reference file does not (reference files of base skills carry no guarded blocks either).
 */
export function renderExtensionText(raw: string, ctx: RenderContext, mode: 'block' | 'reference'): RenderResult {
  let text = raw.replace(/\r\n/g, '\n');

  // A text that carried its own marker or a second anchor would make the next pass find the wrong
  // number of anchors, or strip somebody else's block.
  if (containsBlockMarker(text) || text.includes(EXTENSION_POINT_ANCHOR_OPEN)) {
    return {
      ok: false,
      reason: 'render-failed',
      detail: 'the text contains a reserved unikit-ext marker or an extension-point anchor',
    };
  }

  if (mode === 'block') {
    try {
      text = applyAgentFilter(text, ctx.agent.id);
    } catch (error) {
      return { ok: false, reason: 'render-failed', detail: error instanceof Error ? error.message : String(error) };
    }
  }

  const unresolved: string[] = [];
  text = text.replace(REFERENCE_PLACEHOLDER_PATTERN, (_match, name: string) => {
    if (!ctx.referenceNames.has(name)) {
      if (!unresolved.includes(name)) unresolved.push(name);
      return _match;
    }
    return `${ctx.referenceBaseDir}/${name}`;
  });
  if (unresolved.length > 0) {
    return { ok: false, reason: 'reference-unresolved', detail: unresolved.join(', ') };
  }

  try {
    const vars = buildTemplateVars(getAgentConfig(ctx.agent.id));
    try {
      Object.assign(vars, buildEngineVars(ctx.engine, ctx.engineMcpKey));
    } catch {
      // An unknown engine id: the agent variables alone, as the skill installer does without an engine.
    }
    vars.self_name = ctx.target;

    const processed = processTemplate(text, vars);
    const final = getTransformer(ctx.agent.id).transformReference?.(processed) ?? processed;
    return { ok: true, text: mode === 'block' ? final.trim() : final };
  } catch (error) {
    return { ok: false, reason: 'render-failed', detail: error instanceof Error ? error.message : String(error) };
  }
}
