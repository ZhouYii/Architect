/**
 * Low-level Tauri IPC wrappers for workspace file I/O.
 * When running in a plain browser (no Tauri), all calls return empty/no-op results.
 */

import { safeInvoke } from '../../lib/ipc.js';

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
 * Returns empty map when not running inside Tauri.
 */
export async function readWorkspace(basePath: string): Promise<Record<string, string>> {
  const result = await safeInvoke<WorkspaceReadResult>('read_workspace', { path: basePath });

  // Not in Tauri — return empty map so callers fall through to mock data
  if (result === null) {
    return {};
  }

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
 * Returns empty array when not running inside Tauri.
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

  const result = await safeInvoke<WriteFilesResult>('write_files', {
    base: basePath,
    files: fileMap,
  });

  // Not in Tauri — silently skip writes
  if (result === null) {
    return [];
  }

  if (!result.success) {
    throw new Error(result.error ?? 'write_files failed');
  }

  return result.written;
}
