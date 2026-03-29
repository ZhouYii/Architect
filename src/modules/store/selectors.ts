import type { DesignStore } from './store.js';
import type { CanvasNode, DesignNode, StatusAggregate } from './types.js';

// ─── Current Canvas ───────────────────────────────────────────────────────────

export const selectCurrentCanvasId = (state: DesignStore): string => {
  const path = state.ui.current_path;
  return path[path.length - 1] ?? 'root';
};

export const selectCurrentCanvas = (state: DesignStore): CanvasNode | undefined => {
  const id = selectCurrentCanvasId(state);
  return state.canvases[id];
};

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

export interface BreadcrumbSegment {
  canvas_id: string;
  label: string;
  index: number;
}

export const selectBreadcrumb = (state: DesignStore): BreadcrumbSegment[] => {
  return state.ui.current_path.map((canvasId, index) => ({
    canvas_id: canvasId,
    label: state.canvases[canvasId]?.label ?? canvasId,
    index,
  }));
};

// ─── Selected Node ────────────────────────────────────────────────────────────

export const selectSelectedNode = (state: DesignStore): DesignNode | null => {
  const id = state.ui.selected_node_id;
  if (!id) return null;
  const canvas = selectCurrentCanvas(state);
  if (!canvas) return null;
  return (
    canvas.components.find((n) => n.id === id) ??
    canvas.connections.find((n) => n.id === id) ??
    null
  );
};

// ─── Aggregate Status ─────────────────────────────────────────────────────────

export function aggregateStatus(nodes: DesignNode[]): StatusAggregate {
  const agg: StatusAggregate = {
    clean: 0,
    modified: 0,
    proposed: 0,
    ready: 0,
    running: 0,
    implemented: 0,
    failed: 0,
    dismissed: 0,
    total: 0,
  };
  for (const node of nodes) {
    agg[node.status]++;
    agg.total++;
  }
  return agg;
}

export const selectAggregateStatus = (canvasId: string) => (state: DesignStore): StatusAggregate => {
  const canvas = state.canvases[canvasId];
  if (!canvas) {
    return { clean: 0, modified: 0, proposed: 0, ready: 0, running: 0, implemented: 0, failed: 0, dismissed: 0, total: 0 };
  }
  return aggregateStatus(canvas.components);
};

// ─── Leaf Count ───────────────────────────────────────────────────────────────

export const leafCount = (canvasId: string, canvases: Record<string, CanvasNode>): number => {
  const canvas = canvases[canvasId];
  if (!canvas) return 0;
  let count = 0;
  for (const block of canvas.components) {
    if (block.has_children && block.child_canvas_id) {
      count += leafCount(block.child_canvas_id, canvases);
    } else {
      count += 1;
    }
  }
  return count;
};

export const selectLeafCount = (canvasId: string) => (state: DesignStore): number => {
  return leafCount(canvasId, state.canvases);
};
