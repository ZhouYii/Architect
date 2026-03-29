// ─── Implementation Planner (Phase 6) ────────────────────────────────────────

import { parse as yamlParse } from 'yaml';
import { useDesignStore } from '../store/store.js';
import { PLAN_IMPLEMENTATION_PROMPT } from '../agent/skills.js';
import type { DesignNode, ImplTask } from '../store/types.js';

interface RawTaskYaml {
  id?: unknown;
  title?: unknown;
  method?: unknown;
  type?: unknown;
  complexity?: unknown;
  design_node?: unknown;
  agent?: unknown;
  file?: unknown;
  test_file?: unknown;
  prompt?: unknown;
  correct_when?: unknown;
  depends_on?: unknown;
}

export function computeDesignDelta(): DesignNode[] {
  const { canvases } = useDesignStore.getState();
  const delta: DesignNode[] = [];
  for (const canvas of Object.values(canvases)) {
    for (const node of canvas.components) {
      if (node.status !== 'clean' && node.status !== 'dismissed') {
        delta.push(node);
      }
    }
    for (const arrow of canvas.connections) {
      if (arrow.status !== 'clean' && arrow.status !== 'dismissed') {
        delta.push(arrow);
      }
    }
  }
  return delta;
}

function serializeDeltaForPrompt(delta: DesignNode[]): string {
  if (delta.length === 0) return '(no modified nodes)';
  const lines: string[] = ['## Modified Design Nodes\n'];
  for (const node of delta) {
    lines.push(`### ${node.name} (${node.id})`);
    lines.push(`- kind: ${node.kind}`);
    lines.push(`- status: ${node.status}`);
    if (node.block_type) lines.push(`- block_type: ${node.block_type}`);
    if (node.annotation) lines.push(`- annotation: ${node.annotation}`);
    if (node.contract) {
      if (node.contract.invariants.length > 0) {
        lines.push('- invariants:');
        for (const inv of node.contract.invariants) {
          lines.push(`    - [${inv.satisfied ? 'x' : ' '}] ${inv.description}`);
        }
      }
      if (node.contract.test_cases.length > 0) {
        lines.push('- test_cases:');
        for (const tc of node.contract.test_cases) {
          lines.push(`    - ${tc.name} (${tc.status})`);
        }
      }
    }
    if (node.code_links?.length) {
      lines.push('- code_links:');
      for (const link of node.code_links) {
        lines.push(`    - ${link.file}${link.symbol ? ` :: ${link.symbol}` : ''}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

function extractYamlBlock(text: string): string | null {
  const match = /```ya?ml\s*([\s\S]*?)```/i.exec(text);
  return match ? match[1].trim() : null;
}

export function parseTaskDAG(response: string): ImplTask[] {
  const yamlBlock = extractYamlBlock(response);
  if (!yamlBlock) {
    console.warn('[planner] No YAML block found in response');
    return [];
  }

  let parsed: unknown;
  try {
    parsed = yamlParse(yamlBlock);
  } catch (err) {
    console.error('[planner] YAML parse error:', err);
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.warn('[planner] Parsed YAML is not an array');
    return [];
  }

  const now = new Date().toISOString();
  const tasks: ImplTask[] = [];

  for (const raw of parsed as RawTaskYaml[]) {
    if (!raw || typeof raw !== 'object') continue;

    const id = typeof raw.id === 'string' ? raw.id : `task-${tasks.length + 1}`;
    const title = typeof raw.title === 'string' ? raw.title : id;
    const depends_on = Array.isArray(raw.depends_on)
      ? (raw.depends_on as unknown[]).filter((d): d is string => typeof d === 'string')
      : [];

    tasks.push({
      id,
      title,
      method: typeof raw.method === 'string' ? raw.method : '',
      type: typeof raw.type === 'string' ? raw.type : 'implementation',
      complexity: typeof raw.complexity === 'string' ? raw.complexity : 'medium',
      design_node: typeof raw.design_node === 'string' ? raw.design_node : '',
      agent: typeof raw.agent === 'string' ? raw.agent : 'fast',
      file: typeof raw.file === 'string' ? raw.file : '',
      test_file: typeof raw.test_file === 'string' ? raw.test_file : '',
      prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
      correct_when: typeof raw.correct_when === 'string' ? raw.correct_when : '',
      depends_on,
      canvas_id: '',
      node_id: typeof raw.design_node === 'string' ? raw.design_node : '',
      status: 'queued',
      attempts: [],
      created_at: now,
      updated_at: now,
    });
  }

  return tasks;
}

export function generateMockPlan(delta: DesignNode[]): ImplTask[] {
  const now = new Date().toISOString();
  return delta.map((node, i) => ({
    id: `task-${node.id}`,
    title: `Implement ${node.name}`,
    method: node.name.replace(/\s+/g, ''),
    type: 'implementation' as const,
    complexity: 'medium' as const,
    design_node: node.id,
    agent: 'fast' as const,
    file: `src/${node.block_type ?? 'module'}/${node.name.replace(/\s+/g, '')}.ts`,
    test_file: `src/${node.block_type ?? 'module'}/${node.name.replace(/\s+/g, '')}.test.ts`,
    prompt: `Implement the ${node.name} component.\n${node.annotation ?? ''}`,
    correct_when: `TypeScript compiles without errors.\nAll tests in the test_file pass.`,
    depends_on: i > 0 ? [`task-${delta[i - 1].id}`] : [],
    canvas_id: '',
    node_id: node.id,
    status: 'queued' as const,
    attempts: [],
    created_at: now,
    updated_at: now,
  }));
}

async function callPlanningAgent(userMessage: string): Promise<string | null> {
  const { selectedProviderId } = useDesignStore.getState();
  if (selectedProviderId === 'mock') return null;

  try {
    const { getProvider } = await import('../agent/index.js');
    const provider = getProvider(selectedProviderId);
    if (!provider) return null;

    // LLMProvider.chat(prompt, context?, options?)
    const response = await provider.chat(userMessage, undefined, {
      systemPrompt: PLAN_IMPLEMENTATION_PROMPT,
    });

    return response;
  } catch (err) {
    console.warn('[planner] LLM call failed, falling back to mock:', err);
    return null;
  }
}

export async function planImplementation(
  fromVersion: number,
  toVersion: number
): Promise<ImplTask[]> {
  const delta = computeDesignDelta();

  if (delta.length === 0) {
    console.info('[planner] No dirty nodes found — returning empty plan');
    return [];
  }

  const planId = `v${fromVersion}-to-v${toVersion}`;
  console.info(`[planner] Planning implementation ${planId} (${delta.length} nodes)`);

  const userMessage = [
    `Plan the implementation for design version ${planId}.`,
    '',
    serializeDeltaForPrompt(delta),
  ].join('\n');

  const llmResponse = await callPlanningAgent(userMessage);

  if (llmResponse) {
    const tasks = parseTaskDAG(llmResponse);
    if (tasks.length > 0) {
      console.info(`[planner] LLM returned ${tasks.length} tasks`);
      return tasks;
    }
    console.warn('[planner] LLM response yielded 0 tasks, falling back to mock');
  }

  const mockTasks = generateMockPlan(delta);
  console.info(`[planner] Mock plan: ${mockTasks.length} tasks`);
  return mockTasks;
}
