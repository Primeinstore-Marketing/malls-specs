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

export const USERS: readonly PortalUser[] = [
  { id: 'u-lerato', name: 'Lerato Mokoena', email: 'lerato.mokoena@primedia.demo', role: 'sales', title: 'Account Manager, Primedia Malls' },
];

/** An empty workspace. */
export function seedState(): PortalState {
  return { version: 1, userId: null, campaigns: [], active: {}, seen: {} };
}
