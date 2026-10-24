'use client';

import { useEffect, useState } from 'react';
import type { Asset } from '@data-model';
import { fileUrl } from '@/lib/api';

/**
 * The picture side of the spec page: the selected image or video large,
 * with thumbnails underneath when there's more than one.
 */
export function MediaPane({ media }: { media: readonly Asset[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(media[0]?.id ?? null);
  useEffect(() => {
    if (!media.some((asset) => asset.id === selectedId)) setSelectedId(media[0]?.id ?? null);
  }, [media, selectedId]);

  const selected = media.find((asset) => asset.id === selectedId) ?? media[0];

  if (!selected) {
    return (
      <div className="flex h-full flex-col bg-brand-surface">
        <div className="flex flex-1 items-center justify-center p-6">
          <span className="text-center text-body-sm text-brand-on-surface-muted">No pictures yet</span>
        </div>
      </div>
    );
  }

  const src = fileUrl(selected.storageKey);

  return (
    <div className="flex h-full flex-col bg-brand-surface">
      {/* Absolutely positioned so a large image can't push the pane taller than the viewport. */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {selected.kind === 'video' ? (
          <video key={selected.id} src={src} controls className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] rounded-md object-contain" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- served by the API, not from public/
          <img
            key={selected.id}
            src={src}
            alt={selected.alt || selected.caption || selected.filename}
            className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] object-contain"
          />
        )}
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="absolute right-3 top-3 rounded-md bg-black/40 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur hover:bg-black/60"
        >
          Full size ↗
        </a>
      </div>

      <div className="flex flex-col gap-2 border-t border-white/10 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3 text-body-sm">
          <span className="truncate text-brand-on-surface">{selected.caption || selected.filename}</span>
          {selected.image?.width && selected.image.height ? (
            <span className="shrink-0 font-mono text-[11px] text-brand-on-surface-muted">
              {selected.image.width}×{selected.image.height}
            </span>
          ) : null}
        </div>
        {media.length > 1 ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {media.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => setSelectedId(asset.id)}
                aria-label={`Show ${asset.caption || asset.filename}`}
                aria-pressed={asset.id === selected.id}
                className={`h-12 w-16 shrink-0 overflow-hidden rounded border-2 ${
                  asset.id === selected.id ? 'border-accent' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                {asset.kind === 'video' ? (
                  <span className="flex h-full w-full items-center justify-center bg-black/40 text-[10px] text-white">▶ Video</span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(asset.storageKey)} alt="" className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
