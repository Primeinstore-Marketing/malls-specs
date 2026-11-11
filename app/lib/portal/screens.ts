import type { Asset, Catalogue, Specification } from '@data-model';
import { getAssets } from '@/lib/catalogue';
import { downloadUrl } from '@/lib/api';
import { mallName as publicName, packageByCode } from '@/lib/insights';
import { MALL_PLACES } from '@/lib/mallPlaces';
import { formatAspectRatio, getMalls, getScreenSize } from '@/lib/malls';
import type { CampaignItem } from './types';

/**
 * What a client actually books: screens, how many, and the size of artwork
 * each one needs. Packages from the proposal deck name a format ("Digi Nav
 * × 8") but not a resolution, so each format is matched to a spec on this
 * site: the mall's own spec where it has one, else the network-wide one.
 */

export interface BookedScreen {
  /** Item this screen came from. */
  readonly itemId: string;
  readonly mallName: string;
  readonly title: string;
  readonly qty: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly orientation: 'Landscape' | 'Portrait' | 'Wide' | null;
  readonly ratio: string | null;
  readonly specId: string | null;
  readonly specTitle: string | null;
  readonly sheet: Asset | null;
  /** The After Effects template (.aep) to build the artwork in, when the spec has one. */
  readonly template: Asset | null;
  /** Set when the size is the format's usual size rather than this site's own spec. */
  readonly assumed: string | null;
  /** Where the units stand, from the deck. */
  readonly sites: string | null;
}

/** Network-wide spec for each deck format. */
const FORMAT_SPEC: Readonly<Record<string, { specId: string; keyword: RegExp; note: string }>> = {
  'Digi Nav': { specId: 'spec-portrait-digital-engage', keyword: /digi engage|digital engage|nav/i, note: 'Usual Digi Nav size (portrait Digi Engage); confirm with Primedia' },
  'Digital Impact': { specId: 'spec-digi-impact', keyword: /digi impact|digital impact|video wall/i, note: 'Usual Digital Impact size; this mall’s may differ' },
  'Digi Icon TV': { specId: 'spec-landscape-digital-icon-mtv', keyword: /icon|mtv/i, note: 'Usual Digi Icon TV size' },
};

function orientationOf(w: number, h: number): BookedScreen['orientation'] {
  if (w / h >= 2) return 'Wide';
  return w >= h ? 'Landscape' : 'Portrait';
}

function sheetFor(spec: Specification, catalogue: Catalogue): Asset | null {
  return getAssets(spec.downloadIds, catalogue).find((a) => a.mimeType === 'application/pdf') ?? null;
}

function templateFor(spec: Specification, catalogue: Catalogue): Asset | null {
  return getAssets([...spec.downloadIds, ...spec.attachmentIds], catalogue).find((a) => /aftereffects/i.test(a.mimeType) || /\.aep$/i.test(a.filename)) ?? null;
}

export function sheetHref(sheet: Asset): string {
  return downloadUrl(sheet.storageKey);
}

function fromSpec(spec: Specification | undefined, catalogue: Catalogue) {
  const size = spec ? getScreenSize(spec) : null;
  return {
    width: size?.width ?? null,
    height: size?.height ?? null,
    orientation: size ? orientationOf(size.width, size.height) : null,
    ratio: size ? formatAspectRatio(size) : null,
    specId: spec?.id ?? null,
    sheet: spec ? sheetFor(spec, catalogue) : null,
    template: spec ? templateFor(spec, catalogue) : null,
    specTitle: spec?.title ?? null,
  };
}

/* ---------- Which of the mall's own screens a deck package is ---------- */

