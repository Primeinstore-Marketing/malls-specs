import type { DeckImage, DeckImages, DeckMall, MediaPackage, PhotoRights, PhotoRightsStatus, ScreenPhoto } from './types';
import { MALL_PLACES } from '@/lib/mallPlaces';
import { fileUrl } from '@/lib/api';

/*
 * The proposal deck's data (malls, audiences, packages, photos and their
 * rights) is not in the code. It lives in the API — content "deck-malls",
 * "deck-images", "photo-register" and "screen-photos", with the photos in the
 * file store — and arrives with the rest of the live data (applyDeckData).
 */
let BASE_MALLS: readonly DeckMall[] = [];
let DECK_IMAGES: DeckImages = {};
let BASE_RIGHTS: readonly PhotoRights[] = [];
let SCREEN_PHOTOS: Readonly<Record<string, readonly ScreenPhoto[]>> = {};

/** Sets the deck's data from the API. Call before applyMallContent, which layers admin edits on top. */
export function applyDeckData(d: { malls?: readonly DeckMall[]; images?: DeckImages; register?: readonly PhotoRights[]; screens?: Readonly<Record<string, readonly ScreenPhoto[]>> }) {
  if (Array.isArray(d.malls)) BASE_MALLS = d.malls;
  if (d.images) DECK_IMAGES = d.images;
  if (Array.isArray(d.register)) BASE_RIGHTS = d.register;
  if (d.screens) SCREEN_PHOTOS = d.screens;
}

export type { DeckMall, MediaPackage } from './types';

/* ---------- Admin edits, layered over the deck ---------- */

/** A photo an admin uploaded (stored by the API). Uploaded photos count as cleared. */
export interface UploadedPhoto {
  readonly storageKey: string;
  readonly width: number | null;
  readonly height: number | null;
}

/** A mall as admins edit it: the deck's fields plus photos and visibility. Saved as content "mall:<id>". */
export interface MallContent extends DeckMall {
  readonly hidden?: boolean;
  readonly photo?: UploadedPhoto | null;
  readonly packagePhotos?: Readonly<Record<string, readonly UploadedPhoto[]>>;
}

/** Every mall, deck data with admin edits applied. Hidden malls are left out. */
export let DECK_MALLS: readonly MallContent[] = BASE_MALLS;
/** Including hidden ones, for the admin pages. */
export let ALL_MALLS: readonly MallContent[] = BASE_MALLS;
export let PHOTO_RIGHTS: readonly PhotoRights[] = BASE_RIGHTS;
export let PROVINCES: readonly string[] = [];

let BY_ID = new Map<string, MallContent>();
let BY_APP_ID = new Map<string, MallContent>();
let BY_CODE = new Map<string, { mall: MallContent; pkg: MediaPackage }>();
let RIGHTS = new Map<string, PhotoRights>();
let MAX_VISITS = 1;

function rebuild() {
  DECK_MALLS = ALL_MALLS.filter((m) => !m.hidden);
  BY_ID = new Map(ALL_MALLS.map((m) => [m.id, m]));
  BY_APP_ID = new Map(DECK_MALLS.filter((m) => m.appMallId).map((m) => [m.appMallId as string, m]));
  BY_CODE = new Map(ALL_MALLS.flatMap((m) => m.packages.map((p) => [p.code, { mall: m, pkg: p }] as const)));
  RIGHTS = new Map(PHOTO_RIGHTS.map((r) => [r.src, r]));
  PROVINCES = [...new Set(DECK_MALLS.map((m) => m.province))].sort();
  MAX_VISITS = Math.max(1, ...DECK_MALLS.map((m) => annualVisits(m) ?? 0));
}

/**
 * Applies what admins have saved: edited or added malls, and photo-rights
 * statuses. Called whenever live data arrives from the API.
 */
export function applyMallContent(malls: readonly MallContent[], rights: Readonly<Record<string, PhotoRightsStatus>>) {
  const edited = new Map(malls.map((m) => [m.id, m]));
  ALL_MALLS = [...BASE_MALLS.map((m) => edited.get(m.id) ?? m), ...malls.filter((m) => !BASE_MALLS.some((b) => b.id === m.id))];
  PHOTO_RIGHTS = BASE_RIGHTS.map((r) => (rights[r.src] ? { ...r, status: rights[r.src] } : r));
  rebuild();
}

/** The deck's own version of a mall, before admin edits. */
export const baseMall = (id: string): DeckMall | undefined => BASE_MALLS.find((m) => m.id === id);

