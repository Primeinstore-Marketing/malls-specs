'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { refreshLiveData } from '@/lib/liveData';
import { prepareImage, UploadProblem } from '@/lib/imageUpload';

/** Drop zones on screen, newest last: only the newest takes a paste (the editor sits over the spec page). */
const mounted: symbol[] = [];

type Status = { readonly name: string; readonly state: 'preparing' | 'uploading' | 'done' | 'failed'; readonly note?: string };

/**
 * Where admins add a screen's pictures: drag photos in, paste one (⌘V / Ctrl+V),
 * or choose files. Each photo is made ready (scaled, rotated, iPhone HEIC
 * converted where the browser can) and uploaded, with a line per file saying
 * how it went. Used on the spec page and in the editor's Pictures tab.
 */
export function PictureDrop({ specId, onSessionExpired, compact = false }: { specId: string; onSessionExpired?: () => void; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const busy = statuses.some((s) => s.state === 'preparing' || s.state === 'uploading');

  const set = (name: string, next: Partial<Status>) => setStatuses((cur) => cur.map((s) => (s.name === name ? { ...s, ...next } : s)));

  async function add(files: File[]) {
    const pictures = files.filter((f) => f.size > 0);
    if (!pictures.length) return;
    // Two files can share a name (e.g. "image.png" pasted twice): keep each line apart.
    const named = pictures.map((f, i) => ({ f, key: `${f.name}#${Date.now()}-${i}` }));
    setStatuses((cur) => [...cur.filter((s) => s.state !== 'done'), ...named.map(({ key }) => ({ name: key, state: 'preparing' as const }))]);
    for (const { f, key } of named) {
      try {
        const ready = await prepareImage(f);
        set(key, { state: 'uploading', note: ready !== f ? `resized to ${Math.round(ready.size / 1024)} KB` : undefined });
        await api.uploadFile(specId, 'media', ready);
        set(key, { state: 'done' });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Upload failed.';
        if (!(e instanceof UploadProblem) && /sign in|expired/i.test(message)) onSessionExpired?.();
        set(key, { state: 'failed', note: message });
      }
    }
    await refreshLiveData();
  }

  const [id] = useState(() => Symbol('picture-drop'));
  useEffect(() => {
    mounted.push(id);
    return () => {
      mounted.splice(mounted.indexOf(id), 1);
    };
  }, [id]);

  // Paste a picture (e.g. a screenshot) while this area is in view and nothing else is being typed in.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (mounted[mounted.length - 1] !== id) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (!files.length || !zone.current?.isConnected) return;
      e.preventDefault();
      void add(files.map((f, i) => (f.name === 'image.png' ? new File([f], `pasted-${Date.now()}-${i}.png`, { type: f.type }) : f)));
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });

  const label = (name: string) => name.replace(/#\d+-\d+$/, '');

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={zone}
        role="button"
        tabIndex={0}
        aria-label="Add pictures: drop photos here, paste, or choose files"
        onClick={() => input.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            input.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void add(Array.from(e.dataTransfer.files));
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-center transition-colors ${compact ? 'px-4 py-5' : 'px-6 py-8'} ${
          over ? 'border-accent bg-accent-subtle' : 'border-border-strong bg-bg-subtle hover:border-accent'
        }`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-accent" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10" r="1.6" />
          <path d="m21 16-5-5-6 6-2-2-5 5" />
        </svg>
        <span className="text-body-md font-semibold text-fg">{busy ? 'Uploading…' : 'Drop photos here, or choose files'}</span>
        <span className="max-w-md text-body-sm text-fg-muted">
          Photos straight from a phone are fine: they’re resized and turned the right way up. You can also paste a picture (⌘V / Ctrl+V). JPG, PNG, WebP, GIF, iPhone photos, or MP4 video up to 25 MB.
        </span>
        <span className="mt-1 inline-flex h-10 items-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent">Choose photos</span>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*,.heic,.heif,video/mp4,video/webm"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          void add(files);
        }}
      />
      {statuses.length ? (
        <ul className="flex flex-col gap-1" aria-live="polite">
          {statuses.map((s) => (
            <li
              key={s.name}
              className={`flex flex-wrap items-baseline gap-x-2 rounded-lg px-3 py-2 text-body-sm ${
                s.state === 'failed' ? 'bg-danger-bg text-danger-fg' : s.state === 'done' ? 'bg-success-bg text-success-fg' : 'bg-bg-subtle text-fg-muted'
              }`}
            >
              <span className="font-semibold">{label(s.name)}</span>
              <span>
                {s.state === 'preparing' ? 'Getting it ready…' : s.state === 'uploading' ? `Uploading${s.note ? ` (${s.note})` : ''}…` : s.state === 'done' ? '✓ Added' : s.note}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