const norm = (t: string) =>
  ` ${t
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/food\s*court/g, 'foodcourt')
    .replace(/promotions?/g, 'promo')
    .replace(/woolworths?/g, 'woolworth')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

/** Words in a spec title that say nothing about where the screen is. */
const GENERIC_WORDS = new Set(['digi', 'digital', 'impact', 'screen', 'screens', 'packages', 'package', 'mall', 'and', 'the', 'centre', 'video', 'wall', 'walls']);

/** How much of a spec title's place words appear in the package's site list: 0 when any are missing. */
function placeScore(spec: Specification, mallWords: ReadonlySet<string>, sites: string): number {
  const words = norm(spec.title).trim().split(' ').filter((w) => w && !GENERIC_WORDS.has(w) && !mallWords.has(w));
  if (!words.length) return 0;
  return words.every((w) => sites.includes(` ${w} `)) ? words.length : 0;
}

/**
 * The mall's own spec for a package, best evidence first:
 *  1. a screen whose name matches the package's site list ("Food Court", "Cavendish Court", "Sky"),
 *  2. a screen named for the format ("… Digi Engage", "… MTV"),
 *  3. for Digital Impact, the mall's only screen.
 * Returns undefined when the network-wide spec should be used.
 */
function ownSpecFor(pkg: { format: string; sites: string; name: string }, appMall: { name: string; specIds: readonly string[] }, catalogue: Catalogue, rule: { keyword: RegExp } | undefined): Specification | undefined {
  const specs = appMall.specIds.map((id) => catalogue.specifications[id]).filter((x): x is Specification => Boolean(x && !x.archivedAt && getScreenSize(x)));
  if (!specs.length) return undefined;
  const isImpact = pkg.format === 'Digital Impact';
  if (isImpact) {
    const mallWords = new Set(norm(appMall.name).trim().split(' '));
    const sites = norm(`${pkg.sites} ${pkg.name}`);
    const scored = specs.map((x) => ({ x, score: placeScore(x, mallWords, sites) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
    if (scored.length && (scored.length === 1 || scored[0].score > scored[1].score)) return scored[0].x;
  }
  const byFormat = rule ? specs.filter((x) => rule.keyword.test(x.title)) : [];
  if (byFormat.length === 1) return byFormat[0];
  if (isImpact && specs.length === 1) return specs[0];
  return undefined;
}

/** How a package's screen was decided, for the admin preview. */
export type SpecSource = 'chosen' | 'matched' | 'network' | 'none';

/** The spec a deck package uses: the admin's choice, else the mall's matching screen, else the network-wide one. */
export function resolvePackageSpec(
  pkg: { format: string; sites: string; name: string; specId?: string | null },
  appMallId: string | null | undefined,
  catalogue: Catalogue,
): { spec: Specification | undefined; source: SpecSource } {
  const chosen = pkg.specId ? catalogue.specifications[pkg.specId] : undefined;
  if (chosen) return { spec: chosen, source: 'chosen' };
  const rule = FORMAT_SPEC[pkg.format];
  const appMall = appMallId ? getMalls(catalogue).find((m) => m.id === appMallId) : undefined;
  const own = rule && appMall ? ownSpecFor(pkg, appMall, catalogue, rule) : undefined;
  if (own) return { spec: own, source: 'matched' };
  const network = rule ? catalogue.specifications[rule.specId] : undefined;
  return { spec: network, source: network ? 'network' : 'none' };
}

/** Network-wide specs, for the admin's "screen" choice. */
export const NETWORK_SPEC_IDS = Object.values(FORMAT_SPEC).map((r) => r.specId);

export function screensFor(item: CampaignItem, catalogue: Catalogue): BookedScreen[] {
  if (item.kind === 'screen') {
    const spec = catalogue.specifications[item.specId];
    const mall = getMalls(catalogue).find((m) => m.id === item.appMallId);
    return [{ itemId: item.id, mallName: MALL_PLACES[item.appMallId]?.name ?? mall?.name ?? '', title: item.title, qty: 1, ...fromSpec(spec, catalogue), assumed: null, sites: null }];
  }
  const found = packageByCode(item.code);
  if (!found) return [];
  const { mall, pkg } = found;
  const rule = FORMAT_SPEC[pkg.format];
  const { spec, source } = resolvePackageSpec(pkg, mall.appMallId, catalogue);
  const own = source === 'chosen' || source === 'matched' ? spec : undefined;
  return [
    {
      itemId: item.id,
      mallName: publicName(mall),
      title: own ? `${pkg.format} · ${own.title}` : pkg.format,
      qty: pkg.units ?? 1,
      ...fromSpec(spec, catalogue),
      assumed: own ? null : rule?.note ?? 'Size to be confirmed by Primedia',
      sites: pkg.sites,
    },
  ];
}

export interface ArtworkSize {
  readonly width: number;
  readonly height: number;
  readonly orientation: BookedScreen['orientation'];
  readonly ratio: string | null;
  /** Total screens needing this size. */
  readonly screens: number;
  readonly sheet: Asset | null;
  readonly specId: string | null;
  /** Each distinct spec at this size, with its own sheet and template (malls' templates differ). */
  readonly files: readonly SizeFiles[];
}

export interface SizeFiles {
  readonly specId: string;
  /** Where it's used, e.g. "Cresta Shopping Centre · Food Court". */
  readonly label: string;
  readonly sheet: Asset | null;
  readonly template: Asset | null;
}

/** The distinct artwork sizes a campaign needs, most screens first. */
export function artworkSizes(screens: readonly BookedScreen[]): { sizes: ArtworkSize[]; unknown: number } {
  const map = new Map<string, ArtworkSize>();
  let unknown = 0;
  for (const s of screens) {
    if (!s.width || !s.height) {
      unknown += s.qty;
      continue;
    }
    const key = `${s.width}x${s.height}`;
    const cur = map.get(key);
    const files = [...(cur?.files ?? [])];
    if (s.specId && !files.some((f) => f.specId === s.specId) && (s.sheet || s.template)) {
      files.push({ specId: s.specId, label: s.specTitle && s.specTitle !== s.mallName ? `${s.mallName} · ${s.specTitle}` : s.mallName, sheet: s.sheet, template: s.template });
    } else if (s.specId) {
      const i = files.findIndex((f) => f.specId === s.specId);
      if (i >= 0 && !files[i].label.includes(s.mallName)) files[i] = { ...files[i], label: `${files[i].label}, ${s.mallName}` };
    }
    map.set(key, {
      files,
      width: s.width,
      height: s.height,
      orientation: s.orientation,
      ratio: s.ratio,
      screens: (cur?.screens ?? 0) + s.qty,
      sheet: cur?.sheet ?? s.sheet,
      specId: cur?.specId ?? s.specId,
    });
  }
  return { sizes: [...map.values()].sort((a, b) => b.screens - a.screens), unknown };
}

export function campaignScreens(items: readonly CampaignItem[], catalogue: Catalogue): BookedScreen[] {
  return items.flatMap((i) => screensFor(i, catalogue));
}
