import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type OnConnect,
  type NodeChange,
  type Node,
  type Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { BlockNode } from './BlockNode';
import { ArrowEdge } from './ArrowEdge';
import { useDesignStore, genId } from '../store';

const nodeTypes = { block: BlockNode };
const edgeTypes = { arrow: ArrowEdge };

export function Canvas() {
  const currentPath = useDesignStore((s) => s.currentPath);
  const nodesMap = useDesignStore((s) => s.nodes);
  const selectedBlockId = useDesignStore((s) => s.selectedBlockId);
  const selectBlock = useDesignStore((s) => s.selectBlock);
  const selectArrow = useDesignStore((s) => s.selectArrow);
  const updateBlockPosition = useDesignStore((s) => s.updateBlockPosition);
  const navigateTo = useDesignStore((s) => s.navigateTo);
  const addArrow = useDesignStore((s) => s.addArrow);

  const canvas = nodesMap[currentPath];

  const rfNodes: Node[] = useMemo(() => {
    if (!canvas) return [];
    return canvas.components.map((block) => ({
      id: block.id,
      type: 'block' as const,
      position: canvas.layout[block.id] ?? { x: 0, y: 0 },
      data: { block, selected: block.id === selectedBlockId },
    }));
  }, [canvas, selectedBlockId]);

  const rfEdges: Edge[] = useMemo(() => {
    if (!canvas) return [];
    const sorted = [...canvas.connections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Position-aware handle assignment: pick the correct side based on relative block positions
    const sideCounters = new Map<string, number>();

    return sorted.map((arrow) => {
      const srcPos = canvas.layout[arrow.from] ?? { x: 0, y: 0 };
      const tgtPos = canvas.layout[arrow.to] ?? { x: 0, y: 0 };
      const dx = tgtPos.x - srcPos.x;
      const dy = tgtPos.y - srcPos.y;

      let sourceSide: string;
      let targetSide: string;

      if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx >= 0) {
          sourceSide = 'right'; targetSide = 'left';
        } else {
          sourceSide = 'left'; targetSide = 'right';
        }
      } else {
        if (dy >= 0) {
          sourceSide = 'bottom'; targetSide = 'top';
        } else {
          sourceSide = 'top'; targetSide = 'bottom';
        }
      }

      // Distribute handles on each side per block
      const srcKey = `src-${arrow.from}-${sourceSide}`;
      const tgtKey = `tgt-${arrow.to}-${targetSide}`;
      const srcIdx = sideCounters.get(srcKey) ?? 0;
      sideCounters.set(srcKey, srcIdx + 1);
      const tgtIdx = sideCounters.get(tgtKey) ?? 0;
      sideCounters.set(tgtKey, tgtIdx + 1);

      return {
        id: arrow.id,
        type: 'arrow' as const,
        source: arrow.from,
        target: arrow.to,
        sourceHandle: `source-${sourceSide}-${srcIdx % 3}`,
        targetHandle: `target-${targetSide}-${tgtIdx % 3}`,
        data: { arrow, selected: false },
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      };
    });
  }, [canvas]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);

  // Sync React Flow state when store changes
  useMemo(() => { setNodes(rfNodes); }, [rfNodes]);
  useMemo(() => { setEdges(rfEdges); }, [rfEdges]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      // Persist position changes back to store
      for (const change of changes) {
        if (change.type === 'position' && change.position && change.dragging === false) {
          updateBlockPosition(change.id, change.position);
        }
      }
    },
    [onNodesChange, updateBlockPosition],
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      const arrow = {
        id: genId(),
        from: params.source,
        to: params.target,
        label: '',
      };
      addArrow(arrow);
      setEdges((eds) => addEdge({ ...params, id: arrow.id, type: 'arrow' }, eds));
    },
    [addArrow, setEdges],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectBlock(node.id);
    },
    [selectBlock],
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      selectArrow(edge.id);
    },
    [selectArrow],
  );

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const block = canvas?.components.find((b) => b.id === node.id);
      if (block?.hasChildren && nodesMap[block.id]) {
        navigateTo(block.id);
      }
    },
    [canvas, nodesMap, navigateTo],
  );

  const handlePaneClick = useCallback(() => {
    selectBlock(null);
    selectArrow(null);
  }, [selectBlock, selectArrow]);

  if (!canvas) {
    return <div className="canvas-empty">No canvas loaded</div>;
  }

  return (
    <div className="canvas-container">
      <ReactFlow
        key={currentPath}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: 'arrow',
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        }}
      >
        <Background gap={16} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
}
