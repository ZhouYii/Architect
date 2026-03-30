// ─── CLI-based LLM Provider ───────────────────────────────────────────────────
// Uses Tauri's invoke_cli command to spawn CLI tools and capture their output.

import { safeInvoke } from '../../lib/ipc.js';
import type { LLMProvider } from './provider.js';

interface CliResult {
  exit_code: number;
  stdout: string;
  stderr: string;
}

interface CLIProviderConfig {
  id: string;
  name: string;
  program: string;
  /** Args to check availability (e.g. ['--version']) */
  versionArgs: string[];
  /** Build chat args from assembled prompt string */
  buildChatArgs: (prompt: string) => string[];
}

export class CLIProvider implements LLMProvider {
  readonly id: string;
  readonly name: string;
  private readonly config: CLIProviderConfig;

  constructor(config: CLIProviderConfig) {
    this.config = config;
    this.id = config.id;
    this.name = config.name;
  }

  async available(): Promise<boolean> {
    try {
      const result = await safeInvoke<CliResult>('invoke_cli', {
        program: this.config.program,
        args: this.config.versionArgs,
        cwd: null,
      });
      return result !== null && result.exit_code === 0;
    } catch {
      return false;
    }
  }

  async chat(
    prompt: string,
    context?: string,
    options?: { systemPrompt?: string }
  ): Promise<string> {
    const assembled = assemblePrompt(prompt, context, options?.systemPrompt);
    const args = this.config.buildChatArgs(assembled);

    const result = await safeInvoke<CliResult>('invoke_cli', {
      program: this.config.program,
      args,
      cwd: null,
    });

    if (result === null) {
      throw new Error(
        `CLI provider '${this.id}' unavailable outside Tauri`
      );
    }

    if (result.exit_code !== 0 && result.stdout.trim() === '') {
      throw new Error(
        `CLI provider '${this.id}' failed (exit ${result.exit_code}): ${result.stderr.trim()}`
      );
    }

    return result.stdout.trim();
  }

  // For v1 we use the synchronous chat() and emit it as a single chunk.
  async chatStream(
    prompt: string,
    context: string | undefined,
    onChunk: (text: string) => void,
    options?: { systemPrompt?: string }
  ): Promise<string> {
    const response = await this.chat(prompt, context, options);
    onChunk(response);
    return response;
  }
}

// ─── Prompt assembly ──────────────────────────────────────────────────────────

function assemblePrompt(
  userPrompt: string,
  context?: string,
  systemPrompt?: string
): string {
  const parts: string[] = [];
  if (systemPrompt) {
    parts.push(`[System]\n${systemPrompt}`);
  }
  if (context) {
    parts.push(`[Context]\n${context}`);
  }
  parts.push(`[User]\n${userPrompt}`);
  return parts.join('\n\n');
}

// ─── Provider factory helpers ─────────────────────────────────────────────────

export function makeClaudeProvider(): CLIProvider {
  return new CLIProvider({
    id: 'claude-code',
    name: 'Claude Code',
    program: 'claude',
    versionArgs: ['--version'],
    buildChatArgs: (prompt) => ['-p', prompt, '--output-format', 'text'],
  });
}

export function makeOpencodeProvider(): CLIProvider {
  return new CLIProvider({
    id: 'opencode',
    name: 'OpenCode',
    program: 'opencode',
    versionArgs: ['--version'],
    buildChatArgs: (prompt) => ['chat', prompt],
  });
}

export function makeOllamaProvider(model = 'llama3'): CLIProvider {
  return new CLIProvider({
    id: 'ollama',
    name: `Ollama (${model})`,
    program: 'ollama',
    versionArgs: ['--version'],
    buildChatArgs: (prompt) => ['run', model, prompt],
  });
}

// ─── Mock provider (fallback when no CLI is available) ────────────────────────

export class MockProvider implements LLMProvider {
  readonly id = 'mock';
  readonly name = 'Mock (no CLI)';

  async available(): Promise<boolean> {
    return true;
  }

  async chat(
    prompt: string,
    _context?: string,
    _options?: { systemPrompt?: string }
  ): Promise<string> {
    // Return a mock changeset response so the UI pipeline can be tested end-to-end.
    const nodeId = `proposed-${Date.now()}`;
    return [
      'Here is my analysis of your architecture.',
      '',
      'I suggest adding a caching layer to improve read performance.',
      '',
      '```yaml',
      `id: cs-mock-${Date.now()}`,
      'title: Add Redis Cache Layer',
      'agent: mock',
      'nodes:',
      `  - id: ${nodeId}`,
      '    kind: block',
      '    block_type: service',
      `    name: RedisCache`,
      '    status: proposed',
      '    annotation: In-memory cache for hot read paths. TTL=60s.',
      '    agent_proposed: true',
      '```',
      '',
      `Responding to: "${prompt.slice(0, 80)}..."`,
    ].join('\n');
  }

  async chatStream(
    prompt: string,
    context: string | undefined,
    onChunk: (text: string) => void,
    options?: { systemPrompt?: string }
  ): Promise<string> {
    const response = await this.chat(prompt, context, options);
    onChunk(response);
    return response;
  }
}
