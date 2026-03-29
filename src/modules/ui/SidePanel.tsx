import { useDesignStore } from '../store/store.js';
import { TOKENS } from '../../styles/theme.js';
import { Inspector } from './Inspector.js';
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
        {tab === 'inspector' && <Inspector />}
        {tab === 'changesets' && <ChangesetsPlaceholder />}
        {tab === 'chat' && <ChatPlaceholder />}
      </div>
    </div>
  );
}

function ChangesetsPlaceholder() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: TOKENS.textTertiary,
        gap: 8,
        padding: 24,
      }}
    >
      <span style={{ fontSize: 24 }}>≡</span>
      <span style={{ fontSize: 13 }}>No changesets yet</span>
      <span style={{ fontSize: 11, textAlign: 'center', color: TOKENS.textGhost, maxWidth: 220 }}>
        Changesets track proposed modifications before they are applied to the design.
      </span>
    </div>
  );
}

function ChatPlaceholder() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: TOKENS.textTertiary,
        gap: 8,
        padding: 24,
      }}
    >
      <span style={{ fontSize: 24 }}>◆</span>
      <span style={{ fontSize: 13 }}>Agent chat coming soon</span>
      <span style={{ fontSize: 11, textAlign: 'center', color: TOKENS.textGhost, maxWidth: 220 }}>
        Chat with the AI agent to propose design changes, generate code, or ask questions about your architecture.
      </span>
    </div>
  );
}
