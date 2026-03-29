import { useState } from 'react';
import { initWorkspace, loadWorkspace } from '../lib/workspace';
import { useDesignStore } from '../store';

export function InitWizard() {
  const [projectName, setProjectName] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');
  const [mode, setMode] = useState<'choose' | 'create' | 'open'>('choose');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!projectName.trim() || !workspacePath.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await initWorkspace(workspacePath.trim(), projectName.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    if (!workspacePath.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await loadWorkspace(workspacePath.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSkipDemo = () => {
    // Use demo data without workspace persistence
    useDesignStore.getState().setWorkspacePath('__demo__');
  };

  return (
    <div className="init-wizard-overlay">
      <div className="init-wizard">
        <h1>Architect</h1>
        <p className="hint">Visual System Design Tool</p>

        {mode === 'choose' && (
          <div className="init-wizard-choices">
            <button className="toolbar-btn toolbar-btn-primary" onClick={() => setMode('create')}>
              Create New Workspace
            </button>
            <button className="toolbar-btn" onClick={() => setMode('open')}>
              Open Existing Workspace
            </button>
            <button className="toolbar-btn" onClick={handleSkipDemo} style={{ marginTop: 12 }}>
              Demo Mode (no persistence)
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="init-wizard-form">
            <label className="field-label">
              Project Name
              <input
                type="text"
                className="field-input"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Gacha Game"
                autoFocus
              />
            </label>
            <label className="field-label">
              Workspace Path
              <input
                type="text"
                className="field-input"
                value={workspacePath}
                onChange={(e) => setWorkspacePath(e.target.value)}
                placeholder="e.g. C:\Projects\my-game"
              />
            </label>
            <div className="init-wizard-actions">
              <button className="toolbar-btn" onClick={() => setMode('choose')}>Back</button>
              <button
                className="toolbar-btn toolbar-btn-primary"
                onClick={handleCreate}
                disabled={loading || !projectName.trim() || !workspacePath.trim()}
              >
                {loading ? 'Creating...' : 'Create Workspace'}
              </button>
            </div>
          </div>
        )}

        {mode === 'open' && (
          <div className="init-wizard-form">
            <label className="field-label">
              Workspace Path (must contain .architect/ directory)
              <input
                type="text"
                className="field-input"
                value={workspacePath}
                onChange={(e) => setWorkspacePath(e.target.value)}
                placeholder="e.g. C:\Projects\my-game"
                autoFocus
              />
            </label>
            <div className="init-wizard-actions">
              <button className="toolbar-btn" onClick={() => setMode('choose')}>Back</button>
              <button
                className="toolbar-btn toolbar-btn-primary"
                onClick={handleOpen}
                disabled={loading || !workspacePath.trim()}
              >
                {loading ? 'Opening...' : 'Open Workspace'}
              </button>
            </div>
          </div>
        )}

        {error && <div className="init-wizard-error">{error}</div>}
      </div>
    </div>
  );
}
