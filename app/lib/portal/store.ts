'use client';

import { useSyncExternalStore } from 'react';
import { api, ApiError } from '@/lib/api';
import { SESSION_READY, SESSION_USER, onSessionUser, registerPeople } from './seed';
import { ui } from './ui-state';
import type { Campaign, CampaignEvent, CampaignItem, CampaignStatus, NewCampaignItem, PortalState, PortalUser } from './types';

/**
 * The sales workspace: campaigns and their conversations, saved on the
 * server (API /campaigns) under the signed-in account. Sales see their own
 * campaigns; admins see everyone's. Who's signed in comes from the account
 * session (seed.ts).
 *
 * Changes show at once and are saved in the background, one at a time per
 * campaign. Each save sends the revision it was based on; if the campaign
 * changed somewhere else meanwhile (another device, or the client approving
 * it), the server's version wins and the person is told. The list refreshes
 * every minute and when the tab comes back into view.
 *
 * Only per-person conveniences stay in this browser: which campaign "Add"
 * goes to, and when notifications were last opened.
 */

/** Where campaigns were kept before they moved to the server; uploaded once, then cleared. */
const LEGACY_KEY = 'malls-specs:portal:v2';
const PREFS_KEY = 'malls-specs:portal:prefs';
const listeners = new Set<() => void>();
const EMPTY: PortalState = { version: 1, userId: null, campaigns: [], active: {}, seen: {} };
let state: PortalState = EMPTY;

/** Server revision of each campaign, and who owns it. */
const revs = new Map<string, number>();
const owners = new Map<string, string>();
/** Campaigns with changes not yet saved, and the save chain for each. */
const dirty = new Set<string>();
const chains = new Map<string, Promise<void>>();
type Sync = 'idle' | 'loading' | 'ready' | 'error';
let sync: Sync = 'idle';
let loadedFor: string | null = null;
let saving = 0;
let saveError: string | null = null;

function notify() {
  for (const l of listeners) l();
}

function load(): PortalState {
  return state;
}

function readPrefs(): Pick<PortalState, 'active' | 'seen'> {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    const p = raw ? (JSON.parse(raw) as Partial<PortalState>) : null;
    return { active: p?.active ?? {}, seen: p?.seen ?? {} };
  } catch {
    return { active: {}, seen: {} };
  }
}

/** Updates what's shown; campaigns listed in `changed` are then saved to the server. */
function save(next: PortalState, changed: readonly string[] = []) {
  state = next;
  if (next.active !== EMPTY.active || next.seen !== EMPTY.seen) {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({ active: next.active, seen: next.seen }));
    } catch {
      /* private windows: keep working in memory */
    }
  }
  for (const id of changed) push(id);
  notify();
}

/** Saves a campaign's latest version, after any save already under way for it. */
function push(id: string) {
  dirty.add(id);
  const run = async () => {
    if (!dirty.has(id)) return;
    const c = state.campaigns.find((x) => x.id === id);
    if (!c) return void dirty.delete(id);
    dirty.delete(id);
    saving += 1;
    notify();
    try {
      const r = await api.putCampaign(c, revs.get(id) ?? 0);
      revs.set(id, r.rev);
      owners.set(id, r.ownerName);
      saveError = null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.body && typeof e.body === 'object' && 'latest' in e.body) {
        const latest = (e.body as { latest: ServerCampaign | null }).latest;
        if (latest) adopt([latest], { partial: true, force: true });
        ui.toast({ text: `“${c.name}” was changed somewhere else (another device, or the client). You’re now seeing the latest version.` });
      } else {
        dirty.add(id);
        saveError = e instanceof Error ? e.message : 'Couldn’t save.';
        ui.toast({ text: `Couldn’t save “${c.name}”. It will try again: ${saveError}` });
        setTimeout(() => push(id), 15_000);
      }
    } finally {
      saving -= 1;
      notify();
    }
  };
  const next = (chains.get(id) ?? Promise.resolve()).then(run, run);
  chains.set(id, next);
}

type ServerCampaign = { campaign: Campaign; rev: number; ownerName: string };

/**
 * Takes campaigns from the server. Local changes not yet saved are kept,
 * unless `force` (the server's version won a conflict). On a full refresh a
 * campaign missing from the server is dropped, unless it's new and not saved
 * yet.
 */
function adopt(list: readonly ServerCampaign[], { partial = false, force = false } = {}) {
  const server = new Map(list.map((x) => [x.campaign.id, x]));
  for (const x of list) {
    if (force) dirty.delete(x.campaign.id);
    if (dirty.has(x.campaign.id)) continue;
    revs.set(x.campaign.id, x.rev);
    owners.set(x.campaign.id, x.ownerName);
  }
  const out: Campaign[] = [];
  for (const c of state.campaigns) {
    const x = server.get(c.id);
    if (x) out.push(dirty.has(c.id) ? c : x.campaign);
    else if (partial || dirty.has(c.id) || !revs.has(c.id)) out.push(c);
    server.delete(c.id);
  }
  for (const x of server.values()) out.push(x.campaign);
  state = { ...state, campaigns: out };
  notify();
}

