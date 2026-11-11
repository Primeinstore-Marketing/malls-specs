import type { Catalogue, Specification } from '@data-model';
import { fileUrl } from '@/lib/api';
import { getAssets } from '@/lib/catalogue';
import { annualVisits, compact, deckMallForApp, isCleared, mallArea, mallName, mallPhoto, matchMalls, packagePhotos, screenPhotos } from '@/lib/insights';
import type { AudienceTarget, DeckMall, MediaPackage, ShownPhoto } from '@/lib/insights';
import { ANY_AUDIENCE } from '@/lib/insights';
import { getMalls, getScreenSize } from '@/lib/malls';
import type { Mall } from '@/lib/malls';
import { MALL_PLACES } from '@/lib/mallPlaces';
import { screensFor } from './screens';
import type { CampaignItem, NewCampaignItem } from './types';

/**
 * Every mall and the screens you can put in a campaign, shared by the
 * proposal builder (sales, clients signed in) and the client's booking page.
 *
 * Malls on the screen map list their own screens; malls known only from the
 * proposal deck list each package as a row. Pictures: an uploaded one, else
 * this screen's photo from the malls deck, else its package's, else the
 * mall's. `publicOnly` keeps to uploaded and rights-cleared photos (for pages
 * people outside Primedia see).
 */

export interface MallEntry {
  /** Deck mall id, or "app:<id>" for a screen-map mall the deck doesn't cover. */
  readonly key: string;
  readonly name: string;
  readonly area: string;
  readonly province: string;
  readonly score: number | null;
  readonly reasons: readonly string[];
  readonly deck: DeckMall | undefined;
  readonly packages: readonly MediaPackage[];
  readonly appMall: Mall | undefined;
  readonly screens: readonly Specification[];
}

export interface ScreenRow {
  /** pkg:<code> or scr:<specId>, the same for the same screen everywhere. */
  readonly key: string;
  readonly item: NewCampaignItem;
  readonly title: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly qty: number;
  readonly specId: string | null;
  readonly photo: string | null;
  /** Set when the photo is borrowed from a deck rather than uploaded for this screen. */
  readonly photoNote: string | null;
}

export const pkgKey = (code: string) => `pkg:${code}`;
export const scrKey = (specId: string) => `scr:${specId}`;
export const itemKey = (i: CampaignItem | NewCampaignItem) => (i.kind === 'package' ? pkgKey(i.code) : scrKey(i.specId));

function placeArea(appMallId: string): { area: string; province: string; name: string | null } {
  const place = MALL_PLACES[appMallId];
  if (!place) return { area: '', province: '', name: null };
  return { area: `${place.area === place.city ? place.city : `${place.area}, ${place.city}`} · ${place.province}`, province: place.province, name: place.name };
}

