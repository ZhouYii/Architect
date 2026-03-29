/**
 * Design Tracks — lightweight branching for parallel design exploration.
 *
 * Tracks live at:  .architect/tracks/<name>/
 *   tree/          ← copy of tree/ at fork time (serves as 3-way merge base)
 *   track.yaml     ← metadata (forked_from, forked_at, status, description)
 *
 * Three-way merge insight (§0 of Design Doc):
 *   The clean nodes in the fork snapshot ARE the base.
 *   Compare node.status, not archived diffs.
 */

import { invoke } from '../../lib/ipc.js';
import { useDesignStore } from '../store/store.js';
import { serializeCanvas, deserializeCanvas } from './yaml.js';
import { flush } from './flush.js';
import { getWorkspacePath } from './flush.js';
import type { CanvasNode, DesignNode, MergeConflict, TrackInfo } from '../store/types.js';

// ─── IPC result types ─────────────────────────────────────────────────────────

interface WriteFilesResult {
  success: boolean;
  written: string[];
  error: string | null;
}

interface TrackReadResult {
  success: boolean;
  data: string | null;
  error: string | null;
}

interface ListTracksResult {
  success: boolean;
  tracks: string[];
  error: string | null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Write a set of files into `.architect/` at `basePath`.
 * Wraps the existing `write_files` Tauri command.
 */
async function _writeFiles(basePath: string, files: [string, string][]): Promise<void> {
  const fileMap: Record<string, string> = {};
  for (const [path, content] of files) {
    fileMap[path] = content;
  }
  const result = await invoke<WriteFilesResult>('write_files', { base: basePath, files: fileMap });
  if (!result.success) {
    throw new Error(result.error ?? 'write_files failed');
  }
}

/**
 * Read all files in a named track directory.
 * Returns a map of { relative_path → content }.
 * Keys look like: "track.yaml", "tree/root/node.yaml", …
 */
async function _readTrack(basePath: string, trackName: string): Promise<Record<string, string>> {
  const result = await invoke<TrackReadResult>('read_track', { base: basePath, track: trackName });
  if (!result.success || result.data === null) {
    throw new Error(result.error ?? `read_track('${trackName}') returned no data`);
  }
  return JSON.parse(result.data) as Record<string, string>;
}

/**
 * Build a track.yaml string for a given TrackInfo.
 */
function _buildTrackYaml(info: TrackInfo): string {
  const lines = [
    `name: "${info.name}"`,
    `forked_from: ${info.forked_from}`,
    `forked_at: "${info.forked_at}"`,
    `status: "${info.status}"`,
  ];
  if (info.description) {
    lines.push(`description: "${info.description.replace(/"/g, '\\"')}"`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Parse a track.yaml string into a TrackInfo.
 */
async function _parseTrackYaml(yamlStr: string, fallbackName: string): Promise<TrackInfo> {
  const { default: YAML } = await import('yaml');
  const raw = YAML.parse(yamlStr) as Partial<TrackInfo>;
  return {
    name: raw.name ?? fallbackName,
    forked_from: raw.forked_from ?? 0,
    forked_at: raw.forked_at ?? new Date().toISOString(),
    status: raw.status ?? 'active',
    description: raw.description,
  };
}

/**
 * Serialize the current store canvases as files for writing under a prefix.
 * Returns pairs like `['tracks/<name>/tree/root/node.yaml', content]`.
 */
function _canvasesToTrackFiles(
  canvases: Record<string, CanvasNode>,
  trackName: string
): [string, string][] {
  const files: [string, string][] = [];
  for (const [canvasId, canvas] of Object.entries(canvases)) {
    const dirName = canvasId.replace(/[/\\]/g, '_');
    const prefix = `tracks/${trackName}/tree/${dirName}`;
    files.push([`${prefix}/node.yaml`, serializeCanvas(canvas)]);
    files.push([`${prefix}/node.interfaces.ts`, canvas.interfacesContent ?? '']);
    files.push([`${prefix}/node.notes.md`, canvas.narrative ?? '']);
  }
  return files;
}

/**
 * Deserialize canvases from a track's file map.
 * Expects keys like "tree/<id>/node.yaml".
 */
function _canvasesFromTrackFiles(fileMap: Record<string, string>): Record<string, CanvasNode> {
  const canvases: Record<string, CanvasNode> = {};
  for (const [relPath, content] of Object.entries(fileMap)) {
    if (!relPath.startsWith('tree/') || !relPath.endsWith('/node.yaml')) continue;
    try {
      const canvas = deserializeCanvas(content);
      const id = canvas.id || _idFromPath(relPath);
      canvases[id] = { ...canvas, id };
    } catch (err) {
      console.error(`[tracks] failed to deserialize ${relPath}:`, err);
    }
  }
  return canvases;
}

function _idFromPath(relPath: string): string {
  const parts = relPath.split('/');
  return parts[1] ?? 'root';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new track forking from the current state.
 *
 * 1. Flush current state to disk
 * 2. Snapshot current canvases into .architect/tracks/<name>/tree/
 * 3. Write track.yaml metadata
 * 4. Switch the store to the new track
 */
export async function createTrack(name: string, description?: string): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) throw new Error('[tracks] No workspace path set');

  // 1. Flush
  await flush();

  const state = useDesignStore.getState();
  const now = new Date().toISOString();

  const info: TrackInfo = {
    name,
    forked_from: state.ui.last_major_version,
    forked_at: now,
    status: 'active',
    description,
  };

  // 2 & 3. Write snapshot + metadata
  const treeFiles = _canvasesToTrackFiles(state.canvases, name);
  const trackYaml = _buildTrackYaml(info);
  await _writeFiles(workspacePath, [
    ...treeFiles,
    [`tracks/${name}/track.yaml`, trackYaml],
  ]);

  // 4. Switch store to the new track and refresh track list
  state.setActiveTrack(name);
  const updatedTracks = await listTracks();
  state.setTracks(updatedTracks);

  console.info(`[tracks] Created track '${name}' forked from v${info.forked_from}`);
}

/**
 * Switch to a track (or back to main if name is null).
 *
 * 1. Flush current track state to disk (so it's preserved)
 * 2. Load the target track's canvases (or main tree) into the store
 * 3. Update active_track in the store
 */
export async function switchTrack(name: string | null): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) throw new Error('[tracks] No workspace path set');

  const state = useDesignStore.getState();
  const currentTrack = state.active_track;

  // 1. Flush current state
  if (currentTrack !== null) {
    // Save current canvases back to the track snapshot
    await _saveCurrentToTrack(workspacePath, currentTrack, state.canvases);
  } else {
    // On main — use the standard flush
    await flush();
  }

  // 2. Load target canvases
  let newCanvases: Record<string, CanvasNode>;

  if (name === null) {
    // Switch back to main: reload from the standard tree/
    const { readWorkspace } = await import('./io.js');
    const fileMap = await readWorkspace(workspacePath);
    const { deserializeCanvas: dc } = await import('./yaml.js');
    const canvases: Record<string, CanvasNode> = {};
    for (const [relPath, content] of Object.entries(fileMap)) {
      if (!relPath.endsWith('/node.yaml')) continue;
      try {
        const canvas = dc(content);
        // relPath is like "tree/<id>/node.yaml"; _idFromPath extracts parts[1]
        const id = canvas.id || _idFromPath(relPath);
        canvases[id] = { ...canvas, id };
      } catch (err) {
        console.error(`[tracks] failed to deserialize main ${relPath}:`, err);
      }
    }
    newCanvases = canvases;
  } else {
    // Switch to a specific track
    const fileMap = await _readTrack(workspacePath, name);
    newCanvases = _canvasesFromTrackFiles(fileMap);
  }

  if (Object.keys(newCanvases).length === 0) {
    throw new Error(`[tracks] No canvases found when switching to '${name ?? 'main'}'`);
  }

  // Keep current navigation path if canvases still exist, otherwise reset
  const currentPath = state.ui.current_path.filter((id) => id in newCanvases);
  const safePath = currentPath.length > 0 ? currentPath : [Object.keys(newCanvases)[0]];

  // 3. Update store
  state.loadCanvases(newCanvases, safePath);
  state.setActiveTrack(name);

  console.info(`[tracks] Switched to '${name ?? 'main'}'`);
}

/**
 * Merge a track into main using a three-way strategy.
 *
 * Base = clean nodes in the track snapshot (they are exactly what main had at fork time).
 *
 * Rules per node ID (across both main and track canvases):
 *   - modified in track, clean in main → take track version
 *   - clean in track, modified in main → take main version
 *   - modified in both → CONFLICT
 *   - only in track → add to main
 *   - only in main → keep in main
 *
 * Returns the list of conflicts for UI resolution.
 */
export async function mergeTrack(trackName: string): Promise<MergeConflict[]> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) throw new Error('[tracks] No workspace path set');

  // Flush main state first
  await flush();

  // Read the track's snapshot
  const trackFileMap = await _readTrack(workspacePath, trackName);
  const trackCanvases = _canvasesFromTrackFiles(trackFileMap);

  const mainState = useDesignStore.getState();
  const mainCanvases = mainState.canvases;

  const conflicts: MergeConflict[] = [];

  // Collect all canvas IDs from both sides
  const allCanvasIds = new Set([
    ...Object.keys(mainCanvases),
    ...Object.keys(trackCanvases),
  ]);

  const mergedCanvases: Record<string, CanvasNode> = {};

  for (const canvasId of allCanvasIds) {
    const mainCanvas = mainCanvases[canvasId];
    const trackCanvas = trackCanvases[canvasId];

    if (!mainCanvas && trackCanvas) {
      // Canvas only exists in track → add wholesale
      mergedCanvases[canvasId] = trackCanvas;
      continue;
    }

    if (mainCanvas && !trackCanvas) {
      // Canvas only exists in main → keep
      mergedCanvases[canvasId] = mainCanvas;
      continue;
    }

    if (!mainCanvas || !trackCanvas) continue; // should not happen

    // Both have this canvas — merge at node level
    mergedCanvases[canvasId] = _mergeCanvas(mainCanvas, trackCanvas, canvasId, conflicts);
  }

  // Store conflicts for UI resolution
  mainState.setMergeConflicts(conflicts);

  if (conflicts.length === 0) {
    // No conflicts — apply merge immediately
    const path = mainState.ui.current_path;
    mainState.loadCanvases(mergedCanvases, path);
    await flush();
    console.info(`[tracks] Merged '${trackName}' into main with no conflicts`);
  } else {
    // Store merged (conflict-free) canvases in a temporary slot so we can apply
    // them once all conflicts are resolved. We'll store them as a side-channel
    // in the conflicts themselves — or more practically, trigger the UI which
    // calls applyMerge() after all resolutions.
    // For now, store pre-merged canvases and wait for resolution.
    _pendingMergeCanvases = mergedCanvases;
    console.info(`[tracks] Merge '${trackName}' has ${conflicts.length} conflict(s) — awaiting resolution`);
  }

  return conflicts;
}

