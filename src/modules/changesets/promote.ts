// ─── Changeset Promote ────────────────────────────────────────────────────────
// Applies an AgentChangeset to the target canvas by adding proposed nodes.

import type { AgentChangeset } from '../store/types.js';
import type { DesignNode } from '../store/types.js';
import { useDesignStore } from '../store/store.js';

/**
 * Promotes all nodes from a changeset into the target canvas as proposed blocks.
 * Returns the IDs of promoted nodes.
 */
export function promoteChangeset(changeset: AgentChangeset): string[] {
  const store = useDesignStore.getState();
  const promotedIds: string[] = [];

  for (const proposed of changeset.nodes) {
    // Deduplicate: if a node with this id already exists in the canvas, skip it.
    const canvas = store.canvases[changeset.target_canvas_id];
    if (!canvas) continue;
    const exists = canvas.components.some((n) => n.id === proposed.id);
    if (exists) continue;

    const designNode: DesignNode = {
      id: proposed.id,
      kind: 'block',
      block_type: proposed.block_type ?? 'module',
      name: proposed.name,
      status: 'proposed',
      annotation: proposed.annotation,
      agent_proposed: true,
      x: proposed.x,
      y: proposed.y,
    };

    store.addBlock(changeset.target_canvas_id, designNode);
    promotedIds.push(proposed.id);
  }

  return promotedIds;
}
