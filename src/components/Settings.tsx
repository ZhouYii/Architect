import { useState } from 'react';
import { useDesignStore } from '../store';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function Settings({ open, onClose }: Props) {
  const config = useDesignStore((s) => s.config);
  const activeLLMProvider = useDesignStore((s) => s.activeLLMProvider);
  const setActiveLLMProvider = useDesignStore((s) => s.setActiveLLMProvider);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  if (!open) return null;

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="merge-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="settings-section">
          <h3>LLM Provider</h3>
          <select
            className="field-input"
            value={activeLLMProvider ?? ''}
            onChange={(e) =>
              setActiveLLMProvider(e.target.value || null)
            }
          >
            <option value="">None</option>
            <option value="claude-code">Claude Code</option>
            <option value="opencode">OpenCode</option>
            <option value="ollama">Ollama</option>
          </select>
        </div>

        <div className="settings-section">
          <h3>Appearance</h3>
          <button className="toolbar-btn" onClick={toggleTheme}>
            {theme === 'light' ? 'Switch to Dark' : 'Switch to Light'}
          </button>
        </div>

        <div className="settings-section">
          <h3>Workspace</h3>
          <p className="hint">
            Project: {config?.project_name ?? 'Not loaded'}<br />
            Schema: v{config?.schema_version ?? '?'}
          </p>
        </div>
      </div>
    </div>
  );
}
