-- Habit Tracker — Initial Schema

CREATE TABLE IF NOT EXISTS habits (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  frequency   VARCHAR(10) NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
  icon        VARCHAR(10) DEFAULT '✅',
  category    VARCHAR(100),
  archived    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habit_entries (
  id          SERIAL PRIMARY KEY,
  habit_id    INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, date)
);

CREATE TABLE IF NOT EXISTS goals (
  id               SERIAL PRIMARY KEY,
  type             VARCHAR(10) NOT NULL DEFAULT 'small' CHECK (type IN ('small', 'big')),
  title            VARCHAR(255) NOT NULL,
  description      TEXT,
  target           INTEGER DEFAULT 1,
  deadline         DATE,
  linked_habit_ids JSONB DEFAULT '[]',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_habit_entries_habit_date ON habit_entries(habit_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_entries_date ON habit_entries(date);
CREATE INDEX IF NOT EXISTS idx_goals_type ON goals(type);
