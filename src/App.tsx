import { useEffect, useRef } from 'react';
import './styles/globals.css';
import { Canvas } from './modules/canvas/index.js';
import { Toolbar, SidePanel, MergeConflictView } from './modules/ui/index.js';
import { Drawer } from './modules/ui/Drawer.js';
import { useDesignStore } from './modules/store/store.js';
import {
  setWorkspacePath,
  scheduleFlush,
  flush,
  initWorkspace,
  loadWorkspace,
} from './modules/workspace/index.js';

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
        console.info('[workspace] Ready at', workspacePath);
      } catch (err) {
        console.error('[workspace] Bootstrap failed:', err);
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

  return (
    <div className="app-layout">
      <Toolbar />
      <div className="app-body">
        <div className="app-canvas-area" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>
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
    </div>
  );
}
