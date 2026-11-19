'use client';

import { useRef, useState } from 'react';
import { mallName } from '@/lib/insights';
import { docWords, itemDetail, itemLabel, itemMall } from '@/lib/portal/logic';
import { defaultPeriods, emptyRateCard, PERIOD_LABEL, pricedLines, rand, rateTotals, ratesFromRows, VAT_RATE } from '@/lib/portal/rates';
import { readBrief } from '@/lib/portal/briefReader';
import { parseSiteRows } from '@/lib/portal/siteRows';
import { portal } from '@/lib/portal/store';
import type { Campaign, PortalUser, RateCard, RateLine, RatePeriod } from '@/lib/portal/types';

const cell = 'h-10 w-full rounded-lg border border-border-strong bg-bg px-2 text-right text-body-sm tabular-nums text-fg outline-none focus:border-border-focus';
const head = 'px-2 py-2 text-left text-label-md font-semibold uppercase text-fg-subtle';

/** A number typed in a field: "4 650,00", "4650.00" or "R4,650" all read as 4650. */
function readNumber(raw: string): number | null {
  const t = raw.replace(/[R\s]/gi, '').replace(/,(\d{1,2})$/, '.$1').replace(/,/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** A field that saves when you leave it (or press Enter), not on every keystroke. */
function NumberField({ value, onCommit, placeholder, label, max }: { value: number | null; onCommit: (v: number | null) => void; placeholder?: string; label: string; max?: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? '' : String(value));
  return (
    <input
      inputMode="decimal"
      aria-label={label}
      className={cell}
      value={shown}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      onBlur={() => {
        if (draft == null) return;
        let n = readNumber(draft);
        if (n != null && max != null) n = Math.min(n, max);
        setDraft(null);
        if (n !== value) onCommit(n);
      }}
    />
  );
}

/**
 * Sales' prices for this proposal (any sales account: managers and sales
 * support too). Rate card price per period, discount and periods per line;
 * net rates and totals worked out. It goes in the PowerPoint and the Excel
 * rate card; the client's approval link never shows prices.
 */
export function RateCardEditor({ c, user, editable }: { c: Campaign; user: PortalUser; editable: boolean }) {
  const card: RateCard = c.rateCard ?? emptyRateCard();
  const rows = pricedLines(c);
  const t = rateTotals(c);
  const auto = defaultPeriods(card.per, c.start, c.end);
  const [allDiscount, setAllDiscount] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [upload, setUpload] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const priceFile = useRef<HTMLInputElement>(null);

  /** A price list (Excel or CSV): each line's price, matched by site number, mall and location, or screen name. */
  async function uploadPrices(file: File | undefined) {
    if (!file) return;
    setUpload(null);
    try {
      const payload = await readBrief(file);
      if (payload.kind !== 'text') throw new Error('Prices are read from Excel or CSV files. Save the price list as Excel (.xlsx) or CSV and try again.');
      const rows = parseSiteRows(payload.text);
      if (!rows.some((r) => r.rate != null)) throw new Error('No price column found. The file needs a column headed Rate, Price, Cost or Amount, beside the site number, mall or location.');
      const { lines, found } = ratesFromRows(c.items, rows, card.lines);
      if (!found) throw new Error(`None of the ${rows.length} rows in ${file.name} matched a line on this ${docWords(c).noun}. Check the site numbers or mall names.`);
      save({ lines });
      setUpload({ tone: 'ok', text: `Prices added to ${found} of ${c.items.length} lines from ${file.name}.${found < c.items.length ? ' The rest stay at R 0.00: type them in.' : ''}` });
    } catch (e) {
      setUpload({ tone: 'error', text: e instanceof Error ? e.message : 'Couldn’t read that file.' });
    }
  }

  const save = (next: Partial<RateCard>) => portal.setRateCard(c.id, { ...card, ...next });
  const setLine = (itemId: string, change: Partial<RateLine>) => {
    const others = card.lines.filter((l) => l.itemId !== itemId);
    const cur = card.lines.find((l) => l.itemId === itemId) ?? { itemId, rate: null, discount: null, periods: null };
    save({ lines: [...others, { ...cur, ...change }] });
  };

  if (!c.items.length) return null;

  return (
    <section id="rates" className="flex scroll-mt-28 flex-col gap-4 print:hidden" aria-labelledby="rates-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="rates-title" className="text-display-sm text-fg">Rate card</h2>
          <p className="max-w-prose text-body-sm text-fg-muted">
            Every line starts at R 0.00. Type the prices in, or upload a price list (Excel or CSV with a Rate, Price or Cost column). They go in the PowerPoint and the Excel rate card; the client’s link never shows prices.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable ? (
            <>
              <button type="button" onClick={() => priceFile.current?.click()} className="inline-flex h-11 items-center rounded-full border border-border-strong bg-bg px-5 text-body-sm font-semibold text-fg hover:border-fg">
                Upload prices
              </button>
              <input
                ref={priceFile}
                type="file"
                accept=".xlsx,.csv,.txt,.tsv"
                aria-label="Upload a price list (Excel or CSV)"
                className="hidden"
                onChange={(e) => {
                  void uploadPrices(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </>
          ) : null}
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => {
              setBusy('Making the rate card…');
              import('@/lib/portal/rateCardExcel')
                .then(({ downloadRateCard }) => downloadRateCard(c, user))
                .catch((e) => window.alert(e instanceof Error ? e.message : 'Couldn’t make the rate card.'))
                .finally(() => setBusy(null));
            }}
            className="inline-flex h-11 items-center rounded-full border border-border-strong bg-bg px-5 text-body-sm font-semibold text-fg hover:border-fg disabled:opacity-40"
          >
            {busy ?? 'Download rate card (Excel)'}
          </button>
        </div>
      </div>

      {upload ? <p role={upload.tone === 'error' ? 'alert' : 'status'} className={`text-body-sm ${upload.tone === 'error' ? 'text-danger-fg' : 'text-success-fg'}`}>{upload.text}</p> : null}
      {editable ? (
        <div className="flex flex-wrap items-end gap-4 rounded-2xl bg-bg-subtle p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-label-md font-semibold uppercase text-fg-muted">Rates are</span>
            <select className="h-10 rounded-lg border border-border-strong bg-bg px-2 text-body-sm text-fg" value={card.per} onChange={(e) => save({ per: e.target.value as RatePeriod })}>
              {(Object.keys(PERIOD_LABEL) as RatePeriod[]).map((p) => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-label-md font-semibold uppercase text-fg-muted">Discount on every line</span>
              <input inputMode="decimal" className="h-10 w-24 rounded-lg border border-border-strong bg-bg px-2 text-right text-body-sm text-fg" placeholder="e.g. 20" value={allDiscount} onChange={(e) => setAllDiscount(e.target.value)} />
            </label>
            <button
              type="button"
              className="h-10 rounded-full px-4 text-body-sm font-semibold text-accent hover:bg-accent-subtle disabled:opacity-40"
              disabled={readNumber(allDiscount) == null}
              onClick={() => {
                const d = Math.min(100, readNumber(allDiscount) ?? 0);
                save({ lines: c.items.map((i) => ({ ...(card.lines.find((l) => l.itemId === i.id) ?? { itemId: i.id, rate: null, periods: null }), discount: d })) });
                setAllDiscount('');
              }}
            >
              Apply %
            </button>
          </div>
          <label className="flex h-10 items-center gap-2 text-body-sm text-fg">
            <input type="checkbox" checked={card.vat} onChange={(e) => save({ vat: e.target.checked })} />
            Show VAT ({Math.round(VAT_RATE * 100)}%)
          </label>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[760px] border-collapse text-body-sm">
          <thead className="bg-bg-subtle">
            <tr>
              <th scope="col" className={head}>Line</th>
              <th scope="col" className={`${head} w-36 text-right`}>Rate card {PERIOD_LABEL[card.per].replace('per ', '/ ')}</th>
              <th scope="col" className={`${head} w-24 text-right`}>Discount %</th>
              <th scope="col" className={`${head} w-32 text-right`}>Net rate</th>
              <th scope="col" className={`${head} w-24 text-right`}>Periods</th>
              <th scope="col" className={`${head} w-36 text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const deck = itemMall(p.item);
              const where = deck ? mallName(deck) : p.item.kind === 'site' ? p.item.mall : '';
              return (
                <tr key={p.item.id} className="border-t border-border align-top">
                  <td className="px-2 py-2">
                    <span className="block font-medium text-fg">{itemLabel(p.item)}</span>
                    <span className="block text-[12px] text-fg-muted">{[where, itemDetail(p.item)].filter(Boolean).join(' · ')}</span>
                  </td>
                  <td className="px-2 py-2">
                    {editable ? <NumberField label={`Rate card for ${itemLabel(p.item)}`} value={p.line.rate} placeholder="0.00" onCommit={(v) => setLine(p.item.id, { rate: v })} /> : <span className="block text-right">{rand(p.line.rate ?? 0)}</span>}
                  </td>
                  <td className="px-2 py-2">
                    {editable ? <NumberField label={`Discount for ${itemLabel(p.item)}`} value={p.line.discount} placeholder="0" max={100} onCommit={(v) => setLine(p.item.id, { discount: v })} /> : <span className="block text-right">{p.line.discount ?? 0}%</span>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-fg-muted">{rand(p.net)}</td>
                  <td className="px-2 py-2">
                    {editable ? <NumberField label={`Periods for ${itemLabel(p.item)}`} value={p.line.periods} placeholder={String(auto)} onCommit={(v) => setLine(p.item.id, { periods: v })} /> : <span className="block text-right">{p.periods}</span>}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums text-fg">{rand(p.total)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-border-strong">
            {([
              ['Rate card value', t.gross, false],
              ['Discount', t.discount, false],
              [card.vat ? 'Total excl. VAT' : 'Total (excl. VAT)', t.net, !card.vat],
              ...(card.vat ? ([[`VAT (${Math.round(VAT_RATE * 100)}%)`, t.vat, false], ['Total incl. VAT', t.total, true]] as const) : []),
            ] as const).map(([label, value, strong]) => (
              <tr key={label}>
                <td colSpan={5} className={`px-2 py-1.5 text-right ${strong ? 'font-semibold text-fg' : 'text-fg-muted'}`}>{label}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${strong ? 'text-body-md font-bold text-fg' : 'text-fg-muted'}`}>{label === 'Discount' && value > 0 ? `– ${rand(value)}` : rand(value)}</td>
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
      <p className="text-[12px] text-fg-muted">
        {t.priced} of {t.lines} lines priced. Periods left empty follow the flight ({auto} {card.per === 'flight' ? 'flight' : card.per}{auto === 1 || card.per === 'flight' ? '' : 's'}).
        {card.updatedAt ? ` Last changed ${new Date(card.updatedAt).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.` : ''}
      </p>
      {editable ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-label-md font-semibold uppercase text-fg-muted">Notes on the rate card</span>
          <textarea
            className="min-h-[72px] rounded-lg border border-border-strong bg-bg px-3 py-2 text-body-sm text-fg outline-none focus:border-border-focus"
            defaultValue={card.note}
            placeholder="e.g. Production costs excluded. Rates valid for 30 days. Media subject to availability."
            onBlur={(e) => {
              if (e.target.value !== card.note) save({ note: e.target.value });
            }}
          />
        </label>
      ) : card.note ? <p className="whitespace-pre-line text-body-sm text-fg-muted">{card.note}</p> : null}
    </section>
  );
}
