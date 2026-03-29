/**
 * Thin IPC wrapper around Tauri's invoke.
 * All frontend→backend calls should go through this module.
 */
export { invoke } from '@tauri-apps/api/core';
