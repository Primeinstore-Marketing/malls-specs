'use client';

import { useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { contentPhotoRights } from '@/lib/content';
import { PHOTO_RIGHTS, deckMall, mallName, packageByCode } from '@/lib/insights';
import type { PhotoRightsStatus } from '@/lib/insights';
import { refreshLiveData, useLiveData } from '@/lib/liveData';
import { AdminGate, primaryBtn } from './AdminGate';

const OPTIONS: [PhotoRightsStatus, string][] = [
  ['needs-clearance', 'Needs clearance'],
  ['cleared', 'Cleared'],
  ['replace', 'Replace'],
];

/** Mark deck photos cleared once permission is in. Saved as content "photo-rights". */
function Register() {
  useLiveData(); // re-render when the deck's data arrives from the API
  const [statuses, setStatuses] = useState<Record<string, PhotoRightsStatus>>(() => contentPhotoRights());
  const [kind, setKind] = useState<'mall' | 'package' | 'screen'>('mall');
  const [state, setState] = useState<string | null>(null);
  const current = (src: string) => statuses[src] ?? PHOTO_RIGHTS.find((r) => r.src === src)?.status ?? 'needs-clearance';
  const cleared = PHOTO_RIGHTS.filter((r) => current(r.src) === 'cleared').length;

  async function save() {
    setState('Saving…');
    try {
      await api.putContent('photo-rights', { statuses });
      await refreshLiveData();
      setState('Saved — cleared photos now show on client pages.');
    } catch (e) {
      setState(e instanceof Error ? e.message : 'Couldn’t save.');
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-24">
      <p className="max-w-prose text-body-md text-fg-muted">
        {cleared} of {PHOTO_RIGHTS.length} deck photos are cleared. Client pages only show cleared photos (and any you upload). Keep a record of who gave permission in the private project files.
      </p>
      <div className="inline-flex self-start rounded-full bg-bg-subtle p-1" role="group" aria-label="Show">
        {(['mall', 'package', 'screen'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`h-10 rounded-full px-4 text-body-sm font-semibold ${kind === k ? 'bg-bg text-fg shadow-1' : 'text-fg-muted'}`}>
            {k === 'mall' ? 'Mall photos' : k === 'package' ? 'Package photos' : 'Screen photos'}
          </button>
        ))}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PHOTO_RIGHTS.filter((r) => r.kind === kind).map((r) => {
          const m = deckMall(r.mall);
          return (
            <li key={r.src} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-bg">
              <img src={fileUrl(r.src.replace(/^\//, ''))} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
              <div className="flex flex-col gap-2 p-3">
                <div className="text-body-md font-semibold text-fg">{r.kind === 'screen' ? r.note.split(' — ')[0] : m ? mallName(m) : r.mall}</div>
                <div className="text-body-sm text-fg-muted">{r.kind === 'mall' ? r.note : r.kind === 'screen' ? r.note.split(' — ')[1] ?? '' : packageByCode(r.code ?? '')?.pkg.name ?? r.code}</div>
                <select
                  aria-label="Rights status"
                  value={current(r.src)}
                  onChange={(e) => setStatuses((s) => ({ ...s, [r.src]: e.target.value as PhotoRightsStatus }))}
                  className="h-10 rounded-lg border border-border-strong bg-bg px-3 text-body-sm text-fg"
                >
                  {OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="fixed inset-x-0 bottom-0 z-sticky border-t border-border bg-bg/95 backdrop-blur lg:left-[var(--sidebar-width)]">
        <div className="mx-auto flex max-w-admin items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="text-body-sm text-fg-muted" role="status">{state ?? 'Changes go live when you save.'}</p>
          <button type="button" className={primaryBtn} onClick={() => void save()}>Save</button>
        </div>
      </div>
    </div>
  );
}

export function PhotoRightsAdmin() {
  return <AdminGate><Register /></AdminGate>;
}
