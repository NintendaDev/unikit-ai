import fs from 'fs/promises';
import path from 'path';
import {
  ensureDir, fileExists, getSkillsDir, readFileBuffer, readTextFile, removeDirectory, writeTextFile,
} from '../utils/fs.js';
import { logInfo, logWarn } from '../utils/log.js';
import type { AgentInstallation, ExtensionRecord, UniKitConfig } from './config.js';
import {
  EXTENSION_REFERENCES_SUBDIR, REFERENCES_DIR_NAME, type InjectionSkipReason,
} from './constants.js';
import { applyInjection } from './injections.js';
import { loadAllExtensions, type ExtensionManifest } from './extensions.js';
import {
  isInsideDirectory, isPointInjection, type PointInjection, type PositionInjection,
} from './extension-injections-schema.js';
import {
  countAnchors, insertAtAnchor, pointBlockKey, removePointBlocks, renderBlockRegion,
} from './extension-markers.js';
import { renderExtensionText, type RenderContext } from './extension-render.js';
import { extensionSlug, loadExtensionPointRegistry, registeredPoints } from './extension-points.js';
import { resolveSkillPaths } from './installer/hashing.js';

// The project-level injection pass. One function renders EVERY extension block for EVERY agent from
// scratch — the way `reconcileMcpSettings` does for MCP entries — so the result depends only on the
// installed extensions, never on the order or history of the commands that installed them. It also
// owns the reference files extensions deliver: `references/ext/` of a target skill is the framework's
// namespace and is recreated whole on every pass.

const LOG_COMPONENT = 'extension-injections';

export interface ExtensionInjectionInput {
  projectDir: string;
  engine: string;
  engineMcpKey: string | null | undefined;
  agents: AgentInstallation[];
  extensions: ExtensionRecord[];
}

/** The pass input every command builds the same way from the project's config. */
export function injectionInputFromConfig(projectDir: string, config: UniKitConfig): ExtensionInjectionInput {
  return {
    projectDir,
    engine: config.engine,
    engineMcpKey: config.engineMcpKey,
    agents: config.agents,
    extensions: config.extensions ?? [],
  };
}

export interface InjectionOutcome {
  extension: string;
  /** The entry id; `null` for a `position` entry. */
  id: string | null;
  kind: 'point' | 'position';
  point: string | null;
  target: string;
  targetType: 'skill' | 'subagent';
  agent: string;
  applied: boolean;
  reason?: InjectionSkipReason;
  detail?: string;
}

export interface InjectionReport {
  outcomes: InjectionOutcome[];
  applied: number;
  skipped: number;
  total: number;
  referencesWritten: number;
}

interface LoadedExtension {
  name: string;
  dir: string;
  manifest: ExtensionManifest;
}

interface PointEntry {
  extName: string;
  extDir: string;
  entry: PointInjection;
}

interface PreparedReference {
  dest: string;
  text?: string;
  bytes?: Buffer;
}

interface PreparedEntry {
  item: PointEntry;
  region: string;
  references: PreparedReference[];
}

/** Code-unit comparison: the order must not depend on the locale of the machine. */
function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function toPosix(value: string): string {
  return value.replaceAll('\\', '/');
}

function pointOutcome(
  item: PointEntry,
  agent: AgentInstallation,
  applied: boolean,
  reason?: InjectionSkipReason,
  detail?: string,
): InjectionOutcome {
  return {
    extension: item.extName,
    id: item.entry.id,
    kind: 'point',
    point: item.entry.point,
    target: item.entry.target,
    targetType: item.entry.targetType,
    agent: agent.id,
    applied,
    reason,
    detail,
  };
}

