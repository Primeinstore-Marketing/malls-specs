/**
 * Client for the Primedia Malls specs API (the Cloudflare Worker in `api/`).
 *
 * `NEXT_PUBLIC_API_URL` points at it — set in `.env.local` for development
 * and `.env.production` for the GitHub Pages build. When it's unset the
 * site still works, read-only, on its built-in data.
 */
import type { Campaign, NewCampaignItem } from '@/lib/portal/types';
import type { SharedProposal } from '@/lib/portal/share';
import type { Asset, AssetRole, Specification } from '@data-model';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
export const apiConfigured = API_URL !== '';

const TOKEN_KEY = 'malls-specs:admin-token';

export type AccountRole = 'admin' | 'sales';

/** A signed-in account: an admin (Site admin and everything else) or sales. */
export interface AdminProfile {
  readonly id: number;
  readonly email: string;
  readonly name: string;
  readonly title: string;
  readonly role: AccountRole;
  /** Signed in with a temporary password: must choose their own first. */
  readonly mustChangePassword: boolean;
}
export type AccountProfile = AdminProfile;

/** A campaign the AI drafted from a client's brief (see api/src/brief.ts). */
export interface BriefDraft {
  readonly summary: string;
  readonly name: string;
  readonly client: { readonly company: string; readonly contactName: string; readonly email: string };
  readonly start: string | null;
  readonly end: string | null;
  readonly objective: string;
  readonly items: readonly { readonly key: string; readonly reason: string }[];
  readonly noteForClient: string;
  readonly missing: readonly string[];
}

/** An account as admins see it in Site admin → Accounts. */
export interface ManagedAccount extends AdminProfile {
  readonly disabled: boolean;
  readonly createdAt: string;
  /** Asked for an account from the sign-in page; waiting for an admin. */
  readonly pending: boolean;
  /** When they asked for a password reset, if they have. */
  readonly resetRequestedAt: string | null;
}

export interface LiveSpecRecord {
  readonly id: string;
  readonly mallId: string | null;
  readonly isNew: boolean;
  readonly data: Specification;
  readonly updatedAt: string;
}

export interface LivePinRecord {
  readonly specId: string;
  readonly lng: number;
  readonly lat: number;
  readonly level: string | null;
  readonly updatedAt: string;
}

/** An uploaded picture or file, and the spec it belongs to. */
export type LiveAssetRecord = Asset & { readonly specId: string };

export interface LivePlanPinRecord {
  readonly specId: string;
  readonly x: number;
  readonly y: number;
  readonly updatedAt: string;
}

export interface LiveDataResponse {
  readonly specs: readonly LiveSpecRecord[];
  readonly pins: readonly LivePinRecord[];
  readonly assets?: readonly LiveAssetRecord[];
  readonly planPins?: readonly LivePlanPinRecord[];
  /** Site content admins edit: "mall:<id>", "client:<id>", "photo-rights". */
  readonly content?: readonly LiveContentRecord[];
}

export interface ProposalApproval {
  readonly campaignId: string;
  readonly name: string;
  readonly note: string;
  readonly screens: number;
  readonly at: string;
}

export interface LiveContentRecord {
  readonly key: string;
  readonly data: unknown;
  readonly updatedAt: string;
}

/** Public URL of an uploaded file. */
export function fileUrl(storageKey: string): string {
  return `${API_URL}/files/${storageKey.split('/').map(encodeURIComponent).join('/')}`;
}

/** URL that saves the file rather than opening it (browsers ignore `download` on other origins). */
export function downloadUrl(storageKey: string): string {
  return `${fileUrl(storageKey)}?download=1`;
}

/** Reads an image's pixel size in the browser, so the server can record it. */
export function imageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/') || file.type === 'image/vnd.adobe.photoshop') return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

