import { JsonMcpWriter } from './json-writer.js';
import { KIMI_BEARER_TOKEN_ENV_FIELD } from '../constants.js';
import { splitCodexHeaderEnvRefs } from '../mcp-env.js';
import { logInfo, logWarn } from '../../utils/log.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Kimi Code reads the transport off the entry (`command` → stdio, `url` → HTTP), so
 * `type` is dropped; it expands no `${VAR}` in a header, so an `Authorization: Bearer
 * {{env:NAME}}` becomes the variable NAME in `bearerTokenEnvVar`. A header whose WHOLE
 * value is a reference, or one that mixes text and a reference, has no Kimi field and is
 * dropped with a warning — the same contract the Codex writer keeps.
 */
function toKimiServerConfig(rawConfig: Record<string, unknown>, serverKey: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(rawConfig)) {
    if (field === 'type') {
      continue;
    }
    if (field === 'headers' && isRecord(value)) {
      const split = splitCodexHeaderEnvRefs(value);
      if (Object.keys(split.staticHeaders).length > 0) out['headers'] = split.staticHeaders;
      if (split.bearerTokenEnvVar !== undefined) {
        out[KIMI_BEARER_TOKEN_ENV_FIELD] = split.bearerTokenEnvVar;
        // The field name only — never the variable name next to a header.
        logInfo('mcp', `kimi: ${serverKey} — Authorization written as ${KIMI_BEARER_TOKEN_ENV_FIELD}`);
      }
      for (const name of Object.keys(split.envHttpHeaders)) {
        logWarn('mcp', `kimi: ${serverKey} — header ${name} is a whole-value env reference; Kimi Code has no field for it, header dropped`);
      }
      for (const name of split.dropped) {
        logWarn('mcp', `kimi: ${serverKey} — header ${name} mixes text and an env reference; Kimi Code cannot express it, header dropped`);
      }
      continue;
    }
    out[field] = value;
  }

  return out;
}

export class KimiMcpWriter extends JsonMcpWriter {
  constructor() {
    // `envStyle` is required by the base options but never consulted: `upsert` below
    // removes every `{{env:}}` reference before the base class would render one.
    super({ label: 'kimi', envStyle: 'dollar-brace' });
  }

  override upsert(settings: Record<string, unknown>, key: string, config: Record<string, unknown>): void {
    super.upsert(settings, key, toKimiServerConfig(config, key));
  }
}
