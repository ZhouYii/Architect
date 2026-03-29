/**
 * architect query nodes / contracts / diff
 */

import { loadWorkspaceCli, getDeltaCli, queryNodesCli, queryContractsCli } from '../workspace.js';
import { output, type OutputFormat } from '../output.js';

// Normalized node type (canvas_id always present from getDeltaCli/queryNodesCli)
type NormalizedNode = {
  id: string;
  kind?: string;
  name?: string;
  label?: string;
  status?: string;
  canvas_id?: string;
  [key: string]: unknown;
};

function getLabel(n: NormalizedNode): string {
  return n.name ?? n.label ?? '';
}

function renderTable(items: NormalizedNode[]): void {
  const idW = items.reduce((m, n) => Math.max(m, (n.id ?? '').length), 2);
  const nameW = items.reduce((m, n) => Math.max(m, getLabel(n).length), 4);
  const cvW = items.reduce((m, n) => Math.max(m, (n.canvas_id ?? '').length), 6);

  console.log(
    `${'ID'.padEnd(idW)}  ${'CANVAS'.padEnd(cvW)}  ${'KIND'.padEnd(5)}  ${'STATUS'.padEnd(12)}  NAME`
  );
  console.log(
    `${'-'.repeat(idW)}  ${'-'.repeat(cvW)}  -----  ------------  ${'-'.repeat(nameW)}`
  );
  for (const n of items) {
    console.log(
      `${(n.id ?? '').padEnd(idW)}  ${(n.canvas_id ?? '').padEnd(cvW)}  ${(n.kind ?? '?').padEnd(5)}  ${(n.status ?? '?').padEnd(12)}  ${getLabel(n)}`
    );
  }
}

export function runQueryNodes(
  basePath: string,
  format: OutputFormat,
  statusFilter?: string
): void {
  const ws = loadWorkspaceCli(basePath);
  const nodes = queryNodesCli(ws.canvases, statusFilter) as NormalizedNode[];

  if (format === 'json') {
    output(nodes, format);
    return;
  }

  if (nodes.length === 0) {
    console.log(
      statusFilter ? `No nodes with status '${statusFilter}'` : 'No nodes found'
    );
    return;
  }

  renderTable(nodes);
}

export function runQueryContracts(basePath: string, format: OutputFormat): void {
  const ws = loadWorkspaceCli(basePath);
  const contracts = queryContractsCli(ws.canvases);

  if (format === 'json') {
    output(contracts, format);
    return;
  }

  if (contracts.length === 0) {
    console.log('No contracts defined');
    return;
  }

  for (const c of contracts) {
    const invCount = c.invariants.length;
    const tcCount = c.test_cases.length;
    console.log(`${c.canvas_id} / ${c.node_id}  "${c.node_name}"`);
    console.log(`  Invariants: ${invCount}  Test cases: ${tcCount}`);
  }
}

export function runQueryDiff(basePath: string, format: OutputFormat): void {
  const ws = loadWorkspaceCli(basePath);
  const delta = getDeltaCli(ws.canvases) as NormalizedNode[];

  if (format === 'json') {
    output(delta, format);
    return;
  }

  if (delta.length === 0) {
    console.log('No changes since last version cut (workspace is clean)');
    return;
  }

  renderTable(delta);
  console.log(`\n${delta.length} dirty node(s)`);
}
