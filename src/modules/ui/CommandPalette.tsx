// ─── Command Palette (Phase 11) ───────────────────────────────────────────────
//
// Linear-style Ctrl+K command palette.
// - Fuzzy-matches across node names, actions, canvas names
// - Results grouped by category (Nodes, Actions, Canvases)
// - Keyboard navigable: up/down, Enter to execute, Escape to close

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDesignStore } from '../store/store.js';
import { TOKENS } from '../../styles/theme.js';
import { cutVersion, loadVersion } from '../workspace/versioning.js';
import { createTrack, switchTrack, mergeTrack } from '../workspace/tracks.js';
import {
  startExecution,
  pauseExecution,
  stopExecution,
} from '../orchestrator/executor.js';

// ─── Command definition ───────────────────────────────────────────────────────

interface Command {
  id: string;
  label: string;
  category: 'Nodes' | 'Actions' | 'Canvases';
  icon?: string;
  shortcut?: string;
  onExecute: () => void;
}

// ─── Simple fuzzy match ───────────────────────────────────────────────────────
// Returns a score > 0 if the query characters appear in order in the target.
// Higher = better (contiguous matches score higher).

function fuzzyScore(query: string, target: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  let qi = 0;
  let score = 0;
  let consecutive = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      score += consecutive * 2; // bonus for consecutive chars
    } else {
      consecutive = 0;
    }
  }

  return qi === q.length ? score : 0;
}

// ─── Category header ─────────────────────────────────────────────────────────

function CategoryHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: '6px 14px 3px',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: TOKENS.textTertiary,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  );
}

// ─── Result row ──────────────────────────────────────────────────────────────

