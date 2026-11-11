'use client';

import Link from 'next/link';
import { useState } from 'react';
import { specHref, useLiveData } from '@/lib/liveData';
import { getMalls, getScreenSize } from '@/lib/malls';
import { AdminGate, field } from './AdminGate';

/**
 * Every screen spec, by mall. Edit opens the spec page with its editor;
 * pictures, sizes and files are all changed there. "+ Add screens" opens
 * the mall's page, where new screens are added with a name and size.
 */
function List() {
  const { catalogue, addedSpecIds } = useLiveData();
  const [q, setQ] = useState('');
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const malls = getMalls(catalogue)
    .map((m) => ({
      mall: m,
      specs: m.specIds
        .map((id) => catalogue.specifications[id])
        .filter((s) => s && !s.archivedAt && words.every((w) => `${m.name} ${s.title}`.toLowerCase().includes(w))),
    }))
    .filter((x) => x.specs.length || (!words.length || words.every((w) => x.mall.name.toLowerCase().includes(w))))
    .sort((a, b) => a.mall.name.localeCompare(b.mall.name));
  const count = malls.reduce((n, x) => n + x.specs.length, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a mall or screen" aria-label="Find a screen" className={`${field} max-w-sm`} />
        <p className="text-body-sm text-fg-muted">
          {count} screens in {malls.length} malls. New mall? <Link href="/admin/malls/edit?new=1" className="font-semibold text-accent hover:underline">Add a mall</Link>.
        </p>
      </div>
      {malls.map(({ mall, specs }) => (
        <section key={mall.id} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-body-lg font-semibold text-fg">{mall.name}</h2>
            <span className="flex gap-4">
              <Link href={`/admin/malls/edit?id=${mall.id}#screens`} className="text-body-sm font-semibold text-accent hover:underline">+ Add screens</Link>
              <Link href={`/?mall=${mall.id}`} className="text-body-sm font-semibold text-fg-muted hover:text-fg hover:underline">Open on map</Link>
            </span>
          </div>
          {!specs.length ? <p className="rounded-2xl bg-bg-subtle px-4 py-3 text-body-sm text-fg-muted">No screens yet.</p> : null}
          <ul className={`overflow-hidden rounded-2xl border border-border ${specs.length ? '' : 'hidden'}`}>
            {specs.map((s) => {
              const size = getScreenSize(s);
              const pictures = s.mediaIds.filter((id) => catalogue.assets[id]).length;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-3 first:border-t-0">
                  <Link href={`/spec/${s.id}`} className="min-w-0 flex-1 truncate text-body-md font-medium text-fg hover:underline">
                    {s.title || 'Untitled screen'}
                    {addedSpecIds.has(s.id) ? <span className="ml-2 rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] font-semibold text-accent">Added on site</span> : null}
                  </Link>
                  <span className="w-28 font-mono text-body-sm tabular-nums text-fg-muted">{size ? `${size.width}×${size.height}` : 'No size'}</span>
                  <span className={`w-24 text-body-sm ${pictures ? 'text-fg-muted' : 'text-warning-fg'}`}>{pictures ? `${pictures} ${pictures === 1 ? 'picture' : 'pictures'}` : 'No pictures'}</span>
                  <Link href={`${specHref(s.id)}${specHref(s.id).includes('?') ? '&' : '?'}edit=1`} className="inline-flex h-9 items-center rounded-full border border-border-strong px-4 text-body-sm font-semibold text-fg hover:bg-bg-subtle">
                    Edit
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {!count ? <p className="text-body-md text-fg-muted">No screen matches “{q}”.</p> : null}
    </div>
  );
}

export function ScreensAdmin() {
  return <AdminGate><List /></AdminGate>;
}
