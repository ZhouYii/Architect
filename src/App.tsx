import { useState, useCallback, useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { Breadcrumb } from './components/Breadcrumb';
import { Toolbar } from './components/Toolbar';
import { SidePanel } from './components/SidePanel';
import { TreeNavigator } from './components/TreeNavigator';
import { MergeReview } from './components/MergeReview';
import { Settings } from './components/Settings';
import { InitWizard } from './components/InitWizard';
import { useDesignStore, genId, wireAutosave } from './store';
import { flush } from './lib/flush';
import { exportSnapshot } from './lib/workspace';
import { detectAvailableProviders } from './lib/llm/registry';
import type { Block } from './types';

export default function App() {
  const workspacePath = useDesignStore((s) => s.workspacePath);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const addBlock = useDesignStore((s) => s.addBlock);
  const removeBlock = useDesignStore((s) => s.removeBlock);
  const removeArrow = useDesignStore((s) => s.removeArrow);
  const selectedBlockId = useDesignStore((s) => s.selectedBlockId);
  const selectedArrowId = useDesignStore((s) => s.selectedArrowId);
  const selectBlock = useDesignStore((s) => s.selectBlock);
  const selectArrow = useDesignStore((s) => s.selectArrow);
  const navigateUp = useDesignStore((s) => s.navigateUp);

  // Wire autosave subscriber + detect LLM providers on mount
  useEffect(() => {
    wireAutosave();
    detectAvailableProviders().then((providers) => {
      useDesignStore.getState().setAvailableProviders(providers.map(p => p.id));
      if (providers.length > 0 && !useDesignStore.getState().activeLLMProvider) {
        useDesignStore.getState().setActiveLLMProvider(providers[0].id);
      }
    }).catch(() => { /* Not in Tauri, skip */ });
  }, []);

  // Flush on window blur, rehash on focus (PRD §7.2)
  useEffect(() => {
    const handleBlur = () => { flush(); };
    const handleFocus = async () => {
      const store = useDesignStore.getState();
      if (!store.workspacePath || store.workspacePath === '__demo__') return;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const treePath = `${store.workspacePath}/.architect/tree`;
        const hash = await invoke<string>('compute_tree_hash', { treePath });
        if (hash !== store.state?.head_hash) {
          store.markDirty();
        }
      } catch { /* Not in Tauri */ }
    };
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Flush on app close
  useEffect(() => {
    const handleBeforeUnload = () => { flush(); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+N: new block
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
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
      }
      // Ctrl+S: force save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        flush();
      }
      // Ctrl+E: export snapshot
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        exportSnapshot();
      }
      // Delete: remove selected
      if (e.key === 'Delete') {
        if (selectedBlockId) removeBlock(selectedBlockId);
        else if (selectedArrowId) removeArrow(selectedArrowId);
      }
      // Escape: deselect or close settings
      if (e.key === 'Escape') {
        if (settingsOpen) setSettingsOpen(false);
        else { selectBlock(null); selectArrow(null); }
      }
      // Backspace: navigate up (only when not in text input)
      if (e.key === 'Backspace') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          navigateUp();
        }
      }
    },
    [addBlock, removeBlock, removeArrow, selectedBlockId, selectedArrowId, selectBlock, selectArrow, navigateUp, settingsOpen],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!workspacePath) {
    return <InitWizard />;
  }

  return (
    <div className="app-layout">
      <Toolbar />
      <div className="app-header">
        <Breadcrumb />
        <button
          className="settings-btn"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
        >
          &#x2699;
        </button>
      </div>
      <div className="app-main">
        <TreeNavigator />
        <div className="canvas-area">
          <Canvas />
        </div>
        <SidePanel />
      </div>
      <MergeReview />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
