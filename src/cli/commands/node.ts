/**
 * architect node add / modify / remove / accept / dismiss / ready
 */

import fs from 'fs';
import path from 'path';
import * as YAML from 'yaml';
import { loadWorkspaceCli } from '../workspace.js';
import { output, type OutputFormat } from '../output.js';
import type { DesignNode, CanvasNode } from '../../modules/store/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function canvasFilePath(basePath: string, canvasPath: string): string {
  const dirName = canvasPath.replace(/[/\\]/g, '_');
  return path.join(basePath, '.architect', 'tree', dirName, 'node.yaml');
}

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

function readCanvas(filePath: string): CanvasNode {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return fromSnake(YAML.parse(raw) as PlainObject) as unknown as CanvasNode;
}

function writeCanvas(filePath: string, canvas: CanvasNode): void {
  const plain = toSnake(canvas as unknown as PlainObject);
  fs.writeFileSync(filePath, YAML.stringify(plain, { lineWidth: 0 }));
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export function runNodeAdd(
  basePath: string,
  format: OutputFormat,
  canvasPath: string,
  nodeId: string,
  yamlInput: string
): void {
  const filePath = canvasFilePath(basePath, canvasPath);
  if (!fs.existsSync(filePath)) {
    console.error(`Canvas '${canvasPath}' not found at ${filePath}`);
    process.exit(1);
  }

  let nodeData: Partial<DesignNode>;
  try {
    nodeData = YAML.parse(yamlInput) as Partial<DesignNode>;
  } catch (err) {
    console.error(`Invalid YAML for node: ${String(err)}`);
    process.exit(1);
  }

  const canvas = readCanvas(filePath);
  const existing = (canvas.components ?? []).find((n) => n.id === nodeId);
  if (existing) {
    console.error(`Node '${nodeId}' already exists in canvas '${canvasPath}'`);
    process.exit(1);
  }

  const node: DesignNode = {
    id: nodeId,
    kind: 'block',
    name: nodeData.name ?? nodeId,
    status: nodeData.status ?? 'proposed',
    ...nodeData,
  };

  canvas.components = [...(canvas.components ?? []), node];
  writeCanvas(filePath, canvas);

  const data = { canvas: canvasPath, node_id: nodeId, action: 'added' };
  if (format === 'json') {
    output(data, format);
    return;
  }
  console.log(`Added node '${nodeId}' to canvas '${canvasPath}'`);
}

export function runNodeModify(
  basePath: string,
  format: OutputFormat,
  canvasPath: string,
  nodeId: string,
  yamlInput: string
): void {
  const filePath = canvasFilePath(basePath, canvasPath);
  if (!fs.existsSync(filePath)) {
    console.error(`Canvas '${canvasPath}' not found`);
    process.exit(1);
  }

  let updates: Partial<DesignNode>;
  try {
    updates = YAML.parse(yamlInput) as Partial<DesignNode>;
  } catch (err) {
    console.error(`Invalid YAML: ${String(err)}`);
    process.exit(1);
  }

  const canvas = readCanvas(filePath);
  const idx = (canvas.components ?? []).findIndex((n) => n.id === nodeId);
  if (idx === -1) {
    // Try connections
    const ci = (canvas.connections ?? []).findIndex((n) => n.id === nodeId);
    if (ci === -1) {
      console.error(`Node '${nodeId}' not found in canvas '${canvasPath}'`);
      process.exit(1);
    }
    canvas.connections[ci] = { ...canvas.connections[ci], ...updates, id: nodeId };
  } else {
    canvas.components[idx] = { ...canvas.components[idx], ...updates, id: nodeId };
  }

  writeCanvas(filePath, canvas);

  const data = { canvas: canvasPath, node_id: nodeId, action: 'modified' };
  if (format === 'json') {
    output(data, format);
    return;
  }
  console.log(`Modified node '${nodeId}' in canvas '${canvasPath}'`);
}

export function runNodeRemove(
  basePath: string,
  format: OutputFormat,
  canvasPath: string,
  nodeId: string
): void {
  const filePath = canvasFilePath(basePath, canvasPath);
  if (!fs.existsSync(filePath)) {
    console.error(`Canvas '${canvasPath}' not found`);
    process.exit(1);
  }

  const canvas = readCanvas(filePath);
  const before =
    (canvas.components?.length ?? 0) + (canvas.connections?.length ?? 0);
  canvas.components = (canvas.components ?? []).filter((n) => n.id !== nodeId);
  canvas.connections = (canvas.connections ?? []).filter((n) => n.id !== nodeId);
  const after =
    (canvas.components?.length ?? 0) + (canvas.connections?.length ?? 0);

  if (before === after) {
    console.error(`Node '${nodeId}' not found in canvas '${canvasPath}'`);
    process.exit(1);
  }

  writeCanvas(filePath, canvas);

  const data = { canvas: canvasPath, node_id: nodeId, action: 'removed' };
  if (format === 'json') {
    output(data, format);
    return;
  }
  console.log(`Removed node '${nodeId}' from canvas '${canvasPath}'`);
}

function _setNodeStatus(
  basePath: string,
  format: OutputFormat,
  canvasPath: string,
  nodeId: string,
  newStatus: DesignNode['status'],
  actionLabel: string
): void {
  const filePath = canvasFilePath(basePath, canvasPath);
  if (!fs.existsSync(filePath)) {
    console.error(`Canvas '${canvasPath}' not found`);
    process.exit(1);
  }

  const canvas = readCanvas(filePath);

  let found = false;
  for (const arr of [canvas.components ?? [], canvas.connections ?? []]) {
    const idx = arr.findIndex((n) => n.id === nodeId);
    if (idx !== -1) {
      arr[idx] = { ...arr[idx], status: newStatus };
      found = true;
      break;
    }
  }

  if (!found) {
    console.error(`Node '${nodeId}' not found in canvas '${canvasPath}'`);
    process.exit(1);
  }

  writeCanvas(filePath, canvas);

  const data = { canvas: canvasPath, node_id: nodeId, action: actionLabel, status: newStatus };
  if (format === 'json') {
    output(data, format);
    return;
  }
  console.log(`Node '${nodeId}' ${actionLabel} (status: ${newStatus})`);
}

export function runNodeAccept(
  basePath: string,
  format: OutputFormat,
  canvasPath: string,
  nodeId: string
): void {
  _setNodeStatus(basePath, format, canvasPath, nodeId, 'clean', 'accepted');
}

export function runNodeDismiss(
  basePath: string,
  format: OutputFormat,
  canvasPath: string,
  nodeId: string
): void {
  _setNodeStatus(basePath, format, canvasPath, nodeId, 'dismissed', 'dismissed');
}

export function runNodeReady(
  basePath: string,
  format: OutputFormat,
  canvasPath: string,
  nodeId: string
): void {
  _setNodeStatus(basePath, format, canvasPath, nodeId, 'ready', 'marked ready');
}

export function runNodeList(
  basePath: string,
  format: OutputFormat,
  canvasPath: string
): void {
  const ws = loadWorkspaceCli(basePath);
  const canvas = ws.canvases[canvasPath];
  if (!canvas) {
    console.error(`Canvas '${canvasPath}' not found`);
    process.exit(1);
  }

  const nodes = [
    ...(canvas.components ?? []).map((n) => ({ ...n, kind: 'block' as const })),
    ...(canvas.connections ?? []).map((n) => ({ ...n, kind: 'arrow' as const })),
  ];

  if (format === 'json') {
    output(nodes, format);
    return;
  }

  if (nodes.length === 0) {
    console.log(`No nodes in canvas '${canvasPath}'`);
    return;
  }

  const idW = nodes.reduce((m, n) => Math.max(m, n.id.length), 2);
  const nameW = nodes.reduce((m, n) => Math.max(m, (n.name ?? '').length), 4);
  console.log(
    `${'ID'.padEnd(idW)}  ${'KIND'.padEnd(5)}  ${'STATUS'.padEnd(12)}  ${'NAME'.padEnd(nameW)}`
  );
  console.log(`${'-'.repeat(idW)}  -----  ${'------------'}  ${'-'.repeat(nameW)}`);
  for (const n of nodes) {
    console.log(
      `${n.id.padEnd(idW)}  ${n.kind.padEnd(5)}  ${n.status.padEnd(12)}  ${(n.name ?? '').padEnd(nameW)}`
    );
  }
}
