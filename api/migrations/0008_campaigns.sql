-- Campaigns (proposals) from the sales workspace, saved on the server rather
-- than in one browser. `data` is the whole campaign as the site uses it
-- (items, dates, conversation). `rev` goes up on every save, so two devices
-- editing at once can't silently overwrite each other. Sales see their own;
-- admins see everyone's.
CREATE TABLE campaigns (
  id         TEXT    PRIMARY KEY,
  owner_id   INTEGER NOT NULL REFERENCES admins(id),
  data       TEXT    NOT NULL,
  rev        INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL,
  updated_by TEXT    NOT NULL
);
CREATE INDEX campaigns_owner ON campaigns(owner_id);
