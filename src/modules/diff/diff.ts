/**
 * Delta (diff) utilities.
 *
 * getDelta()      — all DesignNodes across all canvases where status ≠ 'clean'
 * getDeltaCount() — count of those nodes
 *
 * No archive loading or tree diffing: each node carries its own status.
 * cutVersion() resets the baseline; after that, any edited node is 'modified'.
 */

import { useDesignStore } from '../store/store.js';
import type { DesignNode } from '../store/types.js';

/**
 * Return every DesignNode (blocks + arrows) across all canvases whose
 * status is anything other than 'clean'.
 */
export function getDelta(): DesignNode[] {
  const { canvases } = useDesignStore.getState();
  const dirty: DesignNode[] = [];
  for (const canvas of Object.values(canvases)) {
    for (const node of canvas.components) {
      if (node.status !== 'clean') dirty.push(node);
    }
    for (const arrow of canvas.connections) {
      if (arrow.status !== 'clean') dirty.push(arrow);
    }
  }
  return dirty;
}

/**
 * Count of dirty nodes (status ≠ 'clean').
 */
export function getDeltaCount(): number {
  return getDelta().length;
}
