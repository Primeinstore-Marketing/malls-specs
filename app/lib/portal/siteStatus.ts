/**
 * Why a site-list line isn't matched to a screen: the mall is on the site
 * but no screen is set up for that location yet, the mall is on the site
 * with no screens at all yet, or the mall isn't on the site. Worked out from
 * the site's own malls (not the AI), so it's the same every time.
 */
import type { Catalogue } from '@data-model';
import type { Mall } from '@/lib/malls';
import type { SiteItem } from './types';

/** "Walmer Park Shopping Centre" and "Walmer Park" are the same mall. */
export const mallWords = (v: string) =>
  v
    .toLowerCase()
    .replace(/\b(the|mall|malls|shopping|centre|center|city|regional|junction)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** The mall on the site a line's mall name refers to, if any. */
export function findMall(name: string, malls: readonly Mall[]): Mall | undefined {
  const w = mallWords(name);
  if (!w) return undefined;
  return malls.find((m) => mallWords(m.name) === w) ?? malls.find((m) => {
    const mw = mallWords(m.name);
    return mw.length > 2 && (mw.includes(w) || w.includes(mw));
  });
}

export type SiteStatus =
  | { readonly kind: 'matched' }
  | { readonly kind: 'no-screen'; readonly mall: Mall }
  | { readonly kind: 'no-screens-yet'; readonly mall: Mall }
  | { readonly kind: 'no-mall' };

export function siteStatus(line: Pick<SiteItem, 'specId' | 'mall' | 'appMallId'>, malls: readonly Mall[]): SiteStatus {
  if (line.specId) return { kind: 'matched' };
  const mall = (line.appMallId ? malls.find((m) => m.id === line.appMallId) : undefined) ?? findMall(line.mall, malls);
  if (!mall) return { kind: 'no-mall' };
  return mall.specIds.length ? { kind: 'no-screen', mall } : { kind: 'no-screens-yet', mall };
}

/** Short words for a status, for sales. */
export function statusText(s: SiteStatus): string {
  switch (s.kind) {
    case 'matched':
      return 'Matched';
    case 'no-screen':
      return `${s.mall.name} is on the site, but no screen is set up for this location yet`;
    case 'no-screens-yet':
      return `${s.mall.name} is on the site, with no screens set up yet`;
    case 'no-mall':
      return 'This mall isn’t on the site';
  }
}

/** "Check before sending" lines: unmatched sites counted by why, per mall. */
export function unmatchedSummary(lines: readonly SiteItem[], malls: readonly Mall[]): string[] {
  const byMall = new Map<string, { label: string; status: SiteStatus; n: number; places: Set<string> }>();
  for (const l of lines) {
    const s = siteStatus(l, malls);
    if (s.kind === 'matched') continue;
    const key = s.kind === 'no-mall' ? `none:${l.mall.toLowerCase()}` : `${s.kind}:${s.mall.id}`;
    const cur = byMall.get(key) ?? { label: s.kind === 'no-mall' ? l.mall || 'Unknown mall' : s.mall.name, status: s, n: 0, places: new Set<string>() };
    cur.n++;
    if (l.location) cur.places.add(l.location);
    byMall.set(key, cur);
  }
  const sites = (n: number) => `${n} ${n === 1 ? 'site' : 'sites'}`;
  return [...byMall.values()].map(({ label, status, n, places }) => {
    const short = (v: string) => (v.length > 40 ? `${v.slice(0, 38).trim()}…` : v);
    const where = places.size ? ` (${[...places].slice(0, 2).map(short).join('; ')}${places.size > 2 ? `; +${places.size - 2} more` : ''})` : '';
    if (status.kind === 'no-screen') return `${label}: on the site, but no screen set up for ${n === 1 ? 'this location' : 'these locations'} yet: ${sites(n)}${where}. Match ${n === 1 ? 'it' : 'them'} to a screen below, or ask an admin to add the screen.`;
    if (status.kind === 'no-screens-yet') return `${label}: on the site, but no screens set up there yet: ${sites(n)}${where}. Ask an admin to add the screens in Site admin → Malls.`;
    return `${label}: not on the site: ${sites(n)}${where}. Ask an admin to add the mall, or leave ${n === 1 ? 'it' : 'them'} for Primedia to confirm the size.`;
  });
}

/**
 * A site-list line whose site code names a format (e.g. "MEN/MAPP/001/02":
 * MAPP sites are Digi Engage screens) matches that mall's screen of the
 * format, without relying on the AI. Null when the mall has no such screen.
 */
export function formatScreen(line: Pick<SiteItem, 'siteNo' | 'mall'>, malls: readonly Mall[], catalogue: Catalogue): { specId: string; appMallId: string } | null {
  const kind = line.siteNo.toUpperCase().split(/[/\s-]+/)[1] ?? '';
  if (kind !== 'MAPP') return null;
  const mall = findMall(line.mall, malls);
  if (!mall) return null;
  const specId = mall.specIds.find((id) => /(^|-)MAPP$/i.test(catalogue.specifications[id]?.code ?? ''))
    ?? mall.specIds.find((id) => /digi engage/i.test(catalogue.specifications[id]?.title ?? ''));
  return specId ? { specId, appMallId: mall.id } : null;
}
