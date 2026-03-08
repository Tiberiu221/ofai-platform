-- 052: Business hours — per-location schedule
-- One row per day per location. day_of_week: 0=Monday, 6=Sunday (ISO-style)

CREATE TABLE IF NOT EXISTS business_hours (
  id            SERIAL PRIMARY KEY,
  location_id   INTEGER NOT NULL REFERENCES business_locations(id) ON DELETE CASCADE,
  day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time     TIME,
  close_time    TIME,
  is_closed     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (location_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_business_hours_location
  ON business_hours(location_id);
