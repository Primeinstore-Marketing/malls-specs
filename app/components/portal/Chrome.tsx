'use client';

import { useLiveData } from '@/lib/liveData';
import Link from 'next/link';
import { withBasePath } from '@/lib/basePath';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { compact } from '@/lib/insights';
import { canEdit, campaignClientName, clientName, itemLabel, reach, timeAgo, userById, visibleTo } from '@/lib/portal/logic';
import { ui, useUi } from '@/lib/portal/ui-state';
import { portal, useCampaignSync, usePortalState, usePortalUser } from '@/lib/portal/store';
import { Avatar, addWithToast } from './ui';
import { useAdminSession } from '@/components/auth/AdminSession';

/** "Building: Festive Feast · 4 items" — follows the user round the site while they add media. */
export function CampaignTray() {
  useLiveData(); // re-render when the deck's data arrives from the API
  const { campaigns, active, userId } = usePortalState();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const user = userId ? userById(userId) : undefined;
  const c = user ? campaigns.find((x) => x.id === active[user.id]) : undefined;
  if (!user || !c || !canEdit(c, user) || pathname.startsWith('/portal/campaign') || pathname.startsWith('/sign-in')) return null;
  const r = reach(c);
  const summary = `${c.items.length} ${c.items.length === 1 ? 'item' : 'items'} · ${r.malls} ${r.malls === 1 ? 'mall' : 'malls'}${r.visits ? ` · ~${compact(r.visits)} visits` : ''}`;
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label={`Show campaign tray: ${c.name}, ${summary}`}
        className="fixed bottom-4 right-4 z-sticky flex h-11 items-center gap-2 rounded-full bg-brand-surface px-4 text-body-sm font-semibold text-brand-on-surface shadow-3 print:hidden"
      >
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-[12px] text-fg-on-accent">{c.items.length}</span>
        <span className="max-w-[10rem] truncate">{c.name}</span>
      </button>
    );
  }
  return (
    <div className="fixed bottom-4 right-4 z-sticky flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl bg-brand-surface py-3 pl-4 pr-3 text-brand-on-surface shadow-3 print:hidden">
      <div className="flex min-w-0 flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-on-surface-muted">Building</span>
        <strong className="truncate text-body-md font-semibold">{c.name}</strong>
        <span className="text-body-sm text-brand-on-surface-muted">{summary}</span>
      </div>
      <Link href={`/portal/campaign?id=${c.id}`} className="flex h-11 shrink-0 items-center rounded-full bg-accent px-4 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover">
        Review →
      </Link>
      <button
        type="button"
        onClick={() => setCollapsed(true)}
        aria-label="Minimise campaign tray"
        className="flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-brand-on-surface-muted hover:bg-white/10 hover:text-brand-on-surface"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
    </div>
  );
}

/** "Add to which campaign?" — shown the first time someone adds media, so nothing lands in an unnamed draft. */
export function CampaignPicker() {
  const { picking } = useUi();
  const { campaigns, userId } = usePortalState();
  const [name, setName] = useState('');
  const [choice, setChoice] = useState<string>('new');
  const inputRef = useRef<HTMLInputElement>(null);
  const user = userId ? userById(userId) : undefined;
  const editable = user ? campaigns.filter((c) => visibleTo(c, user) && canEdit(c, user)) : [];

  useEffect(() => {
    if (!picking) return;
    setName('');
    setChoice('new');
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    const k = (e: KeyboardEvent) => e.key === 'Escape' && ui.pick(null);
    document.addEventListener('keydown', k);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', k);
    };
  }, [picking]);

  if (!picking || !user) return null;

  function confirm() {
    if (!picking) return;
    if (choice === 'new') {
      const title = name.trim();
      if (!title) {
        inputRef.current?.focus();
        return;
      }
      const id = portal.create({ name: title, items: [] });
      addWithToast(id, title, picking);
    } else {
      const c = editable.find((x) => x.id === choice);
      if (c) addWithToast(c.id, c.name, picking);
    }
    ui.pick(null);
  }

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-[rgba(6,12,28,0.45)] p-0 sm:items-center sm:p-4 print:hidden" onMouseDown={(e) => e.target === e.currentTarget && ui.pick(null)}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        onSubmit={(e) => {
          e.preventDefault();
          confirm();
        }}
        className="flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-bg p-5 shadow-4 sm:rounded-2xl"
      >
        <div className="flex flex-col gap-1">
          <h2 id="picker-title" className="text-display-sm text-fg">Add to a campaign</h2>
          <p className="text-body-sm text-fg-muted">{itemLabel({ ...picking, id: '' } as never)}</p>
        </div>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Campaign">
          <label className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-3 ${choice === 'new' ? 'border-accent bg-accent-subtle' : 'border-border-strong'}`}>
            <span className="flex items-center gap-2 text-body-md font-semibold text-fg">
              <input type="radio" name="campaign" checked={choice === 'new'} onChange={() => setChoice('new')} />
              New campaign
            </span>
            <input
              ref={inputRef}
              value={name}
              onFocus={() => setChoice('new')}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name it, e.g. Winter soup launch"
              aria-label="New campaign name"
              className="h-11 rounded-lg border border-border-strong bg-bg px-3 text-body-md text-fg outline-none focus:border-border-focus"
            />
          </label>
          {editable.map((c) => (
            <label key={c.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border p-3 ${choice === c.id ? 'border-accent bg-accent-subtle' : 'border-border-strong'}`}>
              <input type="radio" name="campaign" checked={choice === c.id} onChange={() => setChoice(c.id)} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body-md font-semibold text-fg">{c.name}</span>
                <span className="text-body-sm text-fg-muted">
                  {c.items.length} {c.items.length === 1 ? 'item' : 'items'}
                  {user.role === 'sales' ? ` · ${campaignClientName(c)}` : ''}
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => ui.pick(null)} className="h-11 rounded-full px-4 text-body-sm font-semibold text-fg-muted hover:text-fg">
            Cancel
          </button>
          <button type="submit" disabled={choice === 'new' && !name.trim()} className="h-11 rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover disabled:opacity-50">
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

