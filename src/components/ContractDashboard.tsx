import { useDesignStore } from '../store';

export function ContractDashboard() {
  const nodes = useDesignStore((s) => s.nodes);

  let totalEntries = 0;
  let implementedEntries = 0;
  let verifiedEntries = 0;
  const canvasStats: Array<{id: string; label: string; total: number; implemented: number}> = [];

  for (const [id, canvas] of Object.entries(nodes)) {
    let canvasTotal = 0;
    let canvasImpl = 0;
    for (const block of canvas.components) {
      if (!block.contract) continue;
      const entries = [...block.contract.invariants, ...block.contract.preconditions, ...block.contract.postconditions];
      canvasTotal += entries.length;
      canvasImpl += entries.filter(e => e.status === 'implemented' || e.status === 'verified').length;
      totalEntries += entries.length;
      implementedEntries += entries.filter(e => e.status === 'implemented').length;
      verifiedEntries += entries.filter(e => e.status === 'verified').length;
    }
    if (canvasTotal > 0) {
      canvasStats.push({ id, label: canvas.label, total: canvasTotal, implemented: canvasImpl });
    }
  }

  return (
    <div className="contract-dashboard">
      <h3>Contract Coverage</h3>
      <div className="dashboard-summary">
        <div className="dashboard-stat">
          <span className="dashboard-number">{totalEntries}</span>
          <span className="dashboard-label">Total</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-number">{implementedEntries}</span>
          <span className="dashboard-label">Implemented</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-number">{verifiedEntries}</span>
          <span className="dashboard-label">Verified</span>
        </div>
      </div>
      {canvasStats.length > 0 && (
        <div className="dashboard-breakdown">
          <h4>By Canvas</h4>
          {canvasStats.map(cs => (
            <div key={cs.id} className="dashboard-row">
              <span>{cs.label}</span>
              <span className="hint">{cs.implemented}/{cs.total}</span>
            </div>
          ))}
        </div>
      )}
      {totalEntries === 0 && <p className="hint">No contracts defined yet. Select a block and add invariants in the Contracts tab.</p>}
    </div>
  );
}
