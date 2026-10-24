'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Specification } from '@data-model';
import { getMallForSpec } from '@/lib/malls';
import { useLiveData } from '@/lib/liveData';
import { useAdminSession } from '@/components/auth/AdminSession';
import { SpecEditor } from './SpecEditor';
import { BookmarkButton } from './BookmarkButton';

function MapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2" />
      <rect x="6" y="14" width="12" height="7" rx="1" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

const ACTION =
  'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-body-sm font-medium text-fg-muted transition-colors duration-fast ease-standard hover:bg-bg-subtle hover:text-fg';

/** The spec's actions, as one tidy group: share and save for everyone, edit for admins. */
export function SpecActionBar({ spec }: { spec: Specification }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const { isAdmin } = useAdminSession();
  const live = useLiveData();
  const mall = getMallForSpec(spec.id, live.catalogue);
  // Screens added by admins have no pre-built print page.
  const printable = !live.addedSpecIds.has(spec.id);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {mall ? (
        <Link href={`/?mall=${mall.id}&screen=${spec.id}`} className={ACTION}>
          <MapIcon />
          Show on map
        </Link>
      ) : null}
      <BookmarkButton specId={spec.id} />
      <button type="button" onClick={copyLink} className={ACTION}>
        <LinkIcon />
        {copied ? 'Copied' : 'Copy link'}
      </button>
      {printable ? (
        <Link href={`/spec/${spec.id}/print`} className={ACTION}>
          <PrintIcon />
          Print
        </Link>
      ) : null}
      {isAdmin ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-body-sm font-semibold text-fg-on-accent transition-colors duration-fast ease-standard hover:bg-accent-hover"
        >
          <PencilIcon />
          Edit spec
        </button>
      ) : null}

      {editing ? (
        <SpecEditor
          spec={spec}
          tags={Object.values(live.catalogue.tags)}
          assets={live.catalogue.assets}
          isAdded={live.addedSpecIds.has(spec.id)}
          mallId={mall?.id ?? null}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}
