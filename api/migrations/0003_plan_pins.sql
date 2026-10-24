-- Screen positions on a mall's directory map (the illustrated, not-to-scale
-- map in the "Mall map" view), as fractions of the image: 0–1 across, 0–1 down.
CREATE TABLE plan_pins (
  spec_id    TEXT PRIMARY KEY,
  x          REAL NOT NULL CHECK (x >= 0 AND x <= 1),
  y          REAL NOT NULL CHECK (y >= 0 AND y <= 1),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
