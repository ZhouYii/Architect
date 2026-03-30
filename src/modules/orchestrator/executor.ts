// ─── DAG Executor (Phase 7) ───────────────────────────────────────────────────
//
// Deterministic state machine. No LLM in the control plane.
// Drives the impl task DAG: picks ready tasks, spawns agent processes via
// invoke_cli, evaluates correctness, escalates on failure, and updates
// the Zustand store in real-time.

import { safeInvoke } from '../../lib/ipc.js';
import { useDesignStore } from '../store/store.js';
import { checkCorrectness } from './correctness.js';
import {
  buildEscalationPrompt,
  getNextAgent,
  isTerminalAttempt,
} from './escalation.js';
import { logAttempt, writeImplStatusFile, writeTaskLog } from './logger.js';
import type { AttemptLog, ImplTask, ImplTaskStatus } from '../store/types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExecutionMode = 'idle' | 'manual' | 'autopilot' | 'paused';

interface CliResult {
  exit_code: number;
  stdout: string;
  stderr: string;
}

export interface ExecutorOptions {
  /** How many tasks may run in parallel (default: 3) */
  max_parallel?: number;
  /** Working directory for spawned agents */
  cwd?: string;
}

export interface ExecutorResult {
  taskId: string;
  status: 'done' | 'failed' | 'escalated';
  output?: string;
  exitCode?: number;
  filesChanged?: string[];
}

// ─── Module state (singleton) ─────────────────────────────────────────────────

let _mode: ExecutionMode = 'idle';
let _running = false;
let _stopRequested = false;
let _pauseRequested = false;

/** taskId → current attempt number (1-based) */
const _taskAttempts = new Map<string, number>();
/** Set of task IDs currently being executed in parallel */
const _activeTaskIds = new Set<string>();
/** Tasks approved for manual-mode execution */
const _approvedTaskIds = new Set<string>();

// ─── Public API ───────────────────────────────────────────────────────────────

export function getExecutionMode(): ExecutionMode {
  return _mode;
}

export function getActiveTaskCount(): number {
  return _activeTaskIds.size;
}

/**
 * Start autopilot or manual execution.
 * Safe to call from the UI; no-op if already running.
 */
export async function startExecution(
  mode: 'manual' | 'autopilot',
  options: ExecutorOptions = {}
): Promise<void> {
  if (_running) return;

  _mode = mode;
  _running = true;
  _stopRequested = false;
  _pauseRequested = false;
  _activeTaskIds.clear();
  _taskAttempts.clear();

  _setExecutionMode(mode);

  try {
    await _runLoop(options);
  } finally {
    _running = false;
    // _mode may have been set to 'paused' by pauseExecution() during the loop
    // Cast through unknown to defeat TypeScript's narrowing from the outer scope
    const currentMode = _mode as unknown as ExecutionMode;
    if (currentMode !== 'paused') {
      _mode = 'idle';
      _setExecutionMode('idle');
    }
  }
}

/** Pause execution — active tasks finish their current attempt, then halt. */
export function pauseExecution(): void {
  if (_mode === 'autopilot' || _mode === 'manual') {
    _pauseRequested = true;
    _mode = 'paused';
    _setExecutionMode('paused');
  }
}

/** Resume a previously paused execution. */
export function resumeExecution(options: ExecutorOptions = {}): void {
  if (_mode !== 'paused') return;

  _mode = 'autopilot';
  _pauseRequested = false;
  _stopRequested = false;
  _setExecutionMode('autopilot');

  if (!_running) {
    _running = true;
    _runLoop(options).finally(() => {
      _running = false;
      if (_mode !== 'paused') {
        _mode = 'idle';
        _setExecutionMode('idle');
      }
    });
  }
}

/** Stop execution immediately — active tasks finish, no new tasks start. */
export function stopExecution(): void {
  _stopRequested = true;
  _mode = 'idle';
  _setExecutionMode('idle');
}

/**
 * Approve a task for execution in manual mode.
 * Adds it to the approved set; the loop picks it up on the next tick.
 */
export function approveTask(taskId: string): void {
  _approvedTaskIds.add(taskId);
}

/**
 * Reset a task to 'queued' and re-run it (restarts the loop if not running).
 */
export async function retryTask(
  taskId: string,
  options: ExecutorOptions = {}
): Promise<void> {
  _taskAttempts.delete(taskId);
  _updateTaskStatus(taskId, 'queued');

  if (!_running) {
    _running = true;
    _mode = 'autopilot';
    _setExecutionMode('autopilot');
    _stopRequested = false;
    _pauseRequested = false;
    await _runLoop(options);
    _running = false;
    _mode = 'idle';
    _setExecutionMode('idle');
  }
}

