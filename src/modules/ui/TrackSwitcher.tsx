/**
 * TrackSwitcher — toolbar component for creating, switching, and merging design tracks.
 *
 * Shows:
 *  - Colored pill indicating the active track (or "main")
 *  - Dropdown listing all tracks + "main"
 *  - "New Track" button
 *  - "Merge to Main" button (only when on a track)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDesignStore } from '../store/store.js';
import { TOKENS } from '../../styles/theme.js';
import { createTrack, switchTrack, mergeTrack, listTracks } from '../workspace/tracks.js';

// ── Track colors (cycling palette) ───────────────────────────────────────────

const TRACK_COLORS = [
  '#7C8BF5', // accent blue
  '#4ADE80', // green
  '#E5A34B', // amber
  '#EF5B5B', // red
  '#A78BFA', // violet
  '#22D3EE', // cyan
  '#F472B6', // pink
];

function trackColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return TRACK_COLORS[hash % TRACK_COLORS.length];
}

// ─────────────────────────────────────────────────────────────────────────────

export function TrackSwitcher() {
  const activeTrack = useDesignStore((s) => s.active_track);
  const tracks = useDesignStore((s) => s.tracks);
  const setTracks = useDesignStore((s) => s.setTracks);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Refresh track list when dropdown opens
  useEffect(() => {
    if (!open) return;
    listTracks()
      .then((t) => setTracks(t))
      .catch((err: unknown) => console.error('[TrackSwitcher] listTracks:', err));
  }, [open, setTracks]);

  const handleNewTrack = useCallback(async () => {
    const name = window.prompt('Track name:', `track-${Date.now()}`);
    if (!name?.trim()) return;
    const desc = window.prompt('Description (optional):', '') ?? '';
    setBusy(true);
    try {
      await createTrack(name.trim(), desc.trim() || undefined);
    } catch (err) {
      console.error('[TrackSwitcher] createTrack failed:', err);
      window.alert(`Failed to create track: ${String(err)}`);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }, []);

  const handleSwitch = useCallback(async (name: string | null) => {
    if (name === activeTrack) { setOpen(false); return; }
    setBusy(true);
    try {
      await switchTrack(name);
    } catch (err) {
      console.error('[TrackSwitcher] switchTrack failed:', err);
      window.alert(`Failed to switch track: ${String(err)}`);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }, [activeTrack]);

  const handleMerge = useCallback(async () => {
    if (!activeTrack) return;
    if (!window.confirm(`Merge track "${activeTrack}" into main?`)) return;
    setBusy(true);
    try {
      const conflicts = await mergeTrack(activeTrack);
      if (conflicts.length === 0) {
        // Switch back to main automatically after a clean merge
        await switchTrack(null);
      }
    } catch (err) {
      console.error('[TrackSwitcher] mergeTrack failed:', err);
      window.alert(`Merge failed: ${String(err)}`);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }, [activeTrack]);

  const label = activeTrack ?? 'main';
  const color = activeTrack ? trackColor(activeTrack) : TOKENS.textGhost;

  return (
    <div ref={dropRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Pill trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        title="Switch design track (Ctrl+B = new)"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          height: 26,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 12,
          background: TOKENS.bgSurfaceRaised,
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.6 : 1,
          fontSize: 11,
          color: TOKENS.textSecondary,
          whiteSpace: 'nowrap',
        }}
      >
        {/* Color dot */}
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
            display: 'inline-block',
          }}
        />
        <span style={{ color: activeTrack ? color : TOKENS.textTertiary }}>
          {label}
        </span>
        <span style={{ color: TOKENS.textGhost, fontSize: 9, marginLeft: 2 }}>▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 30,
            right: 0,
            minWidth: 180,
            background: TOKENS.bgSurfaceRaised,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Section header */}
          <div
            style={{
              padding: '6px 10px',
              fontSize: 10,
              color: TOKENS.textGhost,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderBottom: `1px solid ${TOKENS.border}`,
            }}
          >
            Tracks
          </div>

          {/* Main */}
          <TrackOption
            name="main"
            color={TOKENS.textGhost}
            active={activeTrack === null}
            onSelect={() => { void handleSwitch(null); }}
          />

          {/* Track list */}
          {tracks.map((t) => (
            <TrackOption
              key={t.name}
              name={t.name}
              color={trackColor(t.name)}
              active={activeTrack === t.name}
              description={t.description}
              onSelect={() => { void handleSwitch(t.name); }}
            />
          ))}

          {tracks.length === 0 && (
            <div
              style={{
                padding: '8px 10px',
                fontSize: 11,
                color: TOKENS.textGhost,
                fontStyle: 'italic',
              }}
            >
              No tracks yet
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              borderTop: `1px solid ${TOKENS.border}`,
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <ActionBtn label="+ New Track" onClick={() => { void handleNewTrack(); }} />
            {activeTrack && (
              <ActionBtn
                label={`↑ Merge "${activeTrack}" to main`}
                onClick={() => { void handleMerge(); }}
                color={TOKENS.statusAmber}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TrackOption({
  name,
  color,
  active,
  description,
  onSelect,
}: {
  name: string;
  color: string;
  active: boolean;
  description?: string;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        background: active
          ? TOKENS.accentDim
          : hover
          ? TOKENS.bgSurface
          : 'transparent',
        textAlign: 'left',
        cursor: 'pointer',
        borderBottom: `1px solid ${TOKENS.border}`,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
          display: 'inline-block',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            color: active ? TOKENS.textPrimary : TOKENS.textSecondary,
            fontWeight: active ? 600 : 400,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
        {description && (
          <div
            style={{
              fontSize: 10,
              color: TOKENS.textGhost,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {description}
          </div>
        )}
      </div>
      {active && (
        <span style={{ fontSize: 10, color: TOKENS.accent, flexShrink: 0 }}>✓</span>
      )}
    </button>
  );
}

function ActionBtn({
  label,
  onClick,
  color,
}: {
  label: string;
  onClick: () => void;
  color?: string;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        padding: '5px 8px',
        fontSize: 11,
        color: color ?? TOKENS.textTertiary,
        background: hover ? TOKENS.bgSurface : 'transparent',
        borderRadius: 4,
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
    >
      {label}
    </button>
  );
}
