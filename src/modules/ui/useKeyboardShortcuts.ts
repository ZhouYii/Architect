// ─── Global Keyboard Shortcuts (Phase 11) ─────────────────────────────────────
//
// Consolidated keyboard handler covering all shortcuts from the design doc.
//
// | Context | Shortcut | Action                            |
// |---------|----------|-----------------------------------|
// | Global  | Ctrl+K   | Command palette                   |
// |         | 1        | Design screen (conceptual view)   |
// |         | 2        | Toggle drawer                     |
// |         | 3        | Code view                         |
// |         | Tab      | Cycle side panel tabs             |
// | Canvas  | N        | New block at cursor               |
// |         | E        | Draw arrow from selected          |
// |         | Enter    | Open inspector for selected       |
// |         | D        | Toggle delta mode                 |
// |         | Ctrl+.   | Cut design version                |
// |         | Ctrl+B   | New design track                  |
// |         | Ctrl+[   | Switch tracks (prev)              |
// |         | Ctrl+]   | Switch tracks (next)              |
// |         | Ctrl+M   | Merge current track               |
// |         | /        | Focus chat input                  |
// |         | Ctrl+↓   | Drill down                        |
// |         | Ctrl+↑   | Navigate up                       |
// | Drawer  | Space    | Start/pause execution             |
// |         | A        | Toggle autopilot                  |
// |         | L        | Open log for selected task        |
// |         | R        | Retry selected failed task        |

import { useEffect } from 'react';
import { useDesignStore } from '../store/store.js';
import { cutVersion } from '../workspace/versioning.js';
import { createTrack, switchTrack, mergeTrack } from '../workspace/tracks.js';
import {
  startExecution,
  pauseExecution,
  resumeExecution,
} from '../orchestrator/executor.js';
import type { UIState } from '../store/types.js';

const SIDE_PANEL_TABS: UIState['side_panel_tab'][] = ['inspector', 'changesets', 'chat'];

