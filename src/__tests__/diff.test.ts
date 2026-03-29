import { describe, it, expect } from 'vitest';
import { diffCanvases, diffWorkspaces } from '../lib/diff';
import type { CanvasNode } from '../types';

function makeCanvas(overrides: Partial<CanvasNode> = {}): CanvasNode {
  return {
    id: 'test',
    label: 'Test Canvas',
    parentId: null,
    components: [],
    connections: [],
    layout: {},
    ...overrides,
  };
}

describe('diffCanvases', () => {
  it('returns empty for identical canvases', () => {
    const canvas = makeCanvas({
      components: [{ id: 'b1', label: 'Block 1', ports: [], hasChildren: false }],
      connections: [{ id: 'a1', from: 'b1', to: 'b2', label: 'test' }],
    });
    const result = diffCanvases(canvas, canvas);
    expect(result).toEqual([]);
  });

  it('detects added blocks', () => {
    const before = makeCanvas();
    const after = makeCanvas({
      components: [{ id: 'b1', label: 'New Block', ports: [], hasChildren: false }],
    });
    const result = diffCanvases(before, after);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('added');
    expect(result[0].entity).toBe('block');
    expect(result[0].id).toBe('b1');
  });

  it('detects removed blocks', () => {
    const before = makeCanvas({
      components: [{ id: 'b1', label: 'Old Block', ports: [], hasChildren: false }],
    });
    const after = makeCanvas();
    const result = diffCanvases(before, after);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('removed');
    expect(result[0].entity).toBe('block');
  });

  it('detects modified blocks', () => {
    const before = makeCanvas({
      components: [{ id: 'b1', label: 'Original', ports: [], hasChildren: false }],
    });
    const after = makeCanvas({
      components: [{ id: 'b1', label: 'Modified', ports: [], hasChildren: false }],
    });
    const result = diffCanvases(before, after);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('modified');
    expect(result[0].fields).toContain('label');
  });

  it('detects block type and status changes', () => {
    const before = makeCanvas({
      components: [{
        id: 'b1', label: 'Service', ports: [], hasChildren: false,
        type: 'service', status: 'draft',
      }],
    });
    const after = makeCanvas({
      components: [{
        id: 'b1', label: 'Service', ports: [], hasChildren: false,
        type: 'module', status: 'approved',
      }],
    });
    const result = diffCanvases(before, after);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('modified');
    expect(result[0].fields).toContain('type');
    expect(result[0].fields).toContain('status');
  });

  it('detects added arrows', () => {
    const before = makeCanvas();
    const after = makeCanvas({
      connections: [{ id: 'a1', from: 'b1', to: 'b2', label: 'HTTP' }],
    });
    const result = diffCanvases(before, after);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('added');
    expect(result[0].entity).toBe('arrow');
  });

  it('detects removed arrows', () => {
    const before = makeCanvas({
      connections: [{ id: 'a1', from: 'b1', to: 'b2' }],
    });
    const after = makeCanvas();
    const result = diffCanvases(before, after);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('removed');
    expect(result[0].entity).toBe('arrow');
  });

  it('detects modified arrows', () => {
    const before = makeCanvas({
      connections: [{ id: 'a1', from: 'b1', to: 'b2', label: 'HTTP' }],
    });
    const after = makeCanvas({
      connections: [{ id: 'a1', from: 'b1', to: 'b2', label: 'gRPC' }],
    });
    const result = diffCanvases(before, after);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('modified');
    expect(result[0].fields).toContain('label');
  });

  it('detects arrow type and interface changes', () => {
    const before = makeCanvas({
      connections: [{
        id: 'a1', from: 'b1', to: 'b2', label: 'link',
        type: 'calls',
        interface: { request: 'GetUser', response: 'User' },
      }],
    });
    const after = makeCanvas({
      connections: [{
        id: 'a1', from: 'b1', to: 'b2', label: 'link',
        type: 'reads',
        interface: { request: 'GetUser', response: 'UserDTO', async: true },
      }],
    });
    const result = diffCanvases(before, after);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('modified');
    expect(result[0].entity).toBe('arrow');
    expect(result[0].fields).toContain('type');
    expect(result[0].fields).toContain('interface');
  });

  it('handles complex diff with multiple changes', () => {
    const before = makeCanvas({
      components: [
        { id: 'b1', label: 'Keep', ports: [], hasChildren: false },
        { id: 'b2', label: 'Remove', ports: [], hasChildren: false },
        { id: 'b3', label: 'Modify', ports: [], hasChildren: false },
      ],
      connections: [{ id: 'a1', from: 'b1', to: 'b2' }],
    });
    const after = makeCanvas({
      components: [
        { id: 'b1', label: 'Keep', ports: [], hasChildren: false },
        { id: 'b3', label: 'Modified!', ports: [], hasChildren: false },
        { id: 'b4', label: 'New', ports: [], hasChildren: false },
      ],
      connections: [
        { id: 'a1', from: 'b1', to: 'b2' },
        { id: 'a2', from: 'b3', to: 'b4' },
      ],
    });
    const result = diffCanvases(before, after);
    const added = result.filter((e) => e.type === 'added');
    const removed = result.filter((e) => e.type === 'removed');
    const modified = result.filter((e) => e.type === 'modified');
    expect(added).toHaveLength(2); // b4 + a2
    expect(removed).toHaveLength(1); // b2
    expect(modified).toHaveLength(1); // b3
  });
});

describe('diffWorkspaces', () => {
  it('diffs across multiple canvases', () => {
    const before = {
      root: makeCanvas({ id: 'root', components: [{ id: 'b1', label: 'A', ports: [], hasChildren: false }] }),
    };
    const after = {
      root: makeCanvas({ id: 'root', components: [{ id: 'b1', label: 'B', ports: [], hasChildren: false }] }),
      child: makeCanvas({ id: 'child', components: [{ id: 'c1', label: 'New', ports: [], hasChildren: false }] }),
    };
    const result = diffWorkspaces(before, after);
    expect(result.length).toBeGreaterThanOrEqual(2); // modified b1 + added c1
  });

  it('handles canvas removal', () => {
    const before = {
      root: makeCanvas({ id: 'root' }),
      old: makeCanvas({
        id: 'old',
        components: [{ id: 'x', label: 'Gone', ports: [], hasChildren: false }],
      }),
    };
    const after = {
      root: makeCanvas({ id: 'root' }),
    };
    const result = diffWorkspaces(before, after);
    expect(result.some((e) => e.type === 'removed' && e.id === 'x')).toBe(true);
  });
});