/** Read and render everything one entry needs, before anything is written. `null` plus the reason on failure. */
async function prepareEntry(
  item: PointEntry,
  target: string,
  ctxBase: Omit<RenderContext, 'referenceBaseDir' | 'referenceNames' | 'target'>,
  extRoot: string,
  projectDir: string,
): Promise<{ prepared: PreparedEntry } | { reason: InjectionSkipReason; detail: string }> {
  const { entry, extDir, extName } = item;

  const textPath = path.resolve(extDir, entry.file);
  if (!isInsideDirectory(extDir, textPath)) {
    return { reason: 'path-outside-extension', detail: entry.file };
  }
  const raw = await readTextFile(textPath);
  if (raw === null || raw.trim() === '') {
    return { reason: 'source-missing', detail: entry.file };
  }

  const slug = extensionSlug(extName);
  const destDir = path.join(extRoot, slug);
  const referenceNames = new Set<string>();
  const sources: Array<{ src: string; name: string }> = [];
  for (const ref of entry.references) {
    const src = path.resolve(extDir, ref);
    if (!isInsideDirectory(extDir, src)) {
      return { reason: 'path-outside-extension', detail: ref };
    }
    if (!(await fileExists(src))) {
      return { reason: 'source-missing', detail: ref };
    }
    const name = path.basename(src);
    referenceNames.add(name);
    sources.push({ src, name });
  }

  const ctx: RenderContext = {
    ...ctxBase,
    target,
    referenceBaseDir: toPosix(path.relative(projectDir, destDir)),
    referenceNames,
  };

  const block = renderExtensionText(raw, ctx, 'block');
  if (!block.ok) return { reason: block.reason, detail: block.detail };

  const references: PreparedReference[] = [];
  for (const { src, name } of sources) {
    const dest = path.join(destDir, name);
    if (name.endsWith('.md')) {
      const refRaw = await readTextFile(src);
      if (refRaw === null) return { reason: 'source-missing', detail: name };
      const rendered = renderExtensionText(refRaw, ctx, 'reference');
      if (!rendered.ok) return { reason: rendered.reason, detail: `${name}: ${rendered.detail}` };
      references.push({ dest, text: rendered.text });
    } else {
      const bytes = await readFileBuffer(src);
      if (!bytes) return { reason: 'source-missing', detail: name };
      references.push({ dest, bytes });
    }
  }

  const key = pointBlockKey(extName, target, entry.point, entry.id);
  return { prepared: { item, region: renderBlockRegion(key, block.text), references } };
}

/** All point entries that name `target`, in `(extension, id)` order — the order they appear in a point. */
function entriesFor(pointEntries: PointEntry[], target: string): PointEntry[] {
  return pointEntries.filter(item => item.entry.targetType === 'skill' && item.entry.target === target);
}

async function applyPointsToSkill(
  input: ExtensionInjectionInput,
  agent: AgentInstallation,
  target: string,
  items: PointEntry[],
  registry: Awaited<ReturnType<typeof loadExtensionPointRegistry>>,
  outcomes: InjectionOutcome[],
): Promise<number> {
  const paths = resolveSkillPaths(input.projectDir, agent.skillsDir, agent.id, target, path.join(getSkillsDir(), target));
  const file = paths.targetSkillFile;

  if (!(await fileExists(file))) {
    for (const item of items) outcomes.push(pointOutcome(item, agent, false, 'target-not-installed'));
    return 0;
  }

  const original = await readTextFile(file);
  if (original === null) {
    for (const item of items) outcomes.push(pointOutcome(item, agent, false, 'target-not-found'));
    return 0;
  }

  const base = removePointBlocks(original).content;
  const extRoot = path.join(paths.targetRefsDir, EXTENSION_REFERENCES_SUBDIR);
  await removeDirectory(extRoot);

  const offered = registeredPoints(registry, 'skill', target);
  const replacedBy = input.extensions.find(ext => ext.replacedSkills && Object.hasOwn(ext.replacedSkills, target));
  const ctxBase = { agent, engine: input.engine, engineMcpKey: input.engineMcpKey };

  const prepared: PreparedEntry[] = [];
  for (const item of items) {
    const { point } = item.entry;
    if (!offered.includes(point)) {
      outcomes.push(pointOutcome(item, agent, false, 'unknown-point'));
      continue;
    }

    const anchors = countAnchors(base, point);
    if (anchors === 0) {
      const detail = replacedBy
        ? `the skill is replaced by extension ${replacedBy.name}; the replacement must carry the anchor`
        : undefined;
      outcomes.push(pointOutcome(item, agent, false, 'anchor-missing', detail));
      continue;
    }
    if (anchors > 1) {
      outcomes.push(pointOutcome(item, agent, false, 'anchor-duplicated'));
      continue;
    }

    const result = await prepareEntry(item, target, ctxBase, extRoot, input.projectDir);
    if ('prepared' in result) {
      prepared.push(result.prepared);
    } else {
      outcomes.push(pointOutcome(item, agent, false, result.reason, result.detail));
    }
  }

  // Group by point, keeping the (extension, id) order inside each point.
  const byPoint = new Map<string, string[]>();
  for (const entry of prepared) {
    const list = byPoint.get(entry.item.entry.point) ?? [];
    list.push(entry.region);
    byPoint.set(entry.item.entry.point, list);
  }
  let next = base;
  for (const [point, regions] of byPoint) {
    next = insertAtAnchor(next, point, regions) ?? next;
  }

  if (next !== original) {
    await writeTextFile(file, next);
  }

  let referencesWritten = 0;
  for (const entry of prepared) {
    for (const reference of entry.references) {
      await ensureDir(path.dirname(reference.dest));
      if (reference.text !== undefined) {
        await writeTextFile(reference.dest, reference.text);
      } else {
        await fs.writeFile(reference.dest, reference.bytes as Buffer);
      }
      referencesWritten++;
    }
    outcomes.push(pointOutcome(entry.item, agent, true));
  }

  logInfo(
    LOG_COMPONENT,
    `${agent.id}/${target}: ${prepared.length} block(s), ${referencesWritten} reference file(s) (${REFERENCES_DIR_NAME}/${EXTENSION_REFERENCES_SUBDIR})`,
  );
  return referencesWritten;
}

