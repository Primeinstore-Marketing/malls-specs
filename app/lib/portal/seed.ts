import type { Client, PortalState, PortalUser } from './types';

/**
 * The portal's starting data: the sales account and an empty workspace.
 * Clients are added by an admin (Site admin → Clients, content "client:<id>");
 * campaigns are made by sales. No demo data.
 */

const BASE_CLIENTS: readonly Client[] = [];

/** Clients, with any an admin has added or edited (content "client:<id>"). */
export let CLIENTS: readonly Client[] = BASE_CLIENTS;

export function applyClients(edited: readonly (Client & { hidden?: boolean })[]) {
  const byId = new Map(edited.map((c) => [c.id, c]));
  CLIENTS = [...BASE_CLIENTS.map((c) => byId.get(c.id) ?? c), ...edited.filter((c) => !BASE_CLIENTS.some((b) => b.id === c.id))].filter(
    (c) => !(c as { hidden?: boolean }).hidden,
  );
}

/**
 * People who have signed in on this browser, so campaign activity can still
 * show who did what after they sign out. Sign-in itself is a real account
 * (email and password, through the API); see setSessionUser.
 */
const PEOPLE_KEY = 'malls-specs:people';
let people: PortalUser[] = [
  // The old demo account, so activity it left in this browser keeps a name.
  { id: 'u-lerato', name: 'Lerato Mokoena', email: '', role: 'sales', title: 'Account Manager, Primedia Malls' },
  // Approvals a client gives on their booking page are recorded by the server as "client".
  { id: 'client', name: 'Client', email: '', role: 'client', title: '' },
];
try {
  if (typeof window !== 'undefined') {
    const saved = JSON.parse(window.localStorage.getItem(PEOPLE_KEY) ?? '[]') as PortalUser[];
    people = [...people.filter((p) => !saved.some((x) => x.id === p.id)), ...saved];
  }
} catch {
  /* ignore */
}
export let USERS: readonly PortalUser[] = people;

/** Who's signed in (an admin or sales account), as the workspace sees them. */
export let SESSION_USER: PortalUser | null = null;
/** False until the sign-in check with the API has finished. */
export let SESSION_READY = false;
const sessionListeners = new Set<() => void>();
export const onSessionUser = (l: () => void) => {
  sessionListeners.add(l);
  return () => sessionListeners.delete(l);
};

/** Staff names from the server, so colleagues' activity on a campaign shows who did it. */
export function registerPeople(list: readonly { id: string; name: string; email: string; title: string }[]) {
  const known = new Set(list.map((p) => p.id));
  people = [...people.filter((p) => !known.has(p.id)), ...list.map((p) => ({ ...p, role: 'sales' as const }))];
  USERS = people;
}

export function setSessionUser(user: PortalUser | null, ready = true) {
  SESSION_USER = user;
  SESSION_READY = ready;
  if (user) {
    people = [...people.filter((p) => p.id !== user.id), user];
    USERS = people;
    try {
      window.localStorage.setItem(PEOPLE_KEY, JSON.stringify(people.filter((p) => p.id.startsWith('a-'))));
    } catch {
      /* ignore */
    }
  }
  for (const l of sessionListeners) l();
}

/** An empty workspace. */
export function seedState(): PortalState {
  return { version: 1, userId: null, campaigns: [], active: {}, seen: {} };
}
