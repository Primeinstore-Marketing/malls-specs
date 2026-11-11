import type { Specification } from '@data-model';
import type { ScreenLayout, ScreenPanel } from '@data-model';

/**
 * Screens that aren't one rectangle — several physical panels inside one
 * artwork canvas, or marked zones within one. The layout is part of each
 * spec's record (`spec.screenLayout`), stored in the database and edited as
 * data; nothing about any particular screen is kept in code.
 *
 * Panel gaps on the physical screen are built into the client's template
 * and deliberately not stored (the specs say not to measure them); the
 * drawings add a small gap only so the panels read as separate.
 */
export type { ScreenLayout, ScreenPanel };

/**
 * The safe area every Primedia Malls spec sheet gives: keep essential content
 * and text this many pixels inside each edge (each panel's edges, for
 * multi-panel screens). A layout can set its own.
 */
export const SHEET_SAFE_MARGIN = 40;

export function getSafeMargin(spec: Specification): number {
  return spec.screenLayout?.safeMargin ?? SHEET_SAFE_MARGIN;
}

export function getScreenLayout(spec: Specification): ScreenLayout | null {
  const layout = spec.screenLayout;
  return layout && layout.panels.length > 0 ? layout : null;
}