/**
 * Render every extension block for every agent, deliver the reference files, and apply the original
 * `position` entries. Idempotent; never throws for a single bad entry — the report says what was skipped and why.
 */
export async function applyExtensionInjections(input: ExtensionInjectionInput): Promise<InjectionReport> {
  const outcomes: InjectionOutcome[] = [];
  let referencesWritten = 0;

  const registry = await loadExtensionPointRegistry();

  const requested = input.extensions.map(ext => ext.name);
  const loaded: LoadedExtension[] = (await loadAllExtensions(input.projectDir, requested))
    .map(({ dir, manifest }) => ({ name: manifest.name, dir, manifest }))
    .sort((a, b) => compareCodeUnits(a.name, b.name));
  for (const name of requested) {
    if (!loaded.some(ext => ext.name === name)) {
      logWarn(LOG_COMPONENT, `extension "${name}": manifest not found or invalid — skipped`);
    }
  }

  const pointEntries: PointEntry[] = [];
  const positionEntries: Array<{ extName: string; extDir: string; entry: PositionInjection }> = [];
  for (const ext of loaded) {
    for (const entry of ext.manifest.injections ?? []) {
      if (isPointInjection(entry)) pointEntries.push({ extName: ext.name, extDir: ext.dir, entry });
      else positionEntries.push({ extName: ext.name, extDir: ext.dir, entry });
    }
  }
  pointEntries.sort((a, b) => compareCodeUnits(a.extName, b.extName) || compareCodeUnits(a.entry.id, b.entry.id));

  const registryTargets = Object.keys(registry.skills).sort(compareCodeUnits);

  for (const agent of input.agents) {
    // Entries a registry target cannot take at all.
    for (const item of pointEntries) {
      const { target, targetType } = item.entry;
      if (targetType === 'subagent' || !Object.hasOwn(registry.skills, target)) {
        outcomes.push(pointOutcome(item, agent, false, 'unknown-point'));
      }
    }

    // Every registry target, whether or not an entry names it: this is also the self-healing sweep
    // that takes the blocks of a removed extension out.
    for (const target of registryTargets) {
      try {
        referencesWritten += await applyPointsToSkill(input, agent, target, entriesFor(pointEntries, target), registry, outcomes);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        logWarn(LOG_COMPONENT, `${agent.id}/${target}: ${detail}`);
        for (const item of entriesFor(pointEntries, target)) {
          outcomes.push(pointOutcome(item, agent, false, 'render-failed', detail));
        }
      }
    }

    // The original position entries.
    for (const { extName, extDir, entry } of positionEntries) {
      const base = {
        extension: extName, id: null, kind: 'position' as const, point: null,
        target: entry.target, targetType: entry.targetType, agent: agent.id,
      };
      const contentPath = path.resolve(extDir, entry.file);
      if (!isInsideDirectory(extDir, contentPath)) {
        outcomes.push({ ...base, applied: false, reason: 'path-outside-extension', detail: entry.file });
        continue;
      }
      const text = await readTextFile(contentPath);
      if (!text) {
        outcomes.push({ ...base, applied: false, reason: 'source-missing', detail: entry.file });
        continue;
      }
      const applied = await applyInjection(input.projectDir, agent, extName, entry, text);
      outcomes.push(applied
        ? { ...base, applied: true }
        : { ...base, applied: false, reason: 'target-not-found' });
    }
  }

  const applied = outcomes.filter(o => o.applied).length;
  const report: InjectionReport = {
    outcomes,
    applied,
    skipped: outcomes.length - applied,
    total: outcomes.length,
    referencesWritten,
  };
  logInfo(
    LOG_COMPONENT,
    `pass done: ${applied}/${report.total} applied, ${referencesWritten} reference file(s), ${input.agents.length} agent(s)`,
  );
  return report;
}
