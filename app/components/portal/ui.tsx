'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { CLIENTS, USERS } from '@/lib/portal/seed';
import { CLIENT_STATUS_TONE, STATUS_TONE, canEdit, formatRange, itemLabel, statusLabel } from '@/lib/portal/logic';
import { ui } from '@/lib/portal/ui-state';
import { portal, usePortalState, usePortalUser } from '@/lib/portal/store';
import { useLiveData } from '@/lib/liveData';
import type { CampaignStatus, NewCampaignItem, PortalUser } from '@/lib/portal/types';

/* ---------- Small pieces ---------- */

const TONES = {
  neutral: 'bg-bg-muted text-fg-muted',
  info: 'bg-info-bg text-info-fg',
  warning: 'bg-warning-bg text-warning-fg',
  success: 'bg-success-bg text-success-fg',
  danger: 'bg-danger-bg text-danger-fg',
  accent: 'bg-accent-subtle text-accent',
} as const;

export function Pill({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${TONES[tone]}`}>{children}</span>;
}

export function StatusPill({ status, phase }: { status: CampaignStatus; phase?: 'upcoming' | 'live' | 'completed' | null }) {
  const { userId } = usePortalState();
  const role = USERS.find((u) => u.id === userId)?.role === 'client' ? 'client' : 'sales';
  if (phase === 'live') return <Pill tone="success">● Live now</Pill>;
  if (phase === 'upcoming') return <Pill tone="success">Booked · upcoming</Pill>;
  if (phase === 'completed') return <Pill>Finished</Pill>;
  return <Pill tone={role === 'client' ? CLIENT_STATUS_TONE[status] : STATUS_TONE[status]}>{statusLabel(status, role)}</Pill>;
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-bg p-4">
      <span className="text-label-md font-semibold uppercase text-fg-muted">{label}</span>
      <span className="text-display-md text-fg">{value}</span>
      {note ? <span className="text-body-sm text-fg-muted">{note}</span> : null}
    </div>
  );
}

/** One horizontal bar with its value written beside it. */
export function Bar({ label, pct, max = 100, value }: { label: ReactNode; pct: number; max?: number; value?: ReactNode }) {
  const w = Math.max(2, Math.min(100, (pct / max) * 100));
  return (
    <div className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_3rem] items-center gap-3 text-body-sm sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_3.5rem]" title={`${typeof label === 'string' ? label : ''} ${pct}%`}>
      <span className="truncate text-fg-muted">{label}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-bg-muted">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${w}%` }} />
      </span>
      <span className="text-right font-semibold tabular-nums text-fg">{value ?? `${pct}%`}</span>
    </div>
  );
}

export function Section({ title, action, children, id }: { title: ReactNode; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-display-sm text-fg">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-page flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">{children}</div>;
}

/* ---------- Signing in ---------- */

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
}

