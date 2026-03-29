import { useDesignStore } from '../store/store.js';
import { TOKENS } from '../../styles/theme.js';
import { Inspector } from './Inspector.js';
import { ChatPanel } from './ChatPanel.js';
import { ChangesetsPanel } from './ChangesetsPanel.js';
import { DrawerTaskDetail } from './DrawerTaskDetail.js';
import type { UIState } from '../store/types.js';

type Tab = UIState['side_panel_tab'];

const TABS: { id: Tab; label: string }[] = [
  { id: 'inspector', label: 'Inspector' },
  { id: 'changesets', label: 'Changesets' },
  { id: 'chat', label: 'Chat' },
];

export function SidePanel() {
  const tab = useDesignStore((s) => s.ui.side_panel_tab);
  const setTab = useDesignStore((s) => s.setSidePanelTab);
  const isOpen = useDesignStore((s) => s.ui.is_side_panel_open);
  const setSidePanelOpen = useDesignStore((s) => s.setSidePanelOpen);
  const selectedTaskId = useDesignStore((s) => s.ui.selected_task_id);

  if (!isOpen) {
    return (
      <button
        onClick={() => setSidePanelOpen(true)}
        style={{
          width: 28,
          background: TOKENS.bgSurface,
          borderLeft: `1px solid ${TOKENS.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: TOKENS.textTertiary,
          cursor: 'pointer',
          flexShrink: 0,
          fontSize: 12,
          writingMode: 'vertical-lr',
          letterSpacing: '0.1em',
        }}
        title="Open side panel"
      >
        PANEL
      </button>
    );
  }

  return (
    <div
      style={{
        width: 380,
        display: 'flex',
        flexDirection: 'column',
        background: TOKENS.bgSurface,
        borderLeft: `1px solid ${TOKENS.border}`,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${TOKENS.border}`,
          flexShrink: 0,
        }}
      >
        {TABS.map(({ id, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1,
                padding: '9px 12px',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                color: active ? TOKENS.textPrimary : TOKENS.textTertiary,
                background: 'transparent',
                borderBottom: active ? `2px solid ${TOKENS.accent}` : '2px solid transparent',
                transition: 'color 120ms, border-color 120ms',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
        {/* Collapse button */}
        <button
          onClick={() => setSidePanelOpen(false)}
          style={{
            padding: '9px 10px',
            color: TOKENS.textTertiary,
            fontSize: 14,
            cursor: 'pointer',
          }}
          title="Collapse panel"
        >
          ›
        </button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'inspector' && (
          <>
            {/* When a task is selected, show task detail above the inspector */}
            {selectedTaskId ? <DrawerTaskDetail /> : <Inspector />}
          </>
        )}
        {tab === 'changesets' && <ChangesetsPanel />}
        {tab === 'chat' && <ChatPanel />}
      </div>
    </div>
  );
}
