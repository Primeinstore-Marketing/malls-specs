'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getAssets } from '@/lib/catalogue';
import { specHref, useLiveData } from '@/lib/liveData';
import { getScreenSize } from '@/lib/malls';
import { screensFor, sheetHref } from '@/lib/portal/screens';

/**
 * A small picture you can click to see it large. When it's of a screen
 * (`specId`), the viewer also offers the spec page, the spec sheet (PDF) and
 * the After Effects template. With no photo, it shows the screen's shape.
 *
 * Inside a <label> (e.g. a checkbox row) the click opens the viewer without
 * toggling the row.
 */
export function Zoomable({
  src,
  title,
  detail,
  note,
  specId,
  packageCode,
  className,
  children,
}: {
  src: string | null;
  title: string;
  detail?: string;
  /** e.g. "Photo of the mall, not this screen". */
  note?: string | null;
  specId?: string | null;
  /** A deck package: its screen spec is worked out the same way as on proposals. */
  packageCode?: string;
  className: string;
  /** What to show in the thumbnail instead of the photo (e.g. a shape). */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // A photo that won't load shows the fallback (e.g. the shape) instead of a broken-image icon.
  const [broken, setBroken] = useState<string | null>(null);
  const show = src && broken !== src ? src : null;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`View ${title}${specId || packageCode ? ', spec and template' : ''}`}
        title={specId || packageCode ? 'View large, with spec and template' : 'View large'}
        className={`group relative shrink-0 overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
      >
        {show ? (
          // eslint-disable-next-line @next/next/no-img-element -- deck photo or API file
          <img src={show} alt="" loading="lazy" onError={() => setBroken(show)} className="h-full w-full object-cover transition-transform duration-slow group-hover:scale-105" />
        ) : (
          children
        )}
        <span aria-hidden="true" className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(6,12,28,0.65)] text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          ⤢
        </span>
      </button>
      {open ? <Viewer src={src} title={title} detail={detail} note={note} specId={specId} packageCode={packageCode} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Viewer({ src, title, detail, note, specId, packageCode, onClose }: { src: string | null; title: string; detail?: string; note?: string | null; specId?: string | null; packageCode?: string; onClose: () => void }) {
  const live = useLiveData();
  const resolvedId = specId ?? (packageCode ? screensFor({ id: packageCode, kind: 'package', code: packageCode }, live.catalogue)[0]?.specId : null);
  const spec = resolvedId ? live.catalogue.specifications[resolvedId] : undefined;
  const files = spec ? getAssets([...spec.downloadIds, ...spec.attachmentIds], live.catalogue) : [];
  const sheet = files.find((a) => a.mimeType === 'application/pdf');
  const template = files.find((a) => /aftereffects/i.test(a.mimeType) || /\.aep$/i.test(a.filename));
  const size = spec ? getScreenSize(spec) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const btn = 'inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-body-sm font-semibold';
  return createPortal(
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-[rgba(6,12,28,0.8)] p-3 sm:p-8" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-bg shadow-3" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#0b1020]">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- deck photo or API file
            <img src={src} alt={title} className="max-h-[70vh] w-full object-contain" />
          ) : size ? (
            <div className="flex h-[40vh] w-full items-center justify-center">
              <span
                className="rounded-md bg-gradient-to-br from-accent to-brand-surface"
                style={size.width >= size.height ? { width: 'min(70%, 560px)', aspectRatio: `${size.width} / ${size.height}` } : { height: '80%', aspectRatio: `${size.width} / ${size.height}` }}
              />
            </div>
          ) : (
            <div className="flex h-[30vh] w-full items-center justify-center text-body-md text-white/70">No photo yet</div>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(6,12,28,0.7)] text-body-lg text-white hover:bg-[rgba(6,12,28,0.9)]">
            ✕
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div className="flex min-w-0 flex-col">
            <strong className="text-body-lg text-fg">{title}</strong>
            <span className="text-body-sm text-fg-muted">
              {detail ?? (size ? `${size.width} × ${size.height} px` : '')}
            </span>
            {note ? <span className="text-[12px] text-fg-subtle">{note}</span> : null}
          </div>
          {spec ? (
            <div className="flex flex-wrap gap-2">
              <Link href={specHref(spec.id, live)} target="_blank" className={`${btn} border border-border-strong text-fg hover:border-fg`}>
                View spec ↗
              </Link>
              {sheet ? (
                <a href={sheetHref(sheet)} download={sheet.filename} className={`${btn} border border-border-strong text-fg hover:border-fg`}>
                  Spec sheet (PDF)
                </a>
              ) : null}
              {template ? (
                <a href={sheetHref(template)} download={template.filename} className={`${btn} bg-accent text-fg-on-accent hover:bg-accent-hover`}>
                  <span className="rounded bg-[#00005b] px-1 text-[10px] font-bold leading-4 text-[#9999ff]">Ae</span>
                  After Effects template
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
