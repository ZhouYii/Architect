import { useEffect, useRef, useState } from 'react';
import './styles/globals.css';
import { Canvas } from './modules/canvas/index.js';
import { Toolbar, SidePanel, MergeConflictView } from './modules/ui/index.js';
import { Drawer } from './modules/ui/Drawer.js';
import { CommandPalette } from './modules/ui/CommandPalette.js';
import { useKeyboardShortcuts } from './modules/ui/useKeyboardShortcuts.js';
import { useDesignStore } from './modules/store/store.js';
import {
  setWorkspacePath,
  scheduleFlush,
  flush,
  initWorkspace,
  loadWorkspace,
  loadVersion,
} from './modules/workspace/index.js';
import { TOKENS } from './styles/theme.js';

// ─── Workspace path ───────────────────────────────────────────────────────────
// For v1, derive the workspace path from the Tauri app's CWD or a well-known
// default.  In production this will come from a file-picker dialog.
//
// We use `window.__TAURI_INTERNALS__` presence to detect Tauri vs browser dev.
function getDefaultWorkspacePath(): string {
  // Check if a path was injected at build time or via URL param (for development)
  const params = new URLSearchParams(window.location.search);
  const fromParam = params.get('workspace');
  if (fromParam) return fromParam;

  // Default: use the Desktop/Architect folder itself as the workspace root
  // This is safe for development; in production a dialog should be used.
  return 'C:/Users/yizho/Desktop/Architect';
}

// ─── App ─────────────────────────────────────────────────────────────────────

export function App() {
  const subscriptionRef = useRef<(() => void) | null>(null);
  const workspaceLoaded = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Register consolidated keyboard shortcuts
  useKeyboardShortcuts();

  useEffect(() => {
    const workspacePath = getDefaultWorkspacePath();
    setWorkspacePath(workspacePath);

    // ── Load or init workspace ────────────────────────────────────────────
    async function bootstrap() {
      try {
        const loaded = await loadWorkspace(workspacePath);
        if (!loaded) {
          console.info('[workspace] No .architect/ found — initializing with defaults');
          await initWorkspace(workspacePath, 'Architect Project');
          // After init, try loading the freshly created files
          await loadWorkspace(workspacePath);
        }
        workspaceLoaded.current = true;
        setLoadError(null);
        console.info('[workspace] Ready at', workspacePath);
      } catch (err) {
        console.error('[workspace] Bootstrap failed:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setLoadError(msg);
        // Continue with in-memory mock data — degraded mode
        workspaceLoaded.current = true;
      }
    }

    void bootstrap();

    // ── Subscribe to store changes for autosave ───────────────────────────
    subscriptionRef.current = useDesignStore.subscribe(() => {
      if (workspaceLoaded.current) {
        scheduleFlush();
      }
    });

    // ── Immediate flush on window blur ────────────────────────────────────
    function onBlur() {
      if (workspaceLoaded.current) {
        flush().catch((err: unknown) => {
          console.error('[autosave] blur flush error:', err);
        });
      }
    }

    // ── Immediate flush before tab/window closes ─────────────────────────
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (workspaceLoaded.current) {
        // Synchronous call — best-effort; async flush may not complete
        // but we trigger it to maximise chances of data being written
        flush().catch(() => undefined);
        void e;
      }
    }

    window.addEventListener('blur', onBlur);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      // Cleanup
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
      }
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Error recovery handler ──────────────────────────────────────────────────
  const handleRestoreFromVersion = async () => {
    const lastMajor = useDesignStore.getState().ui.last_major_version;
    const versionStr = window.prompt(
      `Restore from version archive.\nEnter version number (1–${lastMajor || 1}):`,
      String(lastMajor || 1)
    );
    if (!versionStr) return;
    const version = parseInt(versionStr, 10);
    if (isNaN(version) || version < 1) {
      alert('Invalid version number.');
      return;
    }
    setIsRestoring(true);
    try {
      await loadVersion(version);
      setLoadError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Restore failed: ${msg}`);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="app-layout">
      <Toolbar />
      <div className="app-body">
        <div className="app-canvas-area" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>
          {/* Error recovery banner */}
          {loadError && (
            <div
              style={{
                padding: '8px 14px',
                background: `${TOKENS.statusRed}18`,
                borderBottom: `1px solid ${TOKENS.statusRed}44`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 12, color: TOKENS.statusRed, flex: 1 }}>
                Workspace load failed: {loadError}
              </span>
              <button
                onClick={() => { void handleRestoreFromVersion(); }}
                disabled={isRestoring}
                style={{
                  fontSize: 11,
                  padding: '3px 10px',
                  background: `${TOKENS.statusAmber}18`,
                  color: isRestoring ? TOKENS.textTertiary : TOKENS.statusAmber,
                  border: `1px solid ${TOKENS.statusAmber}44`,
                  borderRadius: 4,
                  cursor: isRestoring ? 'wait' : 'pointer',
                  flexShrink: 0,
                }}
              >
                {isRestoring ? 'Restoring…' : 'Restore from version'}
              </button>
              <button
                onClick={() => setLoadError(null)}
                style={{ fontSize: 12, color: TOKENS.textTertiary, padding: '0 4px', cursor: 'pointer' }}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          )}
          <div className="app-canvas" style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <Canvas />
          </div>
          {/* Phase 6: Implementation drawer — overlays/pushes canvas area */}
          <Drawer />
        </div>
        <SidePanel />
      </div>
      {/* Phase 5: merge conflict resolution modal */}
      <MergeConflictView />
      {/* Phase 11: Command palette */}
      <CommandPalette />
    </div>
  );
}
