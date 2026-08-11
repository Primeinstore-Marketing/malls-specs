'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Specification } from '@data-model';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button, LinkButton } from '@/components/ui/Button';
import { BookmarkButton } from './BookmarkButton';

function BackIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function SpecActionBar({ spec, backHref }: { spec: Specification; backHref: string }) {
  const [copied, setCopied] = useState(false);

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
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
      <Link
        href={backHref}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-strong px-2.5 text-body-sm text-fg-muted transition-colors duration-fast ease-standard hover:border-border-control hover:text-fg"
      >
        <BackIcon />
        Back
      </Link>

      {spec.code ? (
        <span className="inline-flex h-[22px] items-center rounded-full border border-accent-border bg-accent-subtle px-2.5 text-mono-md text-accent-fg">
          {spec.code}
        </span>
      ) : null}

      <StatusBadge status={spec.status} />

      <div className="ml-auto flex items-center gap-2">
        <BookmarkButton specId={spec.id} />
        <Button variant="ghost" onClick={copyLink}>
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <LinkButton href={`/spec/${spec.id}/print`} variant="ghost">
          Print
        </LinkButton>
        <Button variant="ghost" disabled title="Export PDF — coming soon">
          Export PDF
        </Button>
      </div>
    </div>
  );
}
