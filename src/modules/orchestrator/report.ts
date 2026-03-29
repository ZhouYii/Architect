// ─── Completion Report (Phase 8) ──────────────────────────────────────────────
//
// Generates a human-readable + structured completion report after all tasks
// finish. Includes: summary counts, per-task details, failure analysis,
// escalation history.

import type { ImplTask } from '../store/types.js';
import type { VerificationResult } from './verification.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskReportEntry {
  id: string;
  title: string;
  status: string;
  attempts: number;
  durationMs: number | null;
  errorMessage?: string;
  verificationPassed?: boolean;
  verificationMessage?: string;
}

export interface CompletionReport {
  generatedAt: string;
  summary: {
    total: number;
    done: number;
    failed: number;
    escalated: number;
    skipped: number;
    verificationPassed: number;
    verificationFailed: number;
  };
  tasks: TaskReportEntry[];
  failedTasks: TaskReportEntry[];
  formattedText: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function taskDurationMs(task: ImplTask): number | null {
  if (task.attempts.length === 0) return null;
  const first = task.attempts[0];
  const last = task.attempts[task.attempts.length - 1];
  if (!first || !last) return null;
  const start = new Date(first.timestamp).getTime();
  const end = new Date(last.timestamp).getTime();
  return isNaN(start) || isNaN(end) ? null : end - start;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 100) / 10;
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function statusSymbol(status: string): string {
  switch (status) {
    case 'done': return '✓';
    case 'failed': return '✗';
    case 'escalated': return '⬆';
    case 'blocked': return '◌';
    case 'running': return '●';
    default: return '○';
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate a structured completion report for a set of implementation tasks.
 *
 * @param tasks - All ImplTask records from the current plan
 * @param verificationResults - Optional verification results to include
 * @returns CompletionReport with both structured data and a formatted string
 */
export function generateCompletionReport(
  tasks: ImplTask[],
  verificationResults: VerificationResult[] = []
): CompletionReport {
  const now = new Date().toISOString();

  const verifyMap = new Map<string, VerificationResult>(
    verificationResults.map((r) => [r.taskId, r])
  );

  // ── Build per-task entries ──────────────────────────────────────────────────
  const taskEntries: TaskReportEntry[] = tasks.map((task) => {
    const vr = verifyMap.get(task.id);
    const lastAttempt = task.attempts[task.attempts.length - 1];
    return {
      id: task.id,
      title: task.title ?? task.id,
      status: task.status,
      attempts: task.attempts.length,
      durationMs: taskDurationMs(task),
      errorMessage:
        task.status === 'failed' ? (lastAttempt?.message ?? 'No details') : undefined,
      verificationPassed: vr?.passed,
      verificationMessage: vr?.message,
    };
  });

  const failedEntries = taskEntries.filter((t) => t.status === 'failed');

  // ── Summary counts ──────────────────────────────────────────────────────────
  const done = tasks.filter((t) => t.status === 'done').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const escalated = tasks.filter((t) => t.status === 'escalated').length;
  const skipped = tasks.filter(
    (t) => t.status === 'queued' || t.status === 'blocked'
  ).length;
  const verificationPassed = verificationResults.filter((r) => r.passed).length;
  const verificationFailed = verificationResults.filter((r) => !r.passed).length;

  // ── Formatted text ──────────────────────────────────────────────────────────
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════');
  lines.push('  IMPLEMENTATION COMPLETION REPORT');
  lines.push(`  Generated: ${now}`);
  lines.push('═══════════════════════════════════════════════════');
  lines.push('');
  lines.push('SUMMARY');
  lines.push('───────────────────────────────────────────────────');
  lines.push(`  Total tasks   : ${tasks.length}`);
  lines.push(`  Done          : ${done}`);
  lines.push(`  Failed        : ${failed}`);
  lines.push(`  Escalated     : ${escalated}`);
  lines.push(`  Skipped       : ${skipped}`);

  if (verificationResults.length > 0) {
    lines.push('');
    lines.push('VERIFICATION');
    lines.push('───────────────────────────────────────────────────');
    lines.push(`  Passed        : ${verificationPassed}`);
    lines.push(`  Failed        : ${verificationFailed}`);
  }

  lines.push('');
  lines.push('TASKS');
  lines.push('───────────────────────────────────────────────────');

  for (const entry of taskEntries) {
    const sym = statusSymbol(entry.status);
    const vTag =
      entry.verificationPassed === true
        ? ' [verified ✓]'
        : entry.verificationPassed === false
        ? ' [verify ✗]'
        : '';
    lines.push(
      `  ${sym} ${entry.title}${vTag}`
    );
    lines.push(
      `     id: ${entry.id} · attempts: ${entry.attempts} · duration: ${formatDuration(entry.durationMs)}`
    );
    if (entry.errorMessage) {
      lines.push(`     error: ${entry.errorMessage}`);
    }
    if (entry.verificationMessage && entry.verificationPassed === false) {
      lines.push(`     verify: ${entry.verificationMessage}`);
    }
  }

  if (failedEntries.length > 0) {
    lines.push('');
    lines.push('FAILED TASK DETAILS');
    lines.push('───────────────────────────────────────────────────');
    for (const entry of failedEntries) {
      lines.push(`  ✗ ${entry.title} (${entry.id})`);
      lines.push(`    Attempts: ${entry.attempts}`);
      if (entry.errorMessage) {
        lines.push(`    Error: ${entry.errorMessage}`);
      }
      if (entry.verificationMessage) {
        lines.push(`    Verification: ${entry.verificationMessage}`);
      }
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════');

  return {
    generatedAt: now,
    summary: { total: tasks.length, done, failed, escalated, skipped, verificationPassed, verificationFailed },
    tasks: taskEntries,
    failedTasks: failedEntries,
    formattedText: lines.join('\n'),
  };
}
