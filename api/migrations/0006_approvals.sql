-- Clients approving a proposal on its booking page (/share), with no
-- account. One row per approval; the sales workspace reads them back by
-- campaign id and moves the campaign to "Client approved".
CREATE TABLE approvals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT    NOT NULL,
  name        TEXT    NOT NULL DEFAULT '',
  note        TEXT    NOT NULL DEFAULT '',
  screens     INTEGER NOT NULL DEFAULT 0,
  at          TEXT    NOT NULL
);
CREATE INDEX approvals_campaign ON approvals(campaign_id);
