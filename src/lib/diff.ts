import type { CanvasNode, Block, Arrow, DiffEntry, ID } from '../types';

/**
 * Diff two canvas trees and return a flat list of changes.
 * ~80 lines. Custom to the Block/Arrow data model.
 */
export function diffCanvases(before: CanvasNode, after: CanvasNode): DiffEntry[] {
  const entries: DiffEntry[] = [];

  // Build lookup maps
  const beforeBlocks = new Map(before.components.map((b) => [b.id, b]));
  const afterBlocks = new Map(after.components.map((b) => [b.id, b]));
  const beforeArrows = new Map(before.connections.map((a) => [a.id, a]));
  const afterArrows = new Map(after.connections.map((a) => [a.id, a]));

  // Blocks: added
  for (const [id, block] of afterBlocks) {
    if (!beforeBlocks.has(id)) {
      entries.push({
        type: 'added', entity: 'block', canvasId: after.id,
        id, label: block.label, after: block,
      });
    }
  }

  // Blocks: removed
  for (const [id, block] of beforeBlocks) {
    if (!afterBlocks.has(id)) {
      entries.push({
        type: 'removed', entity: 'block', canvasId: before.id,
        id, label: block.label, before: block,
      });
    }
  }

  // Blocks: modified
  for (const [id, afterBlock] of afterBlocks) {
    const beforeBlock = beforeBlocks.get(id);
    if (!beforeBlock) continue;
    const changed = diffBlockFields(beforeBlock, afterBlock);
    if (changed.length > 0) {
      entries.push({
        // Detect decomposition: has_children false→true
        type: (!beforeBlock.hasChildren && afterBlock.hasChildren) ? 'decomposed' : 'modified',
        entity: 'block', canvasId: after.id,
        id, label: afterBlock.label,
        before: beforeBlock, after: afterBlock, fields: changed,
      });
    }
  }

  // Arrows: added
  for (const [id, arrow] of afterArrows) {
    if (!beforeArrows.has(id)) {
      entries.push({
        type: 'added', entity: 'arrow', canvasId: after.id,
        id, label: arrow.label ?? `${arrow.from} -> ${arrow.to}`, after: arrow,
      });
    }
  }

  // Arrows: removed
  for (const [id, arrow] of beforeArrows) {
    if (!afterArrows.has(id)) {
      entries.push({
        type: 'removed', entity: 'arrow', canvasId: before.id,
        id, label: arrow.label ?? `${arrow.from} -> ${arrow.to}`, before: arrow,
      });
    }
  }

  // Arrows: modified
  for (const [id, afterArrow] of afterArrows) {
    const beforeArrow = beforeArrows.get(id);
    if (!beforeArrow) continue;
    const changed = diffArrowFields(beforeArrow, afterArrow);
    if (changed.length > 0) {
      entries.push({
        type: 'modified', entity: 'arrow', canvasId: after.id,
        id, label: afterArrow.label ?? `${afterArrow.from} -> ${afterArrow.to}`,
        before: beforeArrow, after: afterArrow, fields: changed,
      });
    }
  }

  return entries;
}

function diffBlockFields(a: Block, b: Block): string[] {
  const changed: string[] = [];
  if (a.label !== b.label) changed.push('label');
  if (a.type !== b.type) changed.push('type');
  if (a.status !== b.status) changed.push('status');
  if (a.annotation !== b.annotation) changed.push('annotation');
  if (a.hasChildren !== b.hasChildren) changed.push('hasChildren');
  if (JSON.stringify(a.tags) !== JSON.stringify(b.tags)) changed.push('tags');
  if (JSON.stringify(a.ports) !== JSON.stringify(b.ports)) changed.push('ports');
  if (a.interfacesContent !== b.interfacesContent) changed.push('interfaces');
  if (a.notesContent !== b.notesContent) changed.push('notes');
  if (JSON.stringify(a.contract) !== JSON.stringify(b.contract)) changed.push('contract');
  if (JSON.stringify(a.source_map) !== JSON.stringify(b.source_map)) changed.push('source_map');
  return changed;
}

function diffArrowFields(a: Arrow, b: Arrow): string[] {
  const changed: string[] = [];
  if (a.from !== b.from) changed.push('from');
  if (a.to !== b.to) changed.push('to');
  if (a.label !== b.label) changed.push('label');
  if (a.type !== b.type) changed.push('type');
  if (a.protocol !== b.protocol) changed.push('protocol');
  if (a.fromPort !== b.fromPort) changed.push('fromPort');
  if (a.toPort !== b.toPort) changed.push('toPort');
  if (JSON.stringify(a.interface) !== JSON.stringify(b.interface)) changed.push('interface');
  if (a.annotation !== b.annotation) changed.push('annotation');
  return changed;
}

/**
 * Diff two workspace trees (all canvases).
 * Detects MOVED blocks (same id under different parent).
 */
export function diffWorkspaces(
  before: Record<ID, CanvasNode>,
  after: Record<ID, CanvasNode>,
): DiffEntry[] {
  const allIds = new Set([...Object.keys(before), ...Object.keys(after)]);
  const entries: DiffEntry[] = [];

  for (const id of allIds) {
    const b = before[id];
    const a = after[id];

    if (!b && a) {
      entries.push(...diffCanvases(
        { id, label: '', parentId: null, components: [], connections: [], layout: {} },
        a,
      ));
    } else if (b && !a) {
      entries.push(...diffCanvases(
        b,
        { id, label: '', parentId: null, components: [], connections: [], layout: {} },
      ));
    } else if (b && a) {
      entries.push(...diffCanvases(b, a));
    }
  }

  // Detect MOVED: block id that was removed from one canvas and added to another
  const removed = entries.filter((e) => e.type === 'removed' && e.entity === 'block');
  const added = entries.filter((e) => e.type === 'added' && e.entity === 'block');
  for (const rem of removed) {
    const match = added.find((a) => a.id === rem.id);
    if (match) {
      // Replace both entries with a single MOVED entry
      rem.type = 'moved';
      rem.after = match.after;
      rem.fields = [`${rem.canvasId} → ${match.canvasId}`];
      // Mark the added entry for removal
      match.type = 'moved';
      match.accepted = undefined; // will be filtered
    }
  }
  // Keep only one MOVED entry per block (the one from the removed side)
  const seen = new Set<string>();
  return entries.filter((e) => {
    if (e.type === 'moved') {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
    }
    return true;
  });
}
