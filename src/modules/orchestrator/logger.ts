// ─── Task Logger (Phase 7) ────────────────────────────────────────────────────
//
// Appends attempt logs to task records in the store and persists status files
// to `.architect/impl/` so the canvas can display real-time ring indicators.

import { useDesignStore } from '../store/store.js';
import { writeFiles } from '../workspace/io.js';
import type { AttemptLog, ImplStatusFile } from '../store/types.js';

// ─── Attempt logging ──────────────────────────────────────────────────────────

/**
 * Append an attempt log entry to the given task in the Zustand store.
 */
export function logAttempt(taskId: string, attempt: AttemptLog): void {
  const store = useDesignStore.getState();
  const task = store.impl_tasks.find((t) => t.id === taskId);
  if (!task) {
    console.warn(`[logger] logAttempt: task '${taskId}' not found`);
    return;
  }

  // Immer-patched update — append to attempts array
  useDesignStore.setState((state) => {
    const t = state.impl_tasks.find((x) => x.id === taskId);
    if (t) {
      t.attempts = [...t.attempts, attempt];
      t.updated_at = new Date().toISOString();
    }
  });
}

// ─── Status file ──────────────────────────────────────────────────────────────

/**
 * Build and write `.architect/impl/status.json` to the current workspace path.
 * The canvas reads this file to display implementation status rings.
 */
export function writeImplStatusFile(): void {
  const { impl_tasks } = useDesignStore.getState();

  const summary = {
    total: impl_tasks.length,
    done: impl_tasks.filter((t) => t.status === 'done').length,
    failed: impl_tasks.filter((t) => t.status === 'failed').length,
    running: impl_tasks.filter((t) => t.status === 'running').length,
    pending: impl_tasks.filter((t) => t.status === 'queued' || t.status === 'blocked').length,
  };

  const statusFile: ImplStatusFile = {
    tasks: impl_tasks,
    summary,
    last_updated: new Date().toISOString(),
  };

  // Fire-and-forget: if no workspace is open yet, skip silently
  const workspacePath = _getWorkspacePath();
  if (!workspacePath) return;

  writeFiles(workspacePath, [
    ['impl/status.json', JSON.stringify(statusFile, null, 2)],
  ]).catch((err) => {
    console.warn('[logger] writeImplStatusFile failed:', err);
  });
}

// ─── Per-task log file ────────────────────────────────────────────────────────

/**
 * Write detailed log for a single task attempt to
 * `.architect/impl/<planId>.log/<taskId>.json`.
 */
export async function writeTaskLog(
  planId: string,
  taskId: string,
  log: AttemptLog
): Promise<void> {
  const workspacePath = _getWorkspacePath();
  if (!workspacePath) return;

  const relPath = `impl/${planId}.log/${taskId}.json`;

  // Read existing log array (best-effort) then append
  const { impl_tasks } = useDesignStore.getState();
  const task = impl_tasks.find((t) => t.id === taskId);
  const allAttempts = task ? [...task.attempts, log] : [log];

  try {
    await writeFiles(workspacePath, [
      [relPath, JSON.stringify(allAttempts, null, 2)],
    ]);
  } catch (err) {
    console.warn(`[logger] writeTaskLog failed for ${taskId}:`, err);
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Retrieve the current workspace path from the store.
 * The store keeps it as `workspace_path` on the WorkspaceState (loaded from disk).
 * For now we pull it from a module-level variable updated by the workspace loader.
 */
let _currentWorkspacePath: string | null = null;

export function setWorkspacePath(path: string): void {
  _currentWorkspacePath = path;
}

function _getWorkspacePath(): string | null {
  return _currentWorkspacePath;
}
