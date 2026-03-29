// ─── Post-Implementation Changeset (Phase 8) ──────────────────────────────────
//
// After all tasks complete, generate a design changeset that:
//   - Marks node status as 'implemented' for nodes whose tasks all passed
//   - Adds code_links for completed tasks' files
//   - Fills in impl_ref for nodes with associated tasks

import type { DesignNode, ImplTask } from '../store/types.js';
import { useDesignStore } from '../store/store.js';
import type { VerificationResult } from './verification.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PostImplNodePatch {
  nodeId: string;
  canvasId: string;
  nodeName: string;
  patches: Partial<DesignNode>;
}

export interface PostImplChangeset {
  id: string;
  title: string;
  created_at: string;
  patches: PostImplNodePatch[];
  summary: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Find which canvas contains a node by design_node id. */
function findNodeInCanvases(
  nodeId: string
): { canvasId: string; node: DesignNode } | null {
  const { canvases } = useDesignStore.getState();
  for (const [canvasId, canvas] of Object.entries(canvases)) {
    const found =
      canvas.components.find((n) => n.id === nodeId) ??
      canvas.connections.find((n) => n.id === nodeId);
    if (found) return { canvasId, node: found };
  }
  return null;
}

/** Collect all tasks grouped by their design_node id. */
function groupTasksByNode(tasks: ImplTask[]): Map<string, ImplTask[]> {
  const map = new Map<string, ImplTask[]>();
  for (const task of tasks) {
    const key = task.design_node ?? task.node_id;
    if (!key) continue;
    const existing = map.get(key) ?? [];
    existing.push(task);
    map.set(key, existing);
  }
  return map;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate a post-implementation changeset from completed tasks.
 *
 * For each design node referenced by at least one task:
 *   - All tasks done + verification passed → status: 'implemented', add code_links
 *   - Any task failed → status: 'failed', add code_links for completed parts
 *
 * Returns a PostImplChangeset for developer review on the canvas.
 */
export function generatePostImplChangeset(
  completedTasks: ImplTask[],
  verificationResults: VerificationResult[] = []
): PostImplChangeset {
  const now = new Date().toISOString();
  const changesetId = `post-impl-${Date.now()}`;

  const verifyMap = new Map<string, boolean>(
    verificationResults.map((r) => [r.taskId, r.passed])
  );

  const tasksByNode = groupTasksByNode(completedTasks);
  const patches: PostImplNodePatch[] = [];

  for (const [nodeId, nodeTasks] of tasksByNode) {
    const located = findNodeInCanvases(nodeId);
    if (!located) continue;

    const { canvasId, node } = located;

    const allDone = nodeTasks.every((t) => t.status === 'done');
    const anyFailed = nodeTasks.some((t) => t.status === 'failed');
    const verifyPassed = nodeTasks.every((t) => verifyMap.get(t.id) !== false);

    const newStatus: DesignNode['status'] =
      allDone && verifyPassed ? 'implemented' : anyFailed ? 'failed' : node.status;

    const existingLinks = node.code_links ?? [];
    const existingFiles = new Set(existingLinks.map((l) => l.file));

    const newLinks = nodeTasks
      .filter((t) => t.file && !existingFiles.has(t.file))
      .map((t) => ({ file: t.file as string }));
    const testLinks = nodeTasks
      .filter((t) => t.test_file && !existingFiles.has(t.test_file))
      .map((t) => ({ file: t.test_file as string }));

    const combinedLinks = [...existingLinks, ...newLinks, ...testLinks];

    const patch: Partial<DesignNode> = {};
    if (newStatus !== node.status) patch.status = newStatus;
    if (combinedLinks.length > existingLinks.length) patch.code_links = combinedLinks;

    if (Object.keys(patch).length === 0) continue;

    patches.push({ nodeId, canvasId, nodeName: node.name, patches: patch });
  }

  const implementedCount = patches.filter((p) => p.patches.status === 'implemented').length;
  const failedCount = patches.filter((p) => p.patches.status === 'failed').length;

  const summary =
    patches.length === 0
      ? 'No design nodes required updates.'
      : `${implementedCount} node(s) marked implemented, ${failedCount} node(s) marked failed. ` +
        `${patches.length} total node(s) updated.`;

  return { id: changesetId, title: 'Post-Implementation Design Update', created_at: now, patches, summary };
}

/**
 * Apply a PostImplChangeset to the store via Immer-backed updateBlock.
 */
export function applyPostImplChangeset(changeset: PostImplChangeset): void {
  const { updateBlock } = useDesignStore.getState();
  for (const { nodeId, canvasId, patches } of changeset.patches) {
    updateBlock(canvasId, nodeId, patches);
  }
  console.info(
    `[post-impl] Applied changeset "${changeset.id}": ${changeset.patches.length} node(s) updated`
  );
}
