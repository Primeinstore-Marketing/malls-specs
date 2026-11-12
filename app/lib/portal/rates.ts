/**
 * A proposal's rate card: sales' prices per line, worked out to net rates
 * and totals. Prices exclude VAT; VAT (15%) is added on the total when asked.
 */
import { days } from './logic';
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
  readonly net: number | null;
  readonly total: number | null;
}

export function pricedLines(c: Pick<Campaign, 'items' | 'start' | 'end' | 'rateCard'>): PricedLine[] {
  const card = c.rateCard ?? emptyRateCard();
  const auto = defaultPeriods(card.per, c.start, c.end);
  return c.items.map((item) => {
    const line = card.lines.find((l) => l.itemId === item.id) ?? { itemId: item.id, rate: null, discount: null, periods: null };
    const periods = line.periods ?? auto;
    const net = line.rate != null ? line.rate * (1 - (line.discount ?? 0) / 100) : null;
    return { item, line, periods, net, total: net != null ? net * periods : null };
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
  const net = rows.reduce((s, r) => s + (r.total ?? 0), 0);
  const vat = c.rateCard?.vat ? net * VAT_RATE : 0;
  return { gross, discount: gross - net, net, vat, total: net + vat, priced: rows.filter((r) => r.line.rate != null).length, lines: rows.length };
}

/** "R 12 345.00" (South African style). */
export function rand(n: number): string {
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const hasRates = (c: Pick<Campaign, 'rateCard'>) => Boolean(c.rateCard?.lines.some((l) => l.rate != null));
