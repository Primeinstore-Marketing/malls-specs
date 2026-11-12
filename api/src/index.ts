/**
 * Primedia Malls specs API.
 *
 * Public:  GET  /data           — admin edits layered on the built-in catalogue
 *                                   (client contacts only with an admin token)
 *          GET  /proposals?s=code        — the client's booking page by its short code (also returns the key)
 *          GET  /proposals/:id?k=key     — the same, by campaign id and share key
 *          POST /proposals/:id/changes?k=key { items, start, end, note?, name? }  (client asks for changes)
 *          POST /approvals    { campaignId, k?, name?, note?, screens? }  (a client approves on the booking page)
 *          GET  /approvals?ids=a,b  — approvals for those campaigns
 *                                   (names and notes only with an admin token)
 * Auth:    POST  /auth/login     { email, password } -> { token, expiresAt, account }
 *          POST  /auth/logout
 *          GET   /auth/me
 *          PATCH /auth/me        { name?, title? }        (your own profile)
 *          POST  /auth/password  { current, next }
 *          POST  /auth/signup    { email, name, title, password }  (company email only; waits for an admin)
 *          POST  /auth/forgot    { email }                         (asks admins for a reset)
 *          Accounts are admins or sales. Sales may also edit client:* content.
 * Campaigns: GET /campaigns (yours; admins: everyone's) · PUT /campaigns/:id { campaign, rev }
 *          (rev = the revision you edited; 409 with the latest if someone saved since)
 * AI:      POST /ai/brief { filename, text? | file?: { name, mediaType, data }, inventory, today } -> { draft, truncated }  (signed in; Workers AI)
 * Accounts (admins): GET /accounts · POST /accounts { email, name, title, role, password }
 *          PATCH /accounts/:id { name?, title?, role?, disabled?, password?, approve? } · DELETE /accounts/:id (a request not yet approved)
 * Files:   GET  /files/:key       — an uploaded picture or file (public)
 * Admin:   POST   /files?specId=&role=   raw body; X-Filename, Content-Type,
 *                                        X-Image-Width / X-Image-Height for images
 *          PATCH  /assets/:id    { alt?, caption? }
 *          DELETE /assets/:id
 *          POST   /assets/order  { specId, ids }     (the order of a screen's files)
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
import { draftFromBrief, fileToText } from './brief';

export interface Env {
  DB: D1Database;
  FILES: KVNamespace;
  /** Comma-separated origins allowed to call the API. */
  ALLOWED_ORIGINS: string;
  /** Comma-separated email domains that may ask for an account, e.g. "primedia.co.za,primeinstore.co.za". */
  SIGNUP_DOMAINS?: string;
  /** Workers AI (free daily allowance): reads briefs and drafts campaigns. */
  AI: Ai;
}

type Role = 'admin' | 'sales';

/** A signed-in account: an admin or a salesperson. */
interface Admin {
  id: number;
  email: string;
  name: string;
  title: string;
  role: Role;
  must_change_password: number;
}

const ROLES: readonly Role[] = ['admin', 'sales'];
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** What the site gets about an account. */
function profile(a: Admin) {
  return { id: a.id, email: a.email, name: a.name, title: a.title, role: a.role, mustChangePassword: a.must_change_password === 1 };
}

const MAX_BODY_BYTES = 64 * 1024;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;
const LOCKOUT_MINUTES = 15;
const MIN_PASSWORD_LENGTH = 10;
const SPEC_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,99}$/;
const MALL_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** Content keys: a kind, then an id — "mall:canal-walk", "client:rialto", "photo-rights". */
/** Campaign ids from the portal, e.g. "c-festive" or "c-k3x9a2b". */
const CAMPAIGN_ID_PATTERN = /^c-[a-z0-9-]{2,60}$/;
const MAX_APPROVALS_PER_IP_HOUR = 30;
/** A campaign with a long conversation can outgrow the usual body limit. */
const MAX_CAMPAIGN_BYTES = 512 * 1024;
const CONTENT_KEY_PATTERN = /^[a-z][a-z-]{1,31}(:[a-z0-9][a-z0-9-]{0,99})?$/;

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

async function readJson<T>(request: Request, limit = MAX_BODY_BYTES): Promise<T> {
  const text = await request.text();
  if (text.length > limit) throw new HttpError(413, 'Request too large.');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'Request body must be JSON.');
  }
}

/**
 * Any signed-in account (admin or sales). An account still on a temporary
 * password can only change it (`allowTemporary`) until it has.
 */
async function requireAccount(request: Request, env: Env, allowTemporary = false): Promise<Admin> {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Sign in to make changes.');
  const admin = await env.DB.prepare(
    `SELECT a.id, a.email, a.name, a.title, a.role, a.must_change_password FROM sessions s JOIN admins a ON a.id = s.admin_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND a.disabled = 0 AND a.pending = 0`,
  )
    .bind(await hashToken(token), now())
    .first<Admin>();
  if (!admin) throw new HttpError(401, 'Your session has expired. Sign in again.');
  if (admin.must_change_password && !allowTemporary) throw new HttpError(403, 'Choose your own password first.');
  return admin;
}

