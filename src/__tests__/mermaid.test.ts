import { describe, it, expect } from 'vitest';
import { generateMermaidDiagram } from '../lib/mermaid';
import type { CanvasNode } from '../types';

describe('generateMermaidDiagram', () => {
  it('generates valid mermaid for simple canvas', () => {
    const canvas: CanvasNode = {
      id: 'root',
      label: 'Root',
      parentId: null,
      components: [
        { id: 'svc-a', label: 'Service A', type: 'service', ports: [], hasChildren: false },
        { id: 'svc-b', label: 'Service B', type: 'module', ports: [], hasChildren: false },
      ],
      connections: [
        { id: 'a1', from: 'svc-a', to: 'svc-b', label: 'calls' },
      ],
      layout: {},
    };

    const diagram = generateMermaidDiagram(canvas);
    expect(diagram).toContain('graph LR');
    expect(diagram).toContain('svc_a');
    expect(diagram).toContain('Service A');
    expect(diagram).toContain('svc_b');
    expect(diagram).toContain('Service B');
    expect(diagram).toContain('-->');
    expect(diagram).toContain('calls');
  });

  it('uses type-appropriate shapes', () => {
    const canvas: CanvasNode = {
      id: 'test',
      label: 'Test',
      parentId: null,
      components: [
        { id: 'db', label: 'Database', type: 'data-store', ports: [], hasChildren: false },
        { id: 'ext', label: 'External API', type: 'external', ports: [], hasChildren: false },
      ],
      connections: [],
      layout: {},
    };

    const diagram = generateMermaidDiagram(canvas);
    // data-store uses [( )] shape
    expect(diagram).toContain('[(');
    // external uses {{ }} shape
    expect(diagram).toContain('{{');
  });

  it('handles empty canvas', () => {
    const canvas: CanvasNode = {
      id: 'empty',
      label: 'Empty',
      parentId: null,
      components: [],
      connections: [],
      layout: {},
    };

    const diagram = generateMermaidDiagram(canvas);
    expect(diagram).toBe('graph LR');
  });

  it('handles arrows without labels', () => {
    const canvas: CanvasNode = {
      id: 'test',
      label: 'Test',
      parentId: null,
      components: [
        { id: 'a', label: 'A', ports: [], hasChildren: false },
        { id: 'b', label: 'B', ports: [], hasChildren: false },
      ],
      connections: [
        { id: 'x', from: 'a', to: 'b' },
      ],
      layout: {},
    };

    const diagram = generateMermaidDiagram(canvas);
    expect(diagram).toContain('a --> b');
  });
});
