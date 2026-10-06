import { DefaultTransformer } from './transformers/default.js';
import { CodexTransformer } from './transformers/codex.js';
import { QwenTransformer } from './transformers/qwen.js';
import { AntigravityTransformer } from './transformers/antigravity.js';
import { KimiTransformer } from './transformers/kimi.js';
import { UniversalTransformer } from './transformers/universal.js';

export interface TransformResult {
  targetDir: string;
  targetName: string;
  content: string;
  flat: boolean;
}

export interface AgentTransformer {
  transform(skillName: string, content: string): TransformResult;
  /**
   * Rewrite skill invocations (`/unikit-*`) inside a reference `.md` file body.
   * Optional: only agents that remap invocations (codex/qwen) or a subagent
   * type (kimi) implement it; default agents (claude/cursor/opencode) leave it
   * undefined so references keep `/unikit-*` verbatim. Unlike {@link transform}
   * this never runs the agent-filter — reference files carry no guarded blocks
   * (enforced by a source guard in scripts/test-skills.sh).
   */
  transformReference?(content: string): string;
  /**
   * Adapt an installed subagent file (`<subagentsDir>/<name>.md`) to the agent's own agent-file
   * format. Runs on the whole file (frontmatter + body) AFTER the agent-filter and `{{var}}`
   * substitution. Optional: only Kimi implements it; every other agent's subagent files are
   * written exactly as before.
   */
  transformSubagent?(subagentName: string, content: string): string;
  postInstall?(projectDir: string): Promise<void>;
  getWelcomeMessage(): string[];
  getInvocationHint?(): string;
  cleanup?(projectDir: string, skillsDir: string): Promise<void>;
}

export interface AgentOnboarding {
  welcomeMessage: string[];
  invocationHint: string | null;
}

export function extractFrontmatterName(content: string): string | null {
  const match = content.match(/^name:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

export function replaceFrontmatterName(content: string, newName: string): string {
  return content.replace(/^name:\s*.+$/m, `name: ${newName}`);
}

// `}` is part of the left boundary: the rewrite runs before `processTemplate`, so a path
// such as `{{skills_dir}}/unikit-fix/…` still carries the closing braces of its variable
// and its `/unikit-fix` is a path segment, not an invocation.
const INVOCATION_PATTERN = /(^|[^A-Za-z0-9_}-])\/(unikit(?:-[a-z0-9-]+)?)/g;

export function rewriteInvocationPrefix(
  content: string,
  mapInvocation: (invocation: string) => string,
): string {
  return content.replace(
    INVOCATION_PATTERN,
    (_match, prefix: string, invocation: string) => `${prefix}${mapInvocation(invocation)}`,
  );
}

const registry: Record<string, () => AgentTransformer> = {
  codex: () => new CodexTransformer(),
  qwen: () => new QwenTransformer(),
  antigravity: () => new AntigravityTransformer(),
  kimi: () => new KimiTransformer(),
  universal: () => new UniversalTransformer(),
};

export function getTransformer(agentId: string): AgentTransformer {
  const factory = registry[agentId];
  return factory ? factory() : new DefaultTransformer();
}

export function getAgentOnboarding(agentId: string): AgentOnboarding {
  const transformer = getTransformer(agentId);
  return {
    welcomeMessage: transformer.getWelcomeMessage(),
    invocationHint: transformer.getInvocationHint?.() ?? null,
  };
}

export async function cleanupAgentSetup(agentId: string, projectDir: string, skillsDir: string): Promise<void> {
  const transformer = getTransformer(agentId);
  await transformer.cleanup?.(projectDir, skillsDir);
}
