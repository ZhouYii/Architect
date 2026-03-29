// ─── Changeset Review ─────────────────────────────────────────────────────────
// Accept / dismiss proposed nodes; store feedback on changesets.

import { useDesignStore } from '../store/store.js';
import { selectCurrentCanvasId } from '../store/selectors.js';

/**
 * Accepts a proposed node: transitions status proposed → modified.
 * Searches all canvases so callers don't need to know the canvas id.
 */
export function acceptNode(nodeId: string): void {
  const store = useDesignStore.getState();
  const canvasId = _findNodeCanvas(nodeId);
  if (!canvasId) return;
  store.updateBlock(canvasId, nodeId, { status: 'modified', agent_proposed: false });
}

/**
 * Dismisses a proposed node: removes it from its canvas entirely.
 */
export function dismissNode(nodeId: string): void {
  const store = useDesignStore.getState();
  const canvasId = _findNodeCanvas(nodeId);
  if (!canvasId) return;
  store.removeBlock(canvasId, nodeId);
}

/**
 * Stores free-text feedback on a changeset.
 * The feedback is keyed by changesetId and appended to the AgentChangeset in the store.
 */
export function feedbackOnChangeset(changesetId: string, message: string): void {
  const store = useDesignStore.getState();
  store.addChangesetFeedback(changesetId, message);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _findNodeCanvas(nodeId: string): string | null {
  const store = useDesignStore.getState();
  // Prefer current canvas first for performance
  const currentCanvasId = selectCurrentCanvasId(store);
  const currentCanvas = store.canvases[currentCanvasId];
  if (currentCanvas?.components.some((n) => n.id === nodeId)) {
    return currentCanvasId;
  }
  // Fall back to scanning all canvases
  for (const [id, canvas] of Object.entries(store.canvases)) {
    if (canvas.components.some((n) => n.id === nodeId)) {
      return id;
    }
  }
  return null;
}
