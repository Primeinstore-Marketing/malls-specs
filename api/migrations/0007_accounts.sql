-- Sales get real accounts with passwords, alongside admins, in the same
-- table. role: 'admin' (Site admin and everything else) or 'sales' (the
-- workspace and client contacts). New accounts and password resets get a
-- temporary password the person must change on first sign-in.
ALTER TABLE admins ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE admins ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE admins ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
