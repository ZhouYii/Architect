import Dagre from '@dagrejs/dagre';
import type { CanvasNode, CanvasLayout } from '../types';

const NODE_W = 240;
const NODE_H = 140;

export function autoLayout(canvas: CanvasNode): CanvasLayout {
  const edgeCounts = new Map<string, number>();
  for (const arrow of canvas.connections) {
    const key = [arrow.from, arrow.to].sort().join('|');
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
  }
  const maxEdges = Math.max(1, ...edgeCounts.values());
  const baseNodeSep = NODE_H + 100;
  const nodeSep = baseNodeSep + maxEdges * 25;

  const g = new Dagre.graphlib.Graph()
    .setDefaultEdgeLabel(() => ({}))
    .setGraph({
      rankdir: 'LR',
      nodesep: nodeSep,
      ranksep: 320,
      marginx: 80,
      marginy: 80,
      edgesep: 60,
      align: 'UL',
      ranker: 'tight-tree',
    });

  for (const block of canvas.components) {
    g.setNode(block.id, { width: NODE_W, height: NODE_H });
  }

  const seen = new Set<string>();
  for (const arrow of canvas.connections) {
    const key = `${arrow.from}->${arrow.to}`;
    if (!seen.has(key)) {
      seen.add(key);
      const pairKey = [arrow.from, arrow.to].sort().join('|');
      const count = edgeCounts.get(pairKey) ?? 1;
      g.setEdge(arrow.from, arrow.to, { minlen: Math.max(1, Math.ceil(count / 2)) });
    }
  }

  Dagre.layout(g);

  // Extract positions
  const positions = new Map<string, { x: number; y: number }>();
  for (const block of canvas.components) {
    const node = g.node(block.id);
    if (node) positions.set(block.id, { x: node.x, y: node.y });
  }

  // Build adjacency for barycenter computation
  const neighbors = new Map<string, string[]>();
  for (const block of canvas.components) neighbors.set(block.id, []);
  for (const arrow of canvas.connections) {
    neighbors.get(arrow.from)?.push(arrow.to);
    neighbors.get(arrow.to)?.push(arrow.from);
  }

  // Group nodes by rank (same X position = same rank in LR layout)
  const ranks = new Map<number, string[]>();
  for (const [id, pos] of positions) {
    const rankX = Math.round(pos.x / 10) * 10; // Quantize to handle floating point
    if (!ranks.has(rankX)) ranks.set(rankX, []);
    ranks.get(rankX)!.push(id);
  }

  // Barycenter reordering: for each rank, sort nodes by average Y of their neighbors
  for (const [_rankX, nodeIds] of ranks) {
    if (nodeIds.length <= 1) continue;

    const barycenters = nodeIds.map((id) => {
      const nbrs = neighbors.get(id) ?? [];
      if (nbrs.length === 0) return { id, bc: positions.get(id)!.y };
      const avgY = nbrs.reduce((sum, n) => sum + (positions.get(n)?.y ?? 0), 0) / nbrs.length;
      return { id, bc: avgY };
    });

    barycenters.sort((a, b) => a.bc - b.bc);

    // Reassign Y positions maintaining the original spacing
    const sortedOriginalYs = nodeIds.map((id) => positions.get(id)!.y).sort((a, b) => a - b);
    for (let i = 0; i < barycenters.length; i++) {
      positions.get(barycenters[i].id)!.y = sortedOriginalYs[i];
    }
  }

  // Build final layout
  const layout: CanvasLayout = {};
  for (const [id, pos] of positions) {
    layout[id] = { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 };
  }

  // Post-process: verify no overlaps and nudge if needed
  const ids = Object.keys(layout);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = layout[ids[i]];
      const b = layout[ids[j]];
      const overlapX = (NODE_W + 40) - Math.abs(a.x - b.x);
      const overlapY = (NODE_H + 40) - Math.abs(a.y - b.y);
      if (overlapX > 0 && overlapY > 0) {
        if (overlapX < overlapY) {
          b.x += b.x >= a.x ? overlapX : -overlapX;
        } else {
          b.y += b.y >= a.y ? overlapY : -overlapY;
        }
      }
    }
  }

  return layout;
}