/**
 * Mark a task and its transitive dependents as blocked/skipped.
 * Records a skip entry in their attempt logs.
 */
export function skipTask(taskId: string): void {
  const { impl_tasks } = useDesignStore.getState();
  const toSkip = _collectDependents(taskId, impl_tasks);
  toSkip.add(taskId);

  const now = new Date().toISOString();
  for (const id of toSkip) {
    _updateTaskStatus(id, 'blocked');
    logAttempt(id, {
      attempt: 0,
      timestamp: now,
      result: 'failure',
      message:
        id === taskId
          ? 'Skipped by user'
          : `Skipped: depends on skipped task '${taskId}'`,
    });
  }

  writeImplStatusFile();
}

// ─── Core loop ────────────────────────────────────────────────────────────────

async function _runLoop(options: ExecutorOptions): Promise<void> {
  const maxParallel = options.max_parallel ?? 3;

  for (;;) {
    if (_stopRequested) break;
    if (_pauseRequested) break;

    const { impl_tasks } = useDesignStore.getState();

    // Termination: all tasks finished
    const unfinished = impl_tasks.filter(
      (t) =>
        t.status !== 'done' &&
        t.status !== 'failed' &&
        t.status !== 'blocked'
    );
    if (unfinished.length === 0) {
      console.info('[executor] All tasks finished');
      break;
    }

    const ready = _collectReadyTasks(impl_tasks, maxParallel);

    if (ready.length === 0) {
      if (_activeTaskIds.size === 0) {
        console.warn('[executor] No tasks can run — deadlock or all blocked');
        break;
      }
      // Wait for an active task to finish
      await _sleep(200);
      continue;
    }

    const slots = maxParallel - _activeTaskIds.size;
    const toStart = ready.slice(0, slots);

    // Fire tasks concurrently; wait for at least one to finish before re-checking
    const promises = toStart.map((task) =>
      _executeTaskWithEscalation(task, options).catch((err) => {
        console.error(`[executor] Unexpected error in task '${task.id}':`, err);
      })
    );

    await Promise.race(promises);

    // Brief yield so React can re-render
    await _sleep(50);
  }
}

// ─── Task eligibility ─────────────────────────────────────────────────────────

function _collectReadyTasks(
  allTasks: ImplTask[],
  maxParallel: number
): ImplTask[] {
  if (_activeTaskIds.size >= maxParallel) return [];

  const doneIds = new Set(
    allTasks.filter((t) => t.status === 'done').map((t) => t.id)
  );

  // Files locked by currently running tasks
  const activeFiles = new Set<string>();
  for (const id of _activeTaskIds) {
    const t = allTasks.find((x) => x.id === id);
    if (t?.file) activeFiles.add(t.file);
  }

  return allTasks.filter((task) => {
    if (task.status !== 'queued') return false;
    if (_activeTaskIds.has(task.id)) return false;

    // Manual mode: task must be explicitly approved
    if (_mode === 'manual' && !_approvedTaskIds.has(task.id)) return false;

    // All dependencies must be 'done'
    for (const depId of task.depends_on ?? []) {
      if (!doneIds.has(depId)) return false;
    }

    // No file conflict with running tasks
    if (task.file && activeFiles.has(task.file)) return false;

    return true;
  });
}

// ─── Execute task with escalation ─────────────────────────────────────────────

