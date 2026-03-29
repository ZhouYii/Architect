/**
 * Level 2 — AI Co-Design internal interfaces.
 *
 * These types describe the data shapes flowing between the AI system's
 * sub-components: conversation UI, provider abstraction, context assembly,
 * and proposal extraction.
 */

/** Options passed to an LLM provider for a chat request. */
export interface ChatOptions {
  /** System-level instructions prepended to the conversation. */
  systemPrompt?: string;
  /** Maximum tokens in the response (provider-dependent). */
  maxTokens?: number;
}

/** The uniform interface every LLM provider must implement. */
export interface LLMProviderContract {
  id: string;
  name: string;
  /** Checks whether the CLI tool exists on the system. */
  available(): Promise<boolean>;
  /** Single-shot prompt/response. */
  chat(prompt: string, context?: string, options?: ChatOptions): Promise<string>;
  /** Streaming prompt/response with per-chunk callback. */
  chatStream(
    prompt: string,
    context: string | undefined,
    onChunk: (text: string) => void,
    options?: ChatOptions,
  ): Promise<string>;
}

/** The context string assembled before each LLM call. */
export interface CanvasContext {
  /** Workspace path on disk. */
  workspacePath: string;
  /** Current canvas serialized as YAML. */
  canvasYaml: string;
  /** TypeScript interfaces from all blocks on the canvas. */
  interfaceDefinitions: string;
  /** Current version and checkpoint for staleness detection. */
  versionInfo: { version: string; checkpoint: string };
}

/** Result of extracting ACP proposals from LLM response text. */
export interface ExtractionResult {
  /** Successfully parsed ACP objects. */
  proposals: import('../../types').ACP[];
  /** Number of YAML blocks found but failed to parse. */
  skippedBlocks: number;
}
