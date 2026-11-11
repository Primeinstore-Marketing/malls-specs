'use client';

import { useRef, useState } from 'react';
import type { Asset, Specification } from '@data-model';
import { api, fileUrl } from '@/lib/api';
import { refreshLiveData, useLiveData } from '@/lib/liveData';
import { deckMallForApp, mallName, mallPhoto, packagePhotos, photoRights, screenPhotos } from '@/lib/insights';
import type { ShownPhoto } from '@/lib/insights';
import { screensFor } from '@/lib/portal/screens';
import { useAdminSession } from '@/components/auth/AdminSession';
import { MediaPane } from './MediaPane';

/**
 * Pictures on a screen's spec page.
 *  - The screen's own pictures, uploaded by an admin, come first.
 *  - Without any, photos from the proposal deck for this mall: the package
 *    of this screen's format where we can tell, else the mall's photos.
 * Admins can upload pictures here, adopt a deck photo with one click, and
 * reorder or delete the screen's own pictures (the first is the main one).
 */

interface Candidate {
  readonly photo: ShownPhoto;
  readonly label: string;
  /** True when the photo is of this screen's package, not just the mall. */
  readonly match: boolean;
}

function candidatesFor(spec: Specification, mallId: string | null, catalogue: ReturnType<typeof useLiveData>['catalogue']): Candidate[] {
  // Photos of this very screen (malls proposal deck) beat anything else.
  const own = screenPhotos(spec.id).map((photo) => ({ photo, label: photo.package, match: true }));
  const mall = mallId ? deckMallForApp(mallId) : undefined;
  if (!mall) return own;
  const out: Candidate[] = [...own];
  for (const pkg of mall.packages) {
    const sc = screensFor({ id: pkg.code, kind: 'package', code: pkg.code }, catalogue)[0];
    const match = sc?.specId === spec.id;
    for (const photo of packagePhotos(pkg.code)) out.push({ photo, label: `${pkg.format}${pkg.units ? ` × ${pkg.units}` : ''} · ${pkg.code}`, match });
  }
  const hero = mallPhoto(mall.id);
  if (hero) out.push({ photo: hero, label: mallName(mall), match: false });
  const matched = out.filter((c) => c.match);
  return matched.length ? [...matched, ...out.filter((c) => !c.match && c.photo === hero)] : out;
}

async function asFile(photo: ShownPhoto, name: string): Promise<File> {
  const res = await fetch(photo.src);
  if (!res.ok) throw new Error('Couldn’t read that photo.');
  const blob = await res.blob();
  return new File([blob], `${name}.jpg`, { type: blob.type || 'image/jpeg' });
}

