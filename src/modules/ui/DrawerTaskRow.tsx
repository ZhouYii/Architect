// ─── DrawerTaskRow ────────────────────────────────────────────────────────────

import { useCallback } from 'react';
import { useDesignStore } from '../store/store.js';
import { TOKENS } from '../../styles/theme.js';
import { approveTask } from '../orchestrator/executor.js';
import type { ImplTask, ImplTaskStatus } from '../store/types.js';

// ─── Status icons ─────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: ImplTaskStatus }) {
  switch (status) {
    case 'queued':
      return <span style={{ color: TOKENS.textTertiary, fontSize: 13 }}>○</span>;
    case 'running':
      return (
        <span
          style={{
            color: TOKENS.statusAmber,
            fontSize: 13,
            display: 'inline-block',
            animation: 'pulse 1.2s ease-in-out infinite',
          }}
        >
          ●
        </span>
      );
    case 'done':
      return <span style={{ color: TOKENS.statusGreen, fontSize: 13 }}>✓</span>;
    case 'failed':
      return <span style={{ color: TOKENS.statusRed, fontSize: 13 }}>✗</span>;
    case 'blocked':
      return <span style={{ color: TOKENS.textTertiary, fontSize: 13 }}>◌</span>;
    case 'escalated':
      return <span style={{ color: TOKENS.statusBlue, fontSize: 13 }}>⬆</span>;
    default:
      return <span style={{ color: TOKENS.textTertiary, fontSize: 13 }}>○</span>;
  }
}

// ─── Agent pill ───────────────────────────────────────────────────────────────

function AgentPill({ agent }: { agent?: string }) {
  if (!agent) return null;
  const color = agent === 'smart' ? TOKENS.accent : TOKENS.statusBlue;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 500,
        padding: '1px 6px',
        borderRadius: 10,
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        flexShrink: 0,
        letterSpacing: '0.02em',
      }}
    >
      {agent}
    </span>
  );
}

// ─── Complexity dot ───────────────────────────────────────────────────────────

function ComplexityDot({ complexity }: { complexity?: string }) {
  const color =
    complexity === 'high'
      ? TOKENS.statusRed
      : complexity === 'medium'
      ? TOKENS.statusAmber
      : TOKENS.statusGreen;
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        display: 'inline-block',
      }}
      title={`Complexity: ${complexity ?? 'unknown'}`}
    />
  );
}

// ─── Attempt pills (Phase 7) ──────────────────────────────────────────────────
// Shows attempt history inline: ✗ attempt 1 (oc)  ✗ attempt 2 (oc)  ✓ attempt 3 (sn)

const ATTEMPT_ABBREVS: Record<number, string> = {
  1: 'oc',
  2: 'oc',
  3: 'sn',
  4: 'op',
};

function AttemptPills({ task }: { task: ImplTask }) {
  const { attempts } = task;
  if (attempts.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
      {attempts.map((a) => {
        const ok = a.result === 'success';
        const abbrev = ATTEMPT_ABBREVS[a.attempt] ?? `a${a.attempt}`;
        const color = ok ? TOKENS.statusGreen : TOKENS.statusRed;
        return (
          <span
            key={a.attempt}
            style={{
              fontSize: 9,
              padding: '1px 4px',
              borderRadius: 6,
              background: `${color}18`,
              color,
              border: `1px solid ${color}33`,
              fontFamily: 'monospace',
              lineHeight: 1.4,
            }}
            title={a.message ?? (ok ? 'passed' : 'failed')}
          >
            {ok ? '✓' : '✗'}{abbrev}
          </span>
        );
      })}
    </div>
  );
}

// ─── Escalation indicator (Phase 7) ──────────────────────────────────────────
// Shows the current agent with an arrow when escalated

function EscalationPill({ task }: { task: ImplTask }) {
  if (task.status !== 'escalated') return null;

  const attemptCount = task.attempts.length;
  const abbrev = attemptCount >= 4 ? 'op' : attemptCount >= 3 ? 'sn' : 'oc';
  const label = attemptCount >= 4 ? 'opus' : attemptCount >= 3 ? 'sonnet' : 'opencode';

  return (
    <span
      style={{
        fontSize: 10,
        padding: '1px 6px',
        borderRadius: 8,
        background: `${TOKENS.statusBlue}18`,
        color: TOKENS.statusBlue,
        border: `1px solid ${TOKENS.statusBlue}33`,
        fontWeight: 500,
        flexShrink: 0,
      }}
      title={`Escalated to ${label} (attempt ${attemptCount + 1})`}
    >
      oc → {abbrev} ⬆
    </span>
  );
}

