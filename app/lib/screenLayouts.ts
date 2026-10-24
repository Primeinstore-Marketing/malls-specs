/**
 * Screens that aren't one rectangle — several physical panels inside one
 * artwork canvas. Coordinates are in artwork pixels, origin top-left of the
 * canvas ("envelope"), straight from each screen's spec PDF.
 *
 * Panel gaps on the physical screen are built into the client's template
 * and deliberately not given here (the specs say not to measure them); the
 * drawings add a small gap only so the panels read as separate.
 */

export interface ScreenPanel {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ScreenLayout {
  readonly panels: readonly ScreenPanel[];
  /** A short description for the size chips, e.g. "5 portrait panels". */
  readonly summary: string;
  /** Size of each panel, when they're all the same. */
  readonly panelSize: { readonly width: number; readonly height: number } | null;
  /** The vertical band every panel covers — keep titles inside it. */
  readonly commonBand: { readonly top: number; readonly bottom: number } | null;
  /** Safe margin inside each panel, in px. */
  readonly safeMargin: number | null;
  /** One line on how the panels are arranged. */
  readonly arrangement: string;
}

const muggBeanPanels: ScreenPanel[] = [0, 1, 2, 3, 4].map((index) => ({
  label: `P${index + 1}`,
  x: index * 384,
  // P1, P3, P5 hang 200 px lower than P2 and P4.
  y: index % 2 === 0 ? 200 : 0,
  width: 384,
  height: 1024,
}));

export const SCREEN_LAYOUTS: Readonly<Record<string, ScreenLayout>> = {
  // "Cresta Mugg & Bean Impact.pdf", Updated Specs, Oct 2026.
  'spec-cresta-mugg-bean-impact': {
    panels: muggBeanPanels,
    summary: '5 portrait panels',
    panelSize: { width: 384, height: 1024 },
    commonBand: { top: 200, bottom: 1024 },
    safeMargin: 40,
    arrangement: 'P1, P3 and P5 sit 200 px lower than P2 and P4',
  },
};

export function getScreenLayout(specId: string): ScreenLayout | null {
  return SCREEN_LAYOUTS[specId] ?? null;
}
