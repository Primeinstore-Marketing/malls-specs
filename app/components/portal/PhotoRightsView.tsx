'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PHOTO_RIGHTS, deckMall, mallName, packageByCode } from '@/lib/insights';
import type { PhotoRights } from '@/lib/insights';
import { withBasePath } from '@/lib/basePath';
import type { PortalUser } from '@/lib/portal/types';
import { Page, Pill, RequireSignIn } from './ui';

const STATUS: Record<PhotoRights['status'], { label: string; tone: 'warning' | 'success' | 'danger' }> = {
  'needs-clearance': { label: 'Needs clearance', tone: 'warning' },
  cleared: { label: 'Cleared', tone: 'success' },
  replace: { label: 'Replace', tone: 'danger' },
};

/** Sales: every deck photo, where it came from, and whether we may use it. */
function Register({ user }: { user: PortalUser }) {
  const [kind, setKind] = useState<'all' | 'mall' | 'package' | 'screen'>('mall');
  if (user.role !== 'sales') return <Page><p className="text-body-md text-fg-muted">This register is for Primedia staff.</p></Page>;
  const list = PHOTO_RIGHTS.filter((r) => kind === 'all' || r.kind === kind);
  const counts = (s: PhotoRights['status']) => PHOTO_RIGHTS.filter((r) => r.status === s).length;

  return (
    <Page>
      <header className="flex flex-col gap-3">
        <Link href="/portal" className="text-body-sm font-semibold text-fg-muted hover:text-fg">← Workspace</Link>
        <h1 className="text-display-xl text-fg">Photo rights</h1>
        <p className="max-w-prose text-body-lg text-fg-muted">
          {counts('cleared')} of {PHOTO_RIGHTS.length} photos from the proposal decks are cleared. Shared proposals and the public home page only show cleared photos.
        </p>
      </header>

      <div className="rounded-3xl bg-bg-subtle p-5 text-body-md text-fg-muted">
        To clear a photo, get written permission from its owner (the mall’s marketing team is the usual start) and record it in{' '}
        <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-body-sm text-fg">deck-images/photo-rights.csv</code>. An admin then marks it cleared in Site admin → Photo rights, or uploads a replacement on the mall’s page. The request email is in{' '}
        <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-body-sm text-fg">deck-images/RIGHTS.md</code>.
      </div>

      <div className="inline-flex self-start rounded-full bg-bg-subtle p-1" role="group" aria-label="Show">
        {(
          [
            ['mall', 'Mall photos'],
            ['package', 'Package photos'],
            ['screen', 'Screen photos'],
            ['all', 'All'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`h-10 rounded-full px-4 text-body-sm font-semibold ${kind === k ? 'bg-bg text-fg shadow-1' : 'text-fg-muted hover:text-fg'}`}
          >
            {l}
          </button>
        ))}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => {
          const mall = deckMall(r.mall);
          return (
            <li key={r.src} className="flex flex-col overflow-hidden rounded-3xl border border-border bg-bg">
              <img src={withBasePath(r.src)} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-body-md font-semibold text-fg">{r.kind === 'screen' ? r.note.split(' — ')[0] : mall ? mallName(mall) : r.mall}</div>
                    <div className="truncate text-body-sm text-fg-muted">{r.kind === 'mall' ? 'Mall photo' : r.kind === 'screen' ? 'Screen photo' : packageByCode(r.code ?? '')?.pkg.name ?? r.code}</div>
                  </div>
                  <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
                </div>
                <p className="text-body-sm text-fg-muted">{r.note}</p>
                <p className="text-body-sm text-fg">{r.action}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}

export function PhotoRightsView() {
  return <RequireSignIn what="photo rights">{(user) => <Register user={user} />}</RequireSignIn>;
}
