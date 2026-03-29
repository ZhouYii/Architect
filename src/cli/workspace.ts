/**
 * CLI workspace I/O — pure Node.js fs, no Tauri IPC.
 *
 * Reads `.architect/` relative to the given base path and returns the same
 * file-map shape that the Tauri backend would produce.
 */

import fs from 'fs';
import path from 'path';
import * as YAML from 'yaml';
import type {
  CanvasNode,
  DesignNode,
  WorkspaceConfig,
  TrackInfo,
} from '../modules/store/types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkspaceData {
  config: WorkspaceConfig;
  canvases: Record<string, CanvasNode>;
  currentPath: string[];
  tracks: TrackInfo[];
}

export interface ChangesetFile {
  id: string;
  description: string;
  status: string;
  timestamp: string;
  changes: unknown[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Walk a directory recursively, returning all file paths. */
function walkDir(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

/** Read all files under `.architect/` and return relative-path → content map. */
function readArchitectDir(basePath: string): Record<string, string> {
  const archDir = path.join(basePath, '.architect');
  if (!fs.existsSync(archDir)) {
    throw new Error(`No .architect/ directory found at: ${basePath}`);
  }

  const map: Record<string, string> = {};
  for (const absPath of walkDir(archDir)) {
    const rel = path.relative(archDir, absPath).replace(/\\/g, '/');
    try {
      map[rel] = fs.readFileSync(absPath, 'utf-8');
    } catch {
      // skip unreadable files
    }
  }
  return map;
}

// ─── camelCase / snake_case helpers (mirror workspace/yaml.ts) ────────────────

type PlainObject = Record<string, unknown>;

function fromSnake(obj: PlainObject): PlainObject {
  const out: PlainObject = {};
  for (const [k, v] of Object.entries(obj)) {
    const camelKey = k === 'interfaces_content' ? 'interfacesContent' : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[camelKey] = fromSnake(v as PlainObject);
    } else if (Array.isArray(v)) {
      out[camelKey] = (v as unknown[]).map((item) =>
        item !== null && typeof item === 'object' ? fromSnake(item as PlainObject) : item
      );
    } else {
      out[camelKey] = v;
    }
  }
  return out;
}

function deserializeCanvas(yamlStr: string): CanvasNode {
  const raw = YAML.parse(yamlStr) as PlainObject;
  return fromSnake(raw) as unknown as CanvasNode;
}

function idFromPath(relPath: string): string {
  const parts = relPath.split('/');
  return parts[1] ?? 'root';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load workspace data from `basePath/.architect/`.
 * Returns canvases, config, and navigation path.
 */
export function loadWorkspaceCli(basePath: string): WorkspaceData {
  const fileMap = readArchitectDir(basePath);

  // Workspace config
  const configRaw = fileMap['workspace.yaml'];
  if (!configRaw) {
    throw new Error('workspace.yaml not found — is this an Architect workspace?');
  }
  const config = YAML.parse(configRaw) as WorkspaceConfig;

  // Canvases
  const canvases: Record<string, CanvasNode> = {};
  for (const [relPath, content] of Object.entries(fileMap)) {
    if (!relPath.startsWith('tree/') || !relPath.endsWith('/node.yaml')) continue;
    try {
      const canvas = deserializeCanvas(content);
      const id = (canvas.id as string | undefined) || idFromPath(relPath);
      canvases[id] = { ...canvas, id };
    } catch {
      // skip malformed canvas files
    }
  }

  // Navigation path
  let currentPath: string[] = [config.root_canvas_id ?? Object.keys(canvases)[0] ?? 'root'];
  const stateRaw = fileMap['workspace.state.yaml'];
  if (stateRaw) {
    try {
      const stateObj = YAML.parse(stateRaw) as { current_path?: string[] };
      if (Array.isArray(stateObj.current_path) && stateObj.current_path.length > 0) {
        const valid = stateObj.current_path.every((id) => id in canvases);
        if (valid) currentPath = stateObj.current_path;
      }
    } catch {
      // ignore, fall back to default
    }
  }

  // Tracks
  const tracks = loadTracksCli(basePath, fileMap);

  return { config, canvases, currentPath, tracks };
}

function loadTracksCli(
  _basePath: string,
  fileMap: Record<string, string>
): TrackInfo[] {
  const tracks: TrackInfo[] = [];
  const seen = new Set<string>();

  for (const relPath of Object.keys(fileMap)) {
    // Keys like "tracks/<name>/track.yaml"
    if (!relPath.startsWith('tracks/') || !relPath.endsWith('/track.yaml')) continue;
    const parts = relPath.split('/');
    const trackName = parts[1];
    if (!trackName || seen.has(trackName)) continue;
    seen.add(trackName);

    try {
      const raw = YAML.parse(fileMap[relPath]) as Partial<TrackInfo>;
      tracks.push({
        name: raw.name ?? trackName,
        forked_from: raw.forked_from ?? 0,
        forked_at: raw.forked_at ?? new Date().toISOString(),
        status: raw.status ?? 'active',
        description: raw.description,
      });
    } catch {
      tracks.push({
        name: trackName,
        forked_from: 0,
        forked_at: new Date().toISOString(),
        status: 'active',
      });
    }
  }
  return tracks;
}

/**
 * List all changeset files from `.architect/changes/`.
 * Returns an array of parsed changeset objects with their status subfolder.
 */
export function loadChangesetsCli(basePath: string): Array<ChangesetFile & { folder: string }> {
  const changesDir = path.join(basePath, '.architect', 'changes');
  if (!fs.existsSync(changesDir)) return [];

  const results: Array<ChangesetFile & { folder: string }> = [];
  for (const folder of ['pending', 'accepted', 'dismissed']) {
    const subDir = path.join(changesDir, folder);
    if (!fs.existsSync(subDir)) continue;
    for (const entry of fs.readdirSync(subDir)) {
      if (!entry.endsWith('.yaml')) continue;
      try {
        const raw = fs.readFileSync(path.join(subDir, entry), 'utf-8');
        const parsed = YAML.parse(raw) as ChangesetFile;
        results.push({ ...parsed, folder });
      } catch {
        // skip malformed
      }
    }
  }
  return results;
}

type RawNode = DesignNode & { canvas_id?: string; label?: string };

/** Normalize a raw node from disk — fills in `status` and `kind` when missing. */
function normalizeNode(node: Record<string, unknown>, kind: 'block' | 'arrow'): DesignNode {
  return {
    id: String(node['id'] ?? ''),
    kind: (node['kind'] as DesignNode['kind'] | undefined) ?? kind,
    name: String(node['name'] ?? node['label'] ?? ''),
    status: (node['status'] as DesignNode['status'] | undefined) ?? 'clean',
    ...node,
  } as DesignNode;
}

/**
 * Compute delta: all DesignNodes across all canvases where status !== 'clean'.
 */
export function getDeltaCli(
  canvases: Record<string, CanvasNode>
): Array<RawNode> {
  const dirty: Array<RawNode> = [];
  for (const [canvasId, canvas] of Object.entries(canvases)) {
    for (const rawNode of canvas.components ?? []) {
      const node = normalizeNode(rawNode as unknown as Record<string, unknown>, 'block');
      if (node.status !== 'clean') dirty.push({ ...node, canvas_id: canvasId });
    }
    for (const rawArrow of canvas.connections ?? []) {
      const arrow = normalizeNode(rawArrow as unknown as Record<string, unknown>, 'arrow');
      if (arrow.status !== 'clean') dirty.push({ ...arrow, canvas_id: canvasId });
    }
  }
  return dirty;
}

/**
 * Query all DesignNodes across all canvases, optionally filtered by status.
 */
export function queryNodesCli(
  canvases: Record<string, CanvasNode>,
  statusFilter?: string
): Array<RawNode> {
  const all: Array<RawNode> = [];
  for (const [canvasId, canvas] of Object.entries(canvases)) {
    for (const rawNode of canvas.components ?? []) {
      const node = normalizeNode(rawNode as unknown as Record<string, unknown>, 'block');
      if (!statusFilter || node.status === statusFilter) {
        all.push({ ...node, canvas_id: canvasId });
      }
    }
    for (const rawArrow of canvas.connections ?? []) {
      const arrow = normalizeNode(rawArrow as unknown as Record<string, unknown>, 'arrow');
      if (!statusFilter || arrow.status === statusFilter) {
        all.push({ ...arrow, canvas_id: canvasId });
      }
    }
  }
  return all;
}

/**
 * Query contracts from all canvases.
 */
export function queryContractsCli(
  canvases: Record<string, CanvasNode>
): Array<{ canvas_id: string; node_id: string; node_name: string; invariants: unknown[]; test_cases: unknown[] }> {
  const results = [];
  for (const [canvasId, canvas] of Object.entries(canvases)) {
    for (const node of canvas.components ?? []) {
      const rawNode = node as unknown as Record<string, unknown>;
      if (node.contract) {
        results.push({
          canvas_id: canvasId,
          node_id: node.id,
          node_name: node.name ?? (rawNode['label'] as string | undefined) ?? node.id,
          invariants: node.contract.invariants ?? [],
          test_cases: node.contract.test_cases ?? [],
        });
      }
    }
  }
  return results;
}
