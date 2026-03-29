import { useMemo, useState, useCallback } from 'react';
import { useDesignStore } from '../store/store.js';
import { TOKENS } from '../../styles/theme.js';
import type { BreadcrumbSegment } from '../store/selectors.js';
import { scan } from '../scanner/index.js';
import { VersionIndicator } from './VersionIndicator.js';
import { TrackSwitcher } from './TrackSwitcher.js';
import { planImplementation } from '../orchestrator/planner.js';

export function Toolbar() {
  const currentPath = useDesignStore((s) => s.ui.current_path);
  const canvases = useDesignStore((s) => s.canvases);
  const navigateToIndex = useDesignStore((s) => s.navigateToIndex);
  const navigateUp = useDesignStore((s) => s.navigateUp);
  const viewMode = useDesignStore((s) => s.ui.view_mode);
  const setViewMode = useDesignStore((s) => s.setViewMode);
  const setCodeGraph = useDesignStore((s) => s.setCodeGraph);
  const setImplTasks = useDesignStore((s) => s.setImplTasks);
  const setImplPlanId = useDesignStore((s) => s.setImplPlanId);
  const setDrawerOpen = useDesignStore((s) => s.setDrawerOpen);
  const lastMajorVersion = useDesignStore((s) => s.ui.last_major_version);

  const [isScanning, setIsScanning] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);

  // NOTE: Global keyboard shortcuts are now handled by useKeyboardShortcuts() in App.tsx.

  const handleViewToggle = useCallback(
    async (mode: 'conceptual' | 'code') => {
      if (mode === viewMode) return;

      if (mode === 'code') {
        setIsScanning(true);
        try {
          // Ask the user for a path; fall back to '.' (app cwd) if no dialog
          const projectPath = window.prompt('Enter project path to scan:', '.') ?? '.';
          const graph = await scan(projectPath);
          setCodeGraph(graph);
        } catch (err) {
          console.error('[toolbar] scan failed:', err);
        } finally {
          setIsScanning(false);
        }
      }

      setViewMode(mode);
    },
    [viewMode, setViewMode, setCodeGraph],
  );

  // ── Plan Implementation ─────────────────────────────────────────────────────
  const handlePlanImplementation = useCallback(async () => {
    setIsPlanning(true);
    try {
      const fromVersion = lastMajorVersion;
      const toVersion = lastMajorVersion + 1;
      const tasks = await planImplementation(fromVersion, toVersion);
      setImplTasks(tasks);
      setImplPlanId(`v${fromVersion}-to-v${toVersion}`);
      setDrawerOpen(true);
    } catch (err) {
      console.error('[toolbar] planImplementation failed:', err);
    } finally {
      setIsPlanning(false);
    }
  }, [lastMajorVersion, setImplTasks, setImplPlanId, setDrawerOpen]);

  // Compute breadcrumb from stable primitives to avoid infinite re-render
  const breadcrumb: BreadcrumbSegment[] = useMemo(
    () => currentPath.map((canvasId, index) => ({
      canvas_id: canvasId,
      label: canvases[canvasId]?.label ?? canvasId,
      index,
    })),
    [currentPath, canvases],
  );

  return (
    <div
      style={{
        height: 44,
        background: TOKENS.bgSurface,
        borderBottom: `1px solid ${TOKENS.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: 12,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* Logo / app name */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          marginRight: 8,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 16, color: TOKENS.accent }}>◆</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: TOKENS.textPrimary,
            letterSpacing: '0.04em',
          }}
        >
          Architect
        </span>
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 18, background: TOKENS.border, flexShrink: 0 }} />

      {/* Breadcrumb */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
        }}
        aria-label="Canvas navigation"
      >
        {currentPath.length > 1 && (
          <button
            onClick={navigateUp}
            style={{
              padding: '2px 6px',
              fontSize: 12,
              color: TOKENS.textTertiary,
              marginRight: 4,
              borderRadius: 4,
              cursor: 'pointer',
            }}
            title="Go up"
          >
            ‹ back
          </button>
        )}

        {breadcrumb.map((seg, i) => {
          const isLast = i === breadcrumb.length - 1;
          return (
            <div key={seg.canvas_id} style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
              {i > 0 && (
                <span style={{ fontSize: 12, color: TOKENS.textGhost, margin: '0 4px', flexShrink: 0 }}>
                  /
                </span>
              )}
              <button
                onClick={() => !isLast && navigateToIndex(seg.index)}
                style={{
                  fontSize: 13,
                  fontWeight: isLast ? 600 : 400,
                  color: isLast ? TOKENS.textPrimary : TOKENS.textTertiary,
                  cursor: isLast ? 'default' : 'pointer',
                  borderRadius: 4,
                  padding: '2px 6px',
                  background: 'transparent',
                  maxWidth: 180,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {seg.label}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Plan Implementation button */}
        <button
          onClick={() => { void handlePlanImplementation(); }}
          disabled={isPlanning}
          style={{
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: 500,
            color: isPlanning ? TOKENS.textTertiary : TOKENS.accent,
            background: `${TOKENS.accent}16`,
            border: `1px solid ${TOKENS.accent}44`,
            borderRadius: 4,
            cursor: isPlanning ? 'wait' : 'pointer',
            letterSpacing: '0.01em',
            flexShrink: 0,
          }}
          title="Generate implementation task DAG from design diff"
        >
          {isPlanning ? 'Planning…' : 'Plan'}
        </button>

        {/* Separator */}
        <div style={{ width: 1, height: 18, background: TOKENS.border, flexShrink: 0 }} />

        {/* Track switcher */}
        <TrackSwitcher />

        {/* Separator */}
        <div style={{ width: 1, height: 18, background: TOKENS.border, flexShrink: 0 }} />

        {/* Version indicator */}
        <VersionIndicator />

        {/* View toggle */}
        <div
          style={{
            display: 'flex',
            background: TOKENS.bgSurfaceRaised,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <ViewToggleBtn
            label="◆"
            active={viewMode === 'conceptual'}
            title="Conceptual view"
            onClick={() => { void handleViewToggle('conceptual'); }}
          />
          <ViewToggleBtn
            label={isScanning ? '…' : '≡'}
            active={viewMode === 'code'}
            title="Code view"
            onClick={() => { void handleViewToggle('code'); }}
          />
        </div>
      </div>
    </div>
  );
}

function ViewToggleBtn({
  label,
  active,
  title,
  onClick,
}: {
  label: string;
  active: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 28,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        color: active ? TOKENS.textPrimary : TOKENS.textTertiary,
        background: active ? TOKENS.bgSurface : 'transparent',
        borderRight: `1px solid ${TOKENS.border}`,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
