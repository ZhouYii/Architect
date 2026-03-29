/**
 * Low-level Tauri IPC wrappers for workspace file I/O.
 */

import { invoke } from '../../lib/ipc.js';

// ─── Types mirroring Rust structs ────────────────────────────────────────────

interface WorkspaceReadResult {
  success: boolean;
  data: string | null;
  error: string | null;
}

interface WriteFilesResult {
  success: boolean;
  written: string[];
  error: string | null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Read all files in `.architect/` at `basePath`.
 * Returns a map of { relative_path → raw string content }.
 * Keys look like: "workspace.yaml", "workspace.state.yaml", "tree/root/node.yaml", …
 *
 * Throws if the backend reports an error.
 */
export async function readWorkspace(basePath: string): Promise<Record<string, string>> {
  const result = await invoke<WorkspaceReadResult>('read_workspace', { path: basePath });

  if (!result.success || result.data === null) {
    throw new Error(result.error ?? 'read_workspace returned no data');
  }

  return JSON.parse(result.data) as Record<string, string>;
}

/**
 * Write files into `.architect/` at `basePath`.
 * `files` is an array of [relative_path, content] pairs.
 * The backend resolves each path as `<basePath>/.architect/<relative_path>`.
 *
 * Returns the list of relative paths that were actually written (unchanged
 * files are skipped by the backend).
 *
 * Throws if the backend reports an error.
 */
export async function writeFiles(
  basePath: string,
  files: [string, string][]
): Promise<string[]> {
  // Convert array-of-pairs to HashMap<String,String> for Rust
  const fileMap: Record<string, string> = {};
  for (const [path, content] of files) {
    fileMap[path] = content;
  }

  const result = await invoke<WriteFilesResult>('write_files', {
    base: basePath,
    files: fileMap,
  });

  if (!result.success) {
    throw new Error(result.error ?? 'write_files failed');
  }

  return result.written;
}
