import { withBasePath } from '@/lib/basePath';
import { CLIENTS } from './seed';
import { campaignClientName, docKind, userById } from './logic';
import type { Campaign, CampaignItem, CampaignStatus, DocKind } from './types';

/**
 * The booking page a client opens from an email — no account needed. The
 * link is short: the campaign id and its secret share key
 * (`/share?c=<id>&k=<key>`); the page loads the campaign from the server, so
 * it always shows the latest version. (Older links packed the whole
 * campaign into the address, `/share?p=…`; those still open.)
 */

export interface SharedProposal {
  readonly v: 2;
  readonly id: string;
  readonly name: string;
  /** Proposal or site list (unset on older links: see docKind). */
  readonly kind?: DocKind;
  readonly client: string;
  readonly status: CampaignStatus;
  readonly start: string | null;
  readonly end: string | null;
  readonly objective: string;
  readonly items: readonly CampaignItem[];
  readonly from: { readonly name: string; readonly title: string; readonly email: string } | null;
  readonly at: string;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}

export function snapshot(c: Campaign, senderId: string): SharedProposal {
  const sender = userById(senderId);
  const sales = sender?.role === 'sales' ? sender : userById(c.events.find((e) => userById(e.by)?.role === 'sales')?.by ?? '');
  return {
    v: 2,
    id: c.id,
    name: c.name,
    kind: docKind(c),
    client: campaignClientName(c),
    status: c.status,
    start: c.start,
    end: c.end,
    objective: c.objective,
    items: c.items,
    from: sales ? { name: sales.name, title: sales.title, email: sales.email } : null,
    at: new Date().toISOString(),
  };
}

export function decodeProposal(code: string): SharedProposal | null {
  try {
    const p = JSON.parse(fromBase64Url(code)) as SharedProposal;
    return p && p.v === 2 && Array.isArray(p.items) ? p : null;
  } catch {
    return null;
  }
}

/** Link to a booking page for a proposal snapshot (also used for a client's edited copy). */
export function proposalUrl(p: SharedProposal, print = false): string {
  const path = withBasePath(`/share?p=${toBase64Url(JSON.stringify(p))}${print ? '&print=1' : ''}`);
  return typeof window === 'undefined' ? path : `${window.location.origin}${path}`;
}

/** Full link to the client's booking page (short, when the campaign has a share key). */
export function shareUrl(c: Campaign, senderId: string, print = false): string {
  if (!c.shareKey) return proposalUrl(snapshot(c, senderId), print);
  const query = c.shareCode ? `s=${c.shareCode}` : `c=${encodeURIComponent(c.id)}&k=${c.shareKey}`;
  const path = withBasePath(`/share?${query}${print ? '&print=1' : ''}`);
  return typeof window === 'undefined' ? path : `${window.location.origin}${path}`;
}

/** A short code for the booking link: 10 letters and digits (about 59 bits, too many to guess). */
export function newShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return [...crypto.getRandomValues(new Uint8Array(10))].map((b) => chars[b % chars.length]).join('');
}

/** A new secret for a campaign's booking link. */
export function newShareKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function clientContact(clientId: string | null) {
  // Contacts are only sent to signed-in admins; for everyone else they're blank.
  const contact = CLIENTS.find((x) => x.id === clientId)?.contact;
  return contact?.email ? contact : null;
}

/** Who the proposal emails go to: the client's contact, else the new contact on the campaign. */
export function campaignContact(c: Campaign): { name: string; email: string } | null {
  const known = clientContact(c.clientId);
  if (known) return known;
  const p = c.prospect;
  return p && (p.email.trim() || p.name.trim()) ? { name: p.name.trim() || p.company.trim(), email: p.email.trim() } : null;
}
