import { describe, it, expect, beforeEach } from 'vitest';
import { applyACP } from '../lib/apply-acp';
import { useDesignStore } from '../store';
import type { ACP } from '../types';

function makeACP(overrides: Partial<ACP> = {}): ACP {
  return {
    id: 'test-acp',
    description: 'Test',
    changes: [],
    status: 'pending',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('applyACP', () => {
  beforeEach(() => {
    // Reset store to demo data
    const store = useDesignStore.getState();
    store.navigateTo('root');
  });

  it('add_component adds a block to the target canvas', () => {
    const acp = makeACP({
      changes: [{
        kind: 'add_component',
        target_canvas: 'root',
        reason: 'Need a cache',
        proposal: { id: 'cache', label: 'Redis Cache', type: 'data-store' },
      }],
    });

    applyACP(acp);

    const root = useDesignStore.getState().nodes.root;
    expect(root.components.some((b) => b.id === 'cache')).toBe(true);
    const cache = root.components.find((b) => b.id === 'cache')!;
    expect(cache.label).toBe('Redis Cache');
    expect(cache.type).toBe('data-store');
  });

  it('add_component handles nested component key and connections_add', () => {
    const acp = makeACP({
      changes: [{
        kind: 'add_component',
        target_canvas: 'root',
        reason: 'Add rate limiter',
        proposal: {
          component: { id: 'rate-limiter', label: 'Rate Limiter', type: 'module' },
          connections_add: [
            { from: 'client', to: 'rate-limiter', label: 'routes', type: 'calls' },
          ],
        },
      }],
    });

    applyACP(acp);

    const root = useDesignStore.getState().nodes.root;
    expect(root.components.some((b) => b.id === 'rate-limiter')).toBe(true);
    expect(root.connections.some((a) => a.from === 'client' && a.to === 'rate-limiter')).toBe(true);
  });

  it('remove_component removes a block', () => {
    const acp = makeACP({
      changes: [{
        kind: 'remove_component',
        target_canvas: 'root',
        target_id: 'database',
        reason: 'Not needed',
        proposal: {},
      }],
    });

    applyACP(acp);

    const root = useDesignStore.getState().nodes.root;
    expect(root.components.some((b) => b.id === 'database')).toBe(false);
  });

  it('modify_component updates a block', () => {
    const acp = makeACP({
      changes: [{
        kind: 'modify_component',
        target_canvas: 'root',
        target_id: 'game-server',
        reason: 'Update status',
        proposal: { label: 'Game Server v2', status: 'implementing' },
      }],
    });

    applyACP(acp);

    const root = useDesignStore.getState().nodes.root;
    const gs = root.components.find((b) => b.id === 'game-server')!;
    expect(gs.label).toBe('Game Server v2');
    expect(gs.status).toBe('implementing');
  });

  it('add_arrow adds a connection', () => {
    const acp = makeACP({
      changes: [{
        kind: 'add_arrow',
        target_canvas: 'root',
        reason: 'Direct DB access',
        proposal: { from: 'client', to: 'database', label: 'direct query', type: 'reads' },
      }],
    });

    applyACP(acp);

    const root = useDesignStore.getState().nodes.root;
    expect(root.connections.some((a) => a.from === 'client' && a.to === 'database')).toBe(true);
  });

  it('decompose creates child canvas with sub-blocks', () => {
    // First, add a fresh leaf block to decompose
    const store = useDesignStore.getState();
    store.addBlockToCanvas('root', {
      id: 'monolith',
      label: 'Monolith',
      hasChildren: false,
      ports: [],
    });

    const acp = makeACP({
      changes: [{
        kind: 'decompose',
        target_canvas: 'root',
        target_id: 'monolith',
        reason: 'Split into services',
        proposal: {
          child_components: [
            { id: 'auth-svc', label: 'Auth Service', type: 'service' },
            { id: 'user-svc', label: 'User Service', type: 'service' },
          ],
          child_connections: [
            { from: 'auth-svc', to: 'user-svc', label: 'validates' },
          ],
        },
      }],
    });

    applyACP(acp);

    const after = useDesignStore.getState().nodes;
    const block = after.root.components.find((b) => b.id === 'monolith');
    expect(block!.hasChildren).toBe(true);
    expect(after.monolith).toBeDefined();
    expect(after.monolith.components).toHaveLength(2);
    expect(after.monolith.connections).toHaveLength(1);
  });
});
