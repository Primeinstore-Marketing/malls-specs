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
  // This mall's own spec for the format, if the site has one.
  const appMall = mall.appMallId ? getMalls(catalogue).find((m) => m.id === mall.appMallId) : undefined;
  const own = rule && appMall
    ? appMall.specIds.map((id) => catalogue.specifications[id]).find((s) => s && rule.keyword.test(s.title) && getScreenSize(s))
    : undefined;
  const spec = own ?? (rule ? catalogue.specifications[rule.specId] : undefined);
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
