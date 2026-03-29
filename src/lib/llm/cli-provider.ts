import { Command } from '@tauri-apps/plugin-shell';
import type { LLMProvider, ChatOptions } from './provider';

export class CLIProvider implements LLMProvider {
  id: string;
  name: string;
  private _command: string;
  private _baseArgs: string[];

  constructor(id: string, name: string, command: string, baseArgs: string[]) {
    this.id = id;
    this.name = name;
    this._command = command;
    this._baseArgs = baseArgs;
  }

  async available(): Promise<boolean> {
    try {
      const output = await Command.create(this._command, ['--version']).execute();
      return output.code === 0;
    } catch {
      return false;
    }
  }

  private buildPrompt(prompt: string, context?: string, options?: ChatOptions): string {
    const parts: string[] = [];
    if (options?.systemPrompt) {
      parts.push(options.systemPrompt);
      parts.push('---');
    }
    if (context) {
      parts.push(context);
      parts.push('---');
    }
    parts.push(prompt);
    return parts.join('\n\n');
  }

  async chat(prompt: string, context?: string, options?: ChatOptions): Promise<string> {
    const fullPrompt = this.buildPrompt(prompt, context, options);
    const output = await Command.create(
      this._command,
      [...this._baseArgs, fullPrompt],
    ).execute();

    if (output.code !== 0) {
      throw new Error(output.stderr || `${this.name} exited with code ${output.code}`);
    }
    return output.stdout;
  }

  async chatStream(
    prompt: string,
    context: string | undefined,
    onChunk: (text: string) => void,
    options?: ChatOptions,
  ): Promise<string> {
    const fullPrompt = this.buildPrompt(prompt, context, options);
    const cmd = Command.create(this._command, [...this._baseArgs, fullPrompt]);

    let full = '';

    return new Promise((resolve, reject) => {
      cmd.stdout.on('data', (line: string) => {
        onChunk(line);
        full += line;
      });

      cmd.stderr.on('data', (line: string) => {
        console.warn(`[${this.name} stderr]`, line);
      });

      cmd.on('close', (data: { code: number | null }) => {
        if (data.code === 0) resolve(full);
        else reject(new Error(`${this.name} exited with code ${data.code}`));
      });

      cmd.on('error', (error: string) => {
        reject(new Error(error));
      });

      cmd.spawn().catch(reject);
    });
  }
}
