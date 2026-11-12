'use client';

import { useState } from 'react';
import { formatRange } from '@/lib/portal/logic';
import { creativeLabel } from '@/lib/portal/screens';
import type { CreativeGroup } from '@/lib/portal/screens';
import { SizeDownloads } from './SizeDownloads';

function Shape({ w, h, size = 56 }: { w: number | null; h: number | null; size?: number }) {
  if (!w || !h) return <span className="block rounded-md border-2 border-dashed border-border-strong" style={{ width: size, height: size * 0.6 }} aria-hidden="true" />;
  const scale = size / Math.max(w, h);
  return <span className="block rounded-[3px] bg-gradient-to-br from-accent to-brand-surface" style={{ width: w * scale, height: h * scale, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} aria-hidden="true" />;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "You'll supply 2 creatives for 18 sites; Primedia will confirm the size for 96 more." */
export function creativeSummary(groups: readonly CreativeGroup[], unit: 'site' | 'screen', audience: 'client' | 'sales'): string {
  const known = groups.filter((g) => g.width);
  const tbc = groups.filter((g) => !g.width);
  const knownCount = known.reduce((n, g) => n + g.count, 0);
  const tbcCount = tbc.reduce((n, g) => n + g.count, 0);
  const who = audience === 'client' ? 'You’ll supply' : 'The client supplies';
  const parts: string[] = [];
  if (known.length) parts.push(`${who} ${plural(known.length, 'creative')} for ${plural(knownCount, unit)}`);
  if (tbc.length) {
    const rest = `${plural(tbcCount, unit)} (${plural(tbc.length, 'group')})`;
    parts.push(audience === 'client' ? `${known.length ? 'and ' : ''}Primedia will confirm the size for ${rest}` : `${known.length ? 'and ' : ''}the size still needs confirming for ${rest}`);
  }
  if (!parts.length) return '';
  const line = `${parts.join(', ')}.`;
  return line[0].toUpperCase() + line.slice(1);
}

/**
 * The site list grouped by the creative it needs: one card per artwork size
 * (or, while a size isn't known, per kind of site), with its templates and
 * spec sheets, and its sites folded underneath. Long lists become a handful
 * of groups to check. Printing shows every site.
 */
export function CreativeGroups({
  groups,
  start,
  end,
  audience,
  onRemove,
}: {
  groups: readonly CreativeGroup[];
  start: string | null;
  end: string | null;
  audience: 'client' | 'sales';
  /** Sales, while the proposal can change: remove a line. */
  onRemove?: (itemId: string) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(groups.length === 1 ? [groups[0].key] : []));
  const toggle = (key: string) => setOpen((cur) => {
    const next = new Set(cur);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const unit = groups.some((g) => g.lines.some((l) => l.screen.site)) ? 'site' : 'screen';

  return (
    <ol className="flex flex-col gap-3">
      {groups.map((g, gi) => {
        const isOpen = open.has(g.key);
        return (
          <li key={g.key} className={`overflow-hidden rounded-3xl border bg-bg print:break-inside-avoid ${g.width ? 'border-border' : 'border-dashed border-border-strong'}`}>
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
              <div className="flex h-16 w-20 shrink-0 items-center justify-center"><Shape w={g.width} h={g.height} size={64} /></div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-label-md font-semibold uppercase text-fg-subtle">Creative {gi + 1}</span>
                <strong className="text-body-lg text-fg">{creativeLabel(g)}</strong>
                <span className="text-body-sm text-fg-muted">
                  For {plural(g.count, unit)} in {plural(g.malls, 'mall')}
                  {g.ratio ? ` · ${g.ratio}` : ''}
                </span>
                {!g.width ? (
                  <span className={`text-body-sm ${audience === 'sales' ? 'font-semibold text-warning-fg' : 'text-fg-muted'}`}>
                    {audience === 'sales' ? 'Not screens on the site yet: check the size and details before sending.' : 'Primedia will confirm the artwork size for these sites.'}
                  </span>
                ) : null}
                {g.files.length ? <div className="pt-1"><SizeDownloads files={g.files} /></div> : null}
              </div>
              <button
                type="button"
                onClick={() => toggle(g.key)}
                aria-expanded={isOpen}
                className="inline-flex h-10 shrink-0 items-center self-start rounded-full border border-border-strong px-4 text-body-sm font-semibold text-fg hover:border-fg print:hidden"
              >
                {isOpen ? 'Hide' : 'Show'} the {plural(g.lines.length, unit)}
              </button>
            </div>
            <div className={`${isOpen ? '' : 'hidden'} overflow-x-auto border-t border-border print:block`}>
              <table className="w-full min-w-[620px] border-collapse text-left text-body-sm">
                <thead>
                  <tr className="bg-bg-subtle text-label-md uppercase text-fg-subtle">
                    <th scope="col" className="px-4 py-2 font-semibold">No</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Mall</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Site / screen</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Site no.</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Flight</th>
                    {onRemove ? <th scope="col" className="px-3 py-2 print:hidden"><span className="sr-only">Remove</span></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {g.lines.map(({ item, screen: x }, i) => (
                    <tr key={`${item.id}-${i}`} className="border-t border-border align-top">
                      <td className="px-4 py-2 tabular-nums text-fg-muted">{x.site?.no ?? i + 1}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-fg">{x.mallName}</td>
                      <td className="px-3 py-2 text-fg">{x.title}{x.qty > 1 ? ` × ${x.qty}` : ''}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px] text-fg-muted">{x.site?.siteNo || (item.kind === 'package' ? item.code : '')}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-fg-muted">{x.site?.start || x.site?.end ? formatRange(x.site.start, x.site.end) : formatRange(start, end)}</td>
                      {onRemove ? (
                        <td className="px-3 py-2 text-right print:hidden">
                          <button type="button" onClick={() => onRemove(item.id)} className="h-8 rounded-full px-3 text-body-sm text-fg-muted hover:bg-bg-subtle hover:text-danger-fg" aria-label={`Remove ${x.title}`}>Remove</button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