/** Campaigns saved in this browser before they lived on the server: upload them once. */
async function uploadLegacy() {
  let legacy: readonly Campaign[] = [];
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    legacy = raw ? ((JSON.parse(raw) as PortalState).campaigns ?? []) : [];
  } catch {
    return;
  }
  if (!legacy.length) return;
  let failed = 0;
  for (const c of legacy) {
    try {
      await api.putCampaign(c, 0);
    } catch (e) {
      // 409: it's on the server already (uploaded from here before). Anything else: try again next time.
      if (!(e instanceof ApiError && (e.status === 409 || e.status === 403))) failed += 1;
    }
  }
  if (!failed) {
    try {
      window.localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* ignore */
    }
    ui.toast({ text: `Moved ${legacy.length} ${legacy.length === 1 ? 'campaign' : 'campaigns'} from this browser to your account.` });
  }
}

async function refresh() {
  if (!SESSION_USER) return;
  const who = SESSION_USER.id;
  try {
    const { campaigns, people } = await api.campaigns();
    if (SESSION_USER?.id !== who) return;
    registerPeople(people ?? []);
    adopt(campaigns);
    sync = 'ready';
  } catch {
    if (sync !== 'ready') sync = 'error';
  }
  notify();
}

/** Loads the signed-in person's campaigns; clears them on sign-out. */
async function start() {
  const who = SESSION_USER?.id ?? null;
  if (who === loadedFor) return;
  loadedFor = who;
  revs.clear();
  owners.clear();
  dirty.clear();
  chains.clear();
  if (!who) {
    state = EMPTY;
    sync = 'idle';
    notify();
    return;
  }
  state = { ...EMPTY, ...readPrefs() };
  sync = 'loading';
  notify();
  await uploadLegacy();
  await refresh();
}

if (typeof window !== 'undefined') {
  onSessionUser(() => void start());
  setInterval(() => {
    if (SESSION_USER && document.visibilityState === 'visible') void refresh();
  }, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (SESSION_USER && document.visibilityState === 'visible') void refresh();
  });
  // Changes still being saved when someone closes the tab.
  window.addEventListener('beforeunload', (e) => {
    if (dirty.size || saving) e.preventDefault();
  });
}

/** Reloads campaigns from the server now (e.g. a "Refresh" button). */
export const refreshCampaigns = () => refresh();

/** Saving status, for a small indicator. */
export function useCampaignSync(): { loading: boolean; saving: boolean; error: string | null; failedToLoad: boolean } {
  const x = useSyncExternalStore(subscribe, snapshot, () => SERVER_SNAP);
  return { loading: x.sync === 'loading', saving: x.saving > 0, error: x.saveError, failedToLoad: x.sync === 'error' };
}

/** Who owns a campaign (shown to admins, who see everyone's). */
export const campaignOwner = (id: string) => owners.get(id) ?? null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  const off = onSessionUser(listener);
  return () => {
    listeners.delete(listener);
    off();
  };
}

/** The workspace plus who's signed in and the sync state, as one snapshot that changes when any does. */
type Snap = { s: PortalState; userId: string | null; ready: boolean; sync: Sync; saving: number; saveError: string | null };
let snap: Snap | null = null;
function snapshot(): Snap {
  const userId = SESSION_USER?.id ?? null;
  // Ready once we know who's signed in and, if someone is, their campaigns have loaded (or failed to).
  const ready = SESSION_READY && (!userId || sync === 'ready' || sync === 'error');
  if (!snap || snap.s !== state || snap.userId !== userId || snap.ready !== ready || snap.sync !== sync || snap.saving !== saving || snap.saveError !== saveError) {
    snap = { s: state, userId, ready, sync, saving, saveError };
  }
  return snap;
}
const SERVER_SNAP: Snap = { s: EMPTY, userId: null, ready: false, sync: 'idle', saving: 0, saveError: null };

/** The whole workspace; empty during the server render and first paint. userId is the signed-in account. */
export function usePortalState(): PortalState & { ready: boolean } {
  const x = useSyncExternalStore(subscribe, snapshot, () => SERVER_SNAP);
  return x === SERVER_SNAP ? { ...EMPTY, ready: false } : { ...x.s, userId: x.userId, ready: x.ready };
}

/**
 * Who's signed in to the workspace: any Primedia account (sales or admin),
 * signed in with email and password. Clients don't sign in: they use the
 * link their account manager emails them.
 */
export function usePortalUser(): { user: PortalUser | null; ready: boolean } {
  const x = useSyncExternalStore(subscribe, snapshot, () => SERVER_SNAP);
  return { user: x.userId ? SESSION_USER : null, ready: x.ready };
}

/* ---------- Actions ---------- */

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

function current(): { s: PortalState; user: PortalUser } {
  const s = load();
  const user = SESSION_USER;
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
  }, [id]);
}

export const portal = {
  /** A campaign as saved right now (e.g. straight after creating it). */
  get(id: string): Campaign | undefined {
    return load().campaigns.find((c) => c.id === id);
  },


  create(fields: Partial<Campaign> = {}): string {
    const { s, user } = current();
    // A caller may choose the id (so an email link can point at the campaign before it exists).
    const id = fields.id ?? uid('c');
    const c: Campaign = {
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
      id,
    };
    save({ ...s, campaigns: [c, ...s.campaigns], active: { ...s.active, [user.id]: id } }, [id]);
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
    const editable = c && (user.role === 'sales' ? true : c.status === 'draft');
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
      const user = SESSION_USER?.id;
      if (user && load().active[user] === id) portal.setActive(null);
    }
  },

  duplicate(id: string): string {
    const { s } = current();
    const c = s.campaigns.find((x) => x.id === id);
    if (!c) return id;
    return portal.create({
      name: `${c.name} (again)`,
      clientId: c.clientId,
      prospect: c.prospect ?? null,
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