/** A signed-in admin; sales accounts get 403. */
async function requireAdmin(request: Request, env: Env): Promise<Admin> {
  const account = await requireAccount(request, env);
  if (account.role !== 'admin') throw new HttpError(403, 'Only admins can do this.');
  return account;
}

/** The signed-in account (admin or sales), or null for everyone else (no error). */
async function accountOrNull(request: Request, env: Env): Promise<Admin | null> {
  try {
    return await requireAccount(request, env);
  } catch {
    return null;
  }
}

/**
 * What the public may see of a content record. Client records hold a
 * contact person's name and email: only signed-in accounts get those.
 */
function publicContent(key: string, data: unknown): unknown {
  if (key.startsWith('client:') && data && typeof data === 'object') {
    const { contact: _contact, ...rest } = data as Record<string, unknown>;
    return { ...rest, contact: { name: '', email: '' } };
  }
  return data;
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
    'SELECT id, email, name, title, role, must_change_password, password_hash, password_salt, iterations, disabled, pending FROM admins WHERE email = ?',
  )
    .bind(email)
    .first<Admin & { password_hash: string; password_salt: string; iterations: number; disabled: number; pending: number }>();

  const valid = record
    ? await verifyPassword(password, record.password_hash, record.password_salt, record.iterations)
    : (await dummyPasswordCheck(password), false);

  if (record && valid && record.pending) {
    throw new HttpError(403, 'Your account is waiting for an admin to approve it. Ask a Primedia Malls admin to approve it in Site admin → Accounts.');
  }
  if (!record || !valid || record.disabled) {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO login_attempts (key) VALUES (?)').bind(`email:${email}`),
      env.DB.prepare('INSERT INTO login_attempts (key) VALUES (?)').bind(`ip:${ip}`),
    ]);
    // Same message whether the email exists or not.
    throw new HttpError(401, 'That email and password don’t match an account.');
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
  return json({ token, expiresAt, account: profile(record), admin: profile(record) });
}

async function logout(request: Request, env: Env): Promise<Response> {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await hashToken(token)).run();
  return json({ ok: true });
}

async function changePassword(request: Request, env: Env): Promise<Response> {
  const admin = await requireAccount(request, env, true);
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
    env.DB.prepare('UPDATE admins SET password_hash = ?, password_salt = ?, iterations = ?, must_change_password = 0 WHERE id = ?').bind(
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

const MAX_SIGNUPS_PER_IP_HOUR = 5;

/** A salesperson creates their own account with their own password. It waits for an admin to approve it. */
async function signup(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ email?: unknown; name?: unknown; title?: unknown; password?: unknown }>(request);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : '';
  if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, 'Enter your work email address.');
  const domains = (env.SIGNUP_DOMAINS ?? '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  const domain = email.split('@')[1] ?? '';
  if (!domains.includes(domain)) {
    throw new HttpError(400, `Use your work email (${domains.map((d) => '@' + d).join(' or ') || 'a Primedia address'}). Anyone else: ask a Primedia Malls admin to add you.`);
  }
  if (!name) throw new HttpError(400, 'Enter your name.');
  const password = checkPassword(body.password);

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key = ? AND at >= ?').bind(`signup:${ip}`, minutesAgo(60)).first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_SIGNUPS_PER_IP_HOUR) throw new HttpError(429, 'Too many requests from this connection. Try again later.');
  await env.DB.prepare('INSERT INTO login_attempts (key, at) VALUES (?, ?)').bind(`signup:${ip}`, now()).run();

  const exists = await env.DB.prepare('SELECT pending FROM admins WHERE email = ?').bind(email).first<{ pending: number }>();
  if (exists) {
    throw new HttpError(409, exists.pending ? 'You’ve already asked for an account. An admin needs to approve it.' : 'There’s already an account for this email. Sign in, or use “Forgot your password?”.');
  }
  const salt = newSalt();
  const hash = await hashPassword(password, salt, PBKDF2_ITERATIONS);
  await env.DB.prepare(
    'INSERT INTO admins (email, name, title, role, password_hash, password_salt, iterations, must_change_password, pending) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)',
  )
    .bind(email, name, title, 'sales', toBase64(hash), toBase64(salt), PBKDF2_ITERATIONS)
    .run();
  await env.DB.prepare('INSERT INTO audit_log (admin, action, target) VALUES (?, ?, ?)').bind(email, 'account.signup', email).run();
  return json({ ok: true }, 201);
}

/** Someone who forgot their password asks for a reset; admins see it in Accounts. Same answer whether the email exists or not. */
async function forgotPassword(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ email?: unknown }>(request);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, 'Enter your work email address.');
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key = ? AND at >= ?').bind(`forgot:${ip}`, minutesAgo(60)).first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_SIGNUPS_PER_IP_HOUR) throw new HttpError(429, 'Too many requests from this connection. Try again later.');
  await env.DB.batch([
    env.DB.prepare('INSERT INTO login_attempts (key, at) VALUES (?, ?)').bind(`forgot:${ip}`, now()),
    env.DB.prepare('UPDATE admins SET reset_requested_at = ? WHERE email = ? AND disabled = 0 AND pending = 0').bind(now(), email),
  ]);
  return json({ ok: true });
}

