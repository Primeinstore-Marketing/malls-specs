-- The order admins put a screen's pictures in. NULL (older uploads, new
-- uploads) sorts after positioned files, oldest first.
ALTER TABLE assets ADD COLUMN position INTEGER;
