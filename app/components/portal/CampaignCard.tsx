'use client';

import Link from 'next/link';
import { compact } from '@/lib/insights';
import { campaignClientName, clientName, days, formatRange, phase, reach, todayIso } from '@/lib/portal/logic';
import type { Campaign, PortalUser } from '@/lib/portal/types';
import { StatusPill } from './ui';

export function countdown(c: Campaign): string | null {
  const ph = phase(c);
  const today = todayIso();
  if (ph === 'upcoming') {
    const d = days(today, c.start) - 1;
    return d <= 1 ? 'Goes live tomorrow' : `Goes live in ${d} days`;
  }
  if (ph === 'live') {
    const d = days(today, c.end) - 1;
    return d <= 0 ? 'Last day today' : `${d} ${d === 1 ? 'day' : 'days'} left`;
  }
  return null;
}

/** A campaign in a list: name, who and when, its state, and one line of numbers. */
export function CampaignCard({ c, user, highlight }: { c: Campaign; user: PortalUser; highlight?: string }) {
  const r = reach(c);
  const ph = phase(c);
  return (
    <Link
      href={`/portal/campaign?id=${c.id}`}
      className="group flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-bg p-4 transition-[border-color,box-shadow] duration-fast ease-standard hover:border-accent-border hover:shadow-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <strong className="truncate text-body-md font-semibold text-fg">{c.name}</strong>
          <span className="truncate text-body-sm text-fg-muted">
            {user.role === 'sales' ? `${campaignClientName(c)} · ` : ''}
            {formatRange(c.start, c.end)}
          </span>
        </div>
        <StatusPill status={c.status} phase={ph} />
      </div>
      <span className="text-body-sm text-fg-subtle">
        {countdown(c) ?? `${r.malls} ${r.malls === 1 ? 'mall' : 'malls'}${r.visits ? ` · ~${compact(r.visits)} visits` : ''}`}
      </span>
      {highlight ? <span className="text-body-sm font-semibold text-accent">{highlight} →</span> : null}
    </Link>
  );
}
