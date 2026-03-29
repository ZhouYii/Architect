/**
 * Load workspace from disk into the Zustand store.
 * Called once on app mount.
 */

import { useDesignStore } from '../store/store.js';
import { readWorkspace } from './io.js';
import { deserializeCanvas } from './yaml.js';
import type { CanvasNode } from '../store/types.js';

interface WorkspaceStateYaml {
  current_path?: string[];
  head_hash?: string;
  dirty?: boolean;
}

/**
 * Read `.architect/` at `basePath`, deserialize all canvases, and populate
 * the Zustand store.  Returns `true` if workspace was loaded, `false` if the
 * `.architect/` directory did not exist (caller should then init).
 */
export async function loadWorkspace(basePath: string): Promise<boolean> {
  let fileMap: Record<string, string>;

  try {
    fileMap = await readWorkspace(basePath);
  } catch (err) {
    // If the directory doesn't exist the backend returns an error
    console.warn('[workspace] load failed (not initialized?):', err);
    return false;
  }

  const canvases: Record<string, CanvasNode> = {};

  // Collect all node.yaml entries — keys look like "tree/<id>/node.yaml"
  for (const [relPath, content] of Object.entries(fileMap)) {
    if (!relPath.endsWith('/node.yaml')) continue;

    try {
      const canvas = deserializeCanvas(content);
      // Use the parsed id if present; otherwise derive from path
      const id = canvas.id || _idFromPath(relPath);
      canvases[id] = { ...canvas, id };
    } catch (err) {
      console.error(`[workspace] failed to deserialize ${relPath}:`, err);
    }
  }

  if (Object.keys(canvases).length === 0) {
    console.warn('[workspace] no canvases found in tree/');
    return false;
  }

  // Restore navigation path from workspace.state.yaml if available
  let currentPath: string[] = [Object.keys(canvases)[0]];
  const stateRaw = fileMap['workspace.state.yaml'];
  if (stateRaw) {
    try {
      // Simple YAML.parse-free approach — use dynamic import to avoid circular deps
      const { default: YAML } = await import('yaml');
      const stateObj = YAML.parse(stateRaw) as WorkspaceStateYaml;
      if (Array.isArray(stateObj?.current_path) && stateObj.current_path.length > 0) {
        // Validate that all IDs in the path actually exist
        const valid = stateObj.current_path.every((id) => id in canvases);
        if (valid) {
          currentPath = stateObj.current_path;
        }
      }
    } catch {
      // ignore parse errors; fall back to default
    }
  }

  // Populate the store — replace canvases and restore navigation
  useDesignStore.getState().loadCanvases(canvases, currentPath);

  return true;
}

/** Derive canvas ID from a path like "tree/gacha-service/node.yaml" */
function _idFromPath(relPath: string): string {
  const parts = relPath.split('/');
  // parts[0] = "tree", parts[1] = "<id>", parts[2] = "node.yaml"
  return parts[1] ?? 'root';
}
