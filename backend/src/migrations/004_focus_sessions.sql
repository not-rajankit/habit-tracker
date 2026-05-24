CREATE TABLE IF NOT EXISTS focus_sessions (
  id               SERIAL PRIMARY KEY,
  preset_name      VARCHAR(80) NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  started_at       TIMESTAMPTZ NOT NULL,
  ended_at         TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_ended_at ON focus_sessions(ended_at);
