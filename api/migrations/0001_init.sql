-- Admin accounts, sessions, and the edits admins make on top of the
-- built-in catalogue. The site's seed data stays in the app; this database
-- only holds what admins have changed or added since.

CREATE TABLE admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT    NOT NULL DEFAULT '',
  password_hash TEXT    NOT NULL,           -- base64 PBKDF2-SHA256
  password_salt TEXT    NOT NULL,           -- base64, 16 random bytes
  iterations    INTEGER NOT NULL,
  disabled      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Only a SHA-256 of each session token is stored, so a leaked database
-- can't be used to sign in.
CREATE TABLE sessions (
  token_hash TEXT    PRIMARY KEY,
  admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX sessions_admin ON sessions(admin_id);

-- Failed sign-in attempts, for lockout. Keyed by email and by client IP.
CREATE TABLE login_attempts (
  key        TEXT NOT NULL,
  at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX login_attempts_key ON login_attempts(key, at);

-- A full Specification record (JSON), either an edited copy of a built-in
-- spec or a brand-new screen. `mall_id` places new screens in a mall.
CREATE TABLE specs (
  id         TEXT PRIMARY KEY,
  mall_id    TEXT,
  data       TEXT NOT NULL,
  is_new     INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

-- Confirmed screen positions; these override the automatic drafts.
CREATE TABLE pins (
  spec_id    TEXT PRIMARY KEY,
  lng        REAL NOT NULL,
  lat        REAL NOT NULL,
  level      TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

-- Who changed what, for accountability. Never read by the public API.
CREATE TABLE audit_log (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  admin    TEXT NOT NULL,
  action   TEXT NOT NULL,
  target   TEXT NOT NULL,
  detail   TEXT
);
