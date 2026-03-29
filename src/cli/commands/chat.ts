/**
 * architect chat <message> [--provider <name>]
 *
 * Sends a message to an LLM provider via its CLI tool.
 * Uses execFileNoThrow (safe, no shell injection) for all subprocess calls.
 */

import { loadWorkspaceCli } from '../workspace.js';
import { output, type OutputFormat } from '../output.js';
import { execFileNoThrow } from '../../utils/execFileNoThrow.js';
import type { CanvasNode } from '../../modules/store/types.js';

// ─── Provider definitions ─────────────────────────────────────────────────────

interface ProviderDef {
  id: string;
  program: string;
  buildArgs: (prompt: string) => string[];
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'claude-code',
    program: 'claude',
    buildArgs: (p) => ['-p', p, '--output-format', 'text'],
  },
  {
    id: 'opencode',
    program: 'opencode',
    buildArgs: (p) => ['chat', p],
  },
  {
    id: 'ollama',
    program: 'ollama',
    buildArgs: (p) => ['run', 'llama3', p],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildContext(canvases: Record<string, CanvasNode>): string {
  const lines: string[] = ['# Current Architecture\n'];
  for (const [id, canvas] of Object.entries(canvases)) {
    lines.push(`## Canvas: ${canvas.label ?? id} [${id}]`);
    for (const block of canvas.components ?? []) {
      lines.push(`  - ${block.name ?? block.id} (${block.status})`);
    }
  }
  return lines.join('\n');
}

async function detectProvider(preferredId?: string): Promise<ProviderDef | null> {
  const list = preferredId
    ? PROVIDERS.filter((p) => p.id === preferredId)
    : PROVIDERS;

  for (const p of list) {
    const result = await execFileNoThrow(p.program, ['--version'], { timeout: 5_000 });
    if (result.status === 'ok') return p;
  }
  return null;
}

// ─── Command ──────────────────────────────────────────────────────────────────

export async function runChat(
  basePath: string,
  format: OutputFormat,
  message: string,
  providerIdHint?: string
): Promise<void> {
  const ws = loadWorkspaceCli(basePath);
  const context = buildContext(ws.canvases);

  const provider = await detectProvider(providerIdHint);
  if (!provider) {
    const msg =
      providerIdHint
        ? `Provider '${providerIdHint}' not found or not available.`
        : 'No LLM provider found. Install claude, opencode, or ollama.';
    if (format === 'json') {
      output({ error: msg }, format);
    } else {
      console.error(msg);
    }
    process.exit(1);
  }

  const assembled = ['[Context]\n' + context, '[User]\n' + message].join('\n\n');

  if (format !== 'json') {
    process.stderr.write(`Using provider: ${provider.id}\n`);
  }

  const result = await execFileNoThrow(provider.program, provider.buildArgs(assembled), {
    timeout: 120_000,
  });

  if (result.status === 'error' && result.stdout === '') {
    const errMsg = `Provider '${provider.id}' failed: ${result.stderr}`;
    if (format === 'json') {
      output({ error: errMsg }, format);
    } else {
      console.error(errMsg);
    }
    process.exit(1);
  }

  if (format === 'json') {
    output({ provider: provider.id, message, response: result.stdout }, format);
    return;
  }

  console.log(result.stdout);
}
