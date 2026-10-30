/**
 * Primedia Malls specs API.
 *
 * Public:  GET  /data           — admin edits layered on the built-in catalogue
 * Auth:    POST /auth/login      { email, password } -> { token, expiresAt, admin }
 *          POST /auth/logout
 *          GET  /auth/me
 *          POST /auth/password   { current, next }
 * Files:   GET  /files/:key       — an uploaded picture or file (public)
 * Admin:   POST   /files?specId=&role=   raw body; X-Filename, Content-Type,
 *                                        X-Image-Width / X-Image-Height for images
 *          PATCH  /assets/:id    { alt?, caption? }
 *          DELETE /assets/:id
 *          PUT    /pins/:specId  { lng, lat, level? }
 *          DELETE /pins/:specId                       (back to the automatic position)
 *          PUT    /plan-pins/:specId { x, y }          (position on the mall's directory map, 0–1)
 *          DELETE /plan-pins/:specId
 *          PUT    /specs/:specId { data, mallId?, isNew? }
 *          DELETE /specs/:specId                      (delete a screen; built-ins are archived)
 *
 * The site is served from GitHub Pages, a different origin, so sessions use
 * a bearer token rather than a cookie (third-party cookies are blocked).
 */
import {
  PBKDF2_ITERATIONS,
  SESSION_DAYS,
  dummyPasswordCheck,
  hashPassword,
  hashToken,
  newSalt,
  newSessionToken,
  toBase64,
  verifyPassword,
} from './auth';
import { ALLOWED_TYPES, MAX_FILE_BYTES, kvFileStore, safeFilename } from './files';

export interface Env {
  DB: D1Database;
  FILES: KVNamespace;
  /** Comma-separated origins allowed to call the API. */
  ALLOWED_ORIGINS: string;
}

interface Admin {
  id: number;
  email: string;
  name: string;
}

const MAX_BODY_BYTES = 64 * 1024;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;
const LOCKOUT_MINUTES = 15;
const MIN_PASSWORD_LENGTH = 10;
const SPEC_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,99}$/;
const MALL_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** decodeURIComponent, but a malformed escape is the caller's error, not a crash. */
function safeDecode(value: string, status = 400): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new HttpError(status, status === 404 ? 'Not found.' : 'Badly encoded request.');
  }
}

function now(): string {
  return new Date().toISOString();
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowed = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim());
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Filename, X-Image-Width, X-Image-Height',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });
}

async function readJson<T>(request: Request): Promise<T> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'Request too large.');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'Request body must be JSON.');
  }
}

async function requireAdmin(request: Request, env: Env): Promise<Admin> {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Sign in to make changes.');
  const admin = await env.DB.prepare(
    `SELECT a.id, a.email, a.name FROM sessions s JOIN admins a ON a.id = s.admin_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND a.disabled = 0`,
  )
    .bind(await hashToken(token), now())
    .first<Admin>();
  if (!admin) throw new HttpError(401, 'Your session has expired. Sign in again.');
  return admin;
}

async function audit(env: Env, admin: Admin, action: string, target: string, detail?: unknown) {
  await env.DB.prepare('INSERT INTO audit_log (admin, action, target, detail) VALUES (?, ?, ?, ?)')
    .bind(admin.email, action, target, detail === undefined ? null : JSON.stringify(detail))
    .run();
}

// ── auth ──────────────────────────────────────────────────────────────