async function updateMe(request: Request, env: Env): Promise<Response> {
  const me = await requireAccount(request, env);
  const body = await readJson<{ name?: unknown; title?: unknown }>(request);
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : me.name;
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : me.title;
  if (!name) throw new HttpError(400, 'Enter your name.');
  await env.DB.prepare('UPDATE admins SET name = ?, title = ? WHERE id = ?').bind(name, title, me.id).run();
  await audit(env, me, 'account.profile', me.email);
  return json({ account: profile({ ...me, name, title }) });
}

// ── accounts (admins manage everyone's) ───────────────────────────────

type AccountRow = Admin & { disabled: number; created_at: string; pending: number; reset_requested_at: string | null };

async function listAccounts(request: Request, env: Env): Promise<Response> {
  await requireAdmin(request, env);
  const rows = await env.DB.prepare(
    'SELECT id, email, name, title, role, must_change_password, disabled, created_at, pending, reset_requested_at FROM admins ORDER BY pending DESC, role, name COLLATE NOCASE',
  ).all<AccountRow>();
  return json({
    accounts: rows.results.map((r) => ({ ...profile(r), disabled: r.disabled === 1, createdAt: r.created_at, pending: r.pending === 1, resetRequestedAt: r.reset_requested_at })),
  });
}

function checkPassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`);
  }
  return password;
}

async function createAccount(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  const body = await readJson<{ email?: unknown; name?: unknown; title?: unknown; role?: unknown; password?: unknown }>(request);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : '';
  const role = ROLES.includes(body.role as Role) ? (body.role as Role) : 'sales';
  if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  if (!name) throw new HttpError(400, 'Enter their name.');
  const password = checkPassword(body.password);
  const exists = await env.DB.prepare('SELECT id FROM admins WHERE email = ?').bind(email).first();
  if (exists) throw new HttpError(409, 'There’s already an account with that email.');
  const salt = newSalt();
  const hash = await hashPassword(password, salt, PBKDF2_ITERATIONS);
  // The person must choose their own password when they first sign in.
  await env.DB.prepare(
    'INSERT INTO admins (email, name, title, role, password_hash, password_salt, iterations, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
  )
    .bind(email, name, title, role, toBase64(hash), toBase64(salt), PBKDF2_ITERATIONS)
    .run();
  await audit(env, admin, 'account.create', email, { role });
  return json({ ok: true }, 201);
}

async function updateAccount(request: Request, env: Env, rawId: string): Promise<Response> {
  const admin = await requireAdmin(request, env);
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'Not found.');
  const target = await env.DB.prepare('SELECT id, email, name, title, role, must_change_password, disabled, created_at, pending, reset_requested_at FROM admins WHERE id = ?')
    .bind(id)
    .first<AccountRow>();
  if (!target) throw new HttpError(404, 'No such account.');
  const body = await readJson<{ name?: unknown; title?: unknown; role?: unknown; disabled?: unknown; password?: unknown; approve?: unknown }>(request);
  const self = id === admin.id;
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 100) : target.name;
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : target.title;
  const role = ROLES.includes(body.role as Role) ? (body.role as Role) : target.role;
  const disabled = typeof body.disabled === 'boolean' ? body.disabled : target.disabled === 1;
  if (self && (role !== 'admin' || disabled)) throw new HttpError(400, 'You can’t remove your own admin access. Ask another admin.');
  const statements = [
    env.DB.prepare('UPDATE admins SET name = ?, title = ?, role = ?, disabled = ? WHERE id = ?').bind(name, title, role, disabled ? 1 : 0, id),
  ];
  if (body.approve === true) statements.push(env.DB.prepare('UPDATE admins SET pending = 0 WHERE id = ?').bind(id));
  if (body.password !== undefined) {
    const salt = newSalt();
    const hash = await hashPassword(checkPassword(body.password), salt, PBKDF2_ITERATIONS);
    statements.push(
      env.DB.prepare('UPDATE admins SET password_hash = ?, password_salt = ?, iterations = ?, must_change_password = 1, reset_requested_at = NULL WHERE id = ?').bind(
        toBase64(hash),
        toBase64(salt),
        PBKDF2_ITERATIONS,
        id,
      ),
    );
  }
  // A reset password, a switched-off account or a lost role signs them out everywhere.
  if (body.password !== undefined || disabled || role !== target.role) {
    statements.push(env.DB.prepare('DELETE FROM sessions WHERE admin_id = ?').bind(id));
  }
  await env.DB.batch(statements);
  await audit(env, admin, 'account.update', target.email, { role, disabled, passwordReset: body.password !== undefined, approved: body.approve === true });
  return json({ ok: true });
}

/** Turns down a request for an account (only one that hasn't been approved). */
async function declineAccount(request: Request, env: Env, rawId: string): Promise<Response> {
  const admin = await requireAdmin(request, env);
  const id = Number(rawId);
  const target = Number.isInteger(id) ? await env.DB.prepare('SELECT email, pending FROM admins WHERE id = ?').bind(id).first<{ email: string; pending: number }>() : null;
  if (!target) throw new HttpError(404, 'No such account.');
  if (!target.pending) throw new HttpError(400, 'Only a request that hasn’t been approved can be removed. Switch the account off instead.');
  await env.DB.prepare('DELETE FROM admins WHERE id = ?').bind(id).run();
  await audit(env, admin, 'account.decline', target.email);
  return json({ ok: true });
}

// ── proposals (the client's booking page; public, with the share key) ──

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CHANGES_PER_IP_HOUR = 30;

type StoredCampaign = {
  id: string; name: string; status: string; start: string | null; end: string | null; objective?: string;
  clientId?: string | null; prospect?: { company?: string; name?: string } | null; items: unknown[];
  events: { at: string; by: string; text: string; kind: string; id: string }[]; shareKey?: string; updatedAt?: string;
  clientChanges?: unknown;
};

/** The campaign behind a booking link, if the key matches. Same answer for a wrong key and no campaign. */
async function sharedCampaign(env: Env, id: string, key: string) {
  if (!CAMPAIGN_ID_PATTERN.test(id) || key.length < 16) throw new HttpError(404, 'This booking link isn’t valid. Ask your account manager to send it again.');
  const row = await env.DB.prepare(`${CAMPAIGN_SELECT} WHERE c.id = ?`).bind(id).first<CampaignRow & { owner_title?: string }>();
  const c = row ? (JSON.parse(row.data) as StoredCampaign) : null;
  if (!row || !c || !c.shareKey || c.shareKey !== key) throw new HttpError(404, 'This booking link isn’t valid. Ask your account manager to send it again.');
  return { row, c };
}

const SHARE_CODE_PATTERN = /^[A-Za-z0-9]{8,16}$/;

/** A short booking link (/share?s=<code>): find the campaign, then answer as for its id and key. */
async function getProposalByCode(url: URL, env: Env): Promise<Response> {
  const code = url.searchParams.get('s') ?? '';
  const row = SHARE_CODE_PATTERN.test(code)
    ? await env.DB.prepare('SELECT id, data FROM campaigns WHERE share_code = ?').bind(code).first<{ id: string; data: string }>()
    : null;
  const key = row ? (JSON.parse(row.data) as { shareKey?: string }).shareKey ?? '' : '';
  if (!row || !key) throw new HttpError(404, 'This booking link isn’t valid. Ask your account manager to send it again.');
  return getProposal(url, env, row.id, key);
}

async function getProposal(url: URL, env: Env, id: string, knownKey?: string): Promise<Response> {
  const key = knownKey ?? url.searchParams.get('k') ?? '';
  const { row, c } = await sharedCampaign(env, id, key);
  const owner = await env.DB.prepare('SELECT name, title, email FROM admins WHERE id = ?').bind(row.owner_id).first<{ name: string; title: string; email: string }>();
  let client = c.prospect?.company?.trim() || c.prospect?.name?.trim() || '';
  if (c.clientId) {
    const rec = await env.DB.prepare('SELECT data FROM content WHERE key = ?').bind(`client:${c.clientId}`).first<{ data: string }>();
    if (rec) client = (JSON.parse(rec.data) as { name?: string }).name ?? client;
  }
  const sent = [...c.events].reverse().find((e) => e.kind === 'status' && /^Sent the proposal/.test(e.text))?.at;
  return json({
    proposal: {
      v: 2,
      id: c.id,
      name: c.name,
      client,
      status: c.status,
      start: c.start,
      end: c.end,
      objective: c.objective ?? '',
      items: c.items,
      from: owner ? { name: owner.name || owner.email, title: owner.title, email: owner.email } : null,
      at: sent ?? c.updatedAt ?? row.updated_at,
    },
    changesPending: Boolean(c.clientChanges),
    // The page uses id and key from here on (changes, approval).
    key,
  });
}

function cleanItems(raw: unknown): unknown[] {
  if (!Array.isArray(raw) || raw.length > 1000) throw new HttpError(400, 'Send the screens as a list (at most 1000).');
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);
  return raw.map((i) => {
    const x = i as Record<string, unknown>;
    if (x?.kind === 'package' && str(x.code, 40)) return { kind: 'package', code: x.code };
    if (x?.kind === 'screen' && str(x.specId, 100) && typeof x.appMallId === 'string' && x.appMallId.length <= 64 && str(x.title, 200)) {
      return { kind: 'screen', specId: x.specId, appMallId: x.appMallId, title: x.title };
    }
    if (x?.kind === 'site' && str(x.ref, 120)) {
      const t = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
      const d = (v: unknown) => (typeof v === 'string' && DATE_PATTERN.test(v) ? v : null);
      return {
        kind: 'site', ref: x.ref, no: Number.isInteger(x.no) ? x.no : null, siteNo: t(x.siteNo, 120), town: t(x.town, 120), mall: t(x.mall, 200),
        location: t(x.location, 400), size: t(x.size, 80), start: d(x.start), end: d(x.end),
        specId: typeof x.specId === 'string' && x.specId.length <= 100 ? x.specId : null, appMallId: t(x.appMallId, 64),
      };
    }
    throw new HttpError(400, 'One of the screens isn’t recognised.');
  });
}

async function postProposalChanges(request: Request, url: URL, env: Env, id: string): Promise<Response> {
  const { row, c } = await sharedCampaign(env, id, url.searchParams.get('k') ?? '');
  if (['approved', 'booked', 'declined'].includes(c.status)) throw new HttpError(409, 'This proposal can’t be changed any more. Contact your account manager.');
  const body = await readJson<{ items?: unknown; start?: unknown; end?: unknown; note?: unknown; name?: unknown }>(request);
  // The client can send just a note (the whole site list stays as it is), or a changed list.
  const items = body.items === undefined ? c.items : cleanItems(body.items);
  const date = (v: unknown) => (v === null || v === undefined || v === '' ? null : typeof v === 'string' && DATE_PATTERN.test(v) ? v : (() => { throw new HttpError(400, 'Dates must be YYYY-MM-DD.'); })());
  const start = date(body.start);
  const end = date(body.end);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key = ? AND at >= ?').bind(`changes:${ip}`, minutesAgo(60)).first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_CHANGES_PER_IP_HOUR) throw new HttpError(429, 'Too many changes sent from this connection. Try again later.');

  const at = now();
  const stamp = Date.now().toString(36);
  const events = [
    ...c.events,
    { id: `e-chg-${stamp}-1`, at, by: 'client', kind: 'status', text: `Asked for changes on the booking page${name ? ` (${name})` : ''}` },
    ...(note ? [{ id: `e-chg-${stamp}-2`, at, by: 'client', kind: 'message', text: note }] : []),
  ];
  const next = { ...c, status: 'changes', updatedAt: at, events, clientChanges: { items, start, end, note, name, at } };
  const result = await env.DB.batch([
    env.DB.prepare('UPDATE campaigns SET data = ?, rev = rev + 1, updated_at = ?, updated_by = ? WHERE id = ? AND rev = ?').bind(
      JSON.stringify(next), at, 'client (booking page)', id, row.rev,
    ),
    env.DB.prepare('INSERT INTO login_attempts (key, at) VALUES (?, ?)').bind(`changes:${ip}`, at),
  ]);
  if (!result[0].meta.changes) throw new HttpError(409, 'The proposal was just updated. Reload the page and try again.');
  return json({ ok: true });
}

// ── AI: a campaign from a client's brief ─────────────────────────────

const MAX_BRIEF_BYTES = 12 * 1024 * 1024; // base64 PDF plus the inventory
const MAX_BRIEFS_PER_ACCOUNT_HOUR = 30;

/** Files the browser sends as they are, for Workers AI to turn into text. */
const BRIEF_FILE_TYPES = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/vnd.ms-excel', 'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.apple.numbers',
]);

async function postBrief(request: Request, env: Env): Promise<Response> {
  const me = await requireAccount(request, env);
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key = ? AND at >= ?').bind(`brief:${me.id}`, minutesAgo(60)).first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_BRIEFS_PER_ACCOUNT_HOUR) throw new HttpError(429, 'That’s a lot of briefs this hour. Try again a little later.');
  const body = await readJson<{ filename?: unknown; text?: unknown; file?: unknown; inventory?: unknown; today?: unknown }>(request, MAX_BRIEF_BYTES);
  const filename = typeof body.filename === 'string' ? body.filename.slice(0, 200) : 'brief';
  const f = body.file as { name?: unknown; mediaType?: unknown; data?: unknown } | undefined;
  const file =
    f && typeof f.data === 'string' && typeof f.mediaType === 'string' && BRIEF_FILE_TYPES.has(f.mediaType)
      ? { name: typeof f.name === 'string' ? f.name.slice(0, 200) : filename, mediaType: f.mediaType, data: f.data }
      : undefined;
  const inventory = typeof body.inventory === 'string' ? body.inventory.slice(0, 60_000) : '';
  const today = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : now().slice(0, 10);
  if (!inventory) throw new HttpError(400, 'The list of screens is missing. Reload the page and try again.');
  await env.DB.prepare('INSERT INTO login_attempts (key, at) VALUES (?, ?)').bind(`brief:${me.id}`, now()).run();
  try {
    const text = file ? await fileToText(env.AI, file) : typeof body.text === 'string' ? body.text : '';
    if (!text.trim()) throw new HttpError(400, 'We couldn’t find any text in that file. Try a PDF, Word, PowerPoint or Excel file.');
    const result = await draftFromBrief(env.AI, { text, filename, inventory, today });
    await audit(env, me, 'ai.brief', filename, { items: result.draft.items.length, model: result.model });
    return json(result);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('brief', error);
    const message = error instanceof Error ? error.message : '';
    // The free daily allowance is used up (or Workers AI is busy).
    if (/neuron|quota|limit|429|capacity/i.test(message)) {
      throw new HttpError(429, 'Today’s free AI allowance is used up. Try again tomorrow, or fill the proposal in by hand.');
    }
    throw new HttpError(502, message.startsWith('The AI') ? message : 'The AI couldn’t read the brief just now. Try again in a minute, or fill the proposal in by hand.');
  }
}

// ── campaigns ─────────────────────────────────────────────────────────

type CampaignRow = { id: string; owner_id: number; data: string; rev: number; updated_at: string; owner_name: string; owner_email: string };

function campaignJson(r: CampaignRow) {
  return { campaign: JSON.parse(r.data), rev: r.rev, ownerId: r.owner_id, ownerName: r.owner_name || r.owner_email, updatedAt: r.updated_at };
}

const CAMPAIGN_SELECT = `SELECT c.id, c.owner_id, c.data, c.rev, c.updated_at, a.name AS owner_name, a.email AS owner_email
  FROM campaigns c JOIN admins a ON a.id = c.owner_id`;

async function listCampaigns(request: Request, env: Env): Promise<Response> {
  const me = await requireAccount(request, env);
  const rows =
    me.role === 'admin'
      ? await env.DB.prepare(`${CAMPAIGN_SELECT} ORDER BY c.updated_at DESC`).all<CampaignRow>()
      : await env.DB.prepare(`${CAMPAIGN_SELECT} WHERE c.owner_id = ? ORDER BY c.updated_at DESC`).bind(me.id).all<CampaignRow>();
  // Staff names, so activity by colleagues shows who did it. Accounts are "a-<id>" in campaigns.
  const people = await env.DB.prepare('SELECT id, name, email, title FROM admins').all<{ id: number; name: string; email: string; title: string }>();
  return json({
    campaigns: rows.results.map(campaignJson),
    people: people.results.map((p) => ({ id: `a-${p.id}`, name: p.name || p.email, email: p.email, title: p.title })),
  });
}

async function putCampaign(request: Request, env: Env, id: string): Promise<Response> {
  const me = await requireAccount(request, env);
  if (!CAMPAIGN_ID_PATTERN.test(id)) throw new HttpError(400, 'Invalid campaign id.');
  const body = await readJson<{ campaign?: unknown; rev?: unknown }>(request, MAX_CAMPAIGN_BYTES);
  const c = body.campaign as { id?: unknown; name?: unknown; status?: unknown; items?: unknown; events?: unknown } | undefined;
  if (!c || typeof c !== 'object' || c.id !== id || typeof c.name !== 'string' || typeof c.status !== 'string' || !Array.isArray(c.items) || !Array.isArray(c.events)) {
    throw new HttpError(400, 'Send the campaign as { campaign: {...}, rev }.');
  }
  const rev = Number.isInteger(body.rev) ? (body.rev as number) : 0;
  const code = typeof (c as { shareCode?: unknown }).shareCode === 'string' && SHARE_CODE_PATTERN.test((c as { shareCode: string }).shareCode) ? (c as { shareCode: string }).shareCode : null;
  const data = JSON.stringify(c);
  const at = now();
  const existing = await env.DB.prepare(`${CAMPAIGN_SELECT} WHERE c.id = ?`).bind(id).first<CampaignRow>();
  if (!existing) {
    await env.DB.prepare('INSERT INTO campaigns (id, owner_id, data, rev, created_at, updated_at, updated_by, share_code) VALUES (?, ?, ?, 1, ?, ?, ?, ?)')
      .bind(id, me.id, data, at, at, me.email, code)
      .run();
    return json({ rev: 1, ownerId: me.id, ownerName: me.name || me.email, updatedAt: at }, 201);
  }
  if (existing.owner_id !== me.id && me.role !== 'admin') throw new HttpError(403, 'This campaign belongs to someone else.');
  if (existing.rev !== rev) return json({ error: 'This campaign was changed somewhere else.', latest: campaignJson(existing) }, 409);
  const result = await env.DB.prepare('UPDATE campaigns SET data = ?, rev = rev + 1, updated_at = ?, updated_by = ?, share_code = ? WHERE id = ? AND rev = ?')
    .bind(data, at, me.email, code, id, rev)
    .run();
  if (!result.meta.changes) {
    const latest = await env.DB.prepare(`${CAMPAIGN_SELECT} WHERE c.id = ?`).bind(id).first<CampaignRow>();
    return json({ error: 'This campaign was changed somewhere else.', latest: latest ? campaignJson(latest) : null }, 409);
  }
  return json({ rev: rev + 1, ownerId: existing.owner_id, ownerName: existing.owner_name || existing.owner_email, updatedAt: at });
}

// ── data ──────────────────────────────────────────────────────────────

async function getData(request: Request, env: Env): Promise<Response> {
  const admin = await accountOrNull(request, env);
  const [specs, pins, assets, planPins, content] = await env.DB.batch([
    env.DB.prepare('SELECT id, mall_id, is_new, data, updated_at FROM specs'),
    env.DB.prepare('SELECT spec_id, lng, lat, level, updated_at FROM pins'),
    env.DB.prepare('SELECT * FROM assets ORDER BY position IS NULL, position, created_at'),
    env.DB.prepare('SELECT spec_id, x, y, updated_at FROM plan_pins'),
    env.DB.prepare('SELECT key, data, updated_at FROM content'),
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
    content: (content.results as { key: string; data: string; updated_at: string }[]).map((row) => ({
      key: row.key,
      data: admin ? JSON.parse(row.data) : publicContent(row.key, JSON.parse(row.data)),
      updatedAt: row.updated_at,
    })),
  });
}

// ── approvals (public: clients have no account) ─────────────────────────

async function postApproval(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ campaignId?: unknown; k?: unknown; name?: unknown; note?: unknown; screens?: unknown }>(request);
  const campaignId = typeof body.campaignId === 'string' ? body.campaignId : '';
  const key = typeof body.k === 'string' ? body.k : '';
  if (!CAMPAIGN_ID_PATTERN.test(campaignId)) throw new HttpError(400, 'This proposal link isn’t complete.');
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
  const screens = Number.isInteger(body.screens) && (body.screens as number) >= 0 ? Math.min(body.screens as number, 10000) : 0;

  // Rate limit by IP, reusing the login-attempts log.
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const since = minutesAgo(60);
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key = ? AND at >= ?')
    .bind(`approve:${ip}`, since)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_APPROVALS_PER_IP_HOUR) throw new HttpError(429, 'Too many approvals from this connection. Try again later.');

  const at = now();
  const statements = [
    env.DB.prepare('INSERT INTO approvals (campaign_id, name, note, screens, at) VALUES (?, ?, ?, ?, ?)').bind(campaignId, name, note, screens, at),
    env.DB.prepare('INSERT INTO login_attempts (key, at) VALUES (?, ?)').bind(`approve:${ip}`, at),
  ];
  // Mark the saved campaign approved straight away, so sales see it on any
  // device even if they're offline. Only a proposal that's waiting (sent).
  const row = await env.DB.prepare('SELECT data, rev FROM campaigns WHERE id = ?').bind(campaignId).first<{ data: string; rev: number }>();
  if (row) {
    const c = JSON.parse(row.data) as { status?: string; events?: unknown[]; updatedAt?: string; shareKey?: string };
    // Links from before share keys carry none; a key that's given must match.
    if (c.status === 'sent' && (!key || key === c.shareKey)) {
      const event = (text: string, kind: string, n: number) => ({ id: `e-appr-${Date.now().toString(36)}-${n}`, at, by: 'client', text, kind });
      const events = [
        ...(Array.isArray(c.events) ? c.events : []),
        event(`Approved the proposal on the booking page${name ? ` (${name})` : ''}`, 'status', 1),
        ...(note ? [event(note, 'message', 2)] : []),
      ];
      statements.push(
        env.DB.prepare('UPDATE campaigns SET data = ?, rev = rev + 1, updated_at = ?, updated_by = ? WHERE id = ? AND rev = ?').bind(
          JSON.stringify({ ...c, status: 'approved', updatedAt: at, events }),
          at,
          'client (booking page)',
          campaignId,
          row.rev,
        ),
      );
    }
  }
  await env.DB.batch(statements);
  return json({ ok: true, approval: { campaignId, name, note, screens, at } });
}

async function getApprovals(request: Request, url: URL, env: Env): Promise<Response> {
  const ids = (url.searchParams.get('ids') ?? '').split(',').filter((x) => CAMPAIGN_ID_PATTERN.test(x)).slice(0, 100);
  if (!ids.length) return json({ approvals: [] });
  const rows = await env.DB.prepare(
    `SELECT campaign_id, name, note, screens, at FROM approvals WHERE campaign_id IN (${ids.map(() => '?').join(',')}) ORDER BY at`,
  )
    .bind(...ids)
    .all<{ campaign_id: string; name: string; note: string; screens: number; at: string }>();
  // Who approved and their note are for Primedia (signed-in accounts) only;
  // anyone else learns just that, and when, the proposal was approved.
  const admin = await accountOrNull(request, env);
  return json({
    approvals: rows.results.map((r) => ({ campaignId: r.campaign_id, name: admin ? r.name : '', note: admin ? r.note : '', screens: r.screens, at: r.at })),
  });
}

/** Client records (contacts) may be kept up to date by sales as well as admins. */
const contentEditor = (request: Request, env: Env, key: string) =>
  key.startsWith('client:') ? requireAccount(request, env) : requireAdmin(request, env);

async function putContent(request: Request, env: Env, key: string): Promise<Response> {
  const admin = await contentEditor(request, env, key);
  const body = await readJson<{ data?: unknown }>(request);
  if (body.data == null || typeof body.data !== 'object') throw new HttpError(400, 'Send the content as { data: {...} }.');
  const data = JSON.stringify(body.data);
  await env.DB.prepare(
    'INSERT INTO content (key, data, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by',
  )
    .bind(key, data, now(), admin.email)
    .run();
  await audit(env, admin, 'content.put', key);
  return json({ ok: true });
}

async function deleteContent(request: Request, env: Env, key: string): Promise<Response> {
  const admin = await contentEditor(request, env, key);
  await env.DB.prepare('DELETE FROM content WHERE key = ?').bind(key).run();
  await audit(env, admin, 'content.delete', key);
  return json({ ok: true });
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

async function serveFile(env: Env, key: string, forceDownload = false): Promise<Response> {
  if (!key || key.length > 512) throw new HttpError(404, 'File not found.');
  const file = await kvFileStore(env.FILES).get(key);
  if (!file) throw new HttpError(404, 'File not found.');
  // `?download=1` (the spec page's download buttons) always saves the file
  // instead of opening it in place of the site.
  const inline =
    !forceDownload &&
    (file.mimeType.startsWith('image/') || file.mimeType.startsWith('video/') || file.mimeType === 'application/pdf');
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

async function reorderAssets(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  const body = await readJson<{ specId?: unknown; ids?: unknown }>(request);
  const specId = typeof body.specId === 'string' ? body.specId : '';
  if (!SPEC_ID_PATTERN.test(specId)) throw new HttpError(400, 'Invalid screen id.');
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string' && /^asset-[0-9a-f-]{36}$/.test(x)) : [];
  if (!ids.length || ids.length > 200) throw new HttpError(400, 'Send the files in their new order.');
  await env.DB.batch(ids.map((id, i) => env.DB.prepare('UPDATE assets SET position = ? WHERE id = ? AND spec_id = ?').bind(i, id, specId)));
  await audit(env, admin, 'file.reorder', specId, { ids });
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
    if (method === 'GET') {
      return serveFile(env, safeDecode(url.pathname.slice('/files/'.length), 404), url.searchParams.get('download') === '1');
    }
  }
  if (resource === 'assets' && id === 'order' && method === 'POST') return reorderAssets(request, env);
  if (resource === 'assets' && /^asset-[0-9a-f-]{36}$/.test(id)) {
    if (method === 'PATCH') return updateAsset(request, env, id);
    if (method === 'DELETE') return deleteAsset(request, env, id);
  }
  if (resource === 'data' && method === 'GET') return getData(request, env);
  if (resource === 'approvals' && !id) {
    if (method === 'POST') return postApproval(request, env);
    if (method === 'GET') return getApprovals(request, url, env);
  }
  if (resource === 'content' && id) {
    if (!CONTENT_KEY_PATTERN.test(id)) throw new HttpError(400, 'Invalid content key.');
    if (method === 'PUT') return putContent(request, env, id);
    if (method === 'DELETE') return deleteContent(request, env, id);
  }

  if (resource === 'auth') {
    if (id === 'login' && method === 'POST') return login(request, env);
    if (id === 'logout' && method === 'POST') return logout(request, env);
    if (id === 'me' && method === 'GET') {
      const me = profile(await requireAccount(request, env, true));
      return json({ account: me, admin: me });
    }
    if (id === 'me' && method === 'PATCH') return updateMe(request, env);
    if (id === 'password' && method === 'POST') return changePassword(request, env);
    if (id === 'signup' && method === 'POST') return signup(request, env);
    if (id === 'forgot' && method === 'POST') return forgotPassword(request, env);
  }

  if (resource === 'proposals' && !id && method === 'GET') return getProposalByCode(url, env);
  if (resource === 'proposals' && id) {
    const sub = url.pathname.split('/')[3] ?? '';
    if (!sub && method === 'GET') return getProposal(url, env, id);
    if (sub === 'changes' && method === 'POST') return postProposalChanges(request, url, env, id);
  }

  if (resource === 'ai' && id === 'brief' && method === 'POST') return postBrief(request, env);

  if (resource === 'campaigns') {
    if (!id && method === 'GET') return listCampaigns(request, env);
    if (id && method === 'PUT') return putCampaign(request, env, id);
  }

  if (resource === 'accounts') {
    if (!id && method === 'GET') return listAccounts(request, env);
    if (!id && method === 'POST') return createAccount(request, env);
    if (id && method === 'PATCH') return updateAccount(request, env, id);
    if (id && method === 'DELETE') return declineAccount(request, env, id);
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
