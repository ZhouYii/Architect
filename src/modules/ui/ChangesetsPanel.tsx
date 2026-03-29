// ─── Changesets Panel ─────────────────────────────────────────────────────────
// Lists pending agent changesets with promote / dismiss controls.

import { useState } from 'react';
import { useDesignStore } from '../store/store.js';
import { selectCurrentCanvasId } from '../store/selectors.js';
import { TOKENS, BLOCK_ICONS } from '../../styles/theme.js';
import type { AgentChangeset, ProposedNode } from '../store/types.js';
import { promoteChangeset } from '../changesets/promote.js';
import { feedbackOnChangeset } from '../changesets/review.js';

// ─── Proposed node row ────────────────────────────────────────────────────────

function ProposedNodeRow({ node }: { node: ProposedNode }) {
  const icon = BLOCK_ICONS[node.block_type ?? 'module'] ?? '▣';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 8px',
        background: TOKENS.bgBase,
        borderRadius: 4,
        border: `1px dashed ${TOKENS.textTertiary}55`,
        marginBottom: 4,
      }}
    >
      <span style={{ fontSize: 13, color: TOKENS.textTertiary, flexShrink: 0, marginTop: 1 }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: TOKENS.textPrimary }}>
          {node.name}
        </div>
        {node.annotation && (
          <div
            style={{
              fontSize: 11,
              color: TOKENS.textSecondary,
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.annotation}
          </div>
        )}
      </div>
      <span
        style={{
          fontSize: 10,
          color: TOKENS.textTertiary,
          background: TOKENS.bgSurfaceRaised,
          padding: '1px 5px',
          borderRadius: 3,
          flexShrink: 0,
          alignSelf: 'center',
        }}
      >
        {node.block_type ?? 'module'}
      </span>
    </div>
  );
}

// ─── Feedback input ───────────────────────────────────────────────────────────

function FeedbackInput({ changesetId }: { changesetId: string }) {
  const [text, setText] = useState('');
  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    feedbackOnChangeset(changesetId, trimmed);
    setText('');
  };

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        placeholder="Leave feedback…"
        style={{
          flex: 1,
          background: TOKENS.bgBase,
          color: TOKENS.textSecondary,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 11,
          outline: 'none',
        }}
      />
      <button
        onClick={handleSubmit}
        style={{
          padding: '4px 10px',
          background: TOKENS.bgSurfaceRaised,
          color: TOKENS.textSecondary,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 4,
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        Send
      </button>
    </div>
  );
}

// ─── Single changeset card ────────────────────────────────────────────────────

function ChangesetCard({ cs }: { cs: AgentChangeset }) {
  const [expanded, setExpanded] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const currentCanvasId = useDesignStore(selectCurrentCanvasId);
  const removeChangeset = useDesignStore((s) => s.removeChangeset);

  const isTargetCanvas = cs.target_canvas_id === currentCanvasId;
  const nodeCount = cs.nodes.length;

  const handlePromote = () => {
    promoteChangeset(cs);
    setPromoted(true);
  };

  const handleDismiss = () => {
    removeChangeset(cs.id);
  };

  const ts = new Date(cs.created_at);
  const tsLabel = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      style={{
        background: TOKENS.bgSurface,
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 8,
        marginBottom: 10,
        overflow: 'hidden',
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: '10px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Expand chevron */}
        <span
          style={{
            fontSize: 10,
            color: TOKENS.textTertiary,
            marginTop: 3,
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 120ms',
            flexShrink: 0,
          }}
        >
          ▶
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: TOKENS.textPrimary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {cs.title}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginTop: 4,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {/* Agent badge */}
            <span
              style={{
                fontSize: 10,
                padding: '1px 6px',
                background: `${TOKENS.accent}22`,
                color: TOKENS.accent,
                border: `1px solid ${TOKENS.accent}44`,
                borderRadius: 3,
              }}
            >
              {cs.agent}
            </span>
            {/* Node count */}
            <span style={{ fontSize: 10, color: TOKENS.textTertiary }}>
              {nodeCount} node{nodeCount !== 1 ? 's' : ''}
            </span>
            {/* Time */}
            <span style={{ fontSize: 10, color: TOKENS.textGhost, marginLeft: 'auto' }}>
              {tsLabel}
            </span>
          </div>
          {!isTargetCanvas && (
            <div style={{ fontSize: 10, color: TOKENS.statusAmber, marginTop: 3 }}>
              target: {cs.target_canvas_id}
            </div>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 12px 12px' }}>
          {/* Node list */}
          <div style={{ marginBottom: 10 }}>
            {cs.nodes.map((node) => (
              <ProposedNodeRow key={node.id} node={node} />
            ))}
          </div>

          {/* Feedback */}
          {cs.feedback && Object.keys(cs.feedback).length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 10,
                  color: TOKENS.textTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 4,
                }}
              >
                Feedback
              </div>
              {Object.entries(cs.feedback).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    fontSize: 11,
                    color: TOKENS.textSecondary,
                    padding: '4px 8px',
                    background: TOKENS.bgBase,
                    borderRadius: 4,
                    marginBottom: 3,
                    fontStyle: 'italic',
                  }}
                >
                  {v}
                </div>
              ))}
            </div>
          )}

          <FeedbackInput changesetId={cs.id} />

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={handlePromote}
              disabled={promoted}
              style={{
                flex: 1,
                padding: '6px 0',
                background: promoted ? TOKENS.bgSurfaceRaised : `${TOKENS.statusAmber}22`,
                color: promoted ? TOKENS.textTertiary : TOKENS.statusAmber,
                border: `1px solid ${promoted ? TOKENS.border : TOKENS.statusAmber + '55'}`,
                borderRadius: 5,
                fontSize: 12,
                cursor: promoted ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              {promoted ? 'Promoted' : 'Promote to Canvas'}
            </button>
            <button
              onClick={handleDismiss}
              style={{
                padding: '6px 14px',
                background: 'transparent',
                color: TOKENS.textTertiary,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: 5,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChangesetsPanel() {
  const changesets = useDesignStore((s) => s.agent_changesets);

  if (changesets.length === 0) {
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
        <span
          style={{
            fontSize: 11,
            textAlign: 'center',
            color: TOKENS.textGhost,
            maxWidth: 220,
            lineHeight: 1.5,
          }}
        >
          Use the Chat tab to ask the agent to propose design changes. Changesets will appear here.
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 12,
      }}
    >
      {changesets.map((cs) => (
        <ChangesetCard key={cs.id} cs={cs} />
      ))}
    </div>
  );
}
