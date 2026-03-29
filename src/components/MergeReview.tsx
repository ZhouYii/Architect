import { useDesignStore } from '../store';

export function MergeReview() {
  const diffEntries = useDesignStore((s) => s.diffEntries);
  const showMergeReview = useDesignStore((s) => s.showMergeReview);
  const setShowMergeReview = useDesignStore((s) => s.setShowMergeReview);
  const acceptDiffEntry = useDesignStore((s) => s.acceptDiffEntry);
  const rejectDiffEntry = useDesignStore((s) => s.rejectDiffEntry);

  if (!showMergeReview || diffEntries.length === 0) return null;

  const resolved = diffEntries.filter((e) => e.accepted !== undefined).length;
  const total = diffEntries.length;

  return (
    <div className="merge-overlay">
      <div className="merge-panel">
        <div className="merge-header">
          <h2>Review Changes</h2>
          <span className="merge-progress">
            {resolved}/{total} resolved
          </span>
          <button
            className="merge-close"
            onClick={() => setShowMergeReview(false)}
          >
            Close
          </button>
        </div>

        <div className="merge-actions-bar">
          <button
            className="toolbar-btn"
            onClick={() => diffEntries.forEach((_, i) => acceptDiffEntry(i))}
          >
            Accept All
          </button>
          <button
            className="toolbar-btn"
            onClick={() => diffEntries.forEach((_, i) => rejectDiffEntry(i))}
          >
            Reject All
          </button>
        </div>

        <div className="merge-list">
          {diffEntries.map((entry, i) => (
            <div
              key={`${entry.canvasId}-${entry.id}-${i}`}
              className={`merge-card ${entry.accepted === true ? 'accepted' : entry.accepted === false ? 'rejected' : ''}`}
            >
              <div className="merge-card-header">
                <span className={`diff-badge diff-badge-${entry.type}`}>
                  {entry.type}
                </span>
                <span className="diff-entity">{entry.entity}</span>
                <span className="diff-label">{entry.label}</span>
              </div>

              {entry.fields && (
                <div className="merge-card-fields">
                  Changed: {entry.fields.join(', ')}
                </div>
              )}

              <div className="merge-card-actions">
                <button
                  className="merge-btn merge-btn-accept"
                  onClick={() => acceptDiffEntry(i)}
                  disabled={entry.accepted === true}
                >
                  Accept
                </button>
                <button
                  className="merge-btn merge-btn-reject"
                  onClick={() => rejectDiffEntry(i)}
                  disabled={entry.accepted === false}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>

        {resolved === total && (
          <div className="merge-footer">
            <button className="toolbar-btn toolbar-btn-primary">
              Export as new major version
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
