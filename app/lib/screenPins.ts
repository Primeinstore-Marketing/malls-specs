/**
 * Where each screen sits inside its mall, and any floor plan images laid
 * over the map. Hand-edited — this is the file to update as positions are
 * confirmed.
 *
 * Every screen already has an automatic first guess in `draftPins.ts`
 * (generated — see the script it names). A pin here always wins over the
 * draft, so this file only needs the screens someone has actually checked.
 *
 * ── Confirming or moving a screen ──────────────────────────────────────
 * Open a mall, click "Place" in the side panel, select a screen and drag it
 * to where it really is (or click the map, for a screen with no position).
 * The panel then shows the exact lines to paste into `SCREEN_PINS` below.
 *
 * ── Adding a floor plan ────────────────────────────────────────────────
 * Put the image in `app/public/floorplans/` and add it to `FLOOR_PLANS`
 * with the map coordinates of its four corners, clockwise from top-left,
 * each as [longitude, latitude]. Pick the corners from the map in edit
 * mode (the panel shows the coordinates under the cursor), or from any
 * map tool that shows coordinates. The image is stretched to fit, so a
 * plan drawn north-up only needs its top-left and bottom-right right.
 */

/**
 * How much to trust a pin, most to least:
 *  - 'confirmed'   — checked by someone who knows the site.
 *  - 'osm-draft'   — at a store of the same name on OpenStreetMap; the
 *                    screen is at or near that store.
 *  - 'estimated'   — inferred, e.g. a food court placed at the densest
 *                    cluster of restaurants in the mall.
 *  - 'placeholder' — nothing to go on; parked in the middle of the mall
 *                    so the screen is on the map until someone places it.
 */
export type PinSource = 'confirmed' | 'osm-draft' | 'estimated' | 'placeholder';

export const PIN_SOURCE_LABELS: Readonly<Record<PinSource, string>> = {
  confirmed: 'Confirmed',
  'osm-draft': 'At store (approx.)',
  estimated: 'Estimated',
  placeholder: 'Placeholder',
};

export interface ScreenPin {
  readonly lng: number;
  readonly lat: number;
  readonly source: PinSource;
  /** Mall level, e.g. "Upper" or "1" — shown in the panel when set. */
  readonly level?: string;
  /** For automatic pins: what the position was based on. */
  readonly note?: string;
}

export interface FloorPlanOverlay {
  readonly src: string;
  readonly corners: readonly [
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
  ];
  /** 0–1, default 0.85 — keeps the street map faintly visible underneath. */
  readonly opacity?: number;
}

export const FLOOR_PLANS: Readonly<Record<string, FloorPlanOverlay>> = {};

/** Confirmed positions. Paste lines from the map's "Moved this session" box here. */
export const SCREEN_PINS: Readonly<Record<string, ScreenPin>> = {};
