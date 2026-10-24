/**
 * Mall directory maps — the illustrated "you are here" maps malls publish.
 * They're drawn for clarity, not to scale, so they get their own view
 * ("Mall map") instead of being stretched over the street map, and screen
 * positions on them are stored as fractions of the image (x: 0 = left edge,
 * 1 = right; y: 0 = top, 1 = bottom).
 *
 * To add one: put the image in `app/public/floorplans/`, add an entry below
 * with its pixel size, then place screens on it from the site (sign in, open
 * the mall, switch to "Mall map", click "Place"). Positions placed on the
 * site are stored on the server and override any listed here.
 */

export interface MallMapPin {
  readonly x: number;
  readonly y: number;
  readonly source: 'confirmed' | 'estimated';
  /** For estimated pins: what the position was based on. */
  readonly note?: string;
}

export interface MallMapImage {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  /** Starting positions; positions saved on the site win over these. */
  readonly pins: Readonly<Record<string, MallMapPin>>;
}

export const MALL_MAPS: Readonly<Record<string, MallMapImage>> = {
  fourways: {
    src: '/floorplans/fourways.png',
    width: 1536,
    height: 1086,
    pins: {
      'spec-fourways-food-court': {
        x: 0.83,
        y: 0.51,
        source: 'estimated',
        note: 'the “Food Court” area on the Fourways mall map (the map also shows a Mezzanine Food Court)',
      },
    },
  },
};
