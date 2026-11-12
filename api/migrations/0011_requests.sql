-- Clients plan their own campaign on the site (malls, screens, dates, a
-- note) and send it to Primedia sales without an account. A salesperson
-- takes the request, which becomes their proposal. `data` is the request as
-- the client sent it. `assigned_to` is the salesperson the client named, if
-- that email is an account. Status: new → taken (or dismissed).
CREATE TABLE requests (
  id          TEXT    PRIMARY KEY,
  data        TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'new',
  assigned_to INTEGER REFERENCES admins(id),
  taken_by    INTEGER REFERENCES admins(id),
  campaign_id TEXT,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);
CREATE INDEX requests_status ON requests(status, created_at);