async function _executeTaskWithEscalation(
  task: ImplTask,
  options: ExecutorOptions
): Promise<void> {
  _activeTaskIds.add(task.id);

  try {
    let attemptNumber = (_taskAttempts.get(task.id) ?? 0) + 1;
    _taskAttempts.set(task.id, attemptNumber);

    _updateTaskStatus(task.id, 'running');

    for (;;) {
      if (isTerminalAttempt(attemptNumber)) {
        _updateTaskStatus(task.id, 'failed');
        const now = new Date().toISOString();
        const failLog: AttemptLog = {
          attempt: attemptNumber,
          timestamp: now,
          result: 'failure',
          message: 'All escalation tiers exhausted',
        };
        logAttempt(task.id, failLog);
        const planId = useDesignStore.getState().ui.impl_plan_id ?? 'default';
        await writeTaskLog(planId, task.id, failLog);
        writeImplStatusFile();
        _skipDependents(task.id);
        return;
      }

      const decision = getNextAgent(task, attemptNumber);

      // Show 'escalated' status when retrying at a higher tier
      if (attemptNumber > 1) {
        _updateTaskStatus(task.id, 'escalated');
      }

      const currentTask = useDesignStore
        .getState()
        .impl_tasks.find((t) => t.id === task.id);
      const previousAttempts = currentTask?.attempts ?? [];
      const prompt = buildEscalationPrompt(task, previousAttempts);

      const result = await _executeTask(task, decision, prompt, options);

      const now = new Date().toISOString();
      const planId = useDesignStore.getState().ui.impl_plan_id ?? 'default';

      if (decision.terminal) {
        const failLog: AttemptLog = {
          attempt: attemptNumber,
          timestamp: now,
          result: 'failure',
          message: 'Terminal — no agent available',
          output: result.stdout,
        };
        logAttempt(task.id, failLog);
        await writeTaskLog(planId, task.id, failLog);
        _updateTaskStatus(task.id, 'failed');
        writeImplStatusFile();
        _skipDependents(task.id);
        return;
      }

      const correctness = await checkCorrectness(task, {
        stdout: result.stdout,
        exit_code: result.exit_code,
        files_changed: [],
        cwd: options.cwd,
      });

      const attemptLog: AttemptLog = {
        attempt: attemptNumber,
        timestamp: now,
        result: correctness.passed ? 'success' : 'failure',
        message: correctness.details,
        output: result.stdout.slice(0, 1000),
      };

      logAttempt(task.id, attemptLog);
      await writeTaskLog(planId, task.id, attemptLog);

      if (correctness.passed) {
        _updateTaskStatus(task.id, 'done');
        writeImplStatusFile();
        return;
      }

      // Escalate to next tier
      attemptNumber++;
      _taskAttempts.set(task.id, attemptNumber);
      console.info(
        `[executor] Task '${task.id}' failed attempt ${attemptNumber - 1}` +
          ` — escalating to attempt ${attemptNumber}`
      );
    }
  } finally {
    _activeTaskIds.delete(task.id);
  }
}

// ─── Single attempt execution ─────────────────────────────────────────────────

async function _executeTask(
  task: ImplTask,
  decision: ReturnType<typeof getNextAgent>,
  prompt: string,
  options: ExecutorOptions
): Promise<CliResult> {
  const { selectedProviderId } = useDesignStore.getState();

  // Mock mode: simulate without spawning a real process
  if (selectedProviderId === 'mock' || decision.terminal) {
    return _mockExecute(task);
  }

  try {
    let program: string;
    let args: string[];

    if (decision.program === 'opencode') {
      program = 'opencode';
      args = ['chat', prompt];
    } else {
      // claude CLI: decision.args = ['--model', '<model>', '--output-format', 'text', '-p']
      program = decision.program;
      args = [...decision.args, prompt];
    }

    const cliResult = await safeInvoke<CliResult>('invoke_cli', {
      program,
      args,
      cwd: options.cwd ?? null,
    });
    return cliResult ?? { exit_code: 1, stdout: '', stderr: 'Not in Tauri environment' };
  } catch (err) {
    return { exit_code: 1, stdout: '', stderr: String(err) };
  }
}

// ─── Mock execution ───────────────────────────────────────────────────────────

async function _mockExecute(task: ImplTask): Promise<CliResult> {
  // Variable latency: 0.8 – 2.5 s
  await _sleep(800 + Math.random() * 1700);

  // 85% success rate
  const success = Math.random() < 0.85;

  return {
    exit_code: success ? 0 : 1,
    stdout: success
      ? `[mock] Task '${task.title ?? task.id}' implemented successfully.\nFile: ${task.file ?? '(no file)'}\n`
      : `[mock] Task '${task.title ?? task.id}' failed.\nError: Type 'string' is not assignable to type 'number'.`,
    stderr: success ? '' : 'TypeScript compile error',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _updateTaskStatus(taskId: string, status: ImplTaskStatus): void {
  useDesignStore.getState().updateTaskStatus(taskId, status);
}

function _setExecutionMode(mode: ExecutionMode): void {
  useDesignStore.getState().setExecutionMode(mode);
}

function _skipDependents(taskId: string): void {
  const { impl_tasks } = useDesignStore.getState();
  const dependents = _collectDependents(taskId, impl_tasks);
  for (const depId of dependents) {
    const t = impl_tasks.find((x) => x.id === depId);
    if (t && (t.status === 'queued' || t.status === 'running')) {
      _updateTaskStatus(depId, 'blocked');
    }
  }
}

/** Collect all transitive dependents of `taskId`. */
function _collectDependents(taskId: string, allTasks: ImplTask[]): Set<string> {
  const result = new Set<string>();
  const queue = [taskId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const t of allTasks) {
      if (t.depends_on?.includes(current) && !result.has(t.id)) {
        result.add(t.id);
        queue.push(t.id);
      }
    }
  }

  return result;
}

function _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
