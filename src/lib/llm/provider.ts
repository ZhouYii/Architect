export interface ChatOptions {
  systemPrompt?: string;
  maxTokens?: number;
}

export interface LLMProvider {
  id: string;
  name: string;
  available(): Promise<boolean>;
  chat(prompt: string, context?: string, options?: ChatOptions): Promise<string>;
  chatStream(
    prompt: string,
    context: string | undefined,
    onChunk: (text: string) => void,
    options?: ChatOptions,
  ): Promise<string>;
}