/** "Added Canal Walk to Festive Feast · Undo" */
export function ToastHost() {
  const { toast } = useUi();
  const { userId, active, campaigns } = usePortalState();
  const pathname = usePathname();
  if (!toast) return null;
  // Sit above the tray when it's showing.
  const trayUp = Boolean(userId && campaigns.some((c) => c.id === active[userId])) && !pathname.startsWith('/portal/campaign');
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 z-toast flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-fg py-2 pl-4 pr-2 text-body-sm text-bg shadow-3 print:hidden ${trayUp ? 'bottom-28' : 'bottom-6'}`}
    >
      <span className="min-w-0 truncate">{toast.text}</span>
      {toast.undo ? (
        <button
          type="button"
          onClick={() => {
            toast.undo?.();
            ui.dismiss();
          }}
          className="h-9 shrink-0 rounded-full px-3 font-semibold text-bg underline-offset-2 hover:underline"
        >
          Undo
        </button>
      ) : null}
      {toast.href && !pathname.startsWith('/portal/campaign') ? (
        <Link href={toast.href} onClick={() => ui.dismiss()} className="flex h-9 shrink-0 items-center rounded-full bg-bg px-3 font-semibold text-fg">
          View
        </Link>
      ) : null}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function useOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onOut();
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [open, onOut, ref]);
}

/** What the other side did since you last looked. */
export function Notifications() {
  useLiveData(); // re-render when the deck's data arrives from the API
  const { campaigns, userId, seen } = usePortalState();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false), open);
  const user = userId ? userById(userId) : undefined;
  if (!user) return null;
  const last = seen[user.id] ?? '';
  const items = campaigns
    .filter((c) => visibleTo(c, user))
    .flatMap((c) => c.events.filter((e) => e.by !== user.id && userById(e.by)?.role !== user.role).map((e) => ({ e, c })))
    .sort((a, b) => b.e.at.localeCompare(a.e.at))
    .slice(0, 12);
  const unread = items.filter((x) => x.e.at > last).length;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unread) portal.markSeen();
        }}
        aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle hover:text-fg"
      >
        <BellIcon />
        {unread ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-fg px-1 text-[10px] font-bold text-bg">{unread}</span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-10 z-popover w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border bg-bg shadow-3">
          <div className="border-b border-border px-4 py-3 text-body-sm font-semibold text-fg">Notifications</div>
          {items.length ? (
            <ul className="max-h-96 overflow-y-auto">
              {items.map(({ e, c }) => (
                <li key={e.id}>
                  <Link
                    href={`/portal/campaign?id=${c.id}`}
                    onClick={() => setOpen(false)}
                    className={`flex gap-3 px-4 py-3 hover:bg-bg-subtle ${e.at > last ? 'bg-accent-subtle' : ''}`}
                  >
                    <Avatar user={userById(e.by)} size="sm" />
                    <span className="flex min-w-0 flex-col text-body-sm">
                      <span className="text-fg">
                        <strong className="font-semibold">{userById(e.by)?.name.split(' ')[0]}</strong>{' '}
                        {e.kind === 'message' ? `on ${c.name}: “${e.text.length > 70 ? `${e.text.slice(0, 70)}…` : e.text}”` : `${e.text.charAt(0).toLowerCase()}${e.text.slice(1)} · ${c.name}`}
                      </span>
                      <span className="text-fg-subtle">{timeAgo(e.at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-body-sm text-fg-muted">Nothing yet.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Signed-in account (sales or admin): pages, your account, sign out. */
export function PortalAccount() {
  const { user, ready } = usePortalUser();
  const { isAdmin, account, signOut, status } = useAdminSession();
  const sync = useCampaignSync();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false), open);
  if (!ready || status === 'checking') return null;
  if (!user) {
    return (
      <Link href="/sign-in" className="inline-flex h-8 items-center rounded-full bg-accent px-3.5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover">
        Sign in
      </Link>
    );
  }
  const links: [string, string][] = [
    ['/portal', 'Sales workspace'],
    ['/portal/new', 'New proposal'],
    ['/portal/clients', 'Client contacts'],
    ['/insights', 'Audience insights'],
    ['/portal/photos', 'Photo rights'],
  ];
  return (
    <div className="relative flex items-center gap-2" ref={ref}>
      <span role="status" className="text-[12px] text-fg-subtle">
        {sync.saving ? 'Saving…' : sync.error ? <span className="font-semibold text-danger-fg" title={sync.error}>Not saved — retrying</span> : null}
      </span>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-bg-subtle">
        <Avatar user={user} size="sm" />
        <span className="hidden text-body-sm font-medium text-fg md:inline">{user.name.split(' ')[0]}</span>
        {isAdmin ? <span className="hidden rounded-full bg-accent px-1.5 text-[10px] font-bold uppercase tracking-wide text-fg-on-accent sm:inline">Admin</span> : null}
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-10 z-popover w-64 overflow-hidden rounded-xl border border-border bg-bg p-2 shadow-3">
          <div className="px-2 py-2">
            <div className="truncate text-body-sm font-semibold text-fg">{user.name}</div>
            <div className="truncate text-body-sm text-fg-muted">{account?.email}</div>
            <div className="text-[12px] text-fg-subtle">{isAdmin ? 'Admin' : 'Primedia sales'}</div>
          </div>
          {links.map(([href, label]) => (
            <Link key={href} href={href} role="menuitem" onClick={() => setOpen(false)} className="block rounded-md px-2 py-1.5 text-body-sm text-fg hover:bg-bg-subtle">
              {label}
            </Link>
          ))}
          {isAdmin ? (
            <Link href="/admin/malls" role="menuitem" onClick={() => setOpen(false)} className="block rounded-md px-2 py-1.5 text-body-sm font-semibold text-fg hover:bg-bg-subtle">
              Site admin
            </Link>
          ) : null}
          <hr className="my-1 border-border" />
          <Link href="/account" role="menuitem" onClick={() => setOpen(false)} className="block rounded-md px-2 py-1.5 text-body-sm text-fg hover:bg-bg-subtle">
            Your account and password
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="block w-full rounded-md px-2 py-1.5 text-left text-body-sm text-fg hover:bg-bg-subtle"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Phone menu on portal pages: just the pages, big and tappable. */
export function PortalDrawer() {
  const { userId } = usePortalState();
  const pathname = usePathname();
  const user = userId ? userById(userId) : undefined;
  const links = user
    ? [
        ['/portal', user.role === 'sales' ? 'Workspace' : 'My campaigns'],
        ['/explorer', 'Media Explorer'],
        ['/insights', 'Insights'],
        ['/portal/new', 'New proposal'],
        ['/portal/clients', 'Client contacts'],
        ['/portal/photos', 'Photo rights'],
        ['/account', 'Your account'],
        ['/', 'Screen specs'],
      ]
    : [
        ['/sign-in', 'Sign in'],
        ['/', 'Screen specs'],
      ];
  return (
    <nav aria-label="Portal" className="flex flex-col gap-1 p-3">
      {links.map(([href, label]) => {
        const on = href === pathname;
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? 'page' : undefined}
            className={`flex h-12 items-center rounded-xl px-4 text-body-md font-semibold ${on ? 'bg-white/15 text-brand-on-surface' : 'text-brand-on-surface-muted hover:bg-white/10 hover:text-brand-on-surface'}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
