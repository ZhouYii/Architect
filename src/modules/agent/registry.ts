// ─── Provider Registry ────────────────────────────────────────────────────────

import type { LLMProvider } from './provider.js';
import {
  makeClaudeProvider,
  makeOpencodeProvider,
  makeOllamaProvider,
  MockProvider,
} from './cli-provider.js';

// ─── Default provider list ────────────────────────────────────────────────────

const DEFAULT_PROVIDERS: LLMProvider[] = [
  makeClaudeProvider(),
  makeOpencodeProvider(),
  makeOllamaProvider(),
];

// ─── Registry ─────────────────────────────────────────────────────────────────

const _registry: Map<string, LLMProvider> = new Map(
  DEFAULT_PROVIDERS.map((p) => [p.id, p])
);

export function getProvider(id: string): LLMProvider | undefined {
  return _registry.get(id);
}

export function getAllProviders(): LLMProvider[] {
  return Array.from(_registry.values());
}

export function registerProvider(provider: LLMProvider): void {
  _registry.set(provider.id, provider);
}

/**
 * Probes each registered provider with --version.
 * Returns the list of providers that responded successfully.
 * Always includes the Mock provider as a guaranteed fallback.
 */
export async function detectAvailableProviders(): Promise<LLMProvider[]> {
  const checks = await Promise.allSettled(
    DEFAULT_PROVIDERS.map(async (p) => ({ provider: p, ok: await p.available() }))
  );

  const available: LLMProvider[] = [];
  for (const result of checks) {
    if (result.status === 'fulfilled' && result.value.ok) {
      available.push(result.value.provider);
    }
  }

  // Always have mock as guaranteed fallback
  const mock = new MockProvider();
  available.push(mock);
  _registry.set(mock.id, mock);

  return available;
}

/**
 * Returns the first available provider, preferring real CLIs over mock.
 */
export async function getDefaultProvider(): Promise<LLMProvider> {
  const available = await detectAvailableProviders();
  return available[0] ?? new MockProvider();
}
