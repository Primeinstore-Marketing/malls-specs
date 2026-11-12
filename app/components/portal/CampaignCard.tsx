'use client';

import Link from 'next/link';
import { compact } from '@/lib/insights';
import { campaignClientName, clientName, days, docWords, formatRange, phase, reach, todayIso } from '@/lib/portal/logic';
import type { Campaign, PortalUser } from '@/lib/portal/types';
import { StatusPill } from './ui';
import { useState } from 'react';
import { useAdminSession } from '@/components/auth/AdminSession';
import { portal } from '@/lib/portal/store';
import { ui } from '@/lib/portal/ui-state';

/** Whoever made a draft, or an admin, may delete it (the server checks too). */
export function canDeleteDraft(c: Campaign, user: PortalUser, isAdmin: boolean): boolean {
  return c.status === 'draft' && (c.createdBy === user.id || isAdmin);
}

/** "Delete" for a draft: asks first, then removes it everywhere. */
export function DeleteDraftButton({ c, className = '', onDeleted }: { c: Campaign; className?: string; onDeleted?: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={`text-body-sm font-semibold text-danger-fg hover:underline disabled:opacity-50 ${className}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm(`Delete the draft “${c.name}”? This can’t be undone.`)) return;
        setBusy(true);
        portal
          .deleteDraft(c.id)
          .then(() => {
            ui.toast({ text: `Deleted the draft “${c.name}”` });
            onDeleted?.();
          })
          .catch((err) => {
            setBusy(false);
            window.alert(err instanceof Error ? err.message : 'Couldn’t delete this draft.');
          });
      }}
    >
      {busy ? 'Deleting…' : 'Delete'}
    </button>
  );
}

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
  const { isAdmin } = useAdminSession();
  const card = (
    <Link
      href={`/portal/campaign?id=${c.id}`}
      className="group flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-bg p-4 transition-[border-color,box-shadow] duration-fast ease-standard hover:border-accent-border hover:shadow-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          {user.role === 'sales' ? <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{docWords(c).Noun}</span> : null}
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
  if (!canDeleteDraft(c, user, isAdmin)) return card;
  // The button sits on the card but outside its link.
  return (
    <div className="relative">
      {card}
      <DeleteDraftButton c={c} className="absolute bottom-4 right-4 rounded-md px-2 py-1 hover:bg-danger-bg" />
    </div>
  );
}
