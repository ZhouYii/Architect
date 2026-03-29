// ─── Correctness Checker (Phase 7) ────────────────────────────────────────────
//
// Checks whether a completed task's output meets its `correct_when` criteria.
// v1 strategy: check process exit code; optionally run tsc / test runner.

import { invoke } from '@tauri-apps/api/core';
import type { ImplTask } from '../store/types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CorrectnessResult {
  passed: boolean;
  types_pass: boolean;
  tests_pass: boolean;
  details: string;
}

interface CliResult {
  exit_code: number;
  stdout: string;
  stderr: string;
}

// ─── Main check ───────────────────────────────────────────────────────────────

/**
 * Evaluate whether a task execution result satisfies `correct_when`.
 *
 * For v1: if agent exited with code 0, the check passes.
 * Additionally, if `correct_when` references "types" we run `tsc --noEmit`,
 * and if it references "tests" we run the test runner.
 */
export async function checkCorrectness(
  task: ImplTask,
  result: { stdout: string; exit_code: number; files_changed: string[]; cwd?: string }
): Promise<CorrectnessResult> {
  const details: string[] = [];
  let types_pass = true;
  let tests_pass = true;

  // ── v1: baseline — exit code 0 ─────────────────────────────────────────────
  if (result.exit_code !== 0) {
    return {
      passed: false,
      types_pass: false,
      tests_pass: false,
      details: `Agent exited with code ${result.exit_code}.\n${result.stdout.slice(0, 500)}`,
    };
  }

  const correctWhen = (task.correct_when ?? '').toLowerCase();
  const cwd = result.cwd ?? null;

  // ── Type check ─────────────────────────────────────────────────────────────
  if (correctWhen.includes('type') || correctWhen.includes('tsc')) {
    const tscResult = await _runCli('npx', ['tsc', '--noEmit'], cwd);
    types_pass = tscResult.exit_code === 0;
    details.push(
      types_pass
        ? 'tsc: PASS'
        : `tsc: FAIL\n${tscResult.stdout.slice(0, 300)}\n${tscResult.stderr.slice(0, 300)}`
    );
  }

  // ── Test runner ────────────────────────────────────────────────────────────
  if (
    (correctWhen.includes('test') || correctWhen.includes('spec')) &&
    task.test_file
  ) {
    // Prefer vitest, fall back to jest
    const runnerArgs = _buildTestArgs(task.test_file);
    const testResult = await _runCli(runnerArgs[0], runnerArgs.slice(1), cwd);
    tests_pass = testResult.exit_code === 0;
    details.push(
      tests_pass
        ? `tests: PASS (${task.test_file})`
        : `tests: FAIL (${task.test_file})\n${testResult.stdout.slice(0, 400)}\n${testResult.stderr.slice(0, 200)}`
    );
  }

  const passed = types_pass && tests_pass;

  return {
    passed,
    types_pass,
    tests_pass,
    details: details.join('\n') || 'Agent exited 0 — correctness assumed.',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function _runCli(
  program: string,
  args: string[],
  cwd: string | null
): Promise<CliResult> {
  try {
    return await invoke<CliResult>('invoke_cli', { program, args, cwd });
  } catch (err) {
    return {
      exit_code: 1,
      stdout: '',
      stderr: String(err),
    };
  }
}

function _buildTestArgs(testFile: string): string[] {
  if (testFile.endsWith('.test.ts') || testFile.endsWith('.spec.ts')) {
    return ['npx', 'vitest', 'run', testFile];
  }
  if (testFile.endsWith('.test.js') || testFile.endsWith('.spec.js')) {
    return ['npx', 'jest', '--testPathPattern', testFile];
  }
  // Rust: derive test name from filename stem
  if (testFile.endsWith('.rs')) {
    return ['cargo', 'test'];
  }
  return ['npx', 'vitest', 'run', testFile];
}
