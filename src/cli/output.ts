/**
 * Shared output helper for CLI commands.
 * Supports --format json (machine-readable) or default human-readable text.
 */

export type OutputFormat = 'text' | 'json';

/**
 * Output `data` in the requested format.
 * For JSON format, emits a single pretty-printed JSON line to stdout.
 * For text format, callers use console.log directly; this is a no-op.
 */
export function output(data: unknown, format: OutputFormat): void {
  if (format === 'json') {
    console.log(JSON.stringify(data, null, 2));
  }
  // text: callers handle their own output
}

/**
 * Parse --format flag from args.
 * Returns 'json' if any arg is '--format' followed by 'json', else 'text'.
 */
export function parseFormat(args: string[]): OutputFormat {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1] === 'json') return 'json';
    if (args[i] === '--format=json') return 'json';
  }
  return 'text';
}

/**
 * Remove --format <value> or --format=<value> from an args array.
 */
export function stripFormatArg(args: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format') {
      i++; // skip next (the value)
      continue;
    }
    if (args[i]?.startsWith('--format=')) continue;
    result.push(args[i]);
  }
  return result;
}
