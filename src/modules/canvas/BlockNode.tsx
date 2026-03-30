import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { BLOCK_ICONS, STATUS_COLORS, TOKENS } from '../../styles/theme.js';
import type { DesignNode, StatusAggregate } from '../store/types.js';

// ─── Data shape passed via React Flow node.data ────────────────────────────

export interface BlockNodeData extends Record<string, unknown> {
  node: DesignNode;
  aggregate?: StatusAggregate;
  isSelected?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBorderStyle(status: string): React.CSSProperties {
  const color = STATUS_COLORS[status] ?? TOKENS.border;
  const isProposed = status === 'proposed';
  const isRunning = status === 'running';
  return {
    borderColor: color,
    borderStyle: isProposed ? 'dashed' : 'solid',
    borderWidth: 2,
    animation: isRunning ? 'pulseAmber 1.4s ease-in-out infinite' : undefined,
  };
}

function fillOpacity(status: string): number {
  return status === 'proposed' ? 0.6 : 1;
}

interface ProgressBarProps {
  aggregate: StatusAggregate;
}

function ProgressBar({ aggregate }: ProgressBarProps) {
  const { total } = aggregate;
  if (total === 0) return null;
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
  return (
    <div style={{ display: 'flex', height: 3, borderRadius: 2, overflow: 'hidden', marginTop: 6 }}>
      {aggregate.implemented > 0 && (
        <div style={{ width: pct(aggregate.implemented), background: TOKENS.statusGreen }} />
      )}
      {aggregate.running > 0 && (
        <div style={{ width: pct(aggregate.running), background: TOKENS.statusAmber }} />
      )}
      {aggregate.modified > 0 && (
        <div style={{ width: pct(aggregate.modified), background: TOKENS.statusAmber }} />
      )}
      {aggregate.ready > 0 && (
        <div style={{ width: pct(aggregate.ready), background: TOKENS.statusBlue }} />
      )}
      {aggregate.failed > 0 && (
        <div style={{ width: pct(aggregate.failed), background: TOKENS.statusRed }} />
      )}
      {(aggregate.proposed + aggregate.clean + aggregate.dismissed) > 0 && (
        <div style={{ flex: 1, background: TOKENS.border }} />
      )}
    </div>
  );
}

// ─── Contract Badge ───────────────────────────────────────────────────────────

interface ContractBadgeProps {
  node: DesignNode;
}

function ContractBadge({ node }: ContractBadgeProps) {
  const contract = node.contract;
  if (!contract) return null;

  const invariants = contract.invariants ?? [];
  const testCases = contract.test_cases ?? [];
  const totalInv = invariants.length;
  const passedInv = invariants.filter((i) => i.satisfied).length;
  const totalTests = testCases.length;
  const passedTests = testCases.filter((t) => t.status === 'pass').length;

  if (totalInv === 0 && totalTests === 0) return null;

  const invColor = passedInv === totalInv ? TOKENS.statusGreen : TOKENS.statusRed;
  const testColor = passedTests === totalTests ? TOKENS.statusGreen : totalTests === 0 ? TOKENS.textTertiary : TOKENS.statusAmber;

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
      {totalInv > 0 && (
        <span style={{ fontSize: 10, color: invColor, fontFamily: 'var(--font-mono, monospace)' }}>
          inv {passedInv}/{totalInv}
        </span>
      )}
      {totalTests > 0 && (
        <span style={{ fontSize: 10, color: testColor, fontFamily: 'var(--font-mono, monospace)' }}>
          tests {passedTests}/{totalTests}
        </span>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function BlockNodeComponent({ data }: NodeProps) {
  const { node, aggregate } = data as BlockNodeData;

  const icon = BLOCK_ICONS[node.block_type ?? 'module'] ?? '▣';
  const statusColor = STATUS_COLORS[node.status] ?? TOKENS.border;

  const containerStyle: React.CSSProperties = {
    background: TOKENS.bgSurface,
    borderRadius: 8,
    padding: '10px 12px',
    minWidth: 160,
    maxWidth: 220,
    opacity: fillOpacity(node.status),
    position: 'relative',
    cursor: 'pointer',
    userSelect: 'none',
    ...statusBorderStyle(node.status),
  };

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: TOKENS.bgSurfaceRaised }} />
      <Handle type="target" position={Position.Top} style={{ background: TOKENS.bgSurfaceRaised }} />

      <div style={containerStyle}>
        {/* Agent proposed badge */}
        {node.agent_proposed && (
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: TOKENS.statusAmber,
            }}
            title="Agent proposed"
          />
        )}

        {/* Header: icon + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, color: statusColor, lineHeight: 1, flexShrink: 0 }}>
            {icon}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: TOKENS.textPrimary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {node.name}
          </span>
        </div>

        {/* Annotation */}
        {node.annotation && (
          <div
            style={{
              marginTop: 5,
              fontSize: 11,
              color: TOKENS.textSecondary,
              lineHeight: 1.4,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {node.annotation}
          </div>
        )}

        {/* Contract badge */}
        <ContractBadge node={node} />

        {/* Aggregate progress bar for parent nodes */}
        {node.has_children && aggregate && (
          <>
            <ProgressBar aggregate={aggregate} />
            <div
              style={{ fontSize: 10, color: TOKENS.textTertiary, marginTop: 3, textAlign: 'right' }}
            >
              {aggregate.implemented}/{aggregate.total} impl · ↵ drill-in
            </div>
          </>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: TOKENS.bgSurfaceRaised }} />
      <Handle type="source" position={Position.Bottom} style={{ background: TOKENS.bgSurfaceRaised }} />
    </>
  );
}

export const BlockNode = memo(BlockNodeComponent);
