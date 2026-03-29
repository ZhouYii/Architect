// ─── DrawerTaskDetail ─────────────────────────────────────────────────────────

import { useState } from 'react';
import { useDesignStore } from '../store/store.js';
import { TOKENS } from '../../styles/theme.js';
import type { ImplTask } from '../store/types.js';

type DetailTab = 'prompt' | 'correct_when' | 'log' | 'files';

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'prompt', label: 'Prompt' },
  { id: 'correct_when', label: 'Correct When' },
  { id: 'log', label: 'Log' },
  { id: 'files', label: 'Files' },
];

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
}: {
  active: DetailTab;
  onChange: (t: DetailTab) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        borderBottom: `1px solid ${TOKENS.border}`,
        flexShrink: 0,
      }}
    >
      {TABS.map(({ id, label }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              flex: 1,
              padding: '7px 8px',
              fontSize: 11,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? TOKENS.textPrimary : TOKENS.textTertiary,
              background: 'transparent',
              borderBottom: isActive ? `2px solid ${TOKENS.accent}` : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Prompt tab ───────────────────────────────────────────────────────────────

function PromptTab({ task }: { task: ImplTask }) {
  const [editedPrompt, setEditedPrompt] = useState(task.prompt ?? '');

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflow: 'hidden' }}>
      <textarea
        value={editedPrompt}
        onChange={(e) => setEditedPrompt(e.target.value)}
        style={{
          flex: 1,
          width: '100%',
          minHeight: 120,
          padding: 10,
          fontSize: 11,
          fontFamily: 'monospace',
          color: TOKENS.textSecondary,
          background: TOKENS.bgBase,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 4,
          resize: 'none',
          lineHeight: 1.6,
        }}
        placeholder="No prompt defined."
      />
      <button
        disabled
        style={{
          alignSelf: 'flex-end',
          padding: '5px 14px',
          fontSize: 11,
          background: TOKENS.bgSurfaceRaised,
          color: TOKENS.textTertiary,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 4,
          cursor: 'not-allowed',
          opacity: 0.6,
        }}
        title="Run with Edits (Phase 7)"
      >
        Run with Edits
      </button>
    </div>
  );
}

// ─── Correct When tab ─────────────────────────────────────────────────────────

function CorrectWhenTab({ task }: { task: ImplTask }) {
  const isDone = task.status === 'done';
  const isFailed = task.status === 'failed';

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: isDone ? TOKENS.statusGreen : TOKENS.textTertiary }}>
            {isDone ? '✓' : '✗'}
          </span>
          <span style={{ fontSize: 12, color: TOKENS.textSecondary }}>TypeScript types pass</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              color: isDone ? TOKENS.statusGreen : isFailed ? TOKENS.statusRed : TOKENS.textTertiary,
            }}
          >
            {isDone ? '✓' : isFailed ? '✗' : '○'}
          </span>
          <span style={{ fontSize: 12, color: TOKENS.textSecondary }}>Tests pass</span>
        </div>
      </div>

      {task.correct_when && (
        <div
          style={{
            padding: '10px 12px',
            background: TOKENS.bgBase,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 4,
            fontSize: 11,
            fontFamily: 'monospace',
            color: TOKENS.textSecondary,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
          }}
        >
          {task.correct_when}
        </div>
      )}
    </div>
  );
}

// ─── Log tab ─────────────────────────────────────────────────────────────────

function LogTab({ task }: { task: ImplTask }) {
  if (task.attempts.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: TOKENS.textTertiary,
          fontSize: 12,
          padding: 24,
        }}
      >
        No attempts yet.
      </div>
    );
  }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto' }}>
      {task.attempts.map((attempt) => {
        const color = attempt.result === 'success' ? TOKENS.statusGreen : TOKENS.statusRed;
        return (
          <div
            key={attempt.attempt}
            style={{
              padding: 10,
              background: TOKENS.bgBase,
              border: `1px solid ${TOKENS.border}`,
              borderLeft: `3px solid ${color}`,
              borderRadius: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color }}>
                Attempt #{attempt.attempt} — {attempt.result}
              </span>
              <span style={{ fontSize: 10, color: TOKENS.textTertiary }}>
                {new Date(attempt.timestamp).toLocaleTimeString()}
              </span>
            </div>
            {attempt.message && (
              <div style={{ fontSize: 11, color: TOKENS.textSecondary, marginBottom: 4 }}>
                {attempt.message}
              </div>
            )}
            {attempt.output && (
              <pre
                style={{
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: TOKENS.textTertiary,
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                  maxHeight: 80,
                  overflow: 'auto',
                }}
              >
                {attempt.output}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Files tab ────────────────────────────────────────────────────────────────

function FilesTab({ task }: { task: ImplTask }) {
  const files: { path: string; role: string }[] = [];
  if (task.file) files.push({ path: task.file, role: 'implementation' });
  if (task.test_file) files.push({ path: task.test_file, role: 'test' });

  if (files.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: TOKENS.textTertiary,
          fontSize: 12,
          padding: 24,
        }}
      >
        No files specified.
      </div>
    );
  }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {files.map(({ path, role }) => (
        <div
          key={path}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 10px',
            background: TOKENS.bgBase,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 4,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: role === 'test' ? TOKENS.statusAmber : TOKENS.statusBlue,
              fontWeight: 600,
              minWidth: 30,
            }}
          >
            {role === 'test' ? 'TEST' : 'IMPL'}
          </span>
          <span
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              color: TOKENS.accent,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {path}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── DrawerTaskDetail ─────────────────────────────────────────────────────────

export function DrawerTaskDetail() {
  const [activeTab, setActiveTab] = useState<DetailTab>('prompt');
  const selectedTaskId = useDesignStore((s) => s.ui.selected_task_id);
  const implTasks = useDesignStore((s) => s.impl_tasks);
  const setSelectedTask = useDesignStore((s) => s.setSelectedTask);

  const task = implTasks.find((t) => t.id === selectedTaskId);

  if (!task) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden',
        borderTop: `1px solid ${TOKENS.border}`,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: `1px solid ${TOKENS.border}`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 600,
            color: TOKENS.textPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {task.title ?? task.id}
        </span>
        <button
          onClick={() => setSelectedTask(null)}
          style={{ color: TOKENS.textTertiary, fontSize: 14, padding: '0 2px', cursor: 'pointer' }}
          title="Close"
        >
          x
        </button>
      </div>

      {/* Tab bar */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'prompt' && <PromptTab task={task} />}
        {activeTab === 'correct_when' && <CorrectWhenTab task={task} />}
        {activeTab === 'log' && <LogTab task={task} />}
        {activeTab === 'files' && <FilesTab task={task} />}
      </div>
    </div>
  );
}
