// ─── Escalation Logic (Phase 7) ───────────────────────────────────────────────
//
// Determines which agent tier to use for each attempt and builds escalation
// prompts that carry context from previous failed attempts.

import type { ImplTask, AttemptLog } from '../store/types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EscalationDecision {
  /** Which CLI program to invoke (e.g. 'opencode', 'claude') */
  program: string;
  /** Extra args / flags for the program */
  args: string[];
  /** Human-readable label for UI display */
  label: string;
  /** Short abbreviation shown in attempt pills, e.g. 'oc', 'sn', 'op' */
  abbrev: string;
  /** true when no more escalation is possible */
  terminal: boolean;
}

export interface EscalationConfig {
  frontline: string;   // default: 'opencode'
  mid_tier: string;    // default: 'claude' (sonnet)
  top_tier: string;    // default: 'claude' (opus)
}

// ─── Tier map ─────────────────────────────────────────────────────────────────

// Attempt numbers (1-based):
//   1: frontline (e.g. opencode)
//   2: retry frontline with error context
//   3: mid-tier (sonnet)
//   4: top-tier (opus)
//   5+: FAILED

function _getTierConfig(
  attemptNumber: number,
  config: EscalationConfig
): EscalationDecision {
  switch (attemptNumber) {
    case 1:
    case 2:
      return _frontlineDecision(config.frontline);
    case 3:
      return _claudeDecision(config.mid_tier, 'claude-sonnet-4-5', 'sonnet', 'sn');
    case 4:
      return _claudeDecision(config.top_tier, 'claude-opus-4-5', 'opus', 'op');
    default:
      return {
        program: '',
        args: [],
        label: 'FAILED',
        abbrev: 'xx',
        terminal: true,
      };
  }
}

function _frontlineDecision(frontline: string): EscalationDecision {
  if (frontline === 'opencode') {
    return {
      program: 'opencode',
      args: ['chat'],
      label: 'OpenCode',
      abbrev: 'oc',
      terminal: false,
    };
  }
  // Generic fallback: treat as a claude-based CLI
  return _claudeDecision(frontline, frontline, frontline, frontline.slice(0, 2));
}

function _claudeDecision(
  programHint: string,
  model: string,
  label: string,
  abbrev: string
): EscalationDecision {
  return {
    program: programHint === 'claude' || programHint.startsWith('claude') ? 'claude' : programHint,
    args: ['--model', model, '--output-format', 'text', '-p'],
    label,
    abbrev,
    terminal: false,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the escalation decision for a given attempt number.
 *
 * @param task          The implementation task being executed
 * @param attemptNumber 1-based attempt counter
 * @param config        Execution config from workspace (or defaults)
 */
export function getNextAgent(
  _task: ImplTask,
  attemptNumber: number,
  config: Partial<EscalationConfig> = {}
): EscalationDecision {
  const fullConfig: EscalationConfig = {
    frontline: config.frontline ?? 'opencode',
    mid_tier: config.mid_tier ?? 'claude',
    top_tier: config.top_tier ?? 'claude',
  };
  return _getTierConfig(attemptNumber, fullConfig);
}

/**
 * Constructs the prompt to send for a given attempt, appending error context
 * from prior failed attempts so the escalated agent can understand what went wrong.
 *
 * Attempt 1: raw task.prompt
 * Attempt 2+: task.prompt + previous attempt summaries
 */
export function buildEscalationPrompt(
  task: ImplTask,
  previousAttempts: AttemptLog[]
): string {
  const basePrompt = task.prompt ?? `Implement task: ${task.title ?? task.id}`;

  if (previousAttempts.length === 0) {
    return basePrompt;
  }

  const failedSummaries = previousAttempts
    .filter((a) => a.result === 'failure')
    .map((a) => {
      const lines: string[] = [
        `### Attempt ${a.attempt} failed at ${a.timestamp}`,
      ];
      if (a.message) lines.push(`Error: ${a.message}`);
      if (a.output) lines.push(`Output:\n${a.output.slice(0, 600)}`);
      return lines.join('\n');
    })
    .join('\n\n');

  if (!failedSummaries) return basePrompt;

  return [
    basePrompt,
    '',
    '---',
    '## Previous Attempts (failed)',
    '',
    failedSummaries,
    '',
    '---',
    'Please fix the issues described above and complete the implementation.',
  ].join('\n');
}

/**
 * Returns true when we have exhausted all escalation tiers and the task should
 * be permanently marked as failed.
 */
export function isTerminalAttempt(attemptNumber: number): boolean {
  return attemptNumber >= 5;
}
