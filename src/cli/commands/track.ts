/**
 * architect track create / switch / list / merge
 *
 * Tracks are stored under .architect/tracks/<name>/
 *   track.yaml     — metadata
 *   tree/<id>/node.yaml  — canvas snapshot at fork time
 */

import fs from 'fs';
import path from 'path';
import * as YAML from 'yaml';
import { loadWorkspaceCli } from '../workspace.js';
import { output, type OutputFormat } from '../output.js';
import type { TrackInfo, CanvasNode, DesignNode } from '../../modules/store/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type PlainObject = Record<string, unknown>;

function toSnake(obj: PlainObject): PlainObject {
  const out: PlainObject = {};
  for (const [k, v] of Object.entries(obj)) {
    const snakeKey = k === 'interfacesContent' ? 'interfaces_content' : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[snakeKey] = toSnake(v as PlainObject);
    } else if (Array.isArray(v)) {
      out[snakeKey] = (v as unknown[]).map((item) =>
        item !== null && typeof item === 'object' ? toSnake(item as PlainObject) : item
      );
    } else {
      out[snakeKey] = v;
    }
  }
  return out;
}

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

function snapshotCanvasesToTrack(
  canvases: Record<string, CanvasNode>,
  trackDir: string
): void {
  for (const [canvasId, canvas] of Object.entries(canvases)) {
    const dirName = canvasId.replace(/[/\\]/g, '_');
    const canvasDir = path.join(trackDir, 'tree', dirName);
    fs.mkdirSync(canvasDir, { recursive: true });
    const plain = toSnake(canvas as unknown as PlainObject);
    fs.writeFileSync(
      path.join(canvasDir, 'node.yaml'),
      YAML.stringify(plain, { lineWidth: 0 })
    );
  }
}

function loadTrackCanvases(trackDir: string): Record<string, CanvasNode> {
  const treeDir = path.join(trackDir, 'tree');
  const canvases: Record<string, CanvasNode> = {};
  if (!fs.existsSync(treeDir)) return canvases;

  for (const dirEntry of fs.readdirSync(treeDir, { withFileTypes: true })) {
    if (!dirEntry.isDirectory()) continue;
    const nodeFile = path.join(treeDir, dirEntry.name, 'node.yaml');
    if (!fs.existsSync(nodeFile)) continue;
    try {
      const raw = YAML.parse(fs.readFileSync(nodeFile, 'utf-8')) as PlainObject;
      const canvas = fromSnake(raw) as unknown as CanvasNode;
      const id = (canvas.id as string | undefined) ?? dirEntry.name;
      canvases[id] = { ...canvas, id };
    } catch {
      // skip
    }
  }
  return canvases;
}

