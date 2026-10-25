import type { DocsSource } from './bridges/types.js';

export interface EngineConfig {
  id: string;
  displayName: string;
  codeLanguage: string;
  memoryDir: string;
  bridgesDir: string;
  /**
   * Documentation every bridge of this engine needs, whichever it is: pointers copied by
   * `/unikit-bridge-docs` into `_engine/`. Typed data checked by the compiler rather than a reserved
   * file name in the bridge catalog, which the scanner would read as an entry.
   */
  docSources: DocsSource[];
  /** Context7 library ids for the same documentation. */
  docContext7: string[];
  skillTemplates: Record<string, string>;
}

const ENGINE_REGISTRY: Record<string, EngineConfig> = {
  unity: {
    id: 'unity',
    displayName: 'Unity',
    codeLanguage: 'C#',
    memoryDir: 'unity',
    bridgesDir: 'unity',
    docSources: [
      { kind: 'git', id: 'unity-skills', repo: 'https://github.com/Unity-Technologies/skills', path: 'skills', include: ['**/*.md'], into: 'unity-skills' },
    ],
    docContext7: ['/unity-technologies/skills'],
    skillTemplates: {
      unikit: 'UNITY_RULES.md',
      'unikit-architecture': 'UNITY_RULES.md',
      'unikit-docs': 'UNITY_RULES.md',
      'unikit-plan': 'UNITY_RULES.md',
      'unikit-verify': 'UNITY_RULES.md',
    },
  },
  godot: {
    id: 'godot',
    displayName: 'Godot 4',
    codeLanguage: 'GDScript',
    memoryDir: 'godot',
    bridgesDir: 'godot',
    docSources: [],
    docContext7: [],
    skillTemplates: {
      unikit: 'GODOT_RULES.md',
      'unikit-architecture': 'GODOT_RULES.md',
      'unikit-docs': 'GODOT_RULES.md',
      'unikit-plan': 'GODOT_RULES.md',
      'unikit-verify': 'GODOT_RULES.md',
    },
  },
  'godot-net': {
    id: 'godot-net',
    displayName: 'Godot 4 .NET',
    codeLanguage: 'C#',
    memoryDir: 'godot-net',
    bridgesDir: 'godot',
    docSources: [],
    docContext7: [],
    skillTemplates: {
      unikit: 'GODOT_NET_RULES.md',
      'unikit-architecture': 'GODOT_NET_RULES.md',
      'unikit-docs': 'GODOT_RULES.md',
      'unikit-plan': 'GODOT_NET_RULES.md',
      'unikit-verify': 'GODOT_NET_RULES.md',
    },
  },
  'unreal-engine-5': {
    id: 'unreal-engine-5',
    displayName: 'Unreal Engine 5',
    codeLanguage: 'C++',
    memoryDir: 'unreal-engine-5',
    bridgesDir: 'unreal-engine-5',
    docSources: [],
    docContext7: [],
    skillTemplates: {
      unikit: 'UNREAL_ENGINE_5_RULES.md',
      'unikit-architecture': 'UNREAL_ENGINE_5_RULES.md',
      'unikit-docs': 'UNREAL_ENGINE_5_RULES.md',
      'unikit-plan': 'UNREAL_ENGINE_5_RULES.md',
      'unikit-verify': 'UNREAL_ENGINE_5_RULES.md',
    },
  },
};

export function getEngineConfig(id: string): EngineConfig {
  const config = ENGINE_REGISTRY[id];
  if (!config) {
    throw new Error(`Unknown engine: ${id}`);
  }

  return config;
}

export function getEngineChoices(): Array<{ name: string; value: string }> {
  return Object.values(ENGINE_REGISTRY).map(engine => ({
    name: engine.displayName,
    value: engine.id,
  }));
}

export function getAllEngineIds(): string[] {
  return Object.keys(ENGINE_REGISTRY);
}