export function ScreenPhotos({ spec, media, mallId }: { spec: Specification; media: readonly Asset[]; mallId: string | null }) {
  const { catalogue } = useLiveData();
  const { isAdmin, sessionExpired } = useAdminSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const candidates = media.length ? [] : candidatesFor(spec, mallId, catalogue);
  const anyMatch = candidates.some((c) => c.match);

  async function run(label: string, task: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await task();
      await refreshLiveData();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'That didn’t work.';
      if (/sign in|expired/i.test(message)) sessionExpired();
      setError(message);
    } finally {
      setBusy(null);
    }
  }

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    void run('Uploading…', async () => {
      for (const f of Array.from(files)) await api.uploadFile(spec.id, 'media', f);
    });
  };

  if (!media.length && !candidates.length && !isAdmin) return null;

  return (
    <section id="pictures" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-label-md font-semibold uppercase text-fg-muted">Pictures</h2>
          {!media.length && candidates.length ? (
            <p className="text-body-sm text-fg-muted">
              {anyMatch ? 'From the proposal decks, of this screen or its package.' : `From the proposal deck, at ${deckMallForApp(mallId ?? '') ? mallName(deckMallForApp(mallId ?? '')!) : 'this mall'}. These may not show this exact screen.`}
            </p>
          ) : null}
        </div>
        {isAdmin ? (
          <div className="flex items-center gap-2">
            <input ref={input} type="file" accept="image/*,video/mp4" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => input.current?.click()}
              className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover disabled:opacity-50"
            >
              {busy ?? 'Upload pictures'}
            </button>
          </div>
        ) : null}
      </div>
      {error ? <p className="rounded-xl bg-danger-bg px-4 py-2 text-body-sm text-danger-fg">{error}</p> : null}

      {media.length ? (
        <div className="h-[300px] overflow-hidden rounded-2xl border border-border sm:h-[420px]">
          <MediaPane media={media} />
        </div>
      ) : null}
      {media.length && isAdmin ? (
        <ManagePictures
          media={media}
          busy={Boolean(busy)}
          onMove={(ids) => void run('Saving order…', () => api.reorderAssets(spec.id, ids))}
          onDelete={(a) => {
            if (window.confirm(`Delete ${a.filename}? It's removed for everyone.`)) void run('Deleting…', () => api.deleteAsset(a.id));
          }}
        />
      ) : null}
      {media.length ? null : candidates.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map((c) => {
            const pending = !c.photo.uploaded && photoRights(c.photo.src)?.status !== 'cleared';
            return (
              <li key={c.photo.src} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-bg">
                <div className="relative">
                  <img src={c.photo.src} alt={c.label} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  {pending ? (
                    <span className="absolute left-3 top-3 rounded-full bg-[rgba(6,12,28,0.6)] px-2.5 py-1 text-[11px] font-semibold text-white" title="Internal use until rights are cleared">
                      Rights pending
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <span className="text-body-sm text-fg-muted">{c.label}</span>
                  {isAdmin ? (
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void run('Adding…', async () => api.uploadFile(spec.id, 'media', await asFile(c.photo, `${spec.id}-${c.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`)))}
                      className="mt-auto self-start text-body-sm font-semibold text-accent hover:underline disabled:opacity-50"
                    >
                      Use as this screen’s picture
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border-strong px-4 py-8 text-center text-body-sm text-fg-muted">
          No pictures yet. Upload a photo of this screen in place.
        </p>
      )}
    </section>
  );
}


/** Admin strip: the screen's pictures in order, to move or delete. */
function ManagePictures({ media, busy, onMove, onDelete }: { media: readonly Asset[]; busy: boolean; onMove: (ids: string[]) => void; onDelete: (a: Asset) => void }) {
  const ids = media.map((a) => a.id);
  const move = (from: number, to: number) => {
    const next = [...ids];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onMove(next);
  };
  const base = 'flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-body-sm font-semibold hover:bg-bg-subtle disabled:opacity-30 disabled:hover:bg-transparent';
  const btn = `${base} text-fg-muted hover:text-fg`;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border p-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-body-sm font-semibold text-fg">Manage pictures</h3>
        <span className="text-body-sm text-fg-muted">The first one is the main picture.</span>
      </div>
      <ol className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
        {media.map((a, i) => (
          <li key={a.id} className="flex w-44 shrink-0 flex-col gap-1.5">
            <div className="relative">
              {a.kind === 'video' ? (
                <span className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-bg-subtle text-body-sm text-fg-muted">▶ Video</span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- served by the API
                <img src={fileUrl(a.storageKey)} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
              )}
              <span className="absolute left-2 top-2 rounded-full bg-[rgba(6,12,28,0.65)] px-2 py-0.5 text-[11px] font-semibold text-white">{i === 0 ? 'Main' : i + 1}</span>
            </div>
            <span className="truncate text-[12px] text-fg-muted" title={a.filename}>{a.filename}</span>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button type="button" className={btn} disabled={busy || i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${a.filename} earlier`}>←</button>
                <button type="button" className={btn} disabled={busy || i === media.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move ${a.filename} later`}>→</button>
              </div>
              <button type="button" className={`${base} text-danger-fg`} disabled={busy} onClick={() => onDelete(a)}>Delete</button>
            </div>
            {i > 0 ? (
              <button type="button" className="self-start text-body-sm font-semibold text-accent hover:underline disabled:opacity-50" disabled={busy} onClick={() => move(i, 0)}>
                Make main picture
              </button>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