function buildTrackYaml(info: TrackInfo): string {
  const obj: Record<string, unknown> = {
    name: info.name,
    forked_from: info.forked_from,
    forked_at: info.forked_at,
    status: info.status,
  };
  if (info.description) obj['description'] = info.description;
  return YAML.stringify(obj, { lineWidth: 0 });
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export function runTrackCreate(
  basePath: string,
  format: OutputFormat,
  name: string
): void {
  const trackDir = path.join(basePath, '.architect', 'tracks', name);
  if (fs.existsSync(trackDir)) {
    console.error(`Track '${name}' already exists`);
    process.exit(1);
  }

  const ws = loadWorkspaceCli(basePath);
  const currentMajor = parseInt(
    (ws.config.version ?? '1.0').split('.')[0] ?? '1',
    10
  );

  const info: TrackInfo = {
    name,
    forked_from: currentMajor,
    forked_at: new Date().toISOString(),
    status: 'active',
  };

  fs.mkdirSync(trackDir, { recursive: true });
  fs.writeFileSync(path.join(trackDir, 'track.yaml'), buildTrackYaml(info));
  snapshotCanvasesToTrack(ws.canvases, trackDir);

  const data = { name, forked_from: currentMajor, status: 'active' };
  if (format === 'json') {
    output(data, format);
    return;
  }
  console.log(`Created track '${name}' (forked from v${currentMajor})`);
}

export function runTrackSwitch(
  basePath: string,
  format: OutputFormat,
  name: string
): void {
  const trackDir = path.join(basePath, '.architect', 'tracks', name);
  if (!fs.existsSync(trackDir)) {
    console.error(`Track '${name}' not found`);
    process.exit(1);
  }

  // Load track canvases and write them to the main tree/
  const trackCanvases = loadTrackCanvases(trackDir);
  if (Object.keys(trackCanvases).length === 0) {
    console.error(`Track '${name}' has no canvases`);
    process.exit(1);
  }

  const treeDir = path.join(basePath, '.architect', 'tree');
  for (const [canvasId, canvas] of Object.entries(trackCanvases)) {
    const dirName = canvasId.replace(/[/\\]/g, '_');
    const canvasDir = path.join(treeDir, dirName);
    fs.mkdirSync(canvasDir, { recursive: true });
    const plain = toSnake(canvas as unknown as PlainObject);
    fs.writeFileSync(
      path.join(canvasDir, 'node.yaml'),
      YAML.stringify(plain, { lineWidth: 0 })
    );
  }

  // Update workspace.state.yaml to record active track
  const stateFile = path.join(basePath, '.architect', 'workspace.state.yaml');
  let stateObj: Record<string, unknown> = {};
  if (fs.existsSync(stateFile)) {
    try {
      stateObj = YAML.parse(fs.readFileSync(stateFile, 'utf-8')) as Record<string, unknown>;
    } catch {
      // ignore
    }
  }
  stateObj['active_track'] = name;
  fs.writeFileSync(stateFile, YAML.stringify(stateObj, { lineWidth: 0 }));

  const data = { switched_to: name, canvas_count: Object.keys(trackCanvases).length };
  if (format === 'json') {
    output(data, format);
    return;
  }
  console.log(`Switched to track '${name}' (${data.canvas_count} canvases loaded)`);
}

export function runTrackList(basePath: string, format: OutputFormat): void {
  const ws = loadWorkspaceCli(basePath);
  const tracks = ws.tracks;

  if (format === 'json') {
    output(tracks, format);
    return;
  }

  if (tracks.length === 0) {
    console.log('No tracks found');
    return;
  }

  const nameW = tracks.reduce((m, t) => Math.max(m, t.name.length), 4);
  console.log(`${'NAME'.padEnd(nameW)}  ${'STATUS'.padEnd(8)}  FORKED_FROM  FORKED_AT`);
  console.log(`${'-'.repeat(nameW)}  --------  -----------  ---------`);
  for (const t of tracks) {
    const forkedAt = t.forked_at.slice(0, 10);
    console.log(
      `${t.name.padEnd(nameW)}  ${t.status.padEnd(8)}  v${String(t.forked_from).padStart(10)}  ${forkedAt}`
    );
  }
}

export function runTrackMerge(
  basePath: string,
  format: OutputFormat,
  name: string
): void {
  const trackDir = path.join(basePath, '.architect', 'tracks', name);
  if (!fs.existsSync(trackDir)) {
    console.error(`Track '${name}' not found`);
    process.exit(1);
  }

  const ws = loadWorkspaceCli(basePath);
  const trackCanvases = loadTrackCanvases(trackDir);
  const mainCanvases = ws.canvases;

  // Three-way merge: same logic as tracks.ts in the GUI
  const conflicts: string[] = [];
  const merged: Record<string, CanvasNode> = { ...mainCanvases };

  const allCanvasIds = new Set([
    ...Object.keys(mainCanvases),
    ...Object.keys(trackCanvases),
  ]);

  for (const canvasId of allCanvasIds) {
    const mainCanvas = mainCanvases[canvasId];
    const trackCanvas = trackCanvases[canvasId];

    if (!mainCanvas && trackCanvas) {
      merged[canvasId] = trackCanvas;
      continue;
    }
    if (!trackCanvas) continue; // only in main → keep

    // Merge at node level
    const mainById = new Map(
      [...(mainCanvas?.components ?? []), ...(mainCanvas?.connections ?? [])].map((n) => [n.id, n])
    );
    const trackById = new Map(
      [...(trackCanvas.components ?? []), ...(trackCanvas.connections ?? [])].map((n) => [n.id, n])
    );

    const allIds = new Set([...mainById.keys(), ...trackById.keys()]);
    const mergedComponents: DesignNode[] = [];
    const mergedConnections: DesignNode[] = [];

    for (const nid of allIds) {
      const mn = mainById.get(nid);
      const tn = trackById.get(nid);

      if (mn && !tn) {
        (mn.kind === 'block' ? mergedComponents : mergedConnections).push(mn);
      } else if (!mn && tn) {
        (tn.kind === 'block' ? mergedComponents : mergedConnections).push(tn);
      } else if (mn && tn) {
        const mainMod = mn.status !== 'clean';
        const trackMod = tn.status !== 'clean';
        if (trackMod && !mainMod) {
          (tn.kind === 'block' ? mergedComponents : mergedConnections).push(tn);
        } else if (trackMod && mainMod) {
          conflicts.push(`${canvasId}::${nid}`);
          (mn.kind === 'block' ? mergedComponents : mergedConnections).push(mn);
        } else {
          (mn.kind === 'block' ? mergedComponents : mergedConnections).push(mn);
        }
      }
    }

    if (mainCanvas) {
      merged[canvasId] = {
        ...mainCanvas,
        components: mergedComponents,
        connections: mergedConnections,
      };
    }
  }

  if (conflicts.length > 0) {
    console.error(`Merge has ${conflicts.length} conflict(s) — resolve manually:`);
    for (const c of conflicts) console.error(`  ${c}`);
    if (format === 'json') {
      output({ merged: false, conflicts }, format);
    }
    process.exit(1);
  }

  // Write merged canvases back to tree/
  const treeDir = path.join(basePath, '.architect', 'tree');
  for (const [canvasId, canvas] of Object.entries(merged)) {
    const dirName = canvasId.replace(/[/\\]/g, '_');
    const nodeFile = path.join(treeDir, dirName, 'node.yaml');
    fs.mkdirSync(path.dirname(nodeFile), { recursive: true });
    const plain = toSnake(canvas as unknown as PlainObject);
    fs.writeFileSync(nodeFile, YAML.stringify(plain, { lineWidth: 0 }));
  }

  // Mark track as merged
  const trackYamlPath = path.join(trackDir, 'track.yaml');
  if (fs.existsSync(trackYamlPath)) {
    try {
      const t = YAML.parse(fs.readFileSync(trackYamlPath, 'utf-8')) as Record<string, unknown>;
      t['status'] = 'merged';
      fs.writeFileSync(trackYamlPath, YAML.stringify(t, { lineWidth: 0 }));
    } catch {
      // ignore
    }
  }

  const data = { merged: true, track: name, canvas_count: Object.keys(merged).length };
  if (format === 'json') {
    output(data, format);
    return;
  }
  console.log(`Merged track '${name}' → main (${data.canvas_count} canvases)`);
}
