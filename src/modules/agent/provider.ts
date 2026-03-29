// ─── LLM Provider Interface ───────────────────────────────────────────────────

export interface LLMProvider {
  id: string;
  name: string;
  available(): Promise<boolean>;
  chat(prompt: string, context?: string, options?: { systemPrompt?: string }): Promise<string>;
  chatStream(
    prompt: string,
    context: string | undefined,
    onChunk: (text: string) => void,
    options?: { systemPrompt?: string }
  ): Promise<string>;
}
