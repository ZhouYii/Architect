// ─── Verification Phase (Phase 8) ─────────────────────────────────────────────
//
// Runs all 'verify' tasks after implementation completes.
// Verify tasks use the top-tier (smart/opus) agent to check:
//   - Integration tests pass
//   - Invariants hold
//   - Interfaces comply with contracts

import { useDesignStore } from '../store/store.js';
import type { ImplTask } from '../store/types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VerificationResult {
  taskId: string;
  passed: boolean;
  message: string;
  details?: string;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const VERIFY_SYSTEM_PROMPT = `\
You are a senior software engineer performing verification of completed implementation tasks.

For each verification task you receive, you must:
1. Evaluate whether the implementation satisfies the stated correct_when criteria.
2. Check that integration tests would pass given the described implementation.
3. Verify invariants hold as stated in the task.
4. Respond with a structured result.

## Response format

Respond with a single yaml block:

\`\`\`yaml
passed: true | false
message: <one-sentence summary>
details: |
  <Additional details about what passed or failed. Be specific.>
\`\`\`

Rules:
- Only output the yaml block (plus a brief 1-sentence preamble if needed).
- Be strict: only pass if you are confident the correct_when criteria are met.
- If information is insufficient to verify, mark passed: false with an explanation.
`;

// ─── Agent call ───────────────────────────────────────────────────────────────

async function callVerificationAgent(task: ImplTask): Promise<string | null> {
  const { selectedProviderId } = useDesignStore.getState();
  if (selectedProviderId === 'mock') return null;

  try {
    const { getProvider } = await import('../agent/index.js');
    const provider = getProvider(selectedProviderId);
    if (!provider) return null;

    const lastAttempt = task.attempts[task.attempts.length - 1];
    const userMessage = [
      `Verify the following implementation task:`,
      ``,
      `## Task: ${task.title ?? task.id}`,
      ``,
      `**Prompt:**`,
      task.prompt ?? '(no prompt)',
      ``,
      `**Correct When:**`,
      task.correct_when ?? '(no criteria)',
      ``,
      `**Status:** ${task.status}`,
      lastAttempt
        ? `**Last attempt result:** ${lastAttempt.message ?? 'n/a'}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await provider.chat(userMessage, undefined, {
      systemPrompt: VERIFY_SYSTEM_PROMPT,
    });

    return response;
  } catch (err) {
    console.warn('[verification] LLM call failed for task', task.id, err);
    return null;
  }
}

// ─── Response parser ──────────────────────────────────────────────────────────

function parseVerificationResponse(
  taskId: string,
  response: string | null
): VerificationResult {
  if (!response) {
    return {
      taskId,
      passed: false,
      message: 'Verification agent unavailable (mock mode)',
      details: 'Running in mock provider mode — no real verification performed.',
    };
  }

  const match = /```ya?ml\s*([\s\S]*?)```/i.exec(response);
  if (!match) {
    return {
      taskId,
      passed: false,
      message: 'Verification response had no YAML block',
      details: response.slice(0, 400),
    };
  }

  const yaml = match[1];
  const passedMatch = /^passed:\s*(true|false)/m.exec(yaml);
  const messageMatch = /^message:\s*(.+)/m.exec(yaml);
  const detailsMatch = /^details:\s*\|?\s*([\s\S]*?)(?=\n\w|$)/m.exec(yaml);

  const passed = passedMatch ? passedMatch[1] === 'true' : false;
  const message = messageMatch ? messageMatch[1].trim() : 'No message';
  const details = detailsMatch ? detailsMatch[1].trim() : undefined;

  return { taskId, passed, message, details };
}

// ─── Mock verification ────────────────────────────────────────────────────────

function mockVerifyTask(task: ImplTask): VerificationResult {
  const passed = task.status === 'done';
  return {
    taskId: task.id,
    passed,
    message: passed
      ? `Mock verification passed for "${task.title ?? task.id}"`
      : `Mock verification failed for "${task.title ?? task.id}" (task status: ${task.status})`,
    details: passed
      ? 'All correct_when criteria assumed satisfied (mock mode).'
      : `Task ended in status "${task.status}". Fix the implementation before re-verifying.`,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Collect all verify-type tasks and run them through the top-tier agent.
 * Falls back to verifying all done/failed tasks when no explicit verify tasks exist.
 * Returns a VerificationResult for each task processed.
 */
export async function runVerification(
  implTasks: ImplTask[]
): Promise<VerificationResult[]> {
  const { selectedProviderId } = useDesignStore.getState();

  // Explicit verify tasks take priority; if none, verify all terminal tasks
  const verifyTasks = implTasks.filter((t) => t.type === 'verify');
  const terminalTasks = implTasks.filter(
    (t) => t.type !== 'verify' && (t.status === 'done' || t.status === 'failed')
  );
  const tasksToVerify = verifyTasks.length > 0 ? verifyTasks : terminalTasks;

  if (tasksToVerify.length === 0) {
    console.info('[verification] No tasks to verify');
    return [];
  }

  console.info(
    `[verification] Verifying ${tasksToVerify.length} tasks (provider: ${selectedProviderId})`
  );

  const results: VerificationResult[] = [];

  for (const task of tasksToVerify) {
    if (selectedProviderId === 'mock') {
      results.push(mockVerifyTask(task));
    } else {
      const response = await callVerificationAgent(task);
      results.push(parseVerificationResponse(task.id, response));
    }
  }

  const passCount = results.filter((r) => r.passed).length;
  console.info(
    `[verification] Complete: ${passCount}/${results.length} passed`
  );

  return results;
}