// Temporary in-memory storage for pending merge state
let _pendingMergeCanvases: Record<string, CanvasNode> | null = null;

/**
 * Apply all resolved conflicts and finalize the merge.
 * Called from MergeConflictView once every conflict has a resolution.
 */
export async function applyMerge(): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) throw new Error('[tracks] No workspace path set');

  const state = useDesignStore.getState();
  const conflicts = state.merge_conflicts;
  const pending = _pendingMergeCanvases;

  if (!pending) throw new Error('[tracks] No pending merge to apply');

  // Apply each conflict resolution to the pending canvases
  for (const conflict of conflicts) {
    if (!conflict.resolution) continue;

    const canvas = pending[conflict.canvas_id];
    if (!canvas) continue;

    const chosenNode =
      conflict.resolution === 'track' ? conflict.track_version : conflict.main_version;

    // Update in components or connections
    const compIdx = canvas.components.findIndex((n) => n.id === conflict.node_id);
    if (compIdx !== -1) {
      canvas.components[compIdx] = chosenNode;
    } else {
      const connIdx = canvas.connections.findIndex((n) => n.id === conflict.node_id);
      if (connIdx !== -1) {
        canvas.connections[connIdx] = chosenNode;
      }
    }
  }

  // Commit to store and disk
  state.loadCanvases(pending, state.ui.current_path);
  state.setMergeConflicts([]);
  _pendingMergeCanvases = null;

  await flush();
  console.info('[tracks] Merge applied successfully');
}

