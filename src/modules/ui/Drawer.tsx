// ─── Implementation Drawer (Phase 6 + 7 + 8) ─────────────────────────────────
//
// Collapsible bottom drawer displaying the implementation task DAG.
// - Collapsed: thin bar with summary + Autopilot button
// - Expanded: scrollable task list with drag-to-resize handle
// Phase 7 additions:
// - Autopilot / Manual / Pause / Stop controls (live execution engine)
// - Keyboard: Space = start/pause, A = toggle autopilot mode
// Phase 8 additions:
// - Completion summary bar with phase indicator
// - Verify / Fix Issues / Update Design buttons

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDesignStore } from '../store/store.js';
import { TOKENS } from '../../styles/theme.js';
import { DrawerTaskRow } from './DrawerTaskRow.js';
import {
  startExecution,
  pauseExecution,
  resumeExecution,
  stopExecution,
} from '../orchestrator/executor.js';
import { runVerification } from '../orchestrator/verification.js';
import { generateFixPlan } from '../orchestrator/planner.js';
import { generatePostImplChangeset, applyPostImplChangeset } from '../orchestrator/post-impl.js';
import { generateCompletionReport } from '../orchestrator/report.js';

// ─── Phase pill ───────────────────────────────────────────────────────────────

function PhasePill({ phase }: { phase: string }) {
  const color =
    phase === 'complete'
      ? TOKENS.statusGreen
      : phase === 'verifying'
      ? TOKENS.accent
      : phase === 'executing'
      ? TOKENS.statusAmber
      : phase === 'planning'
      ? TOKENS.statusBlue
      : TOKENS.textTertiary;

  const label =
    phase === 'idle'
      ? 'Idle'
      : phase === 'planning'
      ? 'Planning'
      : phase === 'executing'
      ? 'Executing'
      : phase === 'verifying'
      ? 'Verifying'
      : 'Complete';

  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: '1px 7px',
        borderRadius: 10,
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        letterSpacing: '0.03em',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

// ─── Execution controls (Phase 7) ────────────────────────────────────────────

function ExecutionControls({ compact = false }: { compact?: boolean }) {
  const executionMode = useDesignStore((s) => s.execution_mode);
  const implTasks = useDesignStore((s) => s.impl_tasks);
  const maxParallel = useDesignStore((s) => s.max_parallel);

  const hasTasks = implTasks.length > 0;
  const isIdle = executionMode === 'idle';
  const isPaused = executionMode === 'paused';
  const isRunning = executionMode === 'autopilot' || executionMode === 'manual';

  const handleAutopilot = useCallback(() => {
    if (isRunning) return;
    startExecution('autopilot', { max_parallel: maxParallel }).catch(console.error);
  }, [isRunning, maxParallel]);

  const handleManual = useCallback(() => {
    if (isRunning) return;
    startExecution('manual', { max_parallel: maxParallel }).catch(console.error);
  }, [isRunning, maxParallel]);

  const handlePauseResume = useCallback(() => {
    if (isRunning) {
      pauseExecution();
    } else if (isPaused) {
      resumeExecution({ max_parallel: maxParallel });
    }
  }, [isRunning, isPaused, maxParallel]);

  const handleStop = useCallback(() => {
    stopExecution();
  }, []);

  if (compact) {
    // Collapsed bar: single button that toggles autopilot
    return (
      <button
        disabled={!hasTasks}
        onClick={(e) => {
          e.stopPropagation();
          if (isRunning) {
            pauseExecution();
          } else if (isPaused) {
            resumeExecution({ max_parallel: maxParallel });
          } else {
            handleAutopilot();
          }
        }}
        style={{
          fontSize: 11,
          padding: '2px 10px',
          background: isRunning
            ? `${TOKENS.statusAmber}22`
            : isPaused
            ? `${TOKENS.statusBlue}22`
            : `${TOKENS.accent}18`,
          color: isRunning
            ? TOKENS.statusAmber
            : isPaused
            ? TOKENS.statusBlue
            : hasTasks
            ? TOKENS.accent
            : TOKENS.textTertiary,
          border: `1px solid ${isRunning ? TOKENS.statusAmber : isPaused ? TOKENS.statusBlue : TOKENS.accent}44`,
          borderRadius: 4,
          cursor: hasTasks ? 'pointer' : 'not-allowed',
          opacity: hasTasks ? 1 : 0.45,
          flexShrink: 0,
          fontWeight: 500,
        }}
        title={
          !hasTasks
            ? 'No tasks — generate a plan first'
            : isRunning
            ? 'Pause execution (Space)'
            : isPaused
            ? 'Resume execution (Space)'
            : 'Start autopilot (Space)'
        }
      >
        {isRunning ? '⏸ Running' : isPaused ? '▶ Resume' : '▶ Autopilot'}
      </button>
    );
  }

  // Expanded bar: full controls
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {(isIdle || isPaused) && (
        <>
          <button
            disabled={!hasTasks || isRunning}
            onClick={isIdle ? handleAutopilot : () => resumeExecution({ max_parallel: maxParallel })}
            style={_btnStyle(TOKENS.accent, hasTasks && !isRunning)}
            title="Start autopilot — runs all tasks automatically (Space)"
          >
            {isPaused ? '▶ Resume' : '▶ Auto'}
          </button>
          {isIdle && (
            <button
              disabled={!hasTasks || isRunning}
              onClick={handleManual}
              style={_btnStyle(TOKENS.statusBlue, hasTasks && !isRunning)}
              title="Manual mode — approve tasks one by one"
            >
              Manual
            </button>
          )}
        </>
      )}

      {isRunning && (
        <button
          onClick={handlePauseResume}
          style={_btnStyle(TOKENS.statusAmber, true)}
          title="Pause execution (Space)"
        >
          ⏸ Pause
        </button>
      )}

      {(isRunning || isPaused) && (
        <button
          onClick={handleStop}
          style={_btnStyle(TOKENS.statusRed, true)}
          title="Stop execution"
        >
          ⏹ Stop
        </button>
      )}

      {/* Execution mode badge */}
      {!isIdle && (
        <span
          style={{
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 8,
            background: isRunning ? `${TOKENS.statusAmber}22` : `${TOKENS.statusBlue}22`,
            color: isRunning ? TOKENS.statusAmber : TOKENS.statusBlue,
            border: `1px solid ${isRunning ? TOKENS.statusAmber : TOKENS.statusBlue}44`,
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          {executionMode}
        </span>
      )}
    </div>
  );
}

function _btnStyle(color: string, enabled: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    padding: '2px 8px',
    background: enabled ? `${color}18` : TOKENS.bgSurfaceRaised,
    color: enabled ? color : TOKENS.textTertiary,
    border: `1px solid ${enabled ? color : TOKENS.border}44`,
    borderRadius: 4,
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.4,
    fontWeight: 500,
    flexShrink: 0,
  };
}

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

      <ExecutionControls compact />
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

// ─── Completion summary bar (Phase 8) ────────────────────────────────────────

function CompletionSummaryBar({
  report,
  onDismiss,
}: {
  report: string;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: `${TOKENS.statusGreen}18`,
        borderTop: `1px solid ${TOKENS.statusGreen}44`,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '4px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span style={{ fontSize: 11, color: TOKENS.statusGreen, fontWeight: 600 }}>
          Implementation Complete
        </span>
        <span style={{ flex: 1 }} />
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          style={{ fontSize: 11, color: TOKENS.textTertiary, cursor: 'pointer', padding: '0 4px' }}
          title="Dismiss report"
        >
          ✕
        </button>
        <span style={{ fontSize: 10, color: TOKENS.textTertiary }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>
      {expanded && (
        <pre
          style={{
            margin: 0,
            padding: '8px 14px',
            fontSize: 10,
            color: TOKENS.textSecondary,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            maxHeight: 200,
            overflowY: 'auto',
            borderTop: `1px solid ${TOKENS.border}`,
          }}
        >
          {report}
        </pre>
      )}
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
  const implPhase = useDesignStore((s) => s.ui.impl_phase);
  const completionReport = useDesignStore((s) => s.ui.completion_report);
  const setImplPhase = useDesignStore((s) => s.setImplPhase);
  const setCompletionReport = useDesignStore((s) => s.setCompletionReport);
  const appendFixTasks = useDesignStore((s) => s.appendFixTasks);

  const [isVerifying, setIsVerifying] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // ── Verify handler ──────────────────────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    setIsVerifying(true);
    setImplPhase('verifying');
    try {
      const results = await runVerification(implTasks);
      const report = generateCompletionReport(implTasks, results);
      setCompletionReport(report.formattedText);
      setImplPhase('complete');
    } catch (err) {
      console.error('[drawer] verification failed:', err);
      setImplPhase('complete');
    } finally {
      setIsVerifying(false);
    }
  }, [implTasks, setImplPhase, setCompletionReport]);

  // ── Fix Issues handler ──────────────────────────────────────────────────────
  const handleFixIssues = useCallback(async () => {
    const failedTasks = implTasks.filter((t) => t.status === 'failed');
    if (failedTasks.length === 0) return;

    setIsFixing(true);
    try {
      const fixTasks = await generateFixPlan(failedTasks);
      if (fixTasks.length > 0) {
        appendFixTasks(fixTasks);
        setImplPhase('executing');
        setCompletionReport(null);
      }
    } catch (err) {
      console.error('[drawer] generateFixPlan failed:', err);
    } finally {
      setIsFixing(false);
    }
  }, [implTasks, appendFixTasks, setImplPhase, setCompletionReport]);

  // ── Update Design handler ───────────────────────────────────────────────────
  const handleUpdateDesign = useCallback(async () => {
    setIsUpdating(true);
    try {
      const changeset = generatePostImplChangeset(implTasks);
      applyPostImplChangeset(changeset);
    } catch (err) {
      console.error('[drawer] post-impl changeset failed:', err);
    } finally {
      setIsUpdating(false);
    }
  }, [implTasks]);

  const failedCount = implTasks.filter((t) => t.status === 'failed').length;
  const allDone = implTasks.length > 0 &&
    implTasks.every((t) => t.status === 'done' || t.status === 'failed' || t.status === 'escalated');

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
        <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textPrimary }}>
          Implementation{planId ? `: ${planId}` : ''}
        </span>

        <PhasePill phase={implPhase} />

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

        <div style={{ flex: 1 }} />

        {/* Phase 8: action buttons — shown when tasks are all terminal */}
        {allDone && (
          <>
            <button
              onClick={() => { void handleVerify(); }}
              disabled={isVerifying}
              style={{
                fontSize: 11,
                padding: '2px 9px',
                background: `${TOKENS.accent}18`,
                color: isVerifying ? TOKENS.textTertiary : TOKENS.accent,
                border: `1px solid ${TOKENS.accent}44`,
                borderRadius: 4,
                cursor: isVerifying ? 'wait' : 'pointer',
                flexShrink: 0,
              }}
              title="Run verification phase on completed tasks"
            >
              {isVerifying ? 'Verifying…' : 'Verify'}
            </button>

            {failedCount > 0 && (
              <button
                onClick={() => { void handleFixIssues(); }}
                disabled={isFixing}
                style={{
                  fontSize: 11,
                  padding: '2px 9px',
                  background: `${TOKENS.statusAmber}18`,
                  color: isFixing ? TOKENS.textTertiary : TOKENS.statusAmber,
                  border: `1px solid ${TOKENS.statusAmber}44`,
                  borderRadius: 4,
                  cursor: isFixing ? 'wait' : 'pointer',
                  flexShrink: 0,
                }}
                title={`Generate fix tasks for ${failedCount} failed task(s)`}
              >
                {isFixing ? 'Generating…' : `Fix Issues (${failedCount})`}
              </button>
            )}

            <button
              onClick={() => { void handleUpdateDesign(); }}
              disabled={isUpdating}
              style={{
                fontSize: 11,
                padding: '2px 9px',
                background: `${TOKENS.statusGreen}18`,
                color: isUpdating ? TOKENS.textTertiary : TOKENS.statusGreen,
                border: `1px solid ${TOKENS.statusGreen}44`,
                borderRadius: 4,
                cursor: isUpdating ? 'wait' : 'pointer',
                flexShrink: 0,
              }}
              title="Apply post-implementation changeset to design"
            >
              {isUpdating ? 'Updating…' : 'Update Design'}
            </button>
          </>
        )}

        <ExecutionControls />

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

      {/* Completion report bar (Phase 8) */}
      {completionReport && (
        <CompletionSummaryBar
          report={completionReport}
          onDismiss={() => setCompletionReport(null)}
        />
      )}

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
  const executionMode = useDesignStore((s) => s.execution_mode);
  const maxParallel = useDesignStore((s) => s.max_parallel);
  const toggleDrawer = useDesignStore((s) => s.toggleDrawer);
  const setDrawerHeight = useDesignStore((s) => s.setDrawerHeight);
  const setDrawerOpen = useDesignStore((s) => s.setDrawerOpen);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        const mode = executionMode;
        if (mode === 'idle') {
          startExecution('autopilot', { max_parallel: maxParallel }).catch(console.error);
        } else if (mode === 'autopilot' || mode === 'manual') {
          pauseExecution();
        } else if (mode === 'paused') {
          resumeExecution({ max_parallel: maxParallel });
        }
      }

      if (e.key === 'a' || e.key === 'A') {
        const mode = executionMode;
        if (mode === 'idle') {
          // Toggle to autopilot
          startExecution('autopilot', { max_parallel: maxParallel }).catch(console.error);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [executionMode, maxParallel]);

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
