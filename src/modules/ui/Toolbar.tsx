import { useDesignStore } from '../store/store.js';
import { selectBreadcrumb } from '../store/selectors.js';
import { TOKENS } from '../../styles/theme.js';

export function Toolbar() {
  const breadcrumb = useDesignStore(selectBreadcrumb);
  const navigateToIndex = useDesignStore((s) => s.navigateToIndex);
  const navigateUp = useDesignStore((s) => s.navigateUp);
  const currentPath = useDesignStore((s) => s.ui.current_path);

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

      {/* Right side: placeholders */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Version indicator placeholder */}
        <div
          style={{
            fontSize: 11,
            color: TOKENS.textGhost,
            padding: '2px 8px',
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 4,
            background: TOKENS.bgSurfaceRaised,
          }}
        >
          v0.0.0
        </div>

        {/* View toggle placeholder */}
        <div
          style={{
            display: 'flex',
            background: TOKENS.bgSurfaceRaised,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <ViewToggleBtn label="◆" active title="Canvas view" />
          <ViewToggleBtn label="≡" active={false} title="List view" />
        </div>
      </div>
    </div>
  );
}

function ViewToggleBtn({
  label,
  active,
  title,
}: {
  label: string;
  active: boolean;
  title: string;
}) {
  return (
    <button
      title={title}
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
