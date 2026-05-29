CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS authentication;

CREATE TABLE IF NOT EXISTS authentication.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name          TEXT,
  avatar_url    TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'password' CHECK (auth_provider IN ('password', 'google', 'hybrid')),
  google_id     TEXT UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS authentication.refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES authentication.users(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  user_agent  TEXT,
  ip_address  INET,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS authentication.password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES authentication.users(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON authentication.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON authentication.refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON authentication.password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON authentication.password_reset_tokens(token_hash);

INSERT INTO authentication.users (id, email, name, auth_provider)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'dummy.user@example.test',
  'Dummy User',
  'password'
)
ON CONFLICT (email) DO NOTHING;

ALTER TABLE habits ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES authentication.users(id) ON DELETE CASCADE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES authentication.users(id) ON DELETE CASCADE;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES authentication.users(id) ON DELETE CASCADE;
ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE habits
SET user_id = '00000000-0000-4000-8000-000000000001'
WHERE user_id IS NULL;

UPDATE goals
SET user_id = '00000000-0000-4000-8000-000000000001'
WHERE user_id IS NULL;

UPDATE focus_sessions
SET user_id = '00000000-0000-4000-8000-000000000001',
    updated_at = COALESCE(updated_at, created_at, NOW())
WHERE user_id IS NULL;

DO $$
DECLARE
  habits_id_type TEXT;
  entries_id_type TEXT;
  entries_habit_id_type TEXT;
  goals_id_type TEXT;
  focus_id_type TEXT;
BEGIN
  SELECT data_type INTO habits_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'habits' AND column_name = 'id';

  IF habits_id_type <> 'uuid' THEN
    CREATE TEMP TABLE IF NOT EXISTS tmp_habit_id_map (old_id INTEGER PRIMARY KEY, new_id UUID NOT NULL) ON COMMIT DROP;
    INSERT INTO tmp_habit_id_map (old_id, new_id)
    SELECT id, gen_random_uuid() FROM habits
    ON CONFLICT (old_id) DO NOTHING;

    ALTER TABLE habit_entries DROP CONSTRAINT IF EXISTS habit_entries_habit_id_fkey;
    ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_pkey;

    ALTER TABLE habits ADD COLUMN IF NOT EXISTS id_uuid UUID;
    UPDATE habits h SET id_uuid = m.new_id FROM tmp_habit_id_map m WHERE h.id = m.old_id AND h.id_uuid IS NULL;
    ALTER TABLE habits ALTER COLUMN id_uuid SET NOT NULL;

    ALTER TABLE habit_entries ADD COLUMN IF NOT EXISTS habit_id_uuid UUID;
    UPDATE habit_entries he SET habit_id_uuid = m.new_id FROM tmp_habit_id_map m WHERE he.habit_id = m.old_id AND he.habit_id_uuid IS NULL;
    ALTER TABLE habit_entries ALTER COLUMN habit_id_uuid SET NOT NULL;

    UPDATE goals g
    SET linked_habit_ids = COALESCE((
      SELECT jsonb_agg(to_jsonb(m.new_id::text))
      FROM jsonb_array_elements_text(g.linked_habit_ids) AS linked(old_id)
      JOIN tmp_habit_id_map m ON m.old_id = linked.old_id::integer
    ), '[]'::jsonb)
    WHERE jsonb_typeof(g.linked_habit_ids) = 'array';

    ALTER TABLE habits DROP COLUMN id;
    ALTER TABLE habits RENAME COLUMN id_uuid TO id;
    ALTER TABLE habits ADD PRIMARY KEY (id);

    ALTER TABLE habit_entries DROP COLUMN habit_id;
    ALTER TABLE habit_entries RENAME COLUMN habit_id_uuid TO habit_id;
  END IF;

  SELECT data_type INTO entries_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'habit_entries' AND column_name = 'id';

  IF entries_id_type <> 'uuid' THEN
    ALTER TABLE habit_entries DROP CONSTRAINT IF EXISTS habit_entries_pkey;
    ALTER TABLE habit_entries ADD COLUMN IF NOT EXISTS id_uuid UUID DEFAULT gen_random_uuid();
    UPDATE habit_entries SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;
    ALTER TABLE habit_entries ALTER COLUMN id_uuid SET NOT NULL;
    ALTER TABLE habit_entries DROP COLUMN id;
    ALTER TABLE habit_entries RENAME COLUMN id_uuid TO id;
    ALTER TABLE habit_entries ADD PRIMARY KEY (id);
  END IF;

  SELECT data_type INTO entries_habit_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'habit_entries' AND column_name = 'habit_id';

  IF entries_habit_id_type = 'uuid' THEN
    ALTER TABLE habit_entries DROP CONSTRAINT IF EXISTS habit_entries_habit_id_fkey;
    ALTER TABLE habit_entries
      ADD CONSTRAINT habit_entries_habit_id_fkey
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE;
  END IF;

  SELECT data_type INTO goals_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'goals' AND column_name = 'id';

  IF goals_id_type <> 'uuid' THEN
    ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_pkey;
    ALTER TABLE goals ADD COLUMN IF NOT EXISTS id_uuid UUID DEFAULT gen_random_uuid();
    UPDATE goals SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;
    ALTER TABLE goals ALTER COLUMN id_uuid SET NOT NULL;
    ALTER TABLE goals DROP COLUMN id;
    ALTER TABLE goals RENAME COLUMN id_uuid TO id;
    ALTER TABLE goals ADD PRIMARY KEY (id);
  END IF;

  SELECT data_type INTO focus_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'focus_sessions' AND column_name = 'id';

  IF focus_id_type <> 'uuid' THEN
    ALTER TABLE focus_sessions DROP CONSTRAINT IF EXISTS focus_sessions_pkey;
    ALTER TABLE focus_sessions ADD COLUMN IF NOT EXISTS id_uuid UUID DEFAULT gen_random_uuid();
    UPDATE focus_sessions SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;
    ALTER TABLE focus_sessions ALTER COLUMN id_uuid SET NOT NULL;
    ALTER TABLE focus_sessions DROP COLUMN id;
    ALTER TABLE focus_sessions RENAME COLUMN id_uuid TO id;
    ALTER TABLE focus_sessions ADD PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE habits ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE habit_entries ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE goals ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE focus_sessions ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE habits ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE goals ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE focus_sessions ALTER COLUMN user_id SET NOT NULL;

DROP INDEX IF EXISTS idx_habit_entries_habit_date;
DROP INDEX IF EXISTS idx_habit_entries_date;
DROP INDEX IF EXISTS idx_habits_sort_order;
DROP INDEX IF EXISTS idx_goals_type;
DROP INDEX IF EXISTS idx_focus_sessions_ended_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_entries_habit_date ON habit_entries(habit_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_entries_date ON habit_entries(date);
CREATE INDEX IF NOT EXISTS idx_habits_user_archived_order ON habits(user_id, archived, sort_order);
CREATE INDEX IF NOT EXISTS idx_goals_user_type ON goals(user_id, type);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_ended_at ON focus_sessions(user_id, ended_at);

DROP TRIGGER IF EXISTS set_auth_users_updated_at ON authentication.users;
CREATE TRIGGER set_auth_users_updated_at
BEFORE UPDATE ON authentication.users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_refresh_tokens_updated_at ON authentication.refresh_tokens;
CREATE TRIGGER set_refresh_tokens_updated_at
BEFORE UPDATE ON authentication.refresh_tokens
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_password_reset_tokens_updated_at ON authentication.password_reset_tokens;
CREATE TRIGGER set_password_reset_tokens_updated_at
BEFORE UPDATE ON authentication.password_reset_tokens
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_focus_sessions_updated_at ON focus_sessions;
CREATE TRIGGER set_focus_sessions_updated_at
BEFORE UPDATE ON focus_sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