export function useKeyboardShortcuts() {
  const toggleCommandPalette = useDesignStore((s) => s.toggleCommandPalette);
  const setViewMode = useDesignStore((s) => s.setViewMode);
  const toggleDrawer = useDesignStore((s) => s.toggleDrawer);
  const toggleDeltaMode = useDesignStore((s) => s.toggleDeltaMode);
  const setSidePanelTab = useDesignStore((s) => s.setSidePanelTab);
  const setSidePanelOpen = useDesignStore((s) => s.setSidePanelOpen);
  const navigateUp = useDesignStore((s) => s.navigateUp);
  const selectNode = useDesignStore((s) => s.selectNode);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // ── Ctrl+K — command palette (fires even when typing) ─────────────────
      if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      // ── Escape — close command palette if open ───────────────────────────
      if (e.key === 'Escape') {
        const state = useDesignStore.getState();
        if (state.ui.command_palette_open) {
          state.setCommandPaletteOpen(false);
          e.preventDefault();
        }
        return;
      }

      // All other shortcuts are suppressed when user is typing
      if (isTyping) return;

      // ── 1 — design screen (conceptual view) ──────────────────────────────
      if (e.key === '1' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setViewMode('conceptual');
        return;
      }

      // ── 2 — toggle implementation drawer ─────────────────────────────────
      if (e.key === '2' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleDrawer();
        return;
      }

      // ── 3 — code view ─────────────────────────────────────────────────────
      if (e.key === '3' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setViewMode('code');
        return;
      }

      // ── Tab — cycle side panel tabs ───────────────────────────────────────
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        const state = useDesignStore.getState();
        setSidePanelOpen(true);
        const currentTab = state.ui.side_panel_tab;
        const idx = SIDE_PANEL_TABS.indexOf(currentTab);
        const nextTab = SIDE_PANEL_TABS[(idx + 1) % SIDE_PANEL_TABS.length];
        setSidePanelTab(nextTab);
        return;
      }

      // ── D — toggle delta mode ─────────────────────────────────────────────
      if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleDeltaMode();
        return;
      }

      // ── N — new block (prompt-based, adds to current canvas) ─────────────
      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        _handleNewBlock();
        return;
      }

      // ── E — draw arrow from selected node ─────────────────────────────────
      if ((e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        _handleDrawArrow();
        return;
      }

      // ── Enter — open inspector for selected node ──────────────────────────
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        const state = useDesignStore.getState();
        if (state.ui.selected_node_id) {
          e.preventDefault();
          state.setSidePanelTab('inspector');
          state.setSidePanelOpen(true);
        }
        return;
      }

      // ── / — focus chat input ──────────────────────────────────────────────
      if (e.key === '/') {
        e.preventDefault();
        setSidePanelTab('chat');
        setSidePanelOpen(true);
        // Focus the textarea in the chat panel (best-effort)
        requestAnimationFrame(() => {
          const el = document.querySelector<HTMLElement>(
            '.chat-panel-input, [data-chat-input], textarea[placeholder*="ask"]'
          );
          el?.focus();
        });
        return;
      }

      // ── Ctrl+. — cut design version ───────────────────────────────────────
      if (e.ctrlKey && e.key === '.') {
        e.preventDefault();
        cutVersion().catch((err: unknown) => {
          console.error('[shortcuts] cutVersion failed:', err);
        });
        return;
      }

      // ── Ctrl+B — new design track ─────────────────────────────────────────
      if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        const name = window.prompt('Track name:', `track-${Date.now()}`);
        if (!name?.trim()) return;
        const desc = window.prompt('Description (optional):', '') ?? '';
        createTrack(name.trim(), desc.trim() || undefined).catch((err: unknown) => {
          console.error('[shortcuts] createTrack failed:', err);
        });
        return;
      }

      // ── Ctrl+[ — switch to previous track ────────────────────────────────
      if (e.ctrlKey && e.key === '[') {
        e.preventDefault();
        const { active_track, tracks } = useDesignStore.getState();
        if (active_track !== null) {
          switchTrack(null).catch((err: unknown) => {
            console.error('[shortcuts] switchTrack(null) failed:', err);
          });
        } else if (tracks.length > 0) {
          switchTrack(tracks[0].name).catch((err: unknown) => {
            console.error('[shortcuts] switchTrack failed:', err);
          });
        }
        return;
      }

      // ── Ctrl+] — switch to next track ────────────────────────────────────
      if (e.ctrlKey && e.key === ']') {
        e.preventDefault();
        const { active_track, tracks } = useDesignStore.getState();
        if (active_track === null && tracks.length > 0) {
          switchTrack(tracks[0].name).catch((err: unknown) => {
            console.error('[shortcuts] switchTrack failed:', err);
          });
        } else if (active_track !== null && tracks.length > 0) {
          const idx = tracks.findIndex((t) => t.name === active_track);
          const nextIdx = (idx + 1) % tracks.length;
          switchTrack(tracks[nextIdx].name).catch((err: unknown) => {
            console.error('[shortcuts] switchTrack failed:', err);
          });
        }
        return;
      }

      // ── Ctrl+M — merge current track into main ────────────────────────────
      if (e.ctrlKey && (e.key === 'm' || e.key === 'M')) {
        const { active_track } = useDesignStore.getState();
        if (!active_track) return;
        e.preventDefault();
        if (!window.confirm(`Merge track "${active_track}" into main?`)) return;
        mergeTrack(active_track).catch((err: unknown) => {
          console.error('[shortcuts] mergeTrack failed:', err);
        });
        return;
      }

      // ── Ctrl+↓ — drill down into selected node's child canvas ────────────
      if (e.ctrlKey && e.key === 'ArrowDown') {
        e.preventDefault();
        const state = useDesignStore.getState();
        const canvasId = state.ui.current_path[state.ui.current_path.length - 1];
        const canvas = state.canvases[canvasId];
        const selectedId = state.ui.selected_node_id;
        if (canvas && selectedId) {
          const node = canvas.components.find((n) => n.id === selectedId);
          if (node?.has_children && node.child_canvas_id) {
            state.navigateTo(node.child_canvas_id);
          }
        }
        return;
      }

      // ── Ctrl+↑ — navigate up ─────────────────────────────────────────────
      if (e.ctrlKey && e.key === 'ArrowUp') {
        e.preventDefault();
        navigateUp();
        return;
      }

      // ── Space — start/pause execution ─────────────────────────────────────
      if (e.code === 'Space') {
        e.preventDefault();
        const { execution_mode, max_parallel } = useDesignStore.getState();
        if (execution_mode === 'idle') {
          startExecution('autopilot', { max_parallel }).catch(console.error);
        } else if (execution_mode === 'autopilot' || execution_mode === 'manual') {
          pauseExecution();
        } else if (execution_mode === 'paused') {
          resumeExecution({ max_parallel });
        }
        return;
      }

      // ── A — toggle autopilot ──────────────────────────────────────────────
      if ((e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey) {
        const { execution_mode, max_parallel } = useDesignStore.getState();
        if (execution_mode === 'idle') {
          startExecution('autopilot', { max_parallel }).catch(console.error);
        }
        return;
      }

      // ── L — open log for selected task ────────────────────────────────────
      if ((e.key === 'l' || e.key === 'L') && !e.ctrlKey && !e.metaKey) {
        const { ui } = useDesignStore.getState();
        if (ui.selected_task_id) {
          setSidePanelTab('inspector');
          setSidePanelOpen(true);
        }
        return;
      }

      // ── R — retry selected failed task ────────────────────────────────────
      if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
        const { ui, impl_tasks, updateTaskStatus } = useDesignStore.getState();
        if (ui.selected_task_id) {
          const task = impl_tasks.find((t) => t.id === ui.selected_task_id);
          if (task?.status === 'failed') {
            updateTaskStatus(task.id, 'queued');
          }
        }
        return;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    toggleCommandPalette,
    setViewMode,
    toggleDrawer,
    toggleDeltaMode,
    setSidePanelTab,
    setSidePanelOpen,
    navigateUp,
    selectNode,
  ]);
}

