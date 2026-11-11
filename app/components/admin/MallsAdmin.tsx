'use client';

import { useLiveData } from '@/lib/liveData';
import Link from 'next/link';
import { useState } from 'react';
import { ALL_MALLS, annualVisits, compact, mallName, mallPhoto } from '@/lib/insights';
import { contentUpdatedAt } from '@/lib/content';
import { AdminGate, field } from './AdminGate';

/** Every mall, with what admins have changed. Click one to edit it. */
function List() {
  useLiveData(); // re-render when the deck's data arrives from the API
  const [q, setQ] = useState('');
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const malls = [...ALL_MALLS]
    .filter((m) => words.every((w) => `${mallName(m)} ${m.province} ${m.packages.map((p) => p.code).join(' ')}`.toLowerCase().includes(w)))
    .sort((a, b) => mallName(a).localeCompare(mallName(b)));
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a mall or package code" aria-label="Find a mall" className={`${field} max-w-sm`} />
        <Link href="/admin/malls/edit?new=1" className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover">
          Add a mall
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {malls.map((m) => {
          const photo = mallPhoto(m.id);
          const edited = contentUpdatedAt(`mall:${m.id}`);
          return (
            <li key={m.id}>
              <Link href={`/admin/malls/edit?id=${m.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-3 hover:border-accent">
                {photo ? <img src={photo.src} alt="" loading="lazy" className="h-14 w-20 shrink-0 rounded-xl object-cover" /> : <span className="h-14 w-20 shrink-0 rounded-xl bg-bg-subtle" />}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-md font-semibold text-fg">{mallName(m)}</span>
                  <span className="truncate text-body-sm text-fg-muted">
                    {m.province} · {m.packages.length} {m.packages.length === 1 ? 'package' : 'packages'}
                    {annualVisits(m) ? ` · ${compact(annualVisits(m) as number)} visits` : ''}
                  </span>
                  <span className="flex gap-1.5 pt-1">
                    {m.hidden ? <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[11px] font-semibold text-fg-muted">Hidden</span> : null}
                    {edited ? <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] font-semibold text-accent">Edited</span> : null}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MallsAdmin() {
  return <AdminGate><List /></AdminGate>;
}