/** Public names where the deck uses a short or internal one. */
const NAME_FIXES: Readonly<Record<string, string>> = {
  'the-glen': 'The Glen',
  'alberton': 'Alberton City',
  'ballito': 'Ballito Junction',
  'randburg-square': 'Randburg Square',
  'walmer': 'Walmer Park',
  'long-beach': 'Longbeach Mall',
};

export function mallName(m: DeckMall): string {
  if (NAME_FIXES[m.id]) return NAME_FIXES[m.id];
  if (m.appMallId && MALL_PLACES[m.appMallId]) return MALL_PLACES[m.appMallId].name;
  return m.name;
}

export function mallArea(m: DeckMall): string {
  const place = m.appMallId ? MALL_PLACES[m.appMallId] : undefined;
  if (place) return `${place.area === place.city ? place.city : `${place.area}, ${place.city}`} · ${m.province}`;
  const town = m.address?.split(',').map((s) => s.trim()).filter(Boolean).pop();
  return town ? `${town} · ${m.province}` : m.province;
}

export const deckMall = (id: string): MallContent | undefined => BY_ID.get(id);
export const deckMallForApp = (appMallId: string): MallContent | undefined => BY_APP_ID.get(appMallId);
export const packageByCode = (code: string): { mall: MallContent; pkg: MediaPackage } | undefined => BY_CODE.get(code);

/** Mall visits a year: the slide's annual count, else 12 × the monthly count. */
export function annualVisits(m: DeckMall): number | null {
  if (m.annualFootcount) return m.annualFootcount;
  if (m.profile?.monthlyFootcount) return m.profile.monthlyFootcount * 12;
  return null;
}


/* ---------- Numbers ---------- */

export function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(Math.round(n));
}

export const thousands = (n: number) => Math.round(n).toLocaleString('en-ZA');

export function rand(n: number): string {
  return `R ${Math.round(n).toLocaleString('en-ZA')}`;
}

/* ---------- Age bands, put on one scale ---------- */

export const STANDARD_BANDS = ['15-24', '25-34', '35-44', '45-64', '65+'] as const;
export type StandardBand = (typeof STANDARD_BANDS)[number];

function toStandard(band: string): StandardBand | null {
  const m = band.match(/^(\d+)(?:-(\d+)|\+)$/);
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : 80;
  const mid = (lo + hi) / 2;
  if (mid < 25) return '15-24';
  if (mid < 35) return '25-34';
  if (mid < 45) return '35-44';
  if (mid < 65) return '45-64';
  return '65+';
}

export function bandShare(m: DeckMall, bands: readonly string[]): number {
  if (!m.profile) return 0;
  return m.profile.ageBands.reduce((sum, b) => (bands.includes(toStandard(b.band) ?? '') ? sum + b.pct : sum), 0);
}

export function topBand(m: DeckMall): string | null {
  const bands = m.profile?.ageBands ?? [];
  if (!bands.length) return null;
  return [...bands].sort((a, b) => b.pct - a.pct)[0].band;
}

/* ---------- Audience matcher ---------- */

export interface AudienceTarget {
  readonly gender: 'any' | 'female' | 'male';
  readonly ages: readonly string[];
  readonly lsm: 'any' | 'A' | 'B' | 'C';
  readonly provinces: readonly string[];
}

export const ANY_AUDIENCE: AudienceTarget = { gender: 'any', ages: [], lsm: 'any', provinces: [] };

