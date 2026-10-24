/**
 * Client for the Primedia Malls specs API (the Cloudflare Worker in `api/`).
 *
 * `NEXT_PUBLIC_API_URL` points at it — set in `.env.local` for development
 * and `.env.production` for the GitHub Pages build. When it's unset the
 * site still works, read-only, on its built-in data.
 */
import type { Asset, AssetRole, Specification } from '@data-model';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
export const apiConfigured = API_URL !== '';

const TOKEN_KEY = 'malls-specs:admin-token';

export interface AdminProfile {
  readonly email: string;
  readonly name: string;
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
}

/** Public URL of an uploaded file. */
export function fileUrl(storageKey: string): string {
  return `${API_URL}/files/${storageKey.split('/').map(encodeURIComponent).join('/')}`;
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
  if (!response.ok) throw new ApiError(response.status, body.error ?? `Request failed (${response.status}).`);
  return body;
}

export const api = {
  data: () => request<LiveDataResponse>('/data'),
  login: (email: string, password: string) =>
    request<{ token: string; expiresAt: string; admin: AdminProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }, true),
  me: () => request<{ admin: AdminProfile }>('/auth/me', {}, true),
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
  deleteAsset: (assetId: string) => request<{ ok: true }>(`/assets/${assetId}`, { method: 'DELETE' }, true),
};
