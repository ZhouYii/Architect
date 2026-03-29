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

// Light theme token values
export const TOKENS_LIGHT = {
  bgBase:          '#F5F6FA',
  bgSurface:       '#FFFFFF',
  bgSurfaceRaised: '#F0F1F7',
  border:          '#D1D4E0',
  borderFocus:     '#A8ABBE',
  textPrimary:     '#1A1C26',
  textSecondary:   '#4A4F66',
  textTertiary:    '#8B90A8',
  textGhost:       '#C4C8D8',
  statusAmber:     '#C97A1A',
  statusGreen:     '#1D9C52',
  statusBlue:      '#2B5DC8',
  statusRed:       '#C82B2B',
  accent:          '#4A5CD8',
  accentDim:       '#E0E4FF',
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

// Inject CSS variables into :root (dark theme by default)
export function injectTheme(mode: 'dark' | 'light' = 'dark'): void {
  const t = mode === 'light' ? TOKENS_LIGHT : TOKENS;
  const css = `
    :root {
      --color-bg-base: ${t.bgBase};
      --color-bg-surface: ${t.bgSurface};
      --color-bg-surface-raised: ${t.bgSurfaceRaised};
      --color-border: ${t.border};
      --color-border-focus: ${t.borderFocus};
      --color-text-primary: ${t.textPrimary};
      --color-text-secondary: ${t.textSecondary};
      --color-text-tertiary: ${t.textTertiary};
      --color-text-ghost: ${t.textGhost};
      --color-status-amber: ${t.statusAmber};
      --color-status-green: ${t.statusGreen};
      --color-status-blue: ${t.statusBlue};
      --color-status-red: ${t.statusRed};
      --color-accent: ${t.accent};
      --color-accent-dim: ${t.accentDim};
    }
  `;
  const existing = document.getElementById('architect-theme');
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = 'architect-theme';
  style.textContent = css;
  document.head.appendChild(style);
}
