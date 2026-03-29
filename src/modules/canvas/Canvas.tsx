import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '../../styles/canvas.css';

import { useDesignStore } from '../store/store.js';
import {
  selectCurrentCanvas,
  selectCurrentCanvasId,
  selectAggregateStatus,
} from '../store/selectors.js';
import type { DesignNode } from '../store/types.js';
import { TOKENS } from '../../styles/theme.js';
import { BlockNode, type BlockNodeData } from './BlockNode.js';
import { ArrowEdge, type ArrowEdgeData } from './ArrowEdge.js';
import { useDrillDown, useNodeClick } from './hooks.js';

// ─── Custom node/edge type map (stable references) ───────────────────────────
const NODE_TYPES = { blockNode: BlockNode };
const EDGE_TYPES = { arrowEdge: ArrowEdge };

// ─── Conversion helpers ───────────────────────────────────────────────────────

function blockToFlowNode(
  block: DesignNode,
  aggregate: ReturnType<typeof selectAggregateStatus>,
  selectedId: string | null
): Node<BlockNodeData> {
  return {
    id: block.id,
    type: 'blockNode',
    position: { x: block.x ?? 100, y: block.y ?? 100 },
    selected: block.id === selectedId,
    data: {
      node: block,
      aggregate: block.has_children ? aggregate : undefined,
      isSelected: block.id === selectedId,
    },
  };
}

function arrowToFlowEdge(arrow: DesignNode, selectedId: string | null): Edge<ArrowEdgeData> {
  return {
    id: arrow.id,
    type: 'arrowEdge',
    source: arrow.source ?? '',
    target: arrow.target ?? '',
    selected: arrow.id === selectedId,
    data: { arrow },
    markerEnd: {
      type: 'arrowclosed' as const,
      color: arrow.status === 'proposed' ? TOKENS.textTertiary : '#3A3D4A',
    },
  };
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export function Canvas() {
  const currentCanvasId = useDesignStore(selectCurrentCanvasId);
  const canvas = useDesignStore(selectCurrentCanvas);
  const selectedId = useDesignStore((s) => s.ui.selected_node_id);
  const canvases = useDesignStore((s) => s.canvases);

  const onNodeDoubleClick = useDrillDown();
  const onNodeClick = useNodeClick();
  const selectNode = useDesignStore((s) => s.selectNode);

  // Build aggregate map for child canvases referenced by blocks
  const aggregateMap = useMemo(() => {
    const map: Record<string, ReturnType<ReturnType<typeof selectAggregateStatus>>> = {};
    if (!canvas) return map;
    for (const block of canvas.components) {
      if (block.has_children && block.child_canvas_id) {
        const childCanvas = canvases[block.child_canvas_id];
        if (childCanvas) {
          let clean = 0, modified = 0, proposed = 0, ready = 0, running = 0, implemented = 0, failed = 0, dismissed = 0;
          for (const n of childCanvas.components) {
            switch (n.status) {
              case 'clean': clean++; break;
              case 'modified': modified++; break;
              case 'proposed': proposed++; break;
              case 'ready': ready++; break;
              case 'running': running++; break;
              case 'implemented': implemented++; break;
              case 'failed': failed++; break;
              case 'dismissed': dismissed++; break;
            }
          }
          map[block.id] = { clean, modified, proposed, ready, running, implemented, failed, dismissed, total: childCanvas.components.length };
        }
      }
    }
    return map;
  }, [canvas, canvases]);

  const nodes: Node<BlockNodeData>[] = useMemo(() => {
    if (!canvas) return [];
    return canvas.components.map((block) =>
      blockToFlowNode(block, aggregateMap[block.id] ?? { clean: 0, modified: 0, proposed: 0, ready: 0, running: 0, implemented: 0, failed: 0, dismissed: 0, total: 0 }, selectedId)
    );
  }, [canvas, aggregateMap, selectedId]);

  const edges: Edge<ArrowEdgeData>[] = useMemo(() => {
    if (!canvas) return [];
    return canvas.connections.map((arrow) => arrowToFlowEdge(arrow, selectedId));
  }, [canvas, selectedId]);

  return (
    <ReactFlow
      key={currentCanvasId}
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
      onPaneClick={() => selectNode(null)}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.2}
      maxZoom={2}
      colorMode="dark"
      defaultEdgeOptions={{
        type: 'arrowEdge',
      }}
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

      {/* Arrowhead markers */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <marker id="arrow-default" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#3A3D4A" />
          </marker>
          <marker id="arrow-proposed" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#5C6170" />
          </marker>
        </defs>
      </svg>

      {/* Running pulse keyframes */}
      <style>{`
        @keyframes pulseAmber {
          0%, 100% { border-color: #E5A34B; box-shadow: 0 0 0 0 rgba(229,163,75,0); }
          50% { border-color: #E5A34B; box-shadow: 0 0 0 4px rgba(229,163,75,0.2); }
        }
      `}</style>
    </ReactFlow>
  );
}
