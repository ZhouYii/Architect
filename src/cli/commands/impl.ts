/**
 * architect impl plan / start / status / pause / resume / stop / log
 *
 * Reads from .architect/impl/status.json (written by the orchestrator).
 * For v1, plan/start/pause/resume/stop are stubs that acknowledge the command.
 */

import fs from 'fs';
import path from 'path';
import { output, type OutputFormat } from '../output.js';
import type { ImplStatusFile, ImplTask } from '../../modules/store/types.js';

function implStatusPath(basePath: string): string {
  return path.join(basePath, '.architect', 'impl', 'status.json');
}

function loadImplStatus(basePath: string): ImplStatusFile | null {
  const p = implStatusPath(basePath);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as ImplStatusFile;
  } catch {
    return null;
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export function runImplPlan(
  _basePath: string,
  format: OutputFormat,
  _fromVersion?: string,
  _toVersion?: string
): void {
  const data = {
    status: 'not_implemented',
    message:
      'impl plan is not yet implemented in the CLI. Use the GUI drawer to generate an implementation plan.',
  };
  if (format === 'json') {
    output(data, format);
    return;
  }
  console.log('impl plan: not yet implemented. Use the GUI to generate an implementation plan.');
}

export function runImplStart(
  _basePath: string,
  format: OutputFormat,
  _autopilot?: boolean
): void {
  const data = {
    status: 'not_implemented',
    message: 'impl start is not yet implemented in the CLI. Use the GUI to start execution.',
  };
  if (format === 'json') {
    output(data, format);
    return;
  }
  console.log('impl start: not yet implemented. Use the GUI to start execution.');
}

export function runImplStatus(basePath: string, format: OutputFormat): void {
  const implStatus = loadImplStatus(basePath);
  if (!implStatus) {
    const data = { status: 'no_impl_data', message: 'No implementation status found.' };
    if (format === 'json') {
      output(data, format);
      return;
    }
    console.log('No implementation status found. Run impl plan to get started.');
    return;
  }

  if (format === 'json') {
    output(implStatus, format);
    return;
  }

  const { summary } = implStatus;
  console.log(`Implementation Status`);
  console.log(`  Total:   ${summary.total}`);
  console.log(`  Done:    ${summary.done}`);
  console.log(`  Running: ${summary.running}`);
  console.log(`  Failed:  ${summary.failed}`);
  console.log(`  Pending: ${summary.pending}`);
  console.log(`  Updated: ${implStatus.last_updated}`);
}

export function runImplPause(_basePath: string, format: OutputFormat): void {
  const data = { status: 'not_implemented', message: 'impl pause: use the GUI.' };
  if (format === 'json') { output(data, format); return; }
  console.log('impl pause: not yet implemented. Use the GUI.');
}

export function runImplResume(_basePath: string, format: OutputFormat): void {
  const data = { status: 'not_implemented', message: 'impl resume: use the GUI.' };
  if (format === 'json') { output(data, format); return; }
  console.log('impl resume: not yet implemented. Use the GUI.');
}

export function runImplStop(_basePath: string, format: OutputFormat): void {
  const data = { status: 'not_implemented', message: 'impl stop: use the GUI.' };
  if (format === 'json') { output(data, format); return; }
  console.log('impl stop: not yet implemented. Use the GUI.');
}

export function runImplLog(
  basePath: string,
  format: OutputFormat,
  taskId: string
): void {
  const implStatus = loadImplStatus(basePath);
  if (!implStatus) {
    console.error('No implementation status found');
    process.exit(1);
  }

  const task: ImplTask | undefined = implStatus.tasks.find((t) => t.id === taskId);
  if (!task) {
    console.error(`Task '${taskId}' not found`);
    process.exit(1);
  }

  if (format === 'json') {
    output(task, format);
    return;
  }

  console.log(`Task: ${task.id}`);
  if (task.title) console.log(`Title:  ${task.title}`);
  console.log(`Status: ${task.status}`);
  console.log(`Canvas: ${task.canvas_id}  Node: ${task.node_id}`);
  if (task.attempts.length === 0) {
    console.log('No attempts yet.');
    return;
  }
  console.log('\nAttempts:');
  for (const attempt of task.attempts) {
    console.log(`  [${attempt.attempt}] ${attempt.timestamp}  ${attempt.result}`);
    if (attempt.message) console.log(`        ${attempt.message}`);
    if (attempt.output) {
      console.log(`        ${attempt.output.slice(0, 200)}`);
    }
  }
}
