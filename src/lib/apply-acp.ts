import { useDesignStore, genId } from '../store';
import type { ACP, Block, Arrow } from '../types';

/**
 * Apply an ACP (Architecture Change Proposal) to the canvas tree.
 * Mutates the store state based on each ACPChange.
 */
export function applyACP(acp: ACP): void {
  const store = useDesignStore.getState();
  for (const change of acp.changes) {
    const canvasId = change.target_canvas;
    switch (change.kind) {
      case 'add_block':
      case 'add_component': {
        const p = change.proposal;
        // The component may be nested under a 'component' key (PRD §10.3)
        const comp = (p.component as Record<string, unknown>) ?? p;
        const block: Block = {
          id: (comp.id as string) ?? genId(),
          label: (comp.label as string) ?? 'New Block',
          hasChildren: false,
          ports: (comp.ports as Block['ports']) ?? [],
          type: comp.type as Block['type'],
          status: (comp.status as Block['status']) ?? 'draft',
          annotation: comp.annotation as string,
          tags: comp.tags as string[],
        };
        store.addBlockToCanvas(canvasId, block);
        // Handle connections_add from proposal
        const connsAdd = p.connections_add as Array<Record<string, unknown>> | undefined;
        if (connsAdd) {
          for (const conn of connsAdd) {
            store.addArrowToCanvas(canvasId, {
              id: genId(),
              from: conn.from as string,
              to: conn.to as string,
              label: conn.label as string,
              type: conn.type as Arrow['type'],
            });
          }
        }
        // Handle connections_remove from proposal
        const connsRemove = p.connections_remove as Array<Record<string, unknown>> | undefined;
        if (connsRemove) {
          for (const conn of connsRemove) {
            // Find arrow matching from+to and remove it
            const canvas = store.nodes[canvasId];
            if (canvas) {
              const match = canvas.connections.find(
                (a) => a.from === conn.from && a.to === conn.to,
              );
              if (match) removeArrowFromAnyCanvas(match.id);
            }
          }
        }
        break;
      }
      case 'remove_block':
      case 'remove_component': {
        if (change.target_id) {
          removeBlockFromAnyCanvas(change.target_id);
        }
        break;
      }
      case 'modify_block':
      case 'modify_component': {
        if (change.target_id) {
          updateBlockInAnyCanvas(change.target_id, change.proposal as Partial<Block>);
        }
        break;
      }
      case 'add_arrow': {
        const p = change.proposal;
        const arrow: Arrow = {
          id: (p.id as string) ?? genId(),
          from: p.from as string,
          to: p.to as string,
          label: p.label as string,
          type: p.type as Arrow['type'],
        };
        store.addArrowToCanvas(canvasId, arrow);
        break;
      }
      case 'remove_arrow': {
        if (change.target_id) {
          removeArrowFromAnyCanvas(change.target_id);
        }
        break;
      }
      case 'modify_arrow':
      case 'refine_arrow': {
        if (change.target_id) {
          updateArrowInAnyCanvas(change.target_id, change.proposal as Partial<Arrow>);
        }
        break;
      }
      case 'decompose': {
        if (change.target_id) {
          store.createChildCanvas(canvasId, change.target_id);
          // Add child components from proposal
          const children = (change.proposal.children ?? change.proposal.child_components) as Array<Record<string, unknown>> | undefined;
          if (children) {
            for (const child of children) {
              const block: Block = {
                id: (child.id as string) ?? genId(),
                label: (child.label as string) ?? 'Sub-block',
                hasChildren: false,
                ports: (child.ports as Block['ports']) ?? [],
                type: child.type as Block['type'],
                status: 'draft',
              };
              store.addBlockToCanvas(change.target_id, block);
            }
          }
          // Add child connections
          const conns = (change.proposal.child_connections ?? change.proposal.connections) as Array<Record<string, unknown>> | undefined;
          if (conns) {
            for (const conn of conns) {
              const arrow: Arrow = {
                id: genId(),
                from: conn.from as string,
                to: conn.to as string,
                label: conn.label as string,
              };
              store.addArrowToCanvas(change.target_id, arrow);
            }
          }
        }
        break;
      }
      case 'restructure': {
        // Move block from one canvas to another — simplified as remove+add
        break;
      }
    }
  }
}

/**
 * Find and remove a block by ID across all canvas nodes.
 */
function removeBlockFromAnyCanvas(blockId: string): void {
  const state = useDesignStore.getState();
  const nodes = state.nodes;
  for (const canvasId of Object.keys(nodes)) {
    const canvas = nodes[canvasId];
    if (canvas.components.some((b) => b.id === blockId)) {
      // Navigate to that canvas so store.removeBlock works on it
      const prevPath = state.currentPath;
      state.navigateTo(canvasId);
      state.removeBlock(blockId);
      state.navigateTo(prevPath);
      return;
    }
  }
}

/**
 * Find and update a block by ID across all canvas nodes.
 */
function updateBlockInAnyCanvas(blockId: string, updates: Partial<Block>): void {
  const state = useDesignStore.getState();
  const nodes = state.nodes;
  for (const canvasId of Object.keys(nodes)) {
    const canvas = nodes[canvasId];
    if (canvas.components.some((b) => b.id === blockId)) {
      const prevPath = state.currentPath;
      state.navigateTo(canvasId);
      state.updateBlock(blockId, updates);
      state.navigateTo(prevPath);
      return;
    }
  }
}

/**
 * Find and remove an arrow by ID across all canvas nodes.
 */
function removeArrowFromAnyCanvas(arrowId: string): void {
  const state = useDesignStore.getState();
  const nodes = state.nodes;
  for (const canvasId of Object.keys(nodes)) {
    const canvas = nodes[canvasId];
    if (canvas.connections.some((a) => a.id === arrowId)) {
      const prevPath = state.currentPath;
      state.navigateTo(canvasId);
      state.removeArrow(arrowId);
      state.navigateTo(prevPath);
      return;
    }
  }
}

/**
 * Find and update an arrow by ID across all canvas nodes.
 */
function updateArrowInAnyCanvas(arrowId: string, updates: Partial<Arrow>): void {
  const state = useDesignStore.getState();
  const nodes = state.nodes;
  for (const canvasId of Object.keys(nodes)) {
    const canvas = nodes[canvasId];
    if (canvas.connections.some((a) => a.id === arrowId)) {
      const prevPath = state.currentPath;
      state.navigateTo(canvasId);
      state.updateArrow(arrowId, updates);
      state.navigateTo(prevPath);
      return;
    }
  }
}
