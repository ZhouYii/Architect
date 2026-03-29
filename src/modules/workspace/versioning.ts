/**
 * Workspace versioning — cut a version snapshot and restore from one.
 *
 * cutVersion()
 *   1. Flush current store to disk
 *   2. Compute a tree hash via Rust
 *   3. Create a .tar.gz archive at .architect/versions/v{N}.tar.gz
 *   4. Increment version in store (N.0 → N+1.0)
 *   5. Reset all modified/implemented nodes → clean (delta baseline)
 *   6. Write workspace files
 *
 * loadVersion(n)
 *   Restore tree/ from a previously cut archive, then reload the workspace.
 */

import { invoke } from '../../lib/ipc.js';
import { useDesignStore } from '../store/store.js';
import { flush } from './flush.js';
import { getWorkspacePath } from './flush.js';
import { writeAgentGuide } from './agent-guide.js';

// ─── Rust IPC types ──────────────────────────────────────────────────────────

interface HashResult {
  hash: string;
  error: string | null;
}

interface ArchiveResult {
  success: boolean;
  archive_path: string | null;
  error: string | null;
}

// ─── cutVersion ─────────────────────────────────────────────────────────────

export async function cutVersion(): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    throw new Error('[versioning] No workspace path set');
  }

  // 1. Ensure disk is up to date
  await flush();

  // 2. Compute tree hash
  const hashResult = await invoke<HashResult>('compute_tree_hash', {
    path: workspacePath,
  });
  if (hashResult.error) {
    throw new Error(`[versioning] compute_tree_hash failed: ${hashResult.error}`);
  }
  const treeHash = hashResult.hash;

  // 3. Determine next major version number
  const { ui } = useDesignStore.getState();
  const nextMajor = ui.last_major_version + 1;
  const archivePath = `${workspacePath}/.architect/versions/v${nextMajor}.tar.gz`;

  const archiveResult = await invoke<ArchiveResult>('create_version_archive', {
    workspacePath,
    archivePath,
  });
  if (!archiveResult.success) {
    throw new Error(
      `[versioning] create_version_archive failed: ${archiveResult.error ?? 'unknown error'}`
    );
  }

  // 4 & 5. Update store: bump version, store hash, reset dirty nodes
  const newVersion = `${nextMajor}.0`;
  useDesignStore.getState().setVersion(newVersion, nextMajor, treeHash);
  useDesignStore.getState().resetDirtyNodes();

  // 6. Flush the updated state (version string + clean statuses) to disk
  await flush();

  // 7. Regenerate AGENT_GUIDE.md with the current design state
  const freshState = useDesignStore.getState();
  const syntheticConfig = {
    name: 'Architect Project',
    root_canvas_id: freshState.ui.current_path[0] ?? 'root',
    version: newVersion,
    created_at: new Date().toISOString(),
  };
  writeAgentGuide(syntheticConfig, freshState.canvases).catch((err: unknown) => {
    console.warn('[versioning] writeAgentGuide failed (non-fatal):', err);
  });

  console.info(`[versioning] Cut v${newVersion} — archive: ${archivePath}, hash: ${treeHash}`);
}

// ─── loadVersion ─────────────────────────────────────────────────────────────

export async function loadVersion(version: number): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    throw new Error('[versioning] No workspace path set');
  }

  const archivePath = `${workspacePath}/.architect/versions/v${version}.tar.gz`;

  const result = await invoke<ArchiveResult>('restore_from_archive', {
    archivePath,
    targetPath: workspacePath,
  });
  if (!result.success) {
    throw new Error(
      `[versioning] restore_from_archive failed: ${result.error ?? 'unknown error'}`
    );
  }

  // Reload the workspace from the restored files
  const { loadWorkspace } = await import('./load.js');
  await loadWorkspace(workspacePath);

  console.info(`[versioning] Restored v${version} from ${archivePath}`);
}
