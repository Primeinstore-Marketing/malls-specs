-- Pictures and files uploaded by admins. The bytes live in the FILES store
-- (Workers KV); this table is the catalogue of them. A spec lists the ids
-- of its assets in mediaIds / downloadIds / attachmentIds.
CREATE TABLE assets (
  id          TEXT    PRIMARY KEY,
  spec_id     TEXT    NOT NULL,
  role        TEXT    NOT NULL CHECK (role IN ('media', 'download', 'attachment')),
  kind        TEXT    NOT NULL,
  filename    TEXT    NOT NULL,
  mime_type   TEXT    NOT NULL,
  size_bytes  INTEGER NOT NULL,
  storage_key TEXT    NOT NULL UNIQUE,
  alt         TEXT    NOT NULL DEFAULT '',
  caption     TEXT    NOT NULL DEFAULT '',
  width       INTEGER,
  height      INTEGER,
  created_at  TEXT    NOT NULL,
  created_by  TEXT    NOT NULL
);
CREATE INDEX assets_spec ON assets(spec_id);
