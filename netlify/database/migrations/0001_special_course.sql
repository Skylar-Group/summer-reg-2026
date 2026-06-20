-- 暑期特選課程 (Summer Special Course) registrations.
-- One row per booked 2-hour session. This track is independent of the
-- flyer-based Part A/B/C flow (which lives in Google Sheets) and is never
-- offered with installment payments.
CREATE TABLE IF NOT EXISTS special_course_sessions (
  id            SERIAL PRIMARY KEY,
  student_name  TEXT NOT NULL,
  gender        TEXT,
  grade_text    TEXT,
  is_secondary  BOOLEAN NOT NULL DEFAULT FALSE,
  session_date  TEXT NOT NULL,          -- MM/DD, e.g. "07/06"
  time_slot     TEXT NOT NULL,          -- e.g. "10:00-12:00"
  fee           INTEGER NOT NULL DEFAULT 0,  -- per-session fee (380 / 420)
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_special_course_name ON special_course_sessions (student_name);
CREATE INDEX IF NOT EXISTS idx_special_course_date ON special_course_sessions (session_date);
