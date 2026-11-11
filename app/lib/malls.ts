import type { Catalogue, Specification, SubGroupId } from '@data-model';
import { getCatalogue, snapshotState } from './catalogue';
import type { LivePlacement } from './mergeLive';
import { allSites, liveSites, siteById } from './sites';
import type { SiteLocation as MallLocation, SiteRecord } from './sites';
import { FLOOR_PLANS, SCREEN_PINS } from './screenPins';
import { DRAFT_PINS } from './draftPins';
import { MALL_MAPS } from './mallMaps';
import type { MallMapImage, MallMapPin } from './mallMaps';
import type { FloorPlanOverlay, PinSource, ScreenPin } from './screenPins';

/**
 * Physical malls, for the map, the left-hand list, the Media Explorer and
 * proposals. Which malls exist, their names, places and map positions all
 * come from the API (records "site:<id>", see lib/sites.ts); admins manage
 * them in Site admin → Malls. This file joins each mall to its screens:
 *  - built-in screens, by the mall's `subGroupId` or `specIds`;
 *  - screens added on the site, by their `mallId` (see mergeLive.ts).
 *
 * Screen positions still use the hand-confirmed pins and floor plans in
 * `screenPins.ts`, the automatic drafts in `draftPins.ts` and the directory
 * maps in `mallMaps.ts`, keyed by mall id; positions set on the site win.
 */

export type { FloorPlanOverlay, MallLocation, PinSource, ScreenPin };
export { PIN_SOURCE_LABELS } from './screenPins';

export type MallGroup = 'malls' | 'hyprop' | 'formats';

export const MALL_GROUP_LABELS: Readonly<Record<MallGroup, string>> = {
  malls: 'Malls',
  hyprop: 'Hyprop Malls',
  formats: 'Generic specs',
};

export interface Mall {
  readonly id: string;
  readonly name: string;
  readonly group: MallGroup;
  readonly specIds: readonly string[];
  /** Null when the mall couldn't be found on OpenStreetMap. */
  readonly location: MallLocation | null;
  readonly floorPlan: FloorPlanOverlay | null;
  /** Only screens with a known position; the rest are "not yet placed". */
  readonly pins: Readonly<Record<string, ScreenPin>>;
  /** The mall's own illustrated directory map, if we have one (see mallMaps.ts). */
  readonly mallMap: { readonly image: MallMapImage; readonly pins: Readonly<Record<string, MallMapPin>> } | null;
}

export type { MallMapImage, MallMapPin };


/**
 * Admin changes from the API (see `lib/liveData.ts`): confirmed positions,
 * and which mall each added screen belongs to. Positions here beat both
 * the hand-confirmed SCREEN_PINS and the automatic drafts.
 */
// Starts as the database snapshot baked in at publish time; replaced when
// fresh data arrives from the API.
let livePlacement: LivePlacement = snapshotState.placement;

export function setLivePlacement(placement: LivePlacement) {
  livePlacement = placement;
}

const GROUP_CATEGORY: Readonly<Record<MallGroup, string>> = {
  malls: 'category-malls',
  hyprop: 'category-hyprop-malls',
  formats: 'category-malls',
};

/** Where a new screen in this mall is filed in the catalogue. */
export function getMallFiling(mallId: string): { categoryId: string; subGroupId: string | null } | null {
  const source = siteById(mallId);
  if (!source) return null;
  return { categoryId: GROUP_CATEGORY[source.group], subGroupId: source.subGroupId ?? null };
}

function subGroupSpecIds(subGroupId: string, catalogue: Catalogue): string[] {
  return Object.values(catalogue.specifications)
    .filter((spec) => spec.archivedAt === null && spec.subGroupId === (subGroupId as SubGroupId))
    .map((spec) => spec.id);
}

function toMall(source: SiteRecord, catalogue: Catalogue): Mall {
  const specIds = Array.from(
    new Set([
      ...(source.subGroupId ? subGroupSpecIds(source.subGroupId, catalogue) : []),
      ...(source.specIds ?? []),
      ...(livePlacement.addedSpecIds[source.id] ?? []),
    ]),
  ).filter((id) => {
    const spec = catalogue.specifications[id];
    return spec != null && spec.archivedAt === null;
  });
  const pins: Record<string, ScreenPin> = {};
  for (const id of specIds) {
    // A confirmed position always beats the automatic draft.
    const pin = livePlacement.pins[id] ?? SCREEN_PINS[id] ?? DRAFT_PINS[id];
    if (pin) pins[id] = pin;
  }
  return {
    id: source.id,
    name: source.name,
    group: source.group,
    specIds,
    location: source.location ?? null,
    floorPlan: FLOOR_PLANS[source.id] ?? null,
    pins,
    mallMap: mallMapFor(source.id, specIds),
  };
}

const byName = (a: Mall, b: Mall) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

/**
 * Every published mall, with its screens. A mall shows even before it has
 * screens (a new one an admin is setting up), so everyone sees every mall.
 */
export function getMalls(catalogue: Catalogue = getCatalogue()): readonly Mall[] {
  // Alphabetical everywhere malls are listed: the menu, the mall picker and the home page.
  return liveSites().map((s) => toMall(s, catalogue)).sort(byName);
}

/** For Site admin: every mall record, drafts and deleted ones included. */
export function getAllMallsForAdmin(catalogue: Catalogue = getCatalogue()): readonly { mall: Mall; site: SiteRecord }[] {
  return allSites()
    .map((site) => ({ mall: toMall(site, catalogue), site }))
    .sort((a, b) => byName(a.mall, b.mall));
}

function mallMapFor(mallId: string, specIds: readonly string[]): Mall['mallMap'] {
  const image = MALL_MAPS[mallId];
  if (!image) return null;
  const pins: Record<string, MallMapPin> = {};
  for (const id of specIds) {
    // A position placed on the site beats the starting one in mallMaps.ts.
    const pin = livePlacement.planPins[id] ?? image.pins[id];
    if (pin) pins[id] = pin;
  }
  return { image, pins };
}

export function getMall(id: string, catalogue: Catalogue = getCatalogue()): Mall | null {
  return getMalls(catalogue).find((mall) => mall.id === id) ?? null;
}

/** The mall a screen belongs to — used for "Show on map" links. */
export function getMallForSpec(specId: string, catalogue: Catalogue = getCatalogue()): Mall | null {
  return getMalls(catalogue).find((mall) => mall.specIds.includes(specId)) ?? null;
}

export interface ScreenSize {
  readonly width: number;
  readonly height: number;
}

export function getScreenSize(spec: Specification): ScreenSize | null {
  const read = (key: string) => {
    const value = spec.metadata.find((field) => field.key === key)?.value;
    const parsed = value != null ? Number(value) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const width = read('width');
  const height = read('height');
  return width != null && height != null ? { width, height } : null;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** "16:9" for exact common ratios, otherwise a 2-decimal ratio like "4.17:1". */
export function formatAspectRatio(size: ScreenSize): string {
  const divisor = gcd(size.width, size.height);
  const w = size.width / divisor;
  const h = size.height / divisor;
  if (w <= 32 && h <= 32) return `${w}:${h}`;
  return size.width >= size.height
    ? `${(size.width / size.height).toFixed(2)}:1`
    : `1:${(size.height / size.width).toFixed(2)}`;
}
