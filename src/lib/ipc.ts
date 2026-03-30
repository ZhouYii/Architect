/**
 * Thin IPC wrapper around Tauri's invoke.
 * All frontend→backend calls should go through this module.
 *
 * When running in a plain browser (no Tauri WebView), invoke() is unavailable.
 * safeInvoke() detects this and returns null instead of crashing.
 */

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

export async function safeInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T | null> {
  if (!isTauri()) {
    console.warn(`[ipc] Not in Tauri, skipping invoke: ${cmd}`);
    return null;
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

// Keep the legacy named export for compatibility with any direct import of `invoke`.
// New code should use safeInvoke instead.
export { safeInvoke as invoke };
