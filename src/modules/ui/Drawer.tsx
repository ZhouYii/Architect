// ─── Implementation Drawer (Phase 6) ─────────────────────────────────────────
//
// Collapsible bottom drawer displaying the implementation task DAG.
// - Collapsed: thin bar with summary + Autopilot button
// - Expanded: scrollable task list with drag-to-resize handle

import { useCallback, useRef } from 'react';
import { useDesignStore } from '../store/store.js';
import { TOKENS } from '../../styles/theme.js';
import { DrawerTaskRow } from './DrawerTaskRow.js';
import type { ImplTaskStatus } from '../store/types.js';

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? (done / total) * 100 : 0;
  return (
    <div
      style={{
        width: 80,
        height: 4,
        background: TOKENS.bgSurfaceRaised,
        borderRadius: 2,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: TOKENS.statusGreen,
          borderRadius: 2,
          transition: 'width 300ms ease',
        }}
      />
    </div>
  );
}

// ─── Collapsed bar ────────────────────────────────────────────────────────────

function CollapsedBar({
  planId,
  summary,
  onExpand,
}: {
  planId: string | null;
  summary: { done: number; running: number; total: number };
  onExpand: () => void;
}) {
  return (
    <div
      style={{
        height: 32,
        background: '#3A3D4A',
        borderTop: `1px solid ${TOKENS.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: 12,
        cursor: 'pointer',
        userSelect: 'none',
        flexShrink: 0,
      }}
      onClick={onExpand}
      title="Expand drawer (keyboard: 2)"
    >
      <span style={{ fontSize: 11, color: TOKENS.textTertiary, flexShrink: 0 }}>▲</span>
      <span style={{ fontSize: 12, color: TOKENS.textPrimary, fontWeight: 500, flexShrink: 0 }}>
        Implementation{planId ? `: ${planId}` : ''}
      </span>

      {summary.total > 0 && (
        <>
          <span style={{ fontSize: 11, color: TOKENS.textTertiary }}>
            {summary.done}/{summary.total} done
          </span>
          {summary.running > 0 && (
            <span style={{ fontSize: 11, color: TOKENS.statusAmber }}>
              · {summary.running} running
            </span>
          )}
          <ProgressBar done={summary.done} total={summary.total} />
        </>
      )}

      {summary.total === 0 && (
        <span style={{ fontSize: 11, color: TOKENS.textTertiary, fontStyle: 'italic' }}>
          No tasks — click Plan Implementation to generate
        </span>
      )}

      <div style={{ flex: 1 }} />

      <button
        disabled
        style={{
          fontSize: 11,
          padding: '2px 10px',
          background: TOKENS.bgSurfaceRaised,
          color: TOKENS.textTertiary,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 4,
          cursor: 'not-allowed',
          opacity: 0.5,
        }}
        onClick={(e) => e.stopPropagation()}
        title="Autopilot (Phase 7)"
      >
        Autopilot
      </button>
    </div>
  );
}

// ─── Drag handle ──────────────────────────────────────────────────────────────

function DragHandle({
  onDragStart,
  onDoubleClick,
}: {
  onDragStart: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}) {
  return (
    <div
      onMouseDown={onDragStart}
      onDoubleClick={onDoubleClick}
      style={{
        height: 8,
        background: '#3A3D4A',
        cursor: 'row-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        borderTop: `1px solid ${TOKENS.border}`,
        userSelect: 'none',
      }}
      title="Drag to resize · double-click to toggle"
    >
      <div
        style={{
          width: 36,
          height: 3,
          borderRadius: 2,
          background: TOKENS.textGhost,
        }}
      />
    </div>
  );
}

// ─── Expanded content ─────────────────────────────────────────────────────────

function ExpandedContent({
  planId,
  summary,
  onCollapse,
}: {
  planId: string | null;
  summary: { done: number; running: number; total: number };
  onCollapse: () => void;
}) {
  const implTasks = useDesignStore((s) => s.impl_tasks);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <div
        style={{
          padding: '5px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: `1px solid ${TOKENS.border}`,
          flexShrink: 0,
          background: '#3A3D4A',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textPrimary, flex: 1 }}>
          Implementation{planId ? `: ${planId}` : ''}
        </span>

        {summary.total > 0 && (
          <>
            <span style={{ fontSize: 11, color: TOKENS.textTertiary }}>
              {summary.done}/{summary.total} done
            </span>
            {summary.running > 0 && (
              <span style={{ fontSize: 11, color: TOKENS.statusAmber }}>
                · {summary.running} running
              </span>
            )}
            <ProgressBar done={summary.done} total={summary.total} />
          </>
        )}

        <button
          disabled
          style={{
            fontSize: 11,
            padding: '2px 10px',
            background: TOKENS.bgSurfaceRaised,
            color: TOKENS.textTertiary,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 4,
            cursor: 'not-allowed',
            opacity: 0.5,
          }}
          title="Autopilot (Phase 7)"
        >
          Autopilot
        </button>

        <button
          onClick={onCollapse}
          style={{
            fontSize: 12,
            color: TOKENS.textTertiary,
            cursor: 'pointer',
            padding: '0 4px',
          }}
          title="Collapse drawer"
        >
          ▼
        </button>
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {implTasks.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: TOKENS.textTertiary,
              fontSize: 12,
            }}
          >
            No tasks. Click <strong style={{ color: TOKENS.textSecondary }}>Plan Implementation</strong> in the toolbar.
          </div>
        ) : (
          implTasks.map((task, i) => (
            <DrawerTaskRow key={task.id} task={task} index={i} allTasks={implTasks} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export function Drawer() {
  const drawerOpen = useDesignStore((s) => s.ui.drawer_open);
  const drawerHeight = useDesignStore((s) => s.ui.drawer_height);
  const planId = useDesignStore((s) => s.ui.impl_plan_id);
  const implTasks = useDesignStore((s) => s.impl_tasks);
  const toggleDrawer = useDesignStore((s) => s.toggleDrawer);
  const setDrawerHeight = useDesignStore((s) => s.setDrawerHeight);
  const setDrawerOpen = useDesignStore((s) => s.setDrawerOpen);

  const dragStartY = useRef<number | null>(null);
  const dragStartHeight = useRef<number>(drawerHeight);

  // Summary stats
  const summary = {
    total: implTasks.length,
    done: implTasks.filter((t) => t.status === 'done').length,
    running: implTasks.filter((t) => t.status === 'running').length,
    failed: implTasks.filter((t) => t.status === 'failed').length,
  };

  // ── Drag to resize ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragStartY.current = e.clientY;
      dragStartHeight.current = drawerHeight;

      const onMouseMove = (ev: MouseEvent) => {
        if (dragStartY.current === null) return;
        const delta = dragStartY.current - ev.clientY;
        setDrawerHeight(dragStartHeight.current + delta);
      };

      const onMouseUp = () => {
        dragStartY.current = null;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [drawerHeight, setDrawerHeight]
  );

  if (!drawerOpen) {
    return (
      <CollapsedBar
        planId={planId}
        summary={summary}
        onExpand={toggleDrawer}
      />
    );
  }

  return (
    <div
      style={{
        height: drawerHeight,
        display: 'flex',
        flexDirection: 'column',
        background: TOKENS.bgSurface,
        borderTop: `1px solid ${TOKENS.border}`,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <DragHandle
        onDragStart={handleDragStart}
        onDoubleClick={toggleDrawer}
      />
      <ExpandedContent
        planId={planId}
        summary={summary}
        onCollapse={() => setDrawerOpen(false)}
      />
    </div>
  );
}

// ─── Keyboard shortcut registration ──────────────────────────────────────────
// The keyboard handler for '2' is registered in Toolbar.tsx (Phase 6 wiring).
// Export a helper for Toolbar to use.
export function useDrawerKeyboardShortcut() {
  const toggleDrawer = useDesignStore((s) => s.toggleDrawer);
  return toggleDrawer;
}