/**
 * List all available tracks.
 */
export async function listTracks(): Promise<TrackInfo[]> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) return [];

  const result = await invoke<ListTracksResult>('list_tracks', { base: workspacePath });
  if (!result.success) {
    console.error('[tracks] list_tracks failed:', result.error);
    return [];
  }

  const infos: TrackInfo[] = [];
  for (const trackName of result.tracks) {
    try {
      const fileMap = await _readTrack(workspacePath, trackName);
      const yamlStr = fileMap['track.yaml'];
      if (yamlStr) {
        const info = await _parseTrackYaml(yamlStr, trackName);
        infos.push(info);
      } else {
        infos.push({
          name: trackName,
          forked_from: 0,
          forked_at: new Date().toISOString(),
          status: 'active',
        });
      }
    } catch (err) {
      console.error(`[tracks] Failed to read track '${trackName}':`, err);
    }
  }

  return infos;
}

// ─── Internal canvas merge ────────────────────────────────────────────────────

function _mergeCanvas(
  main: CanvasNode,
  track: CanvasNode,
  canvasId: string,
  conflicts: MergeConflict[]
): CanvasNode {
  const merged: CanvasNode = { ...main };
  merged.components = _mergeNodeList(main.components, track.components, canvasId, conflicts);
  merged.connections = _mergeNodeList(main.connections, track.connections, canvasId, conflicts);
  return merged;
}

