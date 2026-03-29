import { useState } from 'react';
import { useDesignStore, genId } from '../store';
import { exportSnapshot } from '../lib/workspace';
import { flush } from '../lib/flush';
import { autoLayout } from '../lib/auto-layout';
import type { Block } from '../types';

export function Toolbar() {
  const addBlock = useDesignStore((s) => s.addBlock);
  const removeBlock = useDesignStore((s) => s.removeBlock);
  const removeArrow = useDesignStore((s) => s.removeArrow);
  const selectedBlockId = useDesignStore((s) => s.selectedBlockId);
  const selectedArrowId = useDesignStore((s) => s.selectedArrowId);
  const version = useDesignStore((s) => s.version);
  const dirty = useDesignStore((s) => s.dirty);

  const handleAddBlock = () => {
    const id = genId();
    const block: Block = {
      id,
      label: `Block ${id.slice(-4)}`,
      ports: [
        { id: `${id}-in`, label: 'in', direction: 'entry' },
        { id: `${id}-out`, label: 'out', direction: 'exit' },
      ],
      hasChildren: false,
    };
    addBlock(block);
  };

  const handleDelete = () => {
    if (selectedBlockId) removeBlock(selectedBlockId);
    else if (selectedArrowId) removeArrow(selectedArrowId);
  };

  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    setExportError(null);
    try {
      const ver = await exportSnapshot();
      if (ver) console.log(`Checkpoint cp-${String(ver).padStart(3, '0')} created`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setExportError(msg);
      setTimeout(() => setExportError(null), 8000);
    }
  };

  const handleAutoLayout = () => {
    const store = useDesignStore.getState();
    const canvas = store.nodes[store.currentPath];
    if (!canvas) return;
    const layout = autoLayout(canvas);
    store.setCanvasLayout(layout);
  };

  const handleSave = () => { flush(); };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn" onClick={handleAddBlock} title="Add Block (Ctrl+N)">
          + Block
        </button>
        <button
          className="toolbar-btn"
          onClick={handleDelete}
          disabled={!selectedBlockId && !selectedArrowId}
          title="Delete Selected (Del)"
        >
          Delete
        </button>
        <button className="toolbar-btn" onClick={handleAutoLayout} title="Auto Layout">
          Layout
        </button>
      </div>
      <div className="toolbar-center">
        <span className="version-badge">
          v{version}{dirty ? '*' : ''}
        </span>
        {exportError && (
          <span className="toolbar-error">{exportError}</span>
        )}
      </div>
      <div className="toolbar-right">
        <button className="toolbar-btn" onClick={handleSave} title="Save (Ctrl+S)">
          Save
        </button>
        <button className="toolbar-btn toolbar-btn-primary" onClick={handleExport} title="Checkpoint (Ctrl+E)">
          Checkpoint
        </button>
      </div>
    </div>
  );
}
