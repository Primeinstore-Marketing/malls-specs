'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AddToProposal } from '@/components/portal/ui';
import { usePortalUser } from '@/lib/portal/store';
import { ui } from '@/lib/portal/ui-state';
import { draftCount, requestDraft, useRequestDraft } from '@/lib/requestDraft';

const SIZE = {
  compact: 'h-11 px-3.5 text-body-sm md:h-8 md:px-3',
  normal: 'h-11 px-4 text-body-sm',
};
const ADD = 'inline-flex w-fit items-center gap-1 rounded-full bg-accent font-semibold text-fg-on-accent hover:bg-accent-hover';
const IN = 'inline-flex w-fit items-center gap-1 rounded-full border border-success-border bg-success-bg font-semibold text-success-fg';

/** A client (signed out) adds a screen to the campaign they're planning. */
export function AddScreenToRequest({ specId, title, mallId, mallName, compact = false }: { specId: string; title: string; mallId: string; mallName: string; compact?: boolean }) {
  const draft = useRequestDraft();
  const inIt = draft.screens.some((s) => s.specId === specId);
  const size = compact ? SIZE.compact : SIZE.normal;
  if (inIt) {
    return (
      <button type="button" className={`${IN} ${size}`} title="In your request: click to remove" onClick={() => requestDraft.removeScreen(specId)}>
        ✓ In your request
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`${ADD} ${size}`}
      onClick={() => {
        requestDraft.addScreen({ specId, title, appMallId: mallId, mallName });
        ui.toast({ text: `Added ${title} to your request`, href: '/request', undo: () => requestDraft.removeScreen(specId) });
      }}
    >
      + Add to request
    </button>
  );
}

/** A client adds a whole mall: sales suggest the screens there. */
export function AddMallToRequest({ mallId, mallName }: { mallId: string; mallName: string }) {
  const draft = useRequestDraft();
  const inIt = draft.malls.some((m) => m.id === mallId);
  if (inIt) {
    return (
      <button type="button" className={`${IN} ${SIZE.normal}`} title="In your request: click to remove" onClick={() => requestDraft.removeMall(mallId)}>
        ✓ {mallName} is in your request
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`${ADD} ${SIZE.normal}`}
      onClick={() => {
        requestDraft.addMall({ id: mallId, name: mallName });
        ui.toast({ text: `Added ${mallName} to your request`, href: '/request', undo: () => requestDraft.removeMall(mallId) });
      }}
    >
      + Add this mall to a request
    </button>
  );
}

/**
 * On public pages: sales (signed in) add the screen to their proposal;
 * everyone else adds it to the campaign request they'll send to sales.
 */
export function AddScreenButton(props: { specId: string; title: string; mallId: string; mallName: string; compact?: boolean }) {
  const { user, ready } = usePortalUser();
  if (!ready) return null;
  if (user) return <AddToProposal compact={props.compact} item={{ kind: 'screen', specId: props.specId, appMallId: props.mallId, title: props.title }} />;
  return <AddScreenToRequest {...props} />;
}

/** Signed-out visitors with something in their request: a way back to it from any page. */
export function RequestTray() {
  const draft = useRequestDraft();
  const { user, ready } = usePortalUser();
  const pathname = usePathname();
  const n = draftCount(draft);
  if (!ready || user || !n || pathname.startsWith('/request') || pathname.startsWith('/share') || pathname.startsWith('/sign-in')) return null;
  const parts = [
    draft.screens.length ? `${draft.screens.length} ${draft.screens.length === 1 ? 'screen' : 'screens'}` : '',
    draft.malls.length ? `${draft.malls.length} ${draft.malls.length === 1 ? 'mall' : 'malls'}` : '',
  ].filter(Boolean);
  return (
    <div className="fixed bottom-4 right-4 z-sticky flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl bg-brand-surface py-3 pl-4 pr-3 text-brand-on-surface shadow-3 print:hidden">
      <div className="flex min-w-0 flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-on-surface-muted">Your campaign request</span>
        <strong className="truncate text-body-md font-semibold">{parts.join(' · ')}</strong>
      </div>
      <Link href="/request" className="flex h-11 shrink-0 items-center rounded-full bg-accent px-4 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover">
        Send to sales →
      </Link>
    </div>
  );
}