async function login(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ email?: unknown; password?: unknown }>(request);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) throw new HttpError(400, 'Enter your email and password.');

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const since = minutesAgo(LOCKOUT_MINUTES);
  await env.DB.prepare('DELETE FROM login_attempts WHERE at < ?').bind(since).run();
  const failures = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN key = ? THEN 1 ELSE 0 END) AS by_email,
       SUM(CASE WHEN key = ? THEN 1 ELSE 0 END) AS by_ip
     FROM login_attempts WHERE at >= ?`,
  )
    .bind(`email:${email}`, `ip:${ip}`, since)
    .first<{ by_email: number | null; by_ip: number | null }>();
  if ((failures?.by_email ?? 0) >= MAX_FAILURES_PER_EMAIL || (failures?.by_ip ?? 0) >= MAX_FAILURES_PER_IP) {
    throw new HttpError(429, `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`);
  }

  const record = await env.DB.prepare(
    'SELECT id, email, name, password_hash, password_salt, iterations, disabled FROM admins WHERE email = ?',
  )
    .bind(email)
    .first<Admin & { password_hash: string; password_salt: string; iterations: number; disabled: number }>();

  const valid = record
    ? await verifyPassword(password, record.password_hash, record.password_salt, record.iterations)
    : (await dummyPasswordCheck(password), false);

  if (!record || !valid || record.disabled) {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO login_attempts (key) VALUES (?)').bind(`email:${email}`),
      env.DB.prepare('INSERT INTO login_attempts (key) VALUES (?)').bind(`ip:${ip}`),
    ]);
    // Same message whether the email exists or not.
    throw new HttpError(401, 'That email and password don’t match an admin account.');
  }

  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)').bind(
      await hashToken(token),
      record.id,
      expiresAt,
    ),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now()),
    env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(`email:${email}`),
  ]);
  return json({ token, expiresAt, admin: { email: record.email, name: record.name } });
}

async function logout(request: Request, env: Env): Promise<Response> {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await hashToken(token)).run();
  return json({ ok: true });
}

async function changePassword(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  const body = await readJson<{ current?: unknown; next?: unknown }>(request);
  const current = typeof body.current === 'string' ? body.current : '';
  const next = typeof body.next === 'string' ? body.next : '';
  if (next.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Use at least ${MIN_PASSWORD_LENGTH} characters for the new password.`);
  }
  const record = await env.DB.prepare('SELECT password_hash, password_salt, iterations FROM admins WHERE id = ?')
    .bind(admin.id)
    .first<{ password_hash: string; password_salt: string; iterations: number }>();
  if (!record || !(await verifyPassword(current, record.password_hash, record.password_salt, record.iterations))) {
    throw new HttpError(400, 'Your current password is incorrect.');
  }
  const salt = newSalt();
  const hash = await hashPassword(next, salt, PBKDF2_ITERATIONS);
  // Changing the password signs out every other session.
  const header = request.headers.get('Authorization') ?? '';
  const keep = await hashToken(header.slice(7).trim());
  await env.DB.batch([
    env.DB.prepare('UPDATE admins SET password_hash = ?, password_salt = ?, iterations = ? WHERE id = ?').bind(
      toBase64(hash),
      toBase64(salt),
      PBKDF2_ITERATIONS,
      admin.id,
    ),
    env.DB.prepare('DELETE FROM sessions WHERE admin_id = ? AND token_hash != ?').bind(admin.id, keep),
  ]);
  await audit(env, admin, 'password.change', admin.email);
  return json({ ok: true });
}

// ── data ──────────────────────────────────────────────────────────────

async function getData(env: Env): Promise<Response> {
  const [specs, pins, assets, planPins] = await env.DB.batch([
    env.DB.prepare('SELECT id, mall_id, is_new, data, updated_at FROM specs'),
    env.DB.prepare('SELECT spec_id, lng, lat, level, updated_at FROM pins'),
    env.DB.prepare('SELECT * FROM assets ORDER BY created_at'),
    env.DB.prepare('SELECT spec_id, x, y, updated_at FROM plan_pins'),
  ]);
  return json({
    specs: (specs.results as { id: string; mall_id: string | null; is_new: number; data: string; updated_at: string }[]).map(
      (row) => ({ id: row.id, mallId: row.mall_id, isNew: row.is_new === 1, data: JSON.parse(row.data), updatedAt: row.updated_at }),
    ),
    pins: (pins.results as { spec_id: string; lng: number; lat: number; level: string | null; updated_at: string }[]).map(
      (row) => ({ specId: row.spec_id, lng: row.lng, lat: row.lat, level: row.level, updatedAt: row.updated_at }),
    ),
    assets: (assets.results as AssetRow[]).map(assetJson),
    planPins: (planPins.results as { spec_id: string; x: number; y: number; updated_at: string }[]).map((row) => ({
      specId: row.spec_id,
      x: row.x,
      y: row.y,
      updatedAt: row.updated_at,
    })),
  });
}

