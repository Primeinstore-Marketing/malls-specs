-- Salespeople create their own account (with their own password) from the
-- sign-in page; it waits for an admin to approve it. Someone who forgot
-- their password can ask for a reset, which admins see in Accounts.
ALTER TABLE admins ADD COLUMN pending INTEGER NOT NULL DEFAULT 0;
ALTER TABLE admins ADD COLUMN reset_requested_at TEXT;