export function Avatar({ user, size = 'md' }: { user: PortalUser | undefined; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-10 w-10 text-body-sm';
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${s} ${
        user?.role === 'sales' ? 'bg-brand-surface text-brand-on-surface' : 'bg-accent-subtle text-accent'
      }`}
    >
      {user ? initials(user.name) : '?'}
    </span>
  );
}

/** Sales accounts, plus a pointer for clients, who don't sign in: they use the emailed link. */
export function AccountPicker({ next }: { next?: string }) {
  const router = useRouter();
  const groups: { title: string; note: string; users: PortalUser[] }[] = [
    { title: 'Primedia sales', note: 'Build proposals, send them to clients and confirm bookings.', users: USERS.filter((u) => u.role === 'sales') },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="order-last flex min-w-0 flex-col gap-2 rounded-2xl bg-bg-subtle p-5 md:order-none md:col-start-2">
        <h3 className="text-body-lg font-semibold text-fg">Clients</h3>
        <p className="text-body-sm text-fg-muted">
          You don’t need to sign in. Open the link your account manager emailed you: it shows every screen booked, the artwork to supply, and lets you change or approve the proposal.
        </p>
      </div>
      {groups.map((g) => (
        <div key={g.title} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-bg p-5 md:col-start-1 md:row-start-1">
          <div>
            <h3 className="text-body-lg font-semibold text-fg">{g.title}</h3>
            <p className="text-body-sm text-fg-muted">{g.note}</p>
          </div>
          {g.users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                portal.signIn(u.id);
                router.push(next || '/portal');
              }}
              className="flex items-center gap-3 rounded-xl border border-border-strong px-3 py-2.5 text-left transition-colors duration-fast ease-standard hover:border-accent hover:bg-accent-subtle"
            >
              <Avatar user={u} />
              <span className="flex min-w-0 flex-col">
                <strong className="text-body-md font-semibold text-fg">{u.name}</strong>
                <span className="truncate text-body-sm text-fg-muted">{u.title}</span>
              </span>
              <span className="ml-auto shrink-0 whitespace-nowrap text-body-sm font-semibold text-accent">Sign in →</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Shows the page to signed-in sales and clients; everyone else gets the sign-in. */
export function RequireSignIn({ children, what = 'this page' }: { children: (user: PortalUser) => ReactNode; what?: string }) {
  const { user, ready } = usePortalUser();
  const pathname = usePathname();
  // Re-render when admin-edited content arrives from the API.
  useLiveData();
  if (!ready) return <Page><div className="h-64 animate-pulse rounded-2xl bg-bg-subtle" /></Page>;
  if (user) return <>{children(user)}</>;
  return (
    <Page>
      <div className="flex flex-col gap-3">
        <span className="text-label-md font-semibold uppercase text-accent">Sign in to continue</span>
        <h1 className="text-display-xl text-fg">Sign in to see {what}</h1>
        <p className="max-w-prose text-body-lg text-fg-muted">
          The Media Explorer, audience insights and the campaign workspace are for Primedia sales.
        </p>
      </div>
      <AccountPicker next={pathname + (typeof window !== 'undefined' ? window.location.search : '')} />
      <p className="text-body-sm text-fg-subtle">
        Demo account — campaigns are saved in this browser only.
      </p>
    </Page>
  );
}

export function clientLabel(id: string | null) {
  return CLIENTS.find((c) => c.id === id)?.name ?? 'No client yet';
}

/* ---------- Add to campaign ---------- */

/** Puts an item in the user's current campaign, confirming with a toast and undo. */
export function addWithToast(campaignId: string, campaignName: string, item: NewCampaignItem) {
  const itemId = portal.addTo(campaignId, item);
  ui.toast({
    text: `Added ${itemLabel({ ...item, id: '' } as never)} to ${campaignName}`,
    href: `/portal/campaign?id=${campaignId}`,
    undo: () => portal.remove(campaignId, itemId),
  });
}

const SIZE = {
  // 44px tall on touch screens, compact from tablet width up.
  compact: 'h-11 px-3.5 text-body-sm md:h-7 md:px-2.5 md:text-[12px]',
  normal: 'h-11 px-4 text-body-sm md:h-8 md:px-3',
};

export function AddToCampaign({ item, compact = false }: { item: NewCampaignItem; compact?: boolean }) {
  const { campaigns, active, userId } = usePortalState();
  if (!userId) return null;
  const user = USERS.find((u) => u.id === userId);
  const current = campaigns.find((x) => x.id === active[userId]);
  const c = current && user && canEdit(current, user) ? current : undefined;
  const key = item.kind === 'package' ? `pkg:${item.code}` : `scr:${item.specId}`;
  const inIt = c?.items.find((i) => (i.kind === 'package' ? `pkg:${i.code}` : `scr:${i.specId}`) === key);
  if (inIt && c) {
    return (
      <button
        type="button"
        onClick={() => {
          portal.remove(c.id, inIt.id);
          ui.toast({ text: `Removed from ${c.name}`, undo: () => portal.addTo(c.id, item) });
        }}
        className={`inline-flex items-center gap-1 rounded-full border border-success-border bg-success-bg font-semibold text-success-fg ${compact ? SIZE.compact : SIZE.normal}`}
        title={`In ${c.name} — click to remove`}
      >
        ✓ In {c.name.length > 18 ? 'campaign' : c.name}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => (c ? addWithToast(c.id, c.name, item) : ui.pick(item))}
      className={`inline-flex items-center gap-1 rounded-full bg-accent font-semibold text-fg-on-accent hover:bg-accent-hover ${compact ? SIZE.compact : SIZE.normal}`}
    >
      + Add to campaign
    </button>
  );
}

export function CampaignLink({ id, children, className = '' }: { id: string; children: ReactNode; className?: string }) {
  return (
    <Link href={`/portal/campaign?id=${id}`} className={className}>
      {children}
    </Link>
  );
}
