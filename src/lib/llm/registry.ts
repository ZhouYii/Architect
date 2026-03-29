import type { LLMProvider } from './provider';
import { CLIProvider } from './cli-provider';

const DEFAULT_PROVIDERS: CLIProvider[] = [
  new CLIProvider('claude-code', 'Claude Code', 'run-claude', ['-p', '--output-format', 'text']),
  new CLIProvider('opencode', 'OpenCode', 'run-opencode', ['chat']),
  new CLIProvider('ollama', 'Ollama', 'run-ollama', ['run']),
];

/**
 * Detect which LLM CLI tools are available on this system.
 */
export async function detectAvailableProviders(): Promise<LLMProvider[]> {
  const available: LLMProvider[] = [];
  for (const provider of DEFAULT_PROVIDERS) {
    if (await provider.available()) {
      available.push(provider);
    }
  }
  return available;
}

/**
 * Get a provider by ID.
 */
export function getProvider(id: string): LLMProvider | undefined {
  return DEFAULT_PROVIDERS.find((p) => p.id === id);
}

/**
 * Get all registered providers (regardless of availability).
 */
export function getAllProviders(): LLMProvider[] {
  return [...DEFAULT_PROVIDERS];
}
