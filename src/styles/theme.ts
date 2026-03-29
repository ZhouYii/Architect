// ─── Architect Design System — CSS Variable Definitions ───────────────────────
// Apply via injectTheme() or reference TOKEN values directly in style objects.

export const THEME_VARS = {
  // Backgrounds
  bgBase:          'var(--color-bg-base)',
  bgSurface:       'var(--color-bg-surface)',
  bgSurfaceRaised: 'var(--color-bg-surface-raised)',

  // Borders
  border:          'var(--color-border)',
  borderFocus:     'var(--color-border-focus)',

  // Text
  textPrimary:     'var(--color-text-primary)',
  textSecondary:   'var(--color-text-secondary)',
  textTertiary:    'var(--color-text-tertiary)',
  textGhost:       'var(--color-text-ghost)',

  // Status
  statusAmber:     'var(--color-status-amber)',
  statusGreen:     'var(--color-status-green)',
  statusBlue:      'var(--color-status-blue)',
  statusRed:       'var(--color-status-red)',

  // Accent
  accent:          'var(--color-accent)',
  accentDim:       'var(--color-accent-dim)',
} as const;

// Raw token values (for JavaScript use, e.g. React Flow config)
export const TOKENS = {
  bgBase:          '#0C0E12',
  bgSurface:       '#14161C',
  bgSurfaceRaised: '#1C1E26',
  border:          '#2A2D38',
  borderFocus:     '#3A3D4A',
  textPrimary:     '#E8E9ED',
  textSecondary:   '#9BA0AD',
  textTertiary:    '#5C6170',
  textGhost:       '#363944',
  statusAmber:     '#E5A34B',
  statusGreen:     '#4ADE80',
  statusBlue:      '#5B8DEF',
  statusRed:       '#EF5B5B',
  accent:          '#7C8BF5',
  accentDim:       '#292D4A',
} as const;

// Status → color mapping
export const STATUS_COLORS: Record<string, string> = {
  clean:       TOKENS.border,
  modified:    TOKENS.statusAmber,
  proposed:    TOKENS.textTertiary,
  ready:       TOKENS.statusBlue,
  running:     TOKENS.statusAmber,
  implemented: TOKENS.statusGreen,
  failed:      TOKENS.statusRed,
  dismissed:   TOKENS.textGhost,
};

// Block type → Unicode icon mapping
export const BLOCK_ICONS: Record<string, string> = {
  service:     '◆',
  module:      '▣',
  class:       '◇',
  function:    'ƒ',
  'data-store':'⬡',
  external:    '◈',
  queue:       '≡',
  config:      '○',
};

// Inject CSS variables into :root
export function injectTheme(): void {
  const css = `
    :root {
      --color-bg-base: ${TOKENS.bgBase};
      --color-bg-surface: ${TOKENS.bgSurface};
      --color-bg-surface-raised: ${TOKENS.bgSurfaceRaised};
      --color-border: ${TOKENS.border};
      --color-border-focus: ${TOKENS.borderFocus};
      --color-text-primary: ${TOKENS.textPrimary};
      --color-text-secondary: ${TOKENS.textSecondary};
      --color-text-tertiary: ${TOKENS.textTertiary};
      --color-text-ghost: ${TOKENS.textGhost};
      --color-status-amber: ${TOKENS.statusAmber};
      --color-status-green: ${TOKENS.statusGreen};
      --color-status-blue: ${TOKENS.statusBlue};
      --color-status-red: ${TOKENS.statusRed};
      --color-accent: ${TOKENS.accent};
      --color-accent-dim: ${TOKENS.accentDim};
    }
  `;
  const style = document.createElement('style');
  style.id = 'architect-theme';
  style.textContent = css;
  document.head.appendChild(style);
}