// ─── DrawerTaskRow ────────────────────────────────────────────────────────────

interface DrawerTaskRowProps {
  task: ImplTask;
  index: number;
  allTasks: ImplTask[];
}

export function DrawerTaskRow({ task, index, allTasks }: DrawerTaskRowProps) {
  const selectedTaskId = useDesignStore((s) => s.ui.selected_task_id);
  const setSelectedTask = useDesignStore((s) => s.setSelectedTask);
  const executionMode = useDesignStore((s) => s.execution_mode);

  const isSelected = selectedTaskId === task.id;
  const isManualMode = executionMode === 'manual';

  // Determine if blocked: has depends_on that aren't done
  const isBlocked =
    task.status === 'queued' &&
    (task.depends_on ?? []).some((depId) => {
      const dep = allTasks.find((t) => t.id === depId);
      return dep && dep.status !== 'done';
    });

  const displayStatus: ImplTaskStatus = isBlocked ? 'blocked' : task.status;

  const zebra = index % 2 === 0;
  const bg = isSelected
    ? `${TOKENS.accent}18`
    : zebra
    ? TOKENS.bgSurface
    : TOKENS.bgSurfaceRaised;

  const handleApprove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      approveTask(task.id);
    },
    [task.id]
  );

  return (
    <button
      onClick={() => setSelectedTask(isSelected ? null : task.id)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        background: bg,
        borderBottom: `1px solid ${TOKENS.border}`,
        borderLeft: isSelected ? `2px solid ${TOKENS.accent}` : '2px solid transparent',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 80ms',
      }}
      title={task.prompt ?? ''}
    >
      {/* Status icon */}
      <span style={{ flexShrink: 0, width: 16, display: 'flex', alignItems: 'center' }}>
        <StatusIcon status={displayStatus} />
      </span>

      {/* Complexity dot */}
      <ComplexityDot complexity={task.complexity} />

      {/* Title */}
      <span
        style={{
          flex: 1,
          fontSize: 12,
          color: task.status === 'done'
            ? TOKENS.textTertiary
            : task.status === 'failed'
            ? TOKENS.statusRed
            : TOKENS.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textDecoration: task.status === 'done' ? 'line-through' : 'none',
          opacity: isBlocked ? 0.5 : 1,
        }}
      >
        {task.title ?? task.id}
      </span>

      {/* Attempt history pills (Phase 7) */}
      <AttemptPills task={task} />

      {/* Escalation indicator (Phase 7) */}
      <EscalationPill task={task} />

      {/* Agent pill — shows current agent */}
      <AgentPill agent={task.agent} />

      {/* File indicator */}
      {task.file && (
        <span
          style={{
            fontSize: 10,
            color: TOKENS.textTertiary,
            fontFamily: 'monospace',
            maxWidth: 120,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
          title={task.file}
        >
          {task.file.split('/').pop()}
        </span>
      )}

      {/* Approve button (manual mode only) */}
      {isManualMode && task.status === 'queued' && !isBlocked && (
        <span
          role="button"
          onClick={handleApprove}
          style={{
            fontSize: 10,
            padding: '1px 7px',
            borderRadius: 6,
            background: `${TOKENS.statusGreen}18`,
            color: TOKENS.statusGreen,
            border: `1px solid ${TOKENS.statusGreen}44`,
            cursor: 'pointer',
            fontWeight: 600,
            flexShrink: 0,
            userSelect: 'none',
          }}
          title="Approve this task for execution"
        >
          Approve
        </span>
      )}

      {/* Expand chevron */}
      <span
        style={{
          fontSize: 10,
          color: TOKENS.textGhost,
          flexShrink: 0,
          transform: isSelected ? 'rotate(90deg)' : 'none',
          transition: 'transform 120ms',
        }}
      >
        ▶
      </span>
    </button>
  );
}