export interface MallMatch {
  readonly mall: DeckMall;
  /** 0–100. */
  readonly score: number;
  /** Plain-language reasons, strongest first. */
  readonly reasons: readonly string[];
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/**
 * How well each mall's shoppers fit a target audience. The weights are a
 * starting point for a conversation, not a media model: gender 25, age 30,
 * LSM 15, attention to digital screens 15, size of audience 15.
 */
export function matchMalls(target: AudienceTarget, malls: readonly DeckMall[] = DECK_MALLS): MallMatch[] {
  return malls
    .filter((m) => !target.provinces.length || target.provinces.includes(m.province))
    .map((m) => {
      const p = m.profile;
      const parts: { weight: number; value: number; reason?: string }[] = [];
      if (target.gender !== 'any') {
        const pct = (target.gender === 'female' ? p?.female : p?.male) ?? 50;
        parts.push({ weight: 25, value: clamp((pct - 30) / 40), reason: `${pct}% ${target.gender}` });
      }
      if (target.ages.length) {
        const share = bandShare(m, target.ages);
        parts.push({ weight: 30, value: clamp(share / 70), reason: `${share}% aged ${target.ages.join(', ')}` });
      }
      if (target.lsm !== 'any') {
        const has = Boolean(p?.lsm?.includes(target.lsm));
        parts.push({ weight: 15, value: has ? 1 : 0.2, reason: has ? `High affinity, LSM ${target.lsm}` : undefined });
      }
      const digital = m.media?.seenDigitalScreens;
      parts.push({ weight: 15, value: clamp((digital ?? 40) / 70), reason: digital ? `${digital}% see digital screens` : undefined });
      const visits = annualVisits(m);
      parts.push({
        weight: 15,
        value: visits ? clamp(Math.log(visits) / Math.log(MAX_VISITS)) ** 4 : 0.3,
        reason: visits ? `${compact(visits)} visits a year` : undefined,
      });
      const total = parts.reduce((s, x) => s + x.weight, 0);
      const score = Math.round((parts.reduce((s, x) => s + x.weight * x.value, 0) / total) * 100);
      const reasons = [...parts].sort((a, b) => b.weight * b.value - a.weight * a.value).flatMap((x) => (x.reason ? [x.reason] : []));
      return { mall: m, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}

/* ---------- Network headline numbers ---------- */

export function networkStats() {
  const visits = DECK_MALLS.reduce((s, m) => s + (annualVisits(m) ?? 0), 0);
  const withMedia = DECK_MALLS.filter((m) => m.media?.noticeMallAds);
  const avg = (key: 'noticeMallAds' | 'seenDigitalScreens') =>
    withMedia.length ? Math.round(withMedia.reduce((s, m) => s + (m.media?.[key] ?? 0), 0) / withMedia.length) : 0;
  return {
    malls: DECK_MALLS.length,
    packages: DECK_MALLS.reduce((s, m) => s + m.packages.length, 0),
    units: DECK_MALLS.reduce((s, m) => s + m.packages.reduce((t, p) => t + (p.units ?? 0), 0), 0),
    provinces: PROVINCES.length,
    annualVisits: visits,
    noticeMallAds: avg('noticeMallAds'),
    seenDigitalScreens: avg('seenDigitalScreens'),
  };
}

/* ---------- Photos from the deck ---------- */


export type { DeckImage, PhotoRights, PhotoRightsStatus, ScreenPhoto };

/** A photo ready to show: deck photos get the base path; uploaded ones are marked so they count as cleared. */
export type ShownPhoto = DeckImage & { readonly uploaded?: boolean };

// Deck photos are served by the API's file store, under their "/malls/…" path.
const withBase = (img: DeckImage): ShownPhoto => ({ ...img, src: fileUrl(img.src.replace(/^\//, '')) });
const uploaded = (p: UploadedPhoto): ShownPhoto => ({ src: fileUrl(p.storageKey), width: p.width ?? 0, height: p.height ?? 0, slide: 0, uploaded: true });

/** The mall itself: the admin's upload if there is one, else the deck's title-slide photo. */
export function mallPhoto(deckMallId: string): ShownPhoto | null {
  const own = BY_ID.get(deckMallId)?.photo;
  if (own) return uploaded(own);
  const img = DECK_IMAGES[deckMallId]?.hero;
  return img ? withBase(img) : null;
}

/** The package's units photographed in place: admin uploads first, then the deck's. */
/** Photos of one screen from the malls proposal deck, exact matches first. */
export function screenPhotos(specId: string): (ShownPhoto & Pick<ScreenPhoto, 'package' | 'exact'>)[] {
  return (SCREEN_PHOTOS[specId] ?? []).map((p) => ({ ...withBase(p), package: p.package, exact: p.exact }));
}

export function packagePhotos(code: string): ShownPhoto[] {
  const mall = BY_CODE.get(code)?.mall;
  if (!mall) return [];
  const own = mall.packagePhotos?.[code] ?? [];
  return [...own.map(uploaded), ...(DECK_IMAGES[mall.id]?.packages[code] ?? []).map(withBase)];
}

/* ---------- Photo rights ---------- */


/** Rights for a photo, by its path before the base path is added. */
export function photoRights(src: string): PhotoRights | undefined {
  return RIGHTS.get(src.replace(/^.*?(\/malls\/(?:deck|screens)\/)/, '$1'));
}

/** True when a photo may be shown outside Primedia (public pages, shared proposals). */
export function isCleared(img: ShownPhoto | null | undefined): img is ShownPhoto {
  return Boolean(img && (img.uploaded || photoRights(img.src)?.status === 'cleared'));
}

rebuild();

/** The deck's own photo of a mall, ignoring uploads. */
export function deckPhoto(deckMallId: string): ShownPhoto | null {
  const img = DECK_IMAGES[deckMallId]?.hero;
  return img ? withBase(img) : null;
}
