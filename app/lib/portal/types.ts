import type { AudienceTarget } from '@/lib/insights';

export type Role = 'sales' | 'client';

export interface PortalUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  /** Clients only: the company they book for. */
  readonly clientId?: string;
  readonly title: string;
}

export interface Client {
  readonly id: string;
  readonly name: string;
  readonly industry: string;
  /** Who receives booking emails. */
  readonly contact: { readonly name: string; readonly email: string };
}

/**
 * Where a campaign is:
 * draft → (client) proposed → (sales) sent → approved → booked,
 * with changes and declined as side roads.
 */
export type CampaignStatus = 'draft' | 'proposed' | 'sent' | 'changes' | 'approved' | 'booked' | 'declined';

export type CampaignItem =
  | { readonly id: string; readonly kind: 'package'; readonly code: string }
  | { readonly id: string; readonly kind: 'screen'; readonly specId: string; readonly appMallId: string; readonly title: string };

export interface CampaignEvent {
  readonly id: string;
  readonly at: string;
  readonly by: string;
  readonly text: string;
  /** Messages are shown in the conversation; the rest in the activity log. */
  readonly kind: 'message' | 'status' | 'edit';
}

export interface Campaign {
  readonly id: string;
  readonly name: string;
  readonly clientId: string | null;
  /** Someone who isn't a client on the site yet: who the proposal goes to. */
  readonly prospect?: Prospect | null;
  readonly objective: string;
  readonly start: string | null;
  readonly end: string | null;
  readonly audience: AudienceTarget | null;
  readonly status: CampaignStatus;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly items: readonly CampaignItem[];
  readonly events: readonly CampaignEvent[];
  /** Secret in the client's booking link (/share?c=<id>&k=<key>). */
  readonly shareKey?: string;
  /** Short code for the booking link (/share?s=<code>). */
  readonly shareCode?: string;
  /** Changes the client asked for on their booking page, waiting for sales to apply or dismiss. */
  readonly clientChanges?: ClientChanges | null;
}

export interface ClientChanges {
  readonly items: readonly NewCampaignItem[];
  readonly start: string | null;
  readonly end: string | null;
  readonly note: string;
  readonly name: string;
  readonly at: string;
}

export interface Prospect {
  readonly company: string;
  readonly name: string;
  readonly email: string;
}

export interface PortalState {
  readonly version: 1;
  readonly userId: string | null;
  readonly campaigns: readonly Campaign[];
  /** Per user: the campaign "Add to campaign" puts things in. */
  readonly active: Readonly<Record<string, string>>;
  /** Per user: when they last opened their notifications. */
  readonly seen: Readonly<Record<string, string>>;
}

/** A campaign item before it has an id (Omit doesn't distribute over unions). */
export type NewCampaignItem = CampaignItem extends infer T ? (T extends CampaignItem ? Omit<T, 'id'> : never) : never;
