-- Site content admins edit that isn't a screen spec: mall audiences and
-- packages, mall and package photos, client contacts, photo rights.
-- One JSON document per key, e.g. "mall:canal-walk", "client:rialto",
-- "photo-rights". The site's built-in data stays in the app; a row here
-- replaces the built-in version of that one thing.
CREATE TABLE content (
  key        TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
