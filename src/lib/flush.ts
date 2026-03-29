import { invoke } from '@tauri-apps/api/core';
import { useDesignStore } from '../store';
import { serializeTreeToFiles, serializeWorkspaceState } from './yaml';
import type { WorkspaceState } from '../types';

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let lastFlushedHash: string | null = null;

/**
 * Schedule a flush after 5 seconds of inactivity.
 * Resets the timer on each call.
 */
export function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => flush(), 5000);
}

/**
 * Immediately flush the current store to disk.
 * Returns true if files were written, false if nothing changed.
 */
export async function flush(): Promise<boolean> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const store = useDesignStore.getState();
  if (!store.workspacePath || store.workspacePath === '__demo__') return false;

  // Quick hash check to skip unnecessary writes
  const stateHash = JSON.stringify(store.nodes);
  if (stateHash === lastFlushedHash) return false;

  const treePath = `${store.workspacePath}/.architect/tree`;
  const files = serializeTreeToFiles(store.nodes);

  const fileEntries = files.map((f) => ({
    path: f.path,
    content: f.content,
  }));

  try {
    const written = await invoke<number>('write_files', {
      base: treePath,
      files: fileEntries,
    });

    if (written > 0) {
      // Increment minor version
      const [major, minor] = store.version.split('.').map(Number);
      const newVersion = `${major}.${minor + 1}`;
      store.setVersion(newVersion);

      // Compute new hash
      const hash = await invoke<string>('compute_tree_hash', {
        treePath,
      });
      store.markClean(hash);

      // Persist workspace.state.yaml to disk
      const wsState: WorkspaceState = {
        version: newVersion,
        head_hash: hash,
        dirty: false,
        pending_changes: store.pendingACPs.filter((a) => a.status === 'pending').length,
        last_flush_at: new Date().toISOString(),
      };
      await invoke<number>('write_files', {
        base: `${store.workspacePath}/.architect`,
        files: [{ path: 'workspace.state.yaml', content: serializeWorkspaceState(wsState) }],
      });
    }

    lastFlushedHash = stateHash;
    return written > 0;
  } catch (err) {
    console.error('Flush failed:', err);
    return false;
  }
}

/**
 * Reset flush state (used when loading a new workspace).
 */
export function resetFlush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  lastFlushedHash = null;
}
