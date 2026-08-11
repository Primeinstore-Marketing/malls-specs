// Specification Platform — design token types
// Generated from the Phase 3 token layer. Do not hand-edit.

export const colorTokens = [
  'bg',
  'bg-subtle',
  'bg-muted',
  'bg-strong',
  'bg-inverse',
  'fg',
  'fg-muted',
  'fg-subtle',
  'fg-on-accent',
  'fg-on-inverse',
  'border',
  'border-strong',
  'border-control',
  'border-focus',
  'accent',
  'accent-hover',
  'accent-active',
  'accent-subtle',
  'accent-border',
  'accent-fg',
  'brand',
  'brand-hover',
  'brand-subtle',
  'brand-surface',
  'brand-surface-hover',
  'brand-on-surface',
  'brand-on-surface-muted',
  'info-fg',
  'info-bg',
  'info-border',
  'success-fg',
  'success-bg',
  'success-border',
  'warning-fg',
  'warning-bg',
  'warning-border',
  'danger-fg',
  'danger-bg',
  'danger-border',
  'neutral-fg',
  'neutral-bg',
  'neutral-border',
] as const;
export type ColorToken = (typeof colorTokens)[number];

export const specStatuses = [
  { id: 'draft', label: 'Draft', tone: 'neutral' },
  { id: 'review', label: 'In review', tone: 'warning' },
  { id: 'published', label: 'Published', tone: 'success' },
  { id: 'deprecated', label: 'Deprecated', tone: 'danger' },
  { id: 'superseded', label: 'Superseded', tone: 'info' },
] as const;
export type SpecStatus = (typeof specStatuses)[number]['id'];

export const textTokens = [
  'display-2xl',
  'display-xl',
  'display-lg',
  'display-md',
  'display-sm',
  'body-lg',
  'body-md',
  'body-sm',
  'label-lg',
  'label-md',
  'label-sm',
  'mono-md',
] as const;
export type TextToken = (typeof textTokens)[number];

export const spaceTokens = ['0', 'px', '0.5', '1', '1.5', '2', '3', '4', '5', '6', '8', '10', '12', '16', '20', '24'] as const;
export type SpaceToken = (typeof spaceTokens)[number];

export const radiusTokens = ['xs', 'sm', 'md', 'lg', 'xl', 'full'] as const;
export type RadiusToken = (typeof radiusTokens)[number];

export const breakpoints = {
  xs: 0,   // 390px reference — single column
  sm: 480,   // Compact mobile — icon-only chrome, overflow menu
  md: 768,   // Tablet — sidebar goes off-canvas, split rotates to stack
  lg: 1024,   // Small desktop — sidebar returns, split-pane restored
  xl: 1440,   // Desktop — panel widens to 58% (variant A)
  2xl: 1728,   // Wide — container max-width caps
} as const;
export type Breakpoint = keyof typeof breakpoints;

export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 100,
  topbar: 200,
  scrim: 300,
  drawer: 310,
  modal: 400,
  popover: 500,
  tooltip: 550,
  toast: 600,
} as const;