function _mergeNodeList(
  mainNodes: DesignNode[],
  trackNodes: DesignNode[],
  canvasId: string,
  conflicts: MergeConflict[]
): DesignNode[] {
  const mainById = new Map(mainNodes.map((n) => [n.id, n]));
  const trackById = new Map(trackNodes.map((n) => [n.id, n]));

  const allIds = new Set([...mainById.keys(), ...trackById.keys()]);
  const result: DesignNode[] = [];

  for (const id of allIds) {
    const mainNode = mainById.get(id);
    const trackNode = trackById.get(id);

    if (mainNode && !trackNode) {
      // Only in main → keep
      result.push(mainNode);
    } else if (!mainNode && trackNode) {
      // Only in track → add
      result.push(trackNode);
    } else if (mainNode && trackNode) {
      const mainModified = mainNode.status !== 'clean';
      const trackModified = trackNode.status !== 'clean';

      if (trackModified && !mainModified) {
        // Track changed it, main didn't → take track
        result.push(trackNode);
      } else if (!trackModified && mainModified) {
        // Main changed it, track didn't → take main
        result.push(mainNode);
      } else if (trackModified && mainModified) {
        // Both changed → conflict
        conflicts.push({
          node_id: id,
          canvas_id: canvasId,
          main_version: mainNode,
          track_version: trackNode,
        });
        // Temporarily keep main version in merged canvas; will be overwritten on applyMerge
        result.push(mainNode);
      } else {
        // Both clean → take main (equivalent)
        result.push(mainNode);
      }
    }
  }

  return result;
}

// ─── Internal: save current canvases back to a track snapshot ─────────────────

async function _saveCurrentToTrack(
  workspacePath: string,
  trackName: string,
  canvases: Record<string, CanvasNode>
): Promise<void> {
  const treeFiles = _canvasesToTrackFiles(canvases, trackName);
  await _writeFiles(workspacePath, treeFiles);
}