function ResultRow({
  command,
  isSelected,
  onHover,
  onClick,
}: {
  command: Command;
  isSelected: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  return (
    <div
      onMouseEnter={onHover}
      onClick={onClick}
      style={{
        padding: '7px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        background: isSelected ? `${TOKENS.accent}1A` : 'transparent',
        borderLeft: isSelected ? `2px solid ${TOKENS.accent}` : '2px solid transparent',
        transition: 'background 80ms ease',
      }}
    >
      {command.icon && (
        <span
          style={{
            fontSize: 13,
            color: isSelected ? TOKENS.accent : TOKENS.textTertiary,
            flexShrink: 0,
            width: 18,
            textAlign: 'center',
          }}
        >
          {command.icon}
        </span>
      )}
      <span
        style={{
          fontSize: 13,
          color: isSelected ? TOKENS.textPrimary : TOKENS.textSecondary,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {command.label}
      </span>
      {command.shortcut && (
        <kbd
          style={{
            fontSize: 10,
            color: TOKENS.textTertiary,
            background: TOKENS.bgSurfaceRaised,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 3,
            padding: '1px 5px',
            flexShrink: 0,
            fontFamily: 'inherit',
          }}
        >
          {command.shortcut}
        </kbd>
      )}
    </div>
  );
}

// ─── CommandPalette ───────────────────────────────────────────────────────────

export function CommandPalette() {
  const isOpen = useDesignStore((s) => s.ui.command_palette_open);
  const setOpen = useDesignStore((s) => s.setCommandPaletteOpen);
  const canvases = useDesignStore((s) => s.canvases);
  const impl_tasks = useDesignStore((s) => s.impl_tasks);
  const active_track = useDesignStore((s) => s.active_track);
  const tracks = useDesignStore((s) => s.tracks);
  const execution_mode = useDesignStore((s) => s.execution_mode);
  const max_parallel = useDesignStore((s) => s.max_parallel);
  const last_major_version = useDesignStore((s) => s.ui.last_major_version);

  const navigateTo = useDesignStore((s) => s.navigateTo);
  const setViewMode = useDesignStore((s) => s.setViewMode);
  const toggleDeltaMode = useDesignStore((s) => s.toggleDeltaMode);
  const toggleDrawer = useDesignStore((s) => s.toggleDrawer);
  const setSidePanelTab = useDesignStore((s) => s.setSidePanelTab);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, [setOpen]);

  // ── Build command list ─────────────────────────────────────────────────────

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];

    // ── Actions ────────────────────────────────────────────────────────────

    list.push({
      id: 'action-conceptual',
      label: 'Switch to Design view',
      category: 'Actions',
      icon: '◆',
      shortcut: '1',
      onExecute: () => { setViewMode('conceptual'); },
    });

    list.push({
      id: 'action-code',
      label: 'Switch to Code view',
      category: 'Actions',
      icon: '≡',
      shortcut: '3',
      onExecute: () => { setViewMode('code'); },
    });

    list.push({
      id: 'action-toggle-drawer',
      label: 'Toggle implementation drawer',
      category: 'Actions',
      icon: '▤',
      shortcut: '2',
      onExecute: () => { toggleDrawer(); },
    });

    list.push({
      id: 'action-delta',
      label: 'Toggle delta mode',
      category: 'Actions',
      icon: '△',
      shortcut: 'D',
      onExecute: () => { toggleDeltaMode(); },
    });

    list.push({
      id: 'action-cut-version',
      label: 'Cut design version',
      category: 'Actions',
      icon: '✂',
      shortcut: 'Ctrl+.',
      onExecute: () => {
        cutVersion().catch((err: unknown) => {
          console.error('[command-palette] cutVersion failed:', err);
        });
      },
    });

    list.push({
      id: 'action-new-track',
      label: 'New design track',
      category: 'Actions',
      icon: '⎇',
      shortcut: 'Ctrl+B',
      onExecute: () => {
        const name = window.prompt('Track name:', `track-${Date.now()}`);
        if (!name?.trim()) return;
        const desc = window.prompt('Description (optional):', '') ?? '';
        createTrack(name.trim(), desc.trim() || undefined).catch((err: unknown) => {
          console.error('[command-palette] createTrack failed:', err);
        });
      },
    });

    if (active_track) {
      list.push({
        id: 'action-merge-track',
        label: `Merge track "${active_track}" into main`,
        category: 'Actions',
        icon: '⇐',
        shortcut: 'Ctrl+M',
        onExecute: () => {
          if (!window.confirm(`Merge track "${active_track}" into main?`)) return;
          mergeTrack(active_track).catch((err: unknown) => {
            console.error('[command-palette] mergeTrack failed:', err);
          });
        },
      });

      list.push({
        id: 'action-switch-main',
        label: 'Switch to main branch',
        category: 'Actions',
        icon: '⎇',
        onExecute: () => {
          switchTrack(null).catch((err: unknown) => {
            console.error('[command-palette] switchTrack failed:', err);
          });
        },
      });
    }

    // Per-track switch actions
    for (const track of tracks) {
      if (track.name !== active_track) {
        list.push({
          id: `action-switch-track-${track.name}`,
          label: `Switch to track "${track.name}"`,
          category: 'Actions',
          icon: '⎇',
          onExecute: () => {
            switchTrack(track.name).catch((err: unknown) => {
              console.error('[command-palette] switchTrack failed:', err);
            });
          },
        });
      }
    }

    // Execution controls
    const isRunning = execution_mode === 'autopilot' || execution_mode === 'manual';
    const isIdle = execution_mode === 'idle';
    const hasTasks = impl_tasks.length > 0;

    if (hasTasks && isIdle) {
      list.push({
        id: 'action-start-autopilot',
        label: 'Start autopilot execution',
        category: 'Actions',
        icon: '▶',
        shortcut: 'Space',
        onExecute: () => {
          startExecution('autopilot', { max_parallel }).catch(console.error);
        },
      });
    }

    if (isRunning) {
      list.push({
        id: 'action-pause',
        label: 'Pause execution',
        category: 'Actions',
        icon: '⏸',
        shortcut: 'Space',
        onExecute: () => { pauseExecution(); },
      });

      list.push({
        id: 'action-stop',
        label: 'Stop execution',
        category: 'Actions',
        icon: '⏹',
        onExecute: () => { stopExecution(); },
      });
    }

    // Side panel tabs
    list.push({
      id: 'action-tab-inspector',
      label: 'Open Inspector tab',
      category: 'Actions',
      icon: '◫',
      onExecute: () => { setSidePanelTab('inspector'); },
    });

    list.push({
      id: 'action-tab-changesets',
      label: 'Open Changesets tab',
      category: 'Actions',
      icon: '◫',
      onExecute: () => { setSidePanelTab('changesets'); },
    });

    list.push({
      id: 'action-tab-chat',
      label: 'Open Chat tab',
      category: 'Actions',
      icon: '◫',
      onExecute: () => { setSidePanelTab('chat'); },
    });

    // Restore from version
    if (last_major_version > 0) {
      for (let v = last_major_version; v >= Math.max(1, last_major_version - 4); v--) {
        const ver = v;
        list.push({
          id: `action-restore-v${ver}`,
          label: `Restore from version v${ver}`,
          category: 'Actions',
          icon: '↩',
          onExecute: () => {
            if (!window.confirm(`Restore workspace to version v${ver}? Current changes will be lost.`)) return;
            loadVersion(ver).catch((err: unknown) => {
              console.error('[command-palette] loadVersion failed:', err);
            });
          },
        });
      }
    }

    // ── Canvases ────────────────────────────────────────────────────────────

    for (const canvas of Object.values(canvases)) {
      list.push({
        id: `canvas-${canvas.id}`,
        label: canvas.label,
        category: 'Canvases',
        icon: '⬡',
        onExecute: () => { navigateTo(canvas.id); },
      });
    }

    // ── Nodes ────────────────────────────────────────────────────────────────

    for (const canvas of Object.values(canvases)) {
      for (const node of canvas.components) {
        list.push({
          id: `node-${canvas.id}-${node.id}`,
          label: `${node.name} (${canvas.label})`,
          category: 'Nodes',
          icon: node.kind === 'block' ? '◆' : '→',
          onExecute: () => {
            navigateTo(canvas.id);
          },
        });
      }
    }

    return list;
  }, [
    canvases,
    impl_tasks,
    active_track,
    tracks,
    execution_mode,
    max_parallel,
    last_major_version,
    navigateTo,
    setViewMode,
    toggleDeltaMode,
    toggleDrawer,
    setSidePanelTab,
  ]);

  // ── Filter + group results ─────────────────────────────────────────────────

  type CategoryGroup = {
    category: Command['category'];
    items: Command[];
  };

  const filteredGroups = useMemo<CategoryGroup[]>(() => {
    const scored = commands
      .map((cmd) => ({ cmd, score: fuzzyScore(query, cmd.label) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    const byCategory: Record<string, Command[]> = {};
    for (const { cmd } of scored) {
      if (!byCategory[cmd.category]) byCategory[cmd.category] = [];
      byCategory[cmd.category].push(cmd);
    }

    const order: Command['category'][] = ['Actions', 'Canvases', 'Nodes'];
    return order
      .filter((cat) => byCategory[cat]?.length)
      .map((cat) => ({ category: cat, items: byCategory[cat] }));
  }, [commands, query]);

  const flatResults = useMemo(
    () => filteredGroups.flatMap((g) => g.items),
    [filteredGroups]
  );

  // Clamp selectedIndex when results change
  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(0, flatResults.length - 1)));
  }, [flatResults.length]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // ── Keyboard navigation ────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = flatResults[selectedIndex];
        if (cmd) {
          close();
          cmd.onExecute();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    },
    [flatResults, selectedIndex, close]
  );

  if (!isOpen) return null;

  return (
    // Backdrop
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '14vh',
        animation: 'cp-backdrop-in 120ms ease',
      }}
    >
      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: 'calc(100vw - 48px)',
          background: TOKENS.bgSurface,
          border: `1px solid ${TOKENS.borderFocus}`,
          borderRadius: 10,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'cp-modal-in 150ms ease',
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            borderBottom: `1px solid ${TOKENS.border}`,
            gap: 10,
          }}
        >
          <span style={{ fontSize: 14, color: TOKENS.textTertiary, flexShrink: 0 }}>
            ⌘
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, nodes, canvases…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 15,
              color: TOKENS.textPrimary,
              padding: '13px 0',
              caretColor: TOKENS.accent,
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd
            style={{
              fontSize: 10,
              color: TOKENS.textTertiary,
              background: TOKENS.bgSurfaceRaised,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: 3,
              padding: '2px 6px',
              flexShrink: 0,
              fontFamily: 'inherit',
            }}
          >
            Esc
          </kbd>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          style={{
            maxHeight: 380,
            overflowY: 'auto',
            padding: '6px 0',
          }}
        >
          {flatResults.length === 0 ? (
            <div
              style={{
                padding: '24px 14px',
                textAlign: 'center',
                color: TOKENS.textTertiary,
                fontSize: 13,
              }}
            >
              {query ? 'No results' : 'Type to search…'}
            </div>
          ) : (
            (() => {
              let flatIdx = 0;
              return filteredGroups.map((group) => (
                <div key={group.category}>
                  <CategoryHeader label={group.category} />
                  {group.items.map((cmd) => {
                    const idx = flatIdx++;
                    return (
                      <div key={cmd.id} data-selected={idx === selectedIndex ? 'true' : undefined}>
                        <ResultRow
                          command={cmd}
                          isSelected={idx === selectedIndex}
                          onHover={() => setSelectedIndex(idx)}
                          onClick={() => {
                            close();
                            cmd.onExecute();
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ));
            })()
          )}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '7px 14px',
            borderTop: `1px solid ${TOKENS.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          {[
            ['↑↓', 'navigate'],
            ['Enter', 'execute'],
            ['Esc', 'close'],
          ].map(([key, desc]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <kbd
                style={{
                  fontSize: 9,
                  color: TOKENS.textTertiary,
                  background: TOKENS.bgSurfaceRaised,
                  border: `1px solid ${TOKENS.border}`,
                  borderRadius: 3,
                  padding: '1px 4px',
                  fontFamily: 'inherit',
                }}
              >
                {key}
              </kbd>
              <span style={{ fontSize: 10, color: TOKENS.textGhost }}>{desc}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
