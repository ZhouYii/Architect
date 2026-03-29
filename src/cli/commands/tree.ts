/**
 * architect tree show / tree list — canvas hierarchy.
 */

import { loadWorkspaceCli } from '../workspace.js';
import { output, type OutputFormat } from '../output.js';
import type { CanvasNode } from '../../modules/store/types.js';

interface TreeNode {
  id: string;
  label: string;
  depth: number;
  block_count: number;
  arrow_count: number;
  children: TreeNode[];
}

function buildTree(
  canvasId: string,
  canvases: Record<string, CanvasNode>,
  depth: number,
  maxDepth: number | undefined,
  visited: Set<string>
): TreeNode | null {
  if (visited.has(canvasId)) return null;
  if (maxDepth !== undefined && depth > maxDepth) return null;
  visited.add(canvasId);

  const canvas = canvases[canvasId];
  if (!canvas) return null;

  const children: TreeNode[] = [];
  for (const block of canvas.components ?? []) {
    if (block.has_children && block.child_canvas_id) {
      const child = buildTree(block.child_canvas_id, canvases, depth + 1, maxDepth, visited);
      if (child) children.push(child);
    }
  }

  return {
    id: canvasId,
    label: canvas.label ?? canvasId,
    depth,
    block_count: canvas.components?.length ?? 0,
    arrow_count: canvas.connections?.length ?? 0,
    children,
  };
}

function printTree(node: TreeNode, indent = ''): void {
  const prefix = indent === '' ? '' : `${indent}`;
  const counts = `(${node.block_count}B ${node.arrow_count}A)`;
  console.log(`${prefix}${node.label} [${node.id}] ${counts}`);
  for (let i = 0; i < node.children.length; i++) {
    const isLast = i === node.children.length - 1;
    const childIndent = indent + (isLast ? '    ' : '│   ');
    const childPrefix = indent + (isLast ? '└── ' : '├── ');
    const child = node.children[i];
    const childCounts = `(${child.block_count}B ${child.arrow_count}A)`;
    console.log(`${childPrefix}${child.label} [${child.id}] ${childCounts}`);
    for (let j = 0; j < child.children.length; j++) {
      printTree(child.children[j], childIndent);
    }
  }
}

export function runTreeShow(
  basePath: string,
  format: OutputFormat,
  canvasPath?: string
): void {
  const ws = loadWorkspaceCli(basePath);
  const startId = canvasPath ?? ws.config.root_canvas_id ?? Object.keys(ws.canvases)[0] ?? 'root';

  const visited = new Set<string>();
  const tree = buildTree(startId, ws.canvases, 0, undefined, visited);

  if (!tree) {
    console.error(`Canvas '${startId}' not found`);
    process.exit(1);
  }

  if (format === 'json') {
    output(tree, format);
    return;
  }

  printTree(tree);
}

export function runTreeList(
  basePath: string,
  format: OutputFormat,
  maxDepth?: number
): void {
  const ws = loadWorkspaceCli(basePath);
  const rootId = ws.config.root_canvas_id ?? Object.keys(ws.canvases)[0] ?? 'root';

  const visited = new Set<string>();
  const tree = buildTree(rootId, ws.canvases, 0, maxDepth, visited);

  // Flatten the tree to a list
  function flatten(node: TreeNode): TreeNode[] {
    return [node, ...node.children.flatMap(flatten)];
  }

  const flat = tree ? flatten(tree) : [];

  if (format === 'json') {
    output(flat.map((n) => ({
      id: n.id,
      label: n.label,
      depth: n.depth,
      block_count: n.block_count,
      arrow_count: n.arrow_count,
    })), format);
    return;
  }

  const width = flat.reduce((m, n) => Math.max(m, n.id.length), 2);
  console.log(`${'ID'.padEnd(width)}  DEPTH  BLOCKS  ARROWS  LABEL`);
  console.log(`${'-'.repeat(width)}  -----  ------  ------  -----`);
  for (const node of flat) {
    const indent = '  '.repeat(node.depth);
    console.log(
      `${node.id.padEnd(width)}  ${String(node.depth).padStart(5)}  ${String(node.block_count).padStart(6)}  ${String(node.arrow_count).padStart(6)}  ${indent}${node.label}`
    );
  }
}
