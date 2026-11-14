'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PreviewSlide } from '@/lib/portal/deck';
import { DeckPreview } from './DeckPreview';
import { useLiveData } from '@/lib/liveData';
import { docWords, itemDetail, itemLabel } from '@/lib/portal/logic';
import { hasRates, PERIOD_LABEL, pricedLines, rand, rateTotals, VAT_RATE } from '@/lib/portal/rates';
import { shareUrl } from '@/lib/portal/share';
import type { Campaign, PortalUser } from '@/lib/portal/types';

type Tab = 'pdf' | 'pptx' | 'xlsx';

/**
 * "Preview & download": the three things sales can send, each previewed
 * before it's saved. The PDF is the client's page as printed; the
 * PowerPoint is the very file you'll download (shuffle for a new design);
 * the rate card shows its lines and totals.
 */
export function DownloadsDialog({ c, user, onClose, start = 'pdf' }: { c: Campaign; user: PortalUser; onClose: () => void; start?: Tab }) {
  const { catalogue } = useLiveData();
  const w = docWords(c);
  const priced = hasRates(c);
  const [tab, setTab] = useState<Tab>(start);
  // Every tab always opens: the rate card explains itself when it has no prices yet.
  const tabs: { id: Tab; label: string }[] = [
    { id: 'pdf', label: 'Site list (PDF)' },
    { id: 'pptx', label: 'Presentation (PowerPoint)' },
    { id: 'xlsx', label: 'Rate card (Excel)' },
  ];

  /** Close and take the person to the price fields on the campaign page. */
  function goToRates() {
    onClose();
    window.setTimeout(() => {
      const section = document.getElementById('rates');
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      section?.querySelector<HTMLInputElement>('input[aria-label^="Rate card for"]')?.focus({ preventScroll: true });
    }, 60);
  }

  // The PowerPoint: built once per open (or shuffle), previewed, and that same file downloaded.
  const [deck, setDeck] = useState<{ blob: Blob; fileName: string; slides: PreviewSlide[] } | null>(null);
  const [deckState, setDeckState] = useState<'idle' | 'building' | string>('idle');
  const build = useCallback(async () => {
    setDeckState('building');
    try {
      const { buildDeck } = await import('@/lib/portal/deck');
      const made = await buildDeck(c, user, catalogue);
      setDeck(made);
      setDeckState('idle');
    } catch (e) {
      setDeckState(e instanceof Error ? e.message : 'Couldn’t make the presentation.');
    }
  }, [c, user, catalogue]);
  useEffect(() => {
    if (tab === 'pptx' && !deck && deckState === 'idle') void build();
  }, [tab, deck, deckState, build]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);

  const [saving, setSaving] = useState(false);
  async function download() {
    if (tab === 'pdf') {
      window.open(shareUrl(c, user.id, true), '_blank', 'noopener');
      return;
    }
    setSaving(true);
    try {
      const { saveBlob } = await import('@/lib/portal/deck');
      if (tab === 'pptx' && deck) saveBlob(deck.blob, deck.fileName);
      if (tab === 'xlsx') {
        const { buildRateCard } = await import('@/lib/portal/rateCardExcel');
        const made = await buildRateCard(c, user);
        saveBlob(made.blob, made.fileName);
      }
    } finally {
      setSaving(false);
    }
  }

  const t = rateTotals(c);
  const card = c.rateCard;
  const downloadLabel = tab === 'pdf' ? 'Download site list (PDF)' : tab === 'pptx' ? 'Download presentation (PowerPoint)' : 'Download rate card (Excel)';

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-[rgba(6,12,28,0.55)] p-0 sm:p-6 print:hidden" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="dl-title" className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-bg shadow-4 sm:h-[90vh] sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id="dl-title" className="text-body-lg font-semibold text-fg">Preview and download</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-fg-muted hover:bg-bg-subtle hover:text-fg">✕</button>
        </div>
        <div role="tablist" aria-label="What to download" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border px-4 py-2">
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => setTab(x.id)}
              className={`h-10 shrink-0 rounded-full px-4 text-body-sm font-semibold transition-colors ${tab === x.id ? 'bg-fg text-bg' : 'text-fg-muted hover:bg-bg-subtle hover:text-fg'}`}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-bg-subtle">
          {tab === 'pdf' ? (
            <iframe title="Site list as the client sees it" src={`${shareUrl(c, user.id)}&preview=1`} className="h-full w-full border-0 bg-bg" />
          ) : null}
          {tab === 'pptx' ? (
            <div className="flex flex-col items-center gap-3 p-4">
              {deckState === 'building' ? <p className="py-16 text-body-md text-fg-muted">Making the presentation…</p> : null}
              {deckState !== 'idle' && deckState !== 'building' ? <p role="alert" className="py-16 text-body-md text-danger-fg">{deckState}</p> : null}
              {deck && deckState !== 'building' ? <DeckPreview slides={deck.slides} /> : null}
            </div>
          ) : null}
          {tab === 'xlsx' && !priced ? (
            <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
              <h3 className="text-display-sm text-fg">No prices yet</h3>
              <p className="max-w-md text-body-md text-fg-muted">
                The rate card is made from the prices on this proposal. Add a rate to at least one line and it’s ready to download, with discounts, totals and VAT worked out.
              </p>
              <button type="button" onClick={goToRates} className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover">
                Add prices
              </button>
              <p className="text-body-sm text-fg-subtle">Prices go in the PowerPoint and the Excel only, never on the client’s link.</p>
            </div>
          ) : null}
          {tab === 'xlsx' && priced && card ? (
            <div className="p-4 sm:p-6">
              <div className="overflow-hidden rounded-2xl border border-border bg-bg">
                <div className="bg-brand-surface px-5 py-3 text-body-sm font-semibold uppercase tracking-wide text-brand-on-surface">Rate card · {c.name}</div>
                <p className="px-5 pt-3 text-body-sm text-fg-muted">Rates {PERIOD_LABEL[card.per]}, in rand, excluding VAT.</p>
                <div className="overflow-x-auto px-5 py-3">
                  <table className="w-full min-w-[620px] text-body-sm">
                    <thead>
                      <tr className="text-left text-label-md uppercase text-fg-subtle">
                        <th className="py-2">Line</th><th className="py-2 text-right">Rate card</th><th className="py-2 text-right">Discount</th><th className="py-2 text-right">Periods</th><th className="py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pricedLines(c).map((r) => (
                        <tr key={r.item.id} className="border-t border-border">
                          <td className="py-2"><span className="font-medium text-fg">{itemLabel(r.item)}</span> <span className="text-fg-muted">· {itemDetail(r.item)}</span></td>
                          <td className="py-2 text-right tabular-nums">{r.line.rate != null ? rand(r.line.rate) : '—'}</td>
                          <td className="py-2 text-right tabular-nums">{r.line.discount ?? 0}%</td>
                          <td className="py-2 text-right tabular-nums">{r.periods}</td>
                          <td className="py-2 text-right font-semibold tabular-nums">{r.total != null ? rand(r.total) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <dl className="ml-auto flex max-w-sm flex-col gap-1 px-5 pb-5 text-body-sm">
                  {([['Rate card value', rand(t.gross)], ['Discount', t.discount > 0 ? `– ${rand(t.discount)}` : rand(0)], [card.vat ? 'Total excl. VAT' : 'Total (excl. VAT)', rand(t.net)], ...(card.vat ? [[`VAT (${Math.round(VAT_RATE * 100)}%)`, rand(t.vat)], ['Total incl. VAT', rand(t.total)]] : [])] as [string, string][]).map(([k, v], i, all) => (
                    <div key={k} className={`flex justify-between gap-4 ${i === all.length - 1 ? 'border-t border-border pt-2 text-body-md font-bold text-fg' : 'text-fg-muted'}`}><dt>{k}</dt><dd className="tabular-nums">{v}</dd></div>
                  ))}
                </dl>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
          <p className="text-body-sm text-fg-muted">
            {tab === 'pdf' ? 'Opens your browser’s print window: choose “Save as PDF”.' : tab === 'pptx' ? 'Each presentation gets its own layout. Not keen on this one? Shuffle it.' : priced ? 'Totals are live formulas in Excel.' : 'Add a price to download the rate card.'}
          </p>
          <div className="flex gap-2">
            {tab === 'pptx' ? (
              <button type="button" disabled={deckState === 'building'} onClick={() => { setDeck(null); void build(); }} className="inline-flex h-11 items-center rounded-full border border-border-strong px-5 text-body-sm font-semibold text-fg hover:border-fg disabled:opacity-40">
                Shuffle the design
              </button>
            ) : null}
            <button
              type="button"
              disabled={saving || (tab === 'pptx' && !deck) || (tab === 'xlsx' && !priced)}
              onClick={() => void download()}
              className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? 'Saving…' : downloadLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
