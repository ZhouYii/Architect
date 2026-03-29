import type { ACP } from '../types';
import { useDesignStore } from '../store';
import { applyACP } from '../lib/apply-acp';

interface Props {
  acp: ACP;
}

export function SuggestionCard({ acp }: Props) {
  const resolveACP = useDesignStore((s) => s.resolveACP);
  const pendingACPs = useDesignStore((s) => s.pendingACPs);
  const config = useDesignStore((s) => s.config);

  const handleApply = () => {
    applyACP(acp);
    resolveACP(acp.id, 'accepted');
  };

  // Conflict detection (PRD §10.5): check if other pending ACPs target the same components
  const hasConflict = pendingACPs.some(
    (other) =>
      other.id !== acp.id &&
      other.status === 'pending' &&
      other.changes.some((oc) =>
        acp.changes.some(
          (ac) =>
            ac.target_canvas === oc.target_canvas &&
            ac.target_id &&
            ac.target_id === oc.target_id,
        ),
      ),
  );

  // Staleness warning (PRD §14.2): based_on_checkpoint older than current
  const isStale =
    acp.based_on_checkpoint &&
    config?.last_checkpoint &&
    acp.based_on_checkpoint !== config.last_checkpoint;

  return (
    <div className={`suggestion-card suggestion-${acp.status}`}>
      <div className="suggestion-header">
        <span className="suggestion-title">{acp.description}</span>
        <span className={`suggestion-status status-${acp.status}`}>
          {acp.status}
        </span>
      </div>

      {hasConflict && (
        <div className="suggestion-warning">Conflict: another pending ACP targets the same component</div>
      )}
      {isStale && (
        <div className="suggestion-warning">Stale: based on {acp.based_on_checkpoint}, current is {config?.last_checkpoint}</div>
      )}

      <div className="suggestion-changes">
        {acp.changes.map((change, i) => (
          <div key={i} className="suggestion-change">
            <div className="suggestion-change-header">
              <span className={`change-kind kind-${change.kind}`}>
                {change.kind.replace(/_/g, ' ')}
              </span>
              {change.target_id && (
                <span className="change-target">{change.target_id}</span>
              )}
            </div>
            <div className="change-reason">{change.reason}</div>
          </div>
        ))}
      </div>

      {acp.status === 'pending' && (
        <div className="suggestion-actions">
          <button
            className="merge-btn merge-btn-accept"
            onClick={handleApply}
          >
            Apply
          </button>
          <button
            className="merge-btn merge-btn-reject"
            onClick={() => resolveACP(acp.id, 'dismissed')}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
