import { useCallback } from 'react';
import type { NodeMouseHandler } from '@xyflow/react';
import { useDesignStore } from '../store/store.js';
import type { BlockNodeData } from './BlockNode.js';

/**
 * Returns a double-click handler for React Flow nodes.
 * Double-clicking a block that has_children drills into its child canvas.
 */
export function useDrillDown(): NodeMouseHandler {
  const navigateTo = useDesignStore((s) => s.navigateTo);

  return useCallback<NodeMouseHandler>(
    (_event, node) => {
      const data = node.data as BlockNodeData;
      const designNode = data?.node;
      if (designNode?.has_children && designNode.child_canvas_id) {
        navigateTo(designNode.child_canvas_id);
      }
    },
    [navigateTo]
  );
}

/**
 * Returns a click handler for React Flow nodes.
 * Selects the node in the store (opens inspector).
 */
export function useNodeClick(): NodeMouseHandler {
  const selectNode = useDesignStore((s) => s.selectNode);

  return useCallback<NodeMouseHandler>(
    (_event, node) => {
      selectNode(node.id);
    },
    [selectNode]
  );
}
