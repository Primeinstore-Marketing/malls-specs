import type { Catalogue, Specification, SubGroupId } from '@data-model';
import { getCatalogue, snapshotState } from './catalogue';
import type { LivePlacement } from './mergeLive';
import { MALL_LOCATIONS } from './mallLocations';
import type { MallLocation } from './mallLocations';
import { FLOOR_PLANS, SCREEN_PINS } from './screenPins';
import { DRAFT_PINS } from './draftPins';
import { MALL_MAPS } from './mallMaps';
import type { MallMapImage, MallMapPin } from './mallMaps';
import type { FloorPlanOverlay, PinSource, ScreenPin } from './screenPins';

/**
 * Physical malls, for the map explorer on the home page.
 *
 * The catalogue groups screens by network (category) and, for some malls,
 * by sub-group — but about half the screens sit directly under a network
 * with the mall name only in their title ("Fourways Food Court"). This file
 * is the one place that says which screens belong to which physical mall.
 *
 * Where things are lives in two neighbouring files:
 *  - `mallLocations.ts` — each mall's position and outline, a generated
 *    OpenStreetMap snapshot. Don't hand-edit; re-run the script it names.
 *  - `screenPins.ts` — confirmed screen positions and floor plan images.
 *    Hand-edited; see the notes there.
 *  - `draftPins.ts` — an automatic first guess for every screen, generated
 *    from OpenStreetMap. Confirmed positions override it.
 */

export type { FloorPlanOverlay, MallLocation, PinSource, ScreenPin };
export { PIN_SOURCE_LABELS } from './screenPins';

export type MallGroup = 'malls' | 'hyprop' | 'formats';

export const MALL_GROUP_LABELS: Readonly<Record<MallGroup, string>> = {
  malls: 'Malls',
  hyprop: 'Hyprop Malls',
  formats: 'Network-wide formats',
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

interface MallSource {
  readonly id: string;
  readonly name: string;
  readonly group: MallGroup;
  readonly subGroupId?: string;
  readonly specIds?: readonly string[];
}

const MALL_SOURCES: readonly MallSource[] = [
  { id: 'cresta', name: 'Cresta', group: 'malls', subGroupId: 'subgroup-cresta' },
  { id: 'menlyn', name: 'Menlyn', group: 'malls', subGroupId: 'subgroup-menlyn' },
  { id: 'monte-casino', name: 'Monte Casino', group: 'malls', subGroupId: 'subgroup-monte-casino' },
  { id: 'pavilion', name: 'Pavilion', group: 'malls', subGroupId: 'subgroup-pavilion' },
  { id: 'southgate', name: 'Southgate', group: 'malls', subGroupId: 'subgroup-southgate' },
  { id: 'tygervalley', name: 'Tygervalley', group: 'malls', subGroupId: 'subgroup-tygervalley' },
  { id: 'bayside', name: 'Bayside', group: 'malls', specIds: ['spec-bayside-digi-impact'] },
  { id: 'boardwalk', name: 'Boardwalk', group: 'malls', specIds: ['spec-boardwalk'] },
  { id: 'brooklyn', name: 'Brooklyn Mall', group: 'malls', specIds: ['spec-brooklyn-mall'] },
  {
    id: 'fourways',
    name: 'Fourways',
    group: 'malls',
    specIds: ['spec-fourways-food-court', 'spec-fourways-pillars', 'spec-fourways-promo-court'],
  },
  { id: 'gardens', name: 'Gardens', group: 'malls', specIds: ['spec-gardens-digi-impact'] },
  { id: 'gateway', name: 'Gateway', group: 'malls', specIds: ['spec-gateway-digi-impact'] },
  { id: 'golden-acre', name: 'Golden Acre', group: 'malls', specIds: ['spec-golden-acre-impact'] },
  { id: 'loch-logan', name: 'Loch Logan', group: 'malls', specIds: ['spec-loch-logan'] },
  { id: 'mimosa', name: 'Mimosa', group: 'malls', specIds: ['spec-mimosa-mtvs-digi-engages'] },
  { id: 'n1-city', name: 'N1 City', group: 'malls', specIds: ['spec-n1-city'] },
  { id: 'paarl-mall', name: 'Paarl Mall', group: 'malls', specIds: ['spec-paarl-mall-digi-impact'] },
  { id: 'westgate', name: 'Westgate', group: 'malls', specIds: ['spec-westgate-mtvs-digi-engages'] },
  { id: 'canal-walk', name: 'Canal Walk', group: 'hyprop', subGroupId: 'subgroup-canal-walk' },
  // "Capegate Food Court" is filed under the Malls network in the source
  // sheet, but it's the same physical centre as the Hyprop Cape Gate group.
  {
    id: 'cape-gate',
    name: 'Cape Gate',
    group: 'hyprop',
    subGroupId: 'subgroup-cape-gate',
    specIds: ['spec-capegate-food-court'],
  },
  { id: 'clearwater', name: 'Clearwater', group: 'hyprop', subGroupId: 'subgroup-clearwater' },
  { id: 'table-bay', name: 'Table Bay', group: 'hyprop', subGroupId: 'subgroup-table-bay' },
  { id: 'hype-park', name: 'Hype Park', group: 'hyprop', specIds: ['spec-hype-park'] },
  {
    id: 'rosebank',
    name: 'Rosebank',
    group: 'hyprop',
    specIds: ['spec-rosebank-mall', 'spec-rosebank-fnb-pillar'],
  },
  { id: 'somerset', name: 'Somerset Mall', group: 'hyprop', specIds: ['spec-somerset-mall'] },
  { id: 'the-glen', name: 'The Glen', group: 'hyprop', specIds: ['spec-the-glen'] },
  { id: 'woodlands', name: 'Woodlands', group: 'hyprop', specIds: ['spec-woodlands'] },
  {
    id: 'network-formats',
    name: 'Standard formats',
    group: 'formats',
    specIds: ['spec-landscape-digital-icon-mtv', 'spec-portrait-digital-engage', 'spec-other-pillars'],
  },
];

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
  const source = MALL_SOURCES.find((candidate) => candidate.id === mallId);
  if (!source) return null;
  return { categoryId: GROUP_CATEGORY[source.group], subGroupId: source.subGroupId ?? null };
}

function subGroupSpecIds(subGroupId: string, catalogue: Catalogue): string[] {
  return Object.values(catalogue.specifications)
    .filter((spec) => spec.archivedAt === null && spec.subGroupId === (subGroupId as SubGroupId))
    .map((spec) => spec.id);
}

export function getMalls(catalogue: Catalogue = getCatalogue()): readonly Mall[] {
  return MALL_SOURCES.map((source) => {
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
      location: MALL_LOCATIONS[source.id] ?? null,
      floorPlan: FLOOR_PLANS[source.id] ?? null,
      pins,
      mallMap: mallMapFor(source.id, specIds),
    };
  }).filter((mall) => mall.specIds.length > 0);
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
