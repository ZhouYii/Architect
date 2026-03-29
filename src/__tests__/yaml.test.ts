import { describe, it, expect } from 'vitest';
import {
  serializeNodeYaml,
  deserializeNodeYaml,
  serializeWorkspaceConfig,
  deserializeWorkspaceConfig,
  serializeWorkspaceState,
  deserializeWorkspaceState,
  serializeTreeToFiles,
} from '../lib/yaml';
import type { CanvasNode, WorkspaceConfig, WorkspaceState } from '../types';

describe('node YAML round-trip', () => {
  const canvas: CanvasNode = {
    id: 'game-server',
    label: 'Game Server',
    parentId: 'root',
    components: [
      {
        id: 'gacha',
        label: 'Gacha Service',
        annotation: 'Handles pulls',
        ports: [
          { id: 'g-in', label: 'request', direction: 'entry' },
          { id: 'g-out', label: 'result', direction: 'exit', type: 'PullResult' },
        ],
        hasChildren: false,
      },
      {
        id: 'inventory',
        label: 'Inventory',
        ports: [],
        hasChildren: true,
      },
    ],
    connections: [
      { id: 'a1', from: 'gacha', to: 'inventory', label: 'grant item', protocol: 'gRPC' },
    ],
    layout: { gacha: { x: 100, y: 200 }, inventory: { x: 400, y: 200 } },
  };

  it('serializes to valid YAML', () => {
    const yaml = serializeNodeYaml(canvas);
    expect(yaml).toContain('id: game-server');
    expect(yaml).toContain('label: Game Server');
    expect(yaml).toContain('parent: root');
    expect(yaml).toContain('Gacha Service');
    expect(yaml).toContain('grant item');
  });

  it('deserializes back to matching structure', () => {
    const yaml = serializeNodeYaml(canvas);
    const result = deserializeNodeYaml(yaml);
    expect(result.id).toBe('game-server');
    expect(result.label).toBe('Game Server');
    expect(result.parentId).toBe('root');
    expect(result.components).toHaveLength(2);
    expect(result.components[0].id).toBe('gacha');
    expect(result.components[0].label).toBe('Gacha Service');
    expect(result.components[0].ports).toHaveLength(2);
    expect(result.components[0].ports[0].direction).toBe('entry');
    expect(result.components[0].ports[1].direction).toBe('exit');
    expect(result.components[0].ports[1].type).toBe('PullResult');
    expect(result.components[1].hasChildren).toBe(true);
    expect(result.connections).toHaveLength(1);
    expect(result.connections[0].from).toBe('gacha');
    expect(result.connections[0].protocol).toBe('gRPC');
  });

  it('backward-compatible: deserializes old in/out directions to entry/exit', () => {
    const oldYaml = `
id: legacy-canvas
label: Legacy Canvas
parent: null
components:
  - id: svc
    label: Service
    has_children: false
    ports:
      - id: p1
        label: input
        direction: in
      - id: p2
        label: output
        direction: out
        type: Response
connections: []
`;
    const result = deserializeNodeYaml(oldYaml);
    expect(result.components[0].ports[0].direction).toBe('entry');
    expect(result.components[0].ports[1].direction).toBe('exit');
    expect(result.components[0].ports[1].type).toBe('Response');
  });
});

describe('workspace config round-trip', () => {
  const config: WorkspaceConfig = {
    schema_version: 1,
    project_name: 'Test Project',
    created_at: '2026-03-28T10:00:00Z',
    last_checkpoint: '3.0',
    last_checkpoint_at: '2026-03-28T10:00:00Z',
    last_checkpoint_hash: 'sha256:abc123',
    llm: {
      preferred_provider: 'claude-code',
      ollama_model: 'llama3',
    },
  };

  it('round-trips correctly', () => {
    const yaml = serializeWorkspaceConfig(config);
    const result = deserializeWorkspaceConfig(yaml);
    expect(result).toEqual(config);
  });
});

describe('workspace state round-trip', () => {
  const state: WorkspaceState = {
    version: '3.14',
    head_hash: 'sha256:def456',
    dirty: true,
    pending_changes: 2,
    last_flush_at: '2026-03-28T16:30:14Z',
  };

  it('round-trips correctly', () => {
    const yaml = serializeWorkspaceState(state);
    const result = deserializeWorkspaceState(yaml);
    expect(result).toEqual(state);
  });
});

describe('serializeTreeToFiles', () => {
  it('produces files for each canvas', () => {
    const nodes: Record<string, CanvasNode> = {
      root: {
        id: 'root',
        label: 'Root',
        parentId: null,
        components: [{ id: 'b1', label: 'Block', ports: [], hasChildren: true }],
        connections: [],
        layout: { b1: { x: 0, y: 0 } },
      },
      b1: {
        id: 'b1',
        label: 'Block',
        parentId: 'root',
        components: [],
        connections: [],
        layout: {},
      },
    };
    const files = serializeTreeToFiles(nodes);
    const paths = files.map((f) => f.path);

    // Root canvas files
    expect(paths).toContain('node.yaml');
    expect(paths).toContain('node.layout.json');

    // Child canvas files
    expect(paths).toContain('b1/node.yaml');
    expect(paths).toContain('b1/node.layout.json');
  });

  it('includes interface files when content exists', () => {
    const nodes: Record<string, CanvasNode> = {
      root: {
        id: 'root',
        label: 'Root',
        parentId: null,
        components: [{
          id: 'b1',
          label: 'Block',
          ports: [],
          hasChildren: false,
          interfacesContent: 'interface Foo { bar: string }',
        }],
        connections: [],
        layout: {},
      },
    };
    const files = serializeTreeToFiles(nodes);
    const ifFile = files.find((f) => f.path.endsWith('node.interfaces.ts'));
    expect(ifFile).toBeDefined();
    expect(ifFile!.content).toContain('interface Foo');
  });
});
