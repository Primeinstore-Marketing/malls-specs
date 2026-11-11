'use client';

import { useSyncExternalStore } from 'react';
import { seedState, USERS } from './seed';
import { userById } from './logic';
import type { Campaign, CampaignEvent, CampaignItem, CampaignStatus, NewCampaignItem, PortalState, PortalUser } from './types';

/**
 * The sales and client workspace: who's signed in, campaigns, and their
 * conversations. Kept in this browser's localStorage for now, so the whole
 * flow runs locally without the API. Every change goes through the actions
 * below, which is the seam to move it onto the Worker later.
 */

const KEY = 'malls-specs:portal:v1';
const listeners = new Set<() => void>();
let state: PortalState | null = null;
const SERVER: PortalState = { version: 1, userId: null, campaigns: [], active: {}, seen: {} };

function load(): PortalState {
  if (state) return state;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as PortalState) : null;
    state = parsed?.version === 1 ? parsed : seedState();
  } catch {
    state = seedState();
  }
  return state;
}

function save(next: PortalState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private windows: keep working in memory.
  }
  for (const l of listeners) l();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return;
    state = null;
    for (const l of listeners) l();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The whole workspace; empty during the server render and first paint. */
export function usePortalState(): PortalState & { ready: boolean } {
  const s = useSyncExternalStore(subscribe, load, () => SERVER);
  return s === SERVER ? { ...SERVER, ready: false } : { ...s, ready: true };
}

/**
 * Who's signed in to the portal. Sales only for now: clients use the link
 * their account manager emails them, so an old client session counts as
 * signed out. (Client accounts come back with real sign-in.)
 */
export function usePortalUser(): { user: PortalUser | null; ready: boolean } {
  const s = useSyncExternalStore(subscribe, load, () => SERVER);
  const user = s.userId ? userById(s.userId) ?? null : null;
  return { user: user?.role === 'sales' ? user : null, ready: s !== SERVER };
}

/* ---------- Actions ---------- */

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

function current(): { s: PortalState; user: PortalUser } {
  const s = load();
  const user = s.userId ? userById(s.userId) : undefined;
  if (!user) throw new Error('Not signed in');
  return { s, user };
}

function updateCampaign(id: string, change: (c: Campaign, user: PortalUser) => Partial<Campaign>, event?: Omit<CampaignEvent, 'id' | 'at' | 'by'>) {
  const { s, user } = current();
  save({
    ...s,
    campaigns: s.campaigns.map((c) =>
      c.id === id
        ? {
            ...c,
            ...change(c, user),
            updatedAt: now(),
            events: event ? [...c.events, { ...event, id: uid('e'), at: now(), by: user.id }] : c.events,
          }
        : c,
    ),
  });
}

export const portal = {
  signIn(userId: string) {
    if (!USERS.some((u) => u.id === userId)) return;
    save({ ...load(), userId });
  },
  signOut() {
    save({ ...load(), userId: null });
  },
  resetDemo() {
    const userId = load().userId;
    save({ ...seedState(), userId });
  },

  create(fields: Partial<Campaign> = {}): string {
    const { s, user } = current();
    const id = uid('c');
    const c: Campaign = {
      id,
      name: 'Untitled campaign',
      clientId: user.role === 'client' ? user.clientId ?? null : null,
      objective: '',
      start: null,
      end: null,
      audience: null,
      status: 'draft',
      createdBy: user.id,
      createdAt: now(),
      updatedAt: now(),
      items: [],
      events: [{ id: uid('e'), at: now(), by: user.id, text: 'Created the campaign', kind: 'status' }],
      ...fields,
    };
    save({ ...s, campaigns: [c, ...s.campaigns], active: { ...s.active, [user.id]: id } });
    return id;
  },

  setActive(id: string | null) {
    const { s, user } = current();
    const active = { ...s.active };
    if (id) active[user.id] = id;
    else delete active[user.id];
    save({ ...s, active });
  },

  edit(id: string, fields: Partial<Pick<Campaign, 'name' | 'clientId' | 'prospect' | 'objective' | 'start' | 'end' | 'audience'>>) {
    updateCampaign(id, () => fields);
  },

  /** Adds to the user's active campaign, starting one if needed. Returns its id. */
  add(item: NewCampaignItem): string {
    const { s, user } = current();
    let id = s.active[user.id];
    const c = s.campaigns.find((x) => x.id === id);
    const editable = c && (user.role === 'sales' ? ['draft', 'proposed', 'changes'].includes(c.status) : c.status === 'draft');
    if (!editable) id = portal.create();
    const full = { ...item, id: uid('i') } as CampaignItem;
    updateCampaign(id, (x) => ({ items: [...x.items, full] }));
    return id;
  },

  /** Adds to a given campaign and makes it the one "Add" goes to. Returns the new item's id. */
  addTo(campaignId: string, item: NewCampaignItem): string {
    const { s, user } = current();
    const full = { ...item, id: uid('i') } as CampaignItem;
    if (s.active[user.id] !== campaignId) save({ ...s, active: { ...s.active, [user.id]: campaignId } });
    updateCampaign(campaignId, (x) => ({ items: [...x.items, full] }));
    return full.id;
  },

  /** Applies changes a client sent from their booking page: new screens and dates. */
  applyClientChanges(id: string, changes: { items: readonly NewCampaignItem[]; start: string | null; end: string | null }, note: string) {
    updateCampaign(id, () => ({ items: changes.items.map((i) => ({ ...i, id: uid('i') }) as CampaignItem), start: changes.start, end: changes.end }));
    portal.move(id, 'changes', note);
  },

  remove(id: string, itemId: string) {
    updateCampaign(id, (c) => ({ items: c.items.filter((i) => i.id !== itemId) }));
  },

  message(id: string, text: string) {
    if (!text.trim()) return;
    updateCampaign(id, () => ({}), { kind: 'message', text: text.trim() });
  },

  move(id: string, status: CampaignStatus, note?: string) {
    const text: Record<CampaignStatus, string> = {
      draft: 'Moved back to draft',
      proposed: 'Sent a campaign brief to Primedia',
      sent: 'Sent the proposal to the client',
      changes: 'Asked for changes',
      approved: 'Approved the proposal',
      booked: 'Confirmed the booking',
      declined: 'Declined the proposal',
    };
    updateCampaign(id, () => ({ status }), { kind: 'status', text: text[status] });
    if (note?.trim()) portal.message(id, note);
    if (status !== 'draft') {
      const s = load();
      const user = s.userId;
      if (user && s.active[user] === id) portal.setActive(null);
    }
  },

  duplicate(id: string): string {
    const { s } = current();
    const c = s.campaigns.find((x) => x.id === id);
    if (!c) return id;
    return portal.create({
      name: `${c.name} (again)`,
      clientId: c.clientId,
      objective: c.objective,
      audience: c.audience,
      items: c.items.map((i) => ({ ...i, id: uid('i') })),
    });
  },

  markSeen() {
    const { s, user } = current();
    save({ ...s, seen: { ...s.seen, [user.id]: now() } });
  },
};

export type { Campaign, CampaignItem, PortalUser };
