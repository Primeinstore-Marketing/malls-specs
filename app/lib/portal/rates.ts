/**
 * A proposal's rate card: sales' prices per line, worked out to net rates
 * and totals. Prices exclude VAT; VAT (15%) is added on the total when asked.
 */
import { mallName } from '@/lib/insights';
import { days, itemLabel, itemMall } from './logic';
import { priceFor } from './siteRows';
import type { SiteRow } from './siteRows';
import type { Campaign, CampaignItem, RateCard, RateLine, RatePeriod } from './types';

export const VAT_RATE = 0.15;

export const PERIOD_LABEL: Readonly<Record<RatePeriod, string>> = {
  week: 'per week',
  '4 weeks': 'per 4 weeks',
  month: 'per month',
  flight: 'for the whole flight',
};

/** How many periods the flight covers, rounded up (at least 1). */
export function defaultPeriods(per: RatePeriod, start: string | null, end: string | null): number {
  const d = days(start, end);
  if (!d || per === 'flight') return 1;
  const size = per === 'week' ? 7 : per === '4 weeks' ? 28 : 30;
  return Math.max(1, Math.ceil(d / size));
}

export const emptyRateCard = (): RateCard => ({ per: 'week', lines: [], vat: false, note: '', updatedAt: '', updatedBy: '' });

export interface PricedLine {
  readonly item: CampaignItem;
  readonly line: RateLine;
  readonly periods: number;
  /** Lines without a price count as R 0.00 until sales add one. */
  readonly net: number;
  readonly total: number;
}

export function pricedLines(c: Pick<Campaign, 'items' | 'start' | 'end' | 'rateCard'>): PricedLine[] {
  const card = c.rateCard ?? emptyRateCard();
  const auto = defaultPeriods(card.per, c.start, c.end);
  return c.items.map((item) => {
    const line = card.lines.find((l) => l.itemId === item.id) ?? { itemId: item.id, rate: null, discount: null, periods: null };
    const periods = line.periods ?? auto;
    const net = (line.rate ?? 0) * (1 - (line.discount ?? 0) / 100);
    return { item, line, periods, net, total: net * periods };
  });
}

export interface RateTotals {
  /** Rate card value before discounts. */
  readonly gross: number;
  readonly discount: number;
  /** After discounts, excluding VAT. */
  readonly net: number;
  readonly vat: number;
  readonly total: number;
  readonly priced: number;
  readonly lines: number;
}

export function rateTotals(c: Pick<Campaign, 'items' | 'start' | 'end' | 'rateCard'>): RateTotals {
  const rows = pricedLines(c);
  const gross = rows.reduce((s, r) => s + (r.line.rate ?? 0) * r.periods, 0);
  const net = rows.reduce((s, r) => s + r.total, 0);
  const vat = c.rateCard?.vat ? net * VAT_RATE : 0;
  return { gross, discount: gross - net, net, vat, total: net + vat, priced: rows.filter((r) => r.line.rate != null).length, lines: rows.length };
}

/** "R 12 345.00" (South African style). */
export function rand(n: number): string {
  // Fixed format whatever the browser's language: spaces between thousands, a decimal point.
  const [whole, cents] = Math.abs(n).toFixed(2).split('.');
  return `${n < 0 ? '– ' : ''}R ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${cents}`;
}

export const hasRates = (c: Pick<Campaign, 'rateCard'>) => Boolean(c.rateCard?.lines.some((l) => l.rate != null));

/**
 * Prices from a client's or agency's document (a priced site list, booking
 * sheet or price list) for a campaign's lines: by site number, then mall and
 * location, then screen name. Lines it can't place keep their current price.
 */
export function ratesFromRows(items: readonly CampaignItem[], rows: readonly SiteRow[], current: readonly RateLine[] = []): { lines: RateLine[]; found: number } {
  let found = 0;
  const lines = items.map((item) => {
    const cur = current.find((l) => l.itemId === item.id) ?? { itemId: item.id, rate: null, discount: null, periods: null };
    const deck = itemMall(item);
    const rate =
      item.kind === 'site'
        ? priceFor({ siteNo: item.siteNo, mall: item.mall, location: item.location }, rows)
        : priceFor({ siteNo: item.kind === 'package' ? item.code : '', title: itemLabel(item), mall: deck ? mallName(deck) : '' }, rows);
    if (rate == null) return cur;
    found += 1;
    return { ...cur, rate };
  });
  return { lines, found };
}
