/**
 * Safe child-process wrapper.
 *
 * Uses execFile (NOT exec) to avoid shell injection — args are passed as a
 * separate array and are never interpolated into a shell command string.
 *
 * On Windows, many CLI tools are `.cmd` wrappers (e.g. `claude.cmd`).
 * We try both the bare name and common suffixes (.cmd, .exe) so callers
 * don't need to worry about platform differences.
 */

import { execFile as _execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(_execFile);

export interface ExecResult {
  stdout: string;
  stderr: string;
  status: 'ok' | 'error';
  code: number;
}

/**
 * Run `program` with `args` and return structured output.
 * Never throws — errors are captured in the return value.
 *
 * @param program  The binary name (no shell expansion).
 * @param args     Argument array (each element is a separate arg).
 * @param options  Optional timeout (ms, default 30 000) and cwd.
 */
export async function execFileNoThrow(
  program: string,
  args: string[],
  options: { timeout?: number; cwd?: string } = {}
): Promise<ExecResult> {
  const timeout = options.timeout ?? 30_000;
  const cwd = options.cwd;

  // On Windows, try resolving .cmd suffix if the bare name fails
  const candidates = process.platform === 'win32'
    ? [program, `${program}.cmd`, `${program}.exe`]
    : [program];

  for (const candidate of candidates) {
    try {
      const { stdout, stderr } = await execFileAsync(candidate, args, {
        timeout,
        cwd,
        maxBuffer: 10 * 1024 * 1024, // 10 MB
      });
      return { stdout: stdout.trim(), stderr: stderr.trim(), status: 'ok', code: 0 };
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException & {
        code?: string | number;
        stdout?: Buffer | string;
        stderr?: Buffer | string;
      };
      // If the error is "not found" (ENOENT), try the next candidate
      if (e.code === 'ENOENT' && candidate !== candidates[candidates.length - 1]) {
        continue;
      }
      return {
        stdout: (e.stdout ?? '').toString().trim(),
        stderr: (e.stderr ?? String(err)).toString().trim(),
        status: 'error',
        code: typeof e.code === 'number' ? e.code : 1,
      };
    }
  }

  return { stdout: '', stderr: `${program}: not found`, status: 'error', code: 127 };
}
