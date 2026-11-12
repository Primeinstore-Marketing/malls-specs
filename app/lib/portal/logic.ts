import { annualVisits, deckMall, deckMallForApp, packageByCode } from '@/lib/insights';
import type { DeckMall } from '@/lib/insights';
import { CLIENTS, USERS } from './seed';
import type { Campaign, CampaignItem, CampaignStatus, PortalUser } from './types';

export const STATUS_LABEL: Readonly<Record<CampaignStatus, string>> = {
  draft: 'Draft',
  proposed: 'Proposed by client',
  sent: 'Awaiting client approval',
  changes: 'Changes requested',
  approved: 'Approved — to confirm',
  booked: 'Booked',
  declined: 'Declined',
};

export const STATUS_TONE: Readonly<Record<CampaignStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'accent'>> = {
  draft: 'neutral',
  proposed: 'info',
  sent: 'warning',
  changes: 'danger',
  approved: 'accent',
  booked: 'success',
  declined: 'neutral',
};

/** What the client sees: their side of the same stage, in their words. */
export const CLIENT_STATUS_LABEL: Readonly<Record<CampaignStatus, string>> = {
  draft: 'Draft',
  proposed: 'Brief sent',
  sent: 'Proposal ready',
  changes: 'Changes with Primedia',
  approved: 'You approved',
  booked: 'Booked',
  declined: 'Declined',
};

export const CLIENT_STATUS_TONE: Readonly<Record<CampaignStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'accent'>> = {
  draft: 'neutral',
  proposed: 'info',
  sent: 'warning',
  changes: 'info',
  approved: 'accent',
  booked: 'success',
  declined: 'neutral',
};

export function statusLabel(status: CampaignStatus, role: 'sales' | 'client'): string {
  return role === 'client' ? CLIENT_STATUS_LABEL[status] : STATUS_LABEL[status];
}

/** Progress step names, per side. */
export const STEP_LABELS: Readonly<Record<'sales' | 'client', readonly string[]>> = {
  sales: ['Brief', 'Proposal sent'],
  client: ['Brief', 'Proposal ready'],
};

/** The road a campaign travels, for the progress steps. */
export const STEPS: readonly { readonly status: CampaignStatus; readonly label: string }[] = [
  { status: 'draft', label: 'Brief' },
  { status: 'sent', label: 'Proposal sent' },
  { status: 'approved', label: 'Client approved' },
  { status: 'booked', label: 'Booked' },
];

export function stepIndex(status: CampaignStatus): number {
  switch (status) {
    case 'draft':
    case 'proposed':
      return 0;
    case 'sent':
    case 'changes':
    case 'approved':
    case 'booked':
      return 1;
    default:
      return -1;
  }
}

export const userById = (id: string): PortalUser | undefined => USERS.find((u) => u.id === id);
/** Who a campaign is for: a client, or the new contact sales typed in. */
export const campaignClientName = (c: Pick<Campaign, 'clientId' | 'prospect'>): string =>
  c.clientId ? clientName(c.clientId) : c.prospect?.company?.trim() || c.prospect?.name?.trim() || 'No client yet';

export const clientName = (id: string | null): string => (id ? CLIENTS.find((c) => c.id === id)?.name ?? 'Unknown client' : 'No client yet');

/* ---------- Dates ---------- */

const DAY = 86_400_000;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10);
}

export function days(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1);
}

export function formatDate(iso: string | null, withYear = true): string {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

export function formatRange(start: string | null, end: string | null): string {
  if (!start || !end) return 'Dates to be set';
  return `${formatDate(start, false)} – ${formatDate(end)}`;
}

export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const d = Math.round(hours / 24);
  return d < 30 ? `${d} d ago` : formatDate(iso.slice(0, 10));
}

export type Phase = 'upcoming' | 'live' | 'completed';

/** Where a booked campaign is in its flight. */
export function phase(c: Campaign, today = todayIso()): Phase | null {
  if (c.status !== 'booked' || !c.start || !c.end) return null;
  if (today < c.start) return 'upcoming';
  if (today > c.end) return 'completed';
  return 'live';
}

/** 0–1 through the flight. */
export function progress(c: Campaign, today = todayIso()): number {
  const total = days(c.start, c.end);
  if (!total || !c.start) return 0;
  return Math.max(0, Math.min(1, days(c.start, today) / total));
}

/* ---------- Items ---------- */

export function itemKey(item: CampaignItem): string {
  return item.kind === 'package' ? `pkg:${item.code}` : item.kind === 'site' ? `site:${item.ref}` : `scr:${item.specId}`;
}

export function itemMall(item: CampaignItem): DeckMall | undefined {
  if (item.kind === 'package') return packageByCode(item.code)?.mall;
  return item.appMallId ? deckMallForApp(item.appMallId) : undefined;
}

export function itemLabel(item: CampaignItem): string {
  if (item.kind === 'screen') return item.title;
  if (item.kind === 'site') return [item.mall, item.location].filter(Boolean).join(' · ') || item.siteNo;
  return packageByCode(item.code)?.pkg.name ?? item.code;
}

export function itemDetail(item: CampaignItem): string {
  if (item.kind === 'screen') return 'Screen';
  if (item.kind === 'site') return item.siteNo ? `Site ${item.siteNo}` : 'Site';
  const found = packageByCode(item.code);
  if (!found) return item.code;
  const { pkg } = found;
  return `${pkg.format}${pkg.units ? ` × ${pkg.units}` : ''} · ${pkg.code}`;
}

/* ---------- Reach (indicative) ---------- */

export interface Reach {
  readonly malls: number;
  readonly visits: number;
  /** Visits by people who say they see advertising on digital screens in malls. */
  readonly digitalViewers: number;
  readonly units: number;
}

/**
 * Mall visits during the flight, each mall counted once however many
 * packages it carries: the deck's annual foot count × flight days / 365.
 * An indication to compare plans with, not an audited audience figure.
 */
export function reach(c: Pick<Campaign, 'items' | 'start' | 'end'>): Reach {
  const span = days(c.start, c.end) || 28;
  const malls = new Map<string, DeckMall>();
  let units = 0;
  for (const item of c.items) {
    const m = itemMall(item);
    if (m) malls.set(m.id, m);
    units += item.kind === 'package' ? packageByCode(item.code)?.pkg.units ?? 1 : 1;
  }
  let visits = 0;
  let digitalViewers = 0;
  for (const m of malls.values()) {
    const v = ((annualVisits(m) ?? 0) * span) / 365;
    visits += v;
    digitalViewers += v * ((m.media?.seenDigitalScreens ?? 40) / 100);
  }
  return { malls: malls.size, visits, digitalViewers, units };
}

/* ---------- Who may do what ---------- */

/** Sales can change a campaign at any stage; the email buttons always send its latest version. */
export function canEdit(c: Campaign, user: PortalUser): boolean {
  if (user.role === 'sales') return true;
  return c.status === 'draft' && c.clientId === user.clientId;
}

export function visibleTo(c: Campaign, user: PortalUser): boolean {
  if (user.role === 'sales') return c.status !== 'draft' || userById(c.createdBy)?.role === 'sales';
  return c.clientId === user.clientId && (c.status !== 'draft' || c.createdBy === user.id);
}

export { deckMall };
