-- A short code per campaign for the client's booking link (/share?s=<code>),
-- so links in emails stay short. Kept in a column so it can be looked up.
ALTER TABLE campaigns ADD COLUMN share_code TEXT;
CREATE UNIQUE INDEX campaigns_share_code ON campaigns(share_code);