/** Browsers often leave design files untyped; fill in from the extension. */
export function mimeTypeOf(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const byExtension: Record<string, string> = {
    ai: 'application/postscript',
    eps: 'application/postscript',
    psd: 'image/vnd.adobe.photoshop',
    aep: 'application/vnd.adobe.aftereffects.project',
    dwg: 'image/vnd.dwg',
    dxf: 'application/dxf',
    zip: 'application/zip',
  };
  return byExtension[extension] ?? 'application/octet-stream';
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The response body, e.g. the latest version on a 409. */
    readonly body?: unknown,
  ) {
    super(message);
  }
}

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode etc. — the session just won't survive a reload.
  }
}

async function request<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  if (!apiConfigured) throw new ApiError(0, 'Editing isn’t connected on this copy of the site.');
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (auth) {
    const token = getStoredToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Couldn’t reach the server. Check your connection and try again.');
  }
  const body = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new ApiError(response.status, body.error ?? `Request failed (${response.status}).`, body);
  return body;
}

export const api = {
  data: () => request<LiveDataResponse>('/data', {}, true),
  /** A client approves a proposal on its booking page (no account). */
  approveProposal: (campaignId: string, fields: { name: string; note: string; screens: number; k?: string }) =>
    request<{ ok: true; approval: ProposalApproval }>('/approvals', { method: 'POST', body: JSON.stringify({ campaignId, ...fields }) }),
  /** The client's booking page by its short code; also returns the id's share key. */
  proposalByCode: (code: string) =>
    request<{ proposal: SharedProposal; changesPending: boolean; key: string }>(`/proposals?s=${encodeURIComponent(code)}`),
  /** The client's booking page, by campaign id and share key. */
  proposal: (id: string, key: string) =>
    request<{ proposal: SharedProposal; changesPending: boolean }>(`/proposals/${encodeURIComponent(id)}?k=${encodeURIComponent(key)}`),
  /** A client sends the changes they made on their booking page. */
  sendProposalChanges: (id: string, key: string, changes: { items: readonly NewCampaignItem[]; start: string | null; end: string | null; note: string; name: string }) =>
    request<{ ok: true }>(`/proposals/${encodeURIComponent(id)}/changes?k=${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify(changes) }),
  approvals: (campaignIds: readonly string[]) =>
    request<{ approvals: ProposalApproval[] }>(`/approvals?ids=${campaignIds.map(encodeURIComponent).join(',')}`, {}, true),
  login: (email: string, password: string) =>
    request<{ token: string; expiresAt: string; account: AdminProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }, true),
  me: () => request<{ account: AdminProfile }>('/auth/me', {}, true),
  updateMe: (fields: { name: string; title: string }) =>
    request<{ account: AdminProfile }>('/auth/me', { method: 'PATCH', body: JSON.stringify(fields) }, true),
  accounts: () => request<{ accounts: ManagedAccount[] }>('/accounts', {}, true),
  /** Drafts a campaign from a client's brief with Workers AI (signed-in accounts). */
  briefDraft: (body: { filename: string; text?: string; file?: { name: string; mediaType: string; data: string }; inventory: string; today: string }) =>
    request<{ draft: BriefDraft; model: string; truncated: boolean }>('/ai/brief', { method: 'POST', body: JSON.stringify(body) }, true),
  /** Your campaigns (admins: everyone's), with their revision. */
  campaigns: () => request<{ campaigns: { campaign: Campaign; rev: number; ownerId: number; ownerName: string; updatedAt: string }[]; people: { id: string; name: string; email: string; title: string }[] }>('/campaigns', {}, true),
  /** Saves a campaign; `rev` is the revision it was based on (0 for new). 409 carries `latest`. */
  putCampaign: (campaign: Campaign, rev: number) =>
    request<{ rev: number; ownerId: number; ownerName: string; updatedAt: string }>(
      `/campaigns/${encodeURIComponent(campaign.id)}`,
      { method: 'PUT', body: JSON.stringify({ campaign, rev }) },
      true,
    ),
  createAccount: (fields: { email: string; name: string; title: string; role: AccountRole; password: string }) =>
    request<{ ok: true }>('/accounts', { method: 'POST', body: JSON.stringify(fields) }, true),
  updateAccount: (id: number, fields: Partial<{ name: string; title: string; role: AccountRole; disabled: boolean; password: string; approve: boolean }>) =>
    request<{ ok: true }>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(fields) }, true),
  declineAccount: (id: number) => request<{ ok: true }>(`/accounts/${id}`, { method: 'DELETE' }, true),
  /** A salesperson asks for an account with their own password (an admin approves it). */
  signup: (fields: { email: string; name: string; title: string; password: string }) =>
    request<{ ok: true }>('/auth/signup', { method: 'POST', body: JSON.stringify(fields) }),
  /** Asks admins for a password reset. */
  forgotPassword: (email: string) => request<{ ok: true }>('/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) }),
  changePassword: (current: string, next: string) =>
    request<{ ok: true }>('/auth/password', { method: 'POST', body: JSON.stringify({ current, next }) }, true),
  putPin: (specId: string, lng: number, lat: number, level?: string | null) =>
    request<{ ok: true }>(
      `/pins/${encodeURIComponent(specId)}`,
      { method: 'PUT', body: JSON.stringify({ lng, lat, level }) },
      true,
    ),
  deletePin: (specId: string) => request<{ ok: true }>(`/pins/${encodeURIComponent(specId)}`, { method: 'DELETE' }, true),
  putPlanPin: (specId: string, x: number, y: number) =>
    request<{ ok: true }>(`/plan-pins/${encodeURIComponent(specId)}`, { method: 'PUT', body: JSON.stringify({ x, y }) }, true),
  deletePlanPin: (specId: string) =>
    request<{ ok: true }>(`/plan-pins/${encodeURIComponent(specId)}`, { method: 'DELETE' }, true),
  putSpec: (spec: Specification, options: { mallId?: string | null; isNew?: boolean } = {}) =>
    request<{ ok: true; data: Specification }>(
      `/specs/${encodeURIComponent(spec.id)}`,
      { method: 'PUT', body: JSON.stringify({ data: spec, mallId: options.mallId ?? null, isNew: options.isNew ?? false }) },
      true,
    ),
  deleteSpec: (specId: string) =>
    request<{ ok: true }>(`/specs/${encodeURIComponent(specId)}`, { method: 'DELETE' }, true),
  uploadFile: async (specId: string, role: AssetRole, file: File) => {
    const dimensions = await imageDimensions(file);
    const headers: Record<string, string> = {
      'Content-Type': mimeTypeOf(file),
      'X-Filename': encodeURIComponent(file.name),
    };
    if (dimensions) {
      headers['X-Image-Width'] = String(dimensions.width);
      headers['X-Image-Height'] = String(dimensions.height);
    }
    return request<{ asset: LiveAssetRecord }>(
      `/files?specId=${encodeURIComponent(specId)}&role=${role}`,
      { method: 'POST', body: file, headers },
      true,
    );
  },
  updateAsset: (assetId: string, changes: { alt?: string; caption?: string }) =>
    request<{ ok: true }>(`/assets/${assetId}`, { method: 'PATCH', body: JSON.stringify(changes) }, true),
  /** Save the order of a screen's files (any role); the first picture is the main one. */
  reorderAssets: (specId: string, ids: readonly string[]) =>
    request<{ ok: true }>('/assets/order', { method: 'POST', body: JSON.stringify({ specId, ids }) }, true),
  deleteAsset: (assetId: string) => request<{ ok: true }>(`/assets/${assetId}`, { method: 'DELETE' }, true),
  putContent: (key: string, data: unknown) =>
    request<{ ok: true }>(`/content/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ data }) }, true),
  deleteContent: (key: string) => request<{ ok: true }>(`/content/${encodeURIComponent(key)}`, { method: 'DELETE' }, true),
};