async function putPin(request: Request, env: Env, specId: string): Promise<Response> {
  const admin = await requireAdmin(request, env);
  const body = await readJson<{ lng?: unknown; lat?: unknown; level?: unknown }>(request);
  const lng = Number(body.lng);
  const lat = Number(body.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
    throw new HttpError(400, 'A position needs a valid longitude and latitude.');
  }
  const level = typeof body.level === 'string' && body.level.trim() ? body.level.trim().slice(0, 40) : null;
  await env.DB.prepare(
    `INSERT INTO pins (spec_id, lng, lat, level, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(spec_id) DO UPDATE SET lng = excluded.lng, lat = excluded.lat, level = excluded.level,
       updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  )
    .bind(specId, lng, lat, level, now(), admin.email)
    .run();
  await audit(env, admin, 'pin.set', specId, { lng, lat, level });
  return json({ ok: true });
}

async function deletePin(request: Request, env: Env, specId: string): Promise<Response> {
  const admin = await requireAdmin(request, env);
  await env.DB.prepare('DELETE FROM pins WHERE spec_id = ?').bind(specId).run();
  await audit(env, admin, 'pin.reset', specId);
  return json({ ok: true });
}

async function putPlanPin(request: Request, env: Env, specId: string): Promise<Response> {
  const admin = await requireAdmin(request, env);
  const body = await readJson<{ x?: unknown; y?: unknown }>(request);
  const x = Number(body.x);
  const y = Number(body.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
    throw new HttpError(400, 'A mall-map position needs x and y between 0 and 1.');
  }
  await env.DB.prepare(
    `INSERT INTO plan_pins (spec_id, x, y, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(spec_id) DO UPDATE SET x = excluded.x, y = excluded.y,
       updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  )
    .bind(specId, x, y, now(), admin.email)
    .run();
  await audit(env, admin, 'plan-pin.set', specId, { x, y });
  return json({ ok: true });
}

async function deletePlanPin(request: Request, env: Env, specId: string): Promise<Response> {
  const admin = await requireAdmin(request, env);
  await env.DB.prepare('DELETE FROM plan_pins WHERE spec_id = ?').bind(specId).run();
  await audit(env, admin, 'plan-pin.reset', specId);
  return json({ ok: true });
}

/** Light structural check — enough to keep junk out without duplicating the app's data model. */
function validateSpec(specId: string, data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Spec data must be an object.');
  const spec = data as Record<string, unknown>;
  if (spec.id !== specId) throw new HttpError(400, 'Spec id doesn’t match the URL.');
  if (typeof spec.title !== 'string' || !spec.title.trim() || spec.title.length > 200) {
    throw new HttpError(400, 'A screen needs a title (up to 200 characters).');
  }
  for (const key of ['metadata', 'blocks', 'tagIds'] as const) {
    if (!Array.isArray(spec[key])) throw new HttpError(400, `Spec ${key} must be a list.`);
  }
  return spec;
}

async function putSpec(request: Request, env: Env, specId: string): Promise<Response> {
  const admin = await requireAdmin(request, env);
  const body = await readJson<{ data?: unknown; mallId?: unknown; isNew?: unknown }>(request);
  const spec = validateSpec(specId, body.data);
  const mallId = typeof body.mallId === 'string' && MALL_ID_PATTERN.test(body.mallId) ? body.mallId : null;
  const existing = await env.DB.prepare('SELECT is_new FROM specs WHERE id = ?').bind(specId).first<{ is_new: number }>();
  const isNew = existing ? existing.is_new : body.isNew === true ? 1 : 0;
  if (isNew && !mallId) throw new HttpError(400, 'Choose which mall the new screen is in.');
  const stored = { ...spec, updatedAt: now() };
  await env.DB.prepare(
    `INSERT INTO specs (id, mall_id, data, is_new, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET mall_id = excluded.mall_id, data = excluded.data,
       updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
  )
    .bind(specId, mallId, JSON.stringify(stored), isNew, now(), admin.email)
    .run();
  await audit(env, admin, existing ? 'spec.update' : isNew ? 'spec.create' : 'spec.edit', specId, { title: spec.title });
  return json({ ok: true, data: stored });
}

async function deleteSpec(request: Request, env: Env, specId: string): Promise<Response> {
  const admin = await requireAdmin(request, env);
  const record = await env.DB.prepare('SELECT is_new FROM specs WHERE id = ?').bind(specId).first<{ is_new: number }>();
  if (!record) throw new HttpError(404, 'That screen doesn’t exist.');

  if (record.is_new !== 1) {
    // A built-in screen also lives in the site's code as a fallback, so
    // removing its record would bring it straight back. It's archived
    // instead: hidden everywhere, with its files and position kept.
    await env.DB.prepare(
      `UPDATE specs SET data = json_set(data, '$.archivedAt', ?, '$.archivedBy', ?), updated_at = ?, updated_by = ?
       WHERE id = ?`,
    )
      .bind(now(), admin.email, now(), admin.email, specId)
      .run();
    await audit(env, admin, 'spec.delete', specId, { archived: true });
    return json({ ok: true });
  }

  // A screen added on the site takes its position and files with it.
  const files = await env.DB.prepare('SELECT storage_key FROM assets WHERE spec_id = ?').bind(specId).all<{ storage_key: string }>();
  const store = kvFileStore(env.FILES);
  await Promise.all(files.results.map((file) => store.remove(file.storage_key)));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM assets WHERE spec_id = ?').bind(specId),
    env.DB.prepare('DELETE FROM pins WHERE spec_id = ?').bind(specId),
    env.DB.prepare('DELETE FROM plan_pins WHERE spec_id = ?').bind(specId),
    env.DB.prepare('DELETE FROM specs WHERE id = ?').bind(specId),
  ]);
  await audit(env, admin, 'spec.delete', specId);
  return json({ ok: true });
}

// ── files ─────────────────────────────────────────────────────────────

interface AssetRow {
  id: string;
  spec_id: string;
  role: string;
  kind: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  alt: string;
  caption: string;
  width: number | null;
  height: number | null;
  created_at: string;
  created_by: string;
}

/** Shaped like the app's `Asset` record, plus the spec it belongs to. */
function assetJson(row: AssetRow) {
  return {
    id: row.id,
    specId: row.spec_id,
    role: row.role,
    kind: row.kind,
    filename: row.filename,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    alt: row.alt,
    caption: row.caption,
    order: 0,
    image: row.width != null && row.height != null
      ? { width: row.width, height: row.height, placeholder: null, focalX: null, focalY: null }
      : null,
    durationSeconds: null,
    uploadedAt: row.created_at,
    version: null,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.created_at,
    updatedBy: row.created_by,
  };
}

async function uploadFile(request: Request, env: Env, url: URL): Promise<Response> {
  const admin = await requireAdmin(request, env);
  const specId = url.searchParams.get('specId') ?? '';
  const role = url.searchParams.get('role') ?? '';
  if (!SPEC_ID_PATTERN.test(specId)) throw new HttpError(400, 'Invalid screen id.');
  if (!['media', 'download', 'attachment'].includes(role)) throw new HttpError(400, 'Invalid file role.');

  const mimeType = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  const kind = ALLOWED_TYPES[mimeType];
  if (!kind) throw new HttpError(415, 'That file type isn’t supported. Use JPG, PNG, WebP, GIF, SVG, MP4, PDF, ZIP, AI/EPS, PSD, AEP or DWG/DXF.');
  if (role === 'media' && kind !== 'image' && kind !== 'video') {
    throw new HttpError(400, 'Pictures must be images or videos — add documents under Downloads or Attachments.');
  }
  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > MAX_FILE_BYTES) throw new HttpError(413, 'Files can be up to 25 MB.');

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) throw new HttpError(400, 'The file is empty.');
  if (body.byteLength > MAX_FILE_BYTES) throw new HttpError(413, 'Files can be up to 25 MB.');

  const filename = safeFilename(safeDecode(request.headers.get('X-Filename') ?? 'file'));
  const dimension = (header: string) => {
    const value = Number(request.headers.get(header));
    return Number.isInteger(value) && value > 0 && value < 100_000 ? value : null;
  };
  const width = kind === 'image' ? dimension('X-Image-Width') : null;
  const height = kind === 'image' ? dimension('X-Image-Height') : null;

  const id = `asset-${crypto.randomUUID()}`;
  const storageKey = `${specId}/${id.slice(6, 14)}-${filename}`;
  await kvFileStore(env.FILES).put(storageKey, body, mimeType, filename);
  const row: AssetRow = {
    id,
    spec_id: specId,
    role,
    kind,
    filename,
    mime_type: mimeType,
    size_bytes: body.byteLength,
    storage_key: storageKey,
    alt: '',
    caption: '',
    width,
    height,
    created_at: now(),
    created_by: admin.email,
  };
  await env.DB.prepare(
    `INSERT INTO assets (id, spec_id, role, kind, filename, mime_type, size_bytes, storage_key, alt, caption, width, height, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(row.id, row.spec_id, row.role, row.kind, row.filename, row.mime_type, row.size_bytes, row.storage_key, '', '', width, height, row.created_at, row.created_by)
    .run();
  await audit(env, admin, 'file.upload', specId, { id, filename, role, sizeBytes: body.byteLength });
  return json({ asset: assetJson(row) });
}

async function serveFile(env: Env, key: string): Promise<Response> {
  if (!key || key.length > 512) throw new HttpError(404, 'File not found.');
  const file = await kvFileStore(env.FILES).get(key);
  if (!file) throw new HttpError(404, 'File not found.');
  const inline = file.mimeType.startsWith('image/') || file.mimeType.startsWith('video/') || file.mimeType === 'application/pdf';
  return new Response(file.body, {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${file.filename}"`,
      // Keys are unique per upload, so a file never changes under its URL.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // Uploaded SVGs can contain script; never let a file run anything.
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; media-src 'self'; sandbox",
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function updateAsset(request: Request, env: Env, id: string): Promise<Response> {
  const admin = await requireAdmin(request, env);
  const body = await readJson<{ alt?: unknown; caption?: unknown }>(request);
  const alt = typeof body.alt === 'string' ? body.alt.slice(0, 300) : null;
  const caption = typeof body.caption === 'string' ? body.caption.slice(0, 500) : null;
  const result = await env.DB.prepare(
    'UPDATE assets SET alt = COALESCE(?, alt), caption = COALESCE(?, caption) WHERE id = ?',
  )
    .bind(alt, caption, id)
    .run();
  if (!result.meta.changes) throw new HttpError(404, 'File not found.');
  await audit(env, admin, 'file.update', id);
  return json({ ok: true });
}

async function deleteAsset(request: Request, env: Env, id: string): Promise<Response> {
  const admin = await requireAdmin(request, env);
  const row = await env.DB.prepare('SELECT storage_key, spec_id, filename FROM assets WHERE id = ?')
    .bind(id)
    .first<{ storage_key: string; spec_id: string; filename: string }>();
  if (!row) throw new HttpError(404, 'File not found.');
  await kvFileStore(env.FILES).remove(row.storage_key);
  await env.DB.prepare('DELETE FROM assets WHERE id = ?').bind(id).run();
  await audit(env, admin, 'file.delete', row.spec_id, { id, filename: row.filename });
  return json({ ok: true });
}

// ── router ────────────────────────────────────────────────────────────

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const [, resource, rawId] = url.pathname.split('/');
  const id = rawId ? safeDecode(rawId, 404) : '';
  const method = request.method;

  if (resource === 'health' && method === 'GET') return json({ ok: true });
  if (resource === 'files') {
    if (method === 'POST' && !id) return uploadFile(request, env, url);
    // Storage keys contain a slash, so take everything after /files/.
    if (method === 'GET') return serveFile(env, safeDecode(url.pathname.slice('/files/'.length), 404));
  }
  if (resource === 'assets' && /^asset-[0-9a-f-]{36}$/.test(id)) {
    if (method === 'PATCH') return updateAsset(request, env, id);
    if (method === 'DELETE') return deleteAsset(request, env, id);
  }
  if (resource === 'data' && method === 'GET') return getData(env);

  if (resource === 'auth') {
    if (id === 'login' && method === 'POST') return login(request, env);
    if (id === 'logout' && method === 'POST') return logout(request, env);
    if (id === 'me' && method === 'GET') return json({ admin: await requireAdmin(request, env) });
    if (id === 'password' && method === 'POST') return changePassword(request, env);
  }

  if ((resource === 'pins' || resource === 'specs' || resource === 'plan-pins') && id) {
    if (!SPEC_ID_PATTERN.test(id)) throw new HttpError(400, 'Invalid screen id.');
    if (resource === 'plan-pins' && method === 'PUT') return putPlanPin(request, env, id);
    if (resource === 'plan-pins' && method === 'DELETE') return deletePlanPin(request, env, id);
    if (resource === 'pins' && method === 'PUT') return putPin(request, env, id);
    if (resource === 'pins' && method === 'DELETE') return deletePin(request, env, id);
    if (resource === 'specs' && method === 'PUT') return putSpec(request, env, id);
    if (resource === 'specs' && method === 'DELETE') return deleteSpec(request, env, id);
  }

  throw new HttpError(404, 'Not found.');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // Writes must come from the site itself, not another origin.
    if (request.method !== 'GET' && request.headers.get('Origin') && !cors['Access-Control-Allow-Origin']) {
      return json({ error: 'Origin not allowed.' }, 403);
    }

    try {
      const response = await route(request, env);
      for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
      return response;
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status, cors);
      console.error(error);
      return json({ error: 'Something went wrong on the server.' }, 500, cors);
    }
  },
} satisfies ExportedHandler<Env>;
