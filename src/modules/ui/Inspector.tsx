import { useDesignStore } from '../store/store.js';
import { selectSelectedNode, selectCurrentCanvasId } from '../store/selectors.js';
import { BLOCK_ICONS, STATUS_COLORS, TOKENS } from '../../styles/theme.js';
import type { DesignNode } from '../store/types.js';
import { acceptNode, dismissNode } from '../changesets/review.js';

// ─── Status Pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? TOKENS.border;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 500,
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  );
}

// ─── Type Pill ────────────────────────────────────────────────────────────────

function TypePill({ blockType }: { blockType: string }) {
  const icon = BLOCK_ICONS[blockType] ?? '▣';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 500,
        background: TOKENS.bgSurfaceRaised,
        color: TOKENS.textSecondary,
        border: `1px solid ${TOKENS.border}`,
      }}
    >
      <span style={{ fontSize: 12 }}>{icon}</span>
      {blockType}
    </span>
  );
}

// ─── Code Links ───────────────────────────────────────────────────────────────

function CodeLinks({ node }: { node: DesignNode }) {
  if (!node.code_links?.length) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: TOKENS.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Code Links
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {node.code_links.map((link, i) => (
          <div
            key={i}
            style={{
              fontSize: 11,
              color: TOKENS.accent,
              fontFamily: 'monospace',
              padding: '4px 8px',
              background: TOKENS.bgSurfaceRaised,
              borderRadius: 4,
              border: `1px solid ${TOKENS.border}`,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {link.file}{link.line_start ? `:${link.line_start}` : ''}{link.symbol ? ` · ${link.symbol}` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Contracts Checklist ──────────────────────────────────────────────────────

function ContractsChecklist({ node }: { node: DesignNode }) {
  const contract = node.contract;
  if (!contract) return null;
  const hasItems = contract.invariants.length > 0 || contract.test_cases.length > 0;
  if (!hasItems) return null;

  return (
    <div style={{ marginTop: 16 }}>
      {contract.invariants.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: TOKENS.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Invariants
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {contract.invariants.map((inv) => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: TOKENS.textSecondary }}>
                <span style={{ color: inv.satisfied ? TOKENS.statusGreen : TOKENS.statusRed, flexShrink: 0, marginTop: 1 }}>
                  {inv.satisfied ? '✓' : '✗'}
                </span>
                <span style={{ lineHeight: 1.4 }}>{inv.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {contract.test_cases.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: TOKENS.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Tests
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {contract.test_cases.map((tc) => {
              const color = tc.status === 'pass' ? TOKENS.statusGreen : tc.status === 'fail' ? TOKENS.statusRed : TOKENS.textTertiary;
              return (
                <div key={tc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: TOKENS.textSecondary }}>
                  <span style={{ color, fontFamily: 'monospace', flexShrink: 0 }}>
                    {tc.status === 'pass' ? '●' : tc.status === 'fail' ? '●' : '○'}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{tc.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color }}>{tc.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
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
      <span style={{ fontSize: 24 }}>◈</span>
      <span style={{ fontSize: 13 }}>Select a node to inspect</span>
    </div>
  );
}

// ─── Arrow Inspector ──────────────────────────────────────────────────────────

function ArrowInspector({ node }: { node: DesignNode }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: TOKENS.textPrimary, marginBottom: 8 }}>
        {node.label ?? node.name}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <StatusPill status={node.status} />
        {node.arrow_type && (
          <TypePill blockType={node.arrow_type} />
        )}
      </div>

      <div style={{ fontSize: 12, color: TOKENS.textSecondary }}>
        <span style={{ color: TOKENS.textTertiary }}>source </span>
        {node.source}
        <span style={{ color: TOKENS.textTertiary }}> → target </span>
        {node.target}
      </div>

      {node.interface && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: TOKENS.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Interface
          </div>
          {node.interface.description && (
            <div style={{ fontSize: 12, color: TOKENS.textSecondary, marginBottom: 8, lineHeight: 1.5 }}>
              {node.interface.description}
            </div>
          )}
          {node.interface.request_schema && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, color: TOKENS.textTertiary, marginBottom: 2 }}>Request</div>
              <code style={{ fontSize: 11, color: TOKENS.textSecondary, background: TOKENS.bgSurfaceRaised, padding: '4px 8px', borderRadius: 4, display: 'block', fontFamily: 'monospace' }}>
                {node.interface.request_schema}
              </code>
            </div>
          )}
          {node.interface.response_schema && (
            <div>
              <div style={{ fontSize: 10, color: TOKENS.textTertiary, marginBottom: 2 }}>Response</div>
              <code style={{ fontSize: 11, color: TOKENS.textSecondary, background: TOKENS.bgSurfaceRaised, padding: '4px 8px', borderRadius: 4, display: 'block', fontFamily: 'monospace' }}>
                {node.interface.response_schema}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Proposed Node Actions ────────────────────────────────────────────────────

function ProposedActions({ node }: { node: DesignNode }) {
  const selectNode = useDesignStore((s) => s.selectNode);

  const handleAccept = () => {
    acceptNode(node.id);
    // Keep node selected; status will update reactively
  };

  const handleDismiss = () => {
    dismissNode(node.id);
    selectNode(null);
  };

  return (
    <div
      style={{
        marginTop: 16,
        padding: '10px 12px',
        background: `${TOKENS.statusAmber}14`,
        border: `1px dashed ${TOKENS.statusAmber}66`,
        borderRadius: 6,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: TOKENS.statusAmber,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 8,
        }}
      >
        Agent Proposed
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleAccept}
          style={{
            flex: 1,
            padding: '6px 0',
            background: `${TOKENS.statusGreen}22`,
            color: TOKENS.statusGreen,
            border: `1px solid ${TOKENS.statusGreen}55`,
            borderRadius: 5,
            fontSize: 12,
            cursor: 'pointer',
            fontWeight: 500,
          }}
          title="Accept — marks node as modified"
        >
          ✓ Accept
        </button>
        <button
          onClick={handleDismiss}
          style={{
            flex: 1,
            padding: '6px 0',
            background: `${TOKENS.statusRed}18`,
            color: TOKENS.statusRed,
            border: `1px solid ${TOKENS.statusRed}44`,
            borderRadius: 5,
            fontSize: 12,
            cursor: 'pointer',
            fontWeight: 500,
          }}
          title="Dismiss — removes this proposed node"
        >
          ✗ Dismiss
        </button>
      </div>
    </div>
  );
}

// ─── Block Inspector ──────────────────────────────────────────────────────────

function BlockInspector({ node }: { node: DesignNode }) {
  const updateBlock = useDesignStore((s) => s.updateBlock);
  const canvasId = useDesignStore(selectCurrentCanvasId);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
      {/* Name (editable) */}
      <input
        value={node.name}
        onChange={(e) => updateBlock(canvasId, node.id, { name: e.target.value })}
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: TOKENS.textPrimary,
          background: 'transparent',
          border: 'none',
          borderBottom: `1px solid transparent`,
          borderRadius: 0,
          padding: '0 0 4px 0',
          width: '100%',
          marginBottom: 10,
          outline: 'none',
        }}
        onFocus={(e) => { e.target.style.borderBottomColor = TOKENS.borderFocus; }}
        onBlur={(e) => { e.target.style.borderBottomColor = 'transparent'; }}
      />

      {/* Status + type pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <StatusPill status={node.status} />
        {node.block_type && <TypePill blockType={node.block_type} />}
        {node.agent_proposed && (
          <span style={{ fontSize: 11, color: TOKENS.statusAmber, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: TOKENS.statusAmber, display: 'inline-block' }} />
            agent proposed
          </span>
        )}
      </div>

      {/* Annotation */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: TOKENS.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          Annotation
        </div>
        <textarea
          value={node.annotation ?? ''}
          onChange={(e) => updateBlock(canvasId, node.id, { annotation: e.target.value })}
          rows={3}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: 12,
            color: TOKENS.textSecondary,
            background: TOKENS.bgSurfaceRaised,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 4,
            resize: 'vertical',
            lineHeight: 1.5,
          }}
          placeholder="Describe this block…"
        />
      </div>

      {/* Contracts */}
      <ContractsChecklist node={node} />

      {/* Code links */}
      <CodeLinks node={node} />

      {/* Has children note */}
      {node.has_children && (
        <div
          style={{
            marginTop: 16,
            padding: '8px 10px',
            background: `${TOKENS.accentDim}`,
            border: `1px solid ${TOKENS.accent}44`,
            borderRadius: 6,
            fontSize: 11,
            color: TOKENS.accent,
          }}
        >
          Double-click on canvas to drill into {node.child_canvas_id ?? 'child canvas'}
        </div>
      )}

      {/* Accept / Dismiss for proposed nodes */}
      {node.status === 'proposed' && <ProposedActions node={node} />}
    </div>
  );
}

// ─── Inspector ────────────────────────────────────────────────────────────────

export function Inspector() {
  const node = useDesignStore(selectSelectedNode);

  if (!node) return <EmptyState />;

  if (node.kind === 'arrow') {
    return <ArrowInspector node={node} />;
  }

  return <BlockInspector node={node} />;
}
