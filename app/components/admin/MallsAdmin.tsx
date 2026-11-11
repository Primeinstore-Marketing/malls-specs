'use client';

/* eslint-disable @next/next/no-img-element -- mall photos from the API */
import Link from 'next/link';
import { useState } from 'react';
import { useLiveData } from '@/lib/liveData';
import { getAllMallsForAdmin } from '@/lib/malls';
import { deckMallForApp, mallPhoto } from '@/lib/insights';
import { placeLine } from '@/lib/sites';
import { AdminGate, field } from './AdminGate';

type Show = 'all' | 'drafts' | 'deleted';

/**
 * Every mall: the ones everyone sees, drafts only admins see, and deleted
 * ones that can be restored. "Add a mall" starts the three-step page.
 */
function List() {
  const { catalogue } = useLiveData();
  const [q, setQ] = useState('');
  const [show, setShow] = useState<Show>('all');
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const all = getAllMallsForAdmin(catalogue);
  const counts = {
    all: all.filter((x) => !x.site.deletedAt).length,
    drafts: all.filter((x) => !x.site.deletedAt && !x.site.published).length,
    deleted: all.filter((x) => x.site.deletedAt).length,
  };
  const list = all
    .filter((x) => (show === 'deleted' ? x.site.deletedAt : !x.site.deletedAt && (show === 'all' || !x.site.published)))
    .filter((x) => words.every((w) => `${x.site.name} ${x.site.place?.name ?? ''} ${x.site.place ? placeLine(x.site.place) : ''}`.toLowerCase().includes(w)));
  const tab = (key: Show, label: string) => (
    <button
      type="button"
      onClick={() => setShow(key)}
      aria-pressed={show === key}
      className={`inline-flex h-9 items-center rounded-full px-3.5 text-body-sm font-semibold ${show === key ? 'bg-fg text-bg' : 'text-fg-muted hover:bg-bg-subtle hover:text-fg'}`}
    >
      {label} <span className="ml-1.5 opacity-70">{counts[key]}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a mall, suburb or city" aria-label="Find a mall" className={`${field} w-72 max-w-full`} />
          <div className="flex gap-1" role="group" aria-label="Show">
            {tab('all', 'All')}
            {tab('drafts', 'Drafts')}
            {tab('deleted', 'Deleted')}
          </div>
        </div>
        <Link href="/admin/malls/edit?new=1" className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover">
          + Add a mall
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map(({ site, mall }) => {
          const deck = deckMallForApp(site.id);
          const photo = deck ? mallPhoto(deck.id) : null;
          const badges = [
            site.deletedAt ? ['Deleted', 'bg-danger-bg text-danger-fg'] : !site.published ? ['Draft', 'bg-warning-bg text-warning-fg'] : null,
            site.group !== 'formats' && !site.location ? ['Not on the map', 'bg-warning-bg text-warning-fg'] : null,
            site.place?.note ? ['Check the pin', 'bg-warning-bg text-warning-fg'] : null,
            site.group === 'hyprop' ? ['Hyprop', 'bg-bg-muted text-fg-muted'] : site.group === 'formats' ? ['Generic specs', 'bg-bg-muted text-fg-muted'] : null,
          ].filter(Boolean) as [string, string][];
          return (
            <li key={site.id}>
              <Link href={`/admin/malls/edit?id=${site.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-3 hover:border-accent">
                {photo ? <img src={photo.src} alt="" loading="lazy" className="h-14 w-20 shrink-0 rounded-xl object-cover" /> : <span className="h-14 w-20 shrink-0 rounded-xl bg-bg-subtle" />}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-md font-semibold text-fg">{site.name}</span>
                  <span className="truncate text-body-sm text-fg-muted">
                    {site.place ? placeLine(site.place) : 'No place yet'} · {mall.specIds.length} {mall.specIds.length === 1 ? 'screen' : 'screens'}
                    {deck?.packages.length ? ` · ${deck.packages.length} ${deck.packages.length === 1 ? 'package' : 'packages'}` : ''}
                  </span>
                  {badges.length ? (
                    <span className="flex flex-wrap gap-1.5 pt-1">
                      {badges.map(([t, c]) => <span key={t} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c}`}>{t}</span>)}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {!list.length ? <p className="text-body-md text-fg-muted">{show === 'deleted' ? 'No deleted malls.' : show === 'drafts' ? 'No drafts.' : `No mall matches “${q}”.`}</p> : null}
    </div>
  );
}

export function MallsAdmin() {
  return <AdminGate><List /></AdminGate>;
}