export function mallEntries(catalogue: Catalogue, audience: AudienceTarget = ANY_AUDIENCE): MallEntry[] {
  const appMalls = getMalls(catalogue).filter((m) => m.group !== 'formats');
  const screensOf = (m: Mall | undefined) =>
    (m?.specIds ?? []).map((id) => catalogue.specifications[id]).filter((s): s is Specification => Boolean(s && !s.archivedAt));
  const deck: MallEntry[] = matchMalls({ ...audience, provinces: [] }).map((x) => {
    const appMall = x.mall.appMallId ? appMalls.find((a) => a.id === x.mall.appMallId) : undefined;
    return { key: x.mall.id, name: mallName(x.mall), area: mallArea(x.mall), province: x.mall.province, score: x.score, reasons: x.reasons, deck: x.mall, packages: x.mall.packages, appMall, screens: screensOf(appMall) };
  });
  const extra: MallEntry[] = appMalls
    .filter((a) => !deckMallForApp(a.id))
    .map((a) => {
      const place = placeArea(a.id);
      return { key: `app:${a.id}`, name: place.name ?? a.name, area: place.area, province: place.province, score: null, reasons: [], deck: undefined, packages: [], appMall: a, screens: screensOf(a) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...deck, ...extra].filter((e) => e.packages.length || e.screens.length);
}

/** The mall a campaign item belongs to, as an entry key. */
export function entryKeyFor(item: CampaignItem | NewCampaignItem, entries: readonly MallEntry[]): string | undefined {
  if (item.kind === 'package') return entries.find((e) => e.packages.some((p) => p.code === item.code))?.key;
  return entries.find((e) => e.screens.some((s) => s.id === item.specId))?.key ?? entries.find((e) => e.appMall?.id === item.appMallId)?.key;
}

function pick(photos: readonly (ShownPhoto | null | undefined)[], publicOnly: boolean): ShownPhoto | null {
  for (const p of photos) if (p && (!publicOnly || isCleared(p))) return p;
  return null;
}

export function rowsFor(e: MallEntry, catalogue: Catalogue, publicOnly = false): ScreenRow[] {
  const hero = e.deck ? mallPhoto(e.deck.id) : null;
  if (e.screens.length) {
    return e.screens.map((s) => {
      const size = getScreenSize(s);
      const own = getAssets(s.mediaIds, catalogue).find((a) => a.kind === 'image');
      const pkg = e.packages.find((p) => screensFor({ id: p.code, kind: 'package', code: p.code }, catalogue)[0]?.specId === s.id);
      const shot = pick(screenPhotos(s.id), publicOnly);
      const deck = shot ?? pick([...(pkg ? packagePhotos(pkg.code) : []), hero], publicOnly);
      return {
        key: scrKey(s.id),
        item: { kind: 'screen', specId: s.id, appMallId: e.appMall?.id ?? '', title: s.title },
        title: s.title,
        width: size?.width ?? null,
        height: size?.height ?? null,
        qty: 1,
        specId: s.id,
        photo: own ? fileUrl(own.storageKey) : deck?.src ?? null,
        photoNote: own ? null : deck && !deck.uploaded ? (shot ? 'Photo of this screen from the malls proposal' : pkg && deck !== hero ? `Photo of the ${pkg.format} package` : 'Photo of the mall, not this screen') : null,
      };
    });
  }
  return e.packages.map((p) => {
    const sc = screensFor({ id: p.code, kind: 'package', code: p.code }, catalogue)[0];
    const photo = pick([...packagePhotos(p.code), hero], publicOnly);
    return {
      key: pkgKey(p.code),
      item: { kind: 'package', code: p.code },
      title: p.format,
      width: sc?.width ?? null,
      height: sc?.height ?? null,
      qty: p.units ?? 1,
      specId: sc?.specId ?? null,
      photo: photo?.src ?? null,
      photoNote: photo && !photo.uploaded ? 'Photo from the proposal deck' : null,
    };
  });
}

/** Short facts about a mall's shoppers, for a line of chips. */
export function mallFacts(deck: DeckMall | undefined): string[] {
  if (!deck) return [];
  const out: string[] = [];
  const visits = annualVisits(deck);
  if (visits) out.push(`${compact(visits)} visits a year`);
  if (deck.media?.seenDigitalScreens) out.push(`${deck.media.seenDigitalScreens}% see digital screens`);
  if (deck.media?.noticeMallAds) out.push(`${deck.media.noticeMallAds}% notice mall ads`);
  const p = deck.profile;
  if (p?.female) out.push(`${p.female}% women`);
  const top = p?.ageBands?.length ? [...p.ageBands].sort((a, b) => b.pct - a.pct)[0] : null;
  if (top) out.push(`Most aged ${top.band} (${top.pct}%)`);
  if (p?.lsm) out.push(`LSM ${p.lsm}`);
  return out;
}

/** The mall photo to show with a group, honouring rights when public. */
export function entryPhoto(e: MallEntry, publicOnly: boolean): string | null {
  const hero = e.deck ? mallPhoto(e.deck.id) : null;
  return hero && (!publicOnly || isCleared(hero)) ? hero.src : null;
}