// ─── Canvas-level helpers ─────────────────────────────────────────────────────

function _handleNewBlock() {
  const state = useDesignStore.getState();
  const canvasId = state.ui.current_path[state.ui.current_path.length - 1];
  const canvas = state.canvases[canvasId];
  if (!canvas) return;

  const name = window.prompt('Block name:');
  if (!name?.trim()) return;

  const id = `block-${Date.now()}`;
  state.addBlock(canvasId, {
    id,
    kind: 'block',
    block_type: 'module',
    name: name.trim(),
    status: 'proposed',
    x: 200 + Math.random() * 200,
    y: 200 + Math.random() * 100,
    contract: { invariants: [], test_cases: [] },
  });
  state.selectNode(id);
}

function _handleDrawArrow() {
  const state = useDesignStore.getState();
  const selectedId = state.ui.selected_node_id;
  if (!selectedId) {
    console.info('[shortcuts] E: no node selected — select a block first');
    return;
  }
  const canvasId = state.ui.current_path[state.ui.current_path.length - 1];
  const canvas = state.canvases[canvasId];
  if (!canvas) return;

  const targetName = window.prompt('Connect to (block name):');
  if (!targetName?.trim()) return;

  const target = canvas.components.find(
    (n) => n.name.toLowerCase() === targetName.trim().toLowerCase()
  );
  if (!target) {
    alert(`No block named "${targetName}" in this canvas.`);
    return;
  }

  const arrowId = `arrow-${Date.now()}`;
  state.addArrow(canvasId, {
    id: arrowId,
    kind: 'arrow',
    name: `${selectedId} → ${target.id}`,
    status: 'proposed',
    source: selectedId,
    target: target.id,
    arrow_type: 'calls',
  });
}
