export interface EngineConfig {
  id: string;
  displayName: string;
  codeLanguage: string;
  memoryDir: string;
  mcpDir: string;
  skillTemplates: Record<string, string>;
}

const ENGINE_REGISTRY: Record<string, EngineConfig> = {
  unity: {
    id: 'unity',
    displayName: 'Unity',
    codeLanguage: 'C#',
    memoryDir: 'unity',
    mcpDir: 'unity',
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
    mcpDir: 'godot',
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
    mcpDir: 'godot',
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
    mcpDir: 'unreal-engine-5',
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
