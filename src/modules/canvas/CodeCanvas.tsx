// ─── Code Canvas ─────────────────────────────────────────────────────────────
//
// Read-only React Flow canvas that renders a CodeGraph from the store.
// Files become block nodes; import edges become arrows.

import { memo, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '../../styles/canvas.css';

import { useDesignStore } from '../store/store.js';
import { TOKENS } from '../../styles/theme.js';
import type { CodeGraphNode, CodeGraphEdge } from '../store/types.js';

// ─── Layout helper (simple grid) ─────────────────────────────────────────────

const COLS = 5;
const X_GAP = 240;
const Y_GAP = 120;

function gridPosition(index: number): { x: number; y: number } {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return { x: col * X_GAP + 60, y: row * Y_GAP + 60 };
}

// ─── File extension → icon ────────────────────────────────────────────────────

function iconForPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'ts': case 'tsx': return '▣';
    case 'js': case 'jsx': return '▣';
    case 'css': case 'scss': return '◈';
    case 'json': return '○';
    case 'rs': return '◆';
    case 'py': return 'ƒ';
    case 'md': return '≡';
    default: return '▫';
  }
}

// ─── CodeFileNode ─────────────────────────────────────────────────────────────

export interface CodeFileNodeData extends Record<string, unknown> {
  cgNode: CodeGraphNode;
}

function CodeFileNodeComponent({ data }: NodeProps) {
  const { cgNode } = data as CodeFileNodeData;
  const icon = iconForPath(cgNode.path);

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: TOKENS.bgSurfaceRaised }} />
      <Handle type="target" position={Position.Top} style={{ background: TOKENS.bgSurfaceRaised }} />

      <div
        style={{
          background: TOKENS.bgSurface,
          border: `1.5px solid ${TOKENS.border}`,
          borderRadius: 6,
          padding: '7px 10px',
          minWidth: 140,
          maxWidth: 200,
          cursor: 'default',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: TOKENS.statusBlue, flexShrink: 0 }}>{icon}</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: TOKENS.textPrimary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
            title={cgNode.path}
          >
            {cgNode.name}
          </span>
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 10,
            color: TOKENS.textTertiary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={cgNode.path}
        >
          {cgNode.path}
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={{ background: TOKENS.bgSurfaceRaised }} />
      <Handle type="source" position={Position.Bottom} style={{ background: TOKENS.bgSurfaceRaised }} />
    </>
  );
}

const CodeFileNode = memo(CodeFileNodeComponent);

// ─── Stable node/edge type maps ───────────────────────────────────────────────

const CODE_NODE_TYPES = { codeFileNode: CodeFileNode };

// ─── Conversion helpers ───────────────────────────────────────────────────────

function cgNodeToFlowNode(cgNode: CodeGraphNode, index: number): Node<CodeFileNodeData> {
  return {
    id: cgNode.id,
    type: 'codeFileNode',
    position: gridPosition(index),
    data: { cgNode },
  };
}

function cgEdgeToFlowEdge(cgEdge: CodeGraphEdge, index: number): Edge {
  return {
    id: `edge-${index}-${cgEdge.source}-${cgEdge.target}`,
    source: cgEdge.source,
    target: cgEdge.target,
    label: cgEdge.relationship === 'imports' ? undefined : cgEdge.relationship,
    style: { stroke: TOKENS.borderFocus, strokeWidth: 1 },
    markerEnd: {
      type: 'arrowclosed' as const,
      color: TOKENS.borderFocus,
    },
  };
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyCodeState() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      <span style={{ fontSize: 32, color: TOKENS.textGhost }}>≡</span>
      <span style={{ fontSize: 14, color: TOKENS.textTertiary }}>
        No code graph loaded
      </span>
      <span style={{ fontSize: 12, color: TOKENS.textGhost }}>
        Open a project folder to scan its dependencies
      </span>
    </div>
  );
}

// ─── CodeCanvas ───────────────────────────────────────────────────────────────

export function CodeCanvas() {
  const codeGraph = useDesignStore((s) => s.code_graph);

  const nodes: Node<CodeFileNodeData>[] = useMemo(
    () => (codeGraph?.nodes ?? []).map((n, i) => cgNodeToFlowNode(n, i)),
    [codeGraph],
  );

  const edges: Edge[] = useMemo(
    () => (codeGraph?.edges ?? []).map((e, i) => cgEdgeToFlowEdge(e, i)),
    [codeGraph],
  );

  if (!codeGraph || codeGraph.nodes.length === 0) {
    return (
      <div style={{ flex: 1, position: 'relative', background: TOKENS.bgBase }}>
        <EmptyCodeState />
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={CODE_NODE_TYPES}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.1}
      maxZoom={2}
      colorMode="dark"
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="#1A1C24"
        style={{ background: TOKENS.bgBase }}
      />
      <Controls
        style={{
          background: TOKENS.bgSurface,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 6,
        }}
      />
      <MiniMap
        nodeColor={() => TOKENS.bgSurfaceRaised}
        maskColor="rgba(12,14,18,0.6)"
        style={{
          background: TOKENS.bgSurface,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 6,
        }}
      />
    </ReactFlow>
  );
}
