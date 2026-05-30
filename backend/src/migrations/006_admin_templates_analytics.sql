CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS authentication;

ALTER TABLE authentication.users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS authentication.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS authentication.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS authentication.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES authentication.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES authentication.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES authentication.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

CREATE TABLE IF NOT EXISTS authentication.role_permissions (
  role_id UUID REFERENCES authentication.roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES authentication.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY(role_id, permission_id)
);

INSERT INTO authentication.roles (name)
VALUES ('SystemAdmin'), ('Admin'), ('User')
ON CONFLICT (name) DO NOTHING;

INSERT INTO authentication.permissions (name)
VALUES
  ('manage_admins'),
  ('manage_roles'),
  ('manage_users'),
  ('manage_templates'),
  ('manage_categories'),
  ('manage_packs'),
  ('view_analytics'),
  ('suspend_users'),
  ('manage_system_settings')
ON CONFLICT (name) DO NOTHING;

INSERT INTO authentication.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM authentication.roles r
JOIN authentication.permissions p ON p.name = ANY(ARRAY[
  'manage_admins',
  'manage_roles',
  'manage_users',
  'manage_templates',
  'manage_categories',
  'manage_packs',
  'view_analytics',
  'suspend_users',
  'manage_system_settings'
])
WHERE r.name = 'SystemAdmin'
ON CONFLICT DO NOTHING;

INSERT INTO authentication.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM authentication.roles r
JOIN authentication.permissions p ON p.name = ANY(ARRAY[
  'manage_users',
  'manage_templates',
  'manage_categories',
  'manage_packs',
  'view_analytics'
])
WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;

INSERT INTO authentication.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM authentication.users u
JOIN authentication.roles r ON r.name = 'User'
ON CONFLICT DO NOTHING;

INSERT INTO authentication.user_roles (user_id, role_id)
SELECT '00000000-0000-4000-8000-000000000001'::uuid, r.id
FROM authentication.roles r
WHERE r.name = 'SystemAdmin'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS habit_template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  icon VARCHAR(100),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habit_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES habit_template_categories(id) ON DELETE SET NULL,
  icon VARCHAR(100),
  color VARCHAR(50),
  difficulty VARCHAR(50),
  frequency_type VARCHAR(50) DEFAULT 'daily' CHECK (frequency_type IN ('daily', 'weekly')),
  default_goal INTEGER DEFAULT 1,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES authentication.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habit_template_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  cover_image TEXT,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habit_template_pack_items (
  pack_id UUID REFERENCES habit_template_packs(id) ON DELETE CASCADE,
  template_id UUID REFERENCES habit_templates(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY(pack_id, template_id)
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES authentication.users(id) ON DELETE SET NULL,
  event_name VARCHAR(100) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES authentication.users(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL,
  target_type VARCHAR(80),
  target_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO habit_template_categories (name, slug, icon, sort_order)
VALUES
  ('Health', 'health', '💧', 1),
  ('Fitness', 'fitness', '🏃', 2),
  ('Productivity', 'productivity', '✅', 3),
  ('Learning', 'learning', '📚', 4),
  ('Mental Health', 'mental-health', '🌱', 5),
  ('Sleep', 'sleep', '🌙', 6),
  ('Finance', 'finance', '💰', 7),
  ('Mindfulness', 'mindfulness', '🧘', 8),
  ('Career', 'career', '💼', 9),
  ('Relationships', 'relationships', '🤝', 10)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO habit_templates (title, description, category_id, icon, color, difficulty, frequency_type, default_goal, is_featured)
SELECT seed.title, seed.description, c.id, seed.icon, seed.color, seed.difficulty, seed.frequency_type, seed.default_goal, seed.is_featured
FROM (VALUES
  ('Drink Water', 'Build a simple hydration habit.', 'health', '💧', '#2563eb', 'easy', 'daily', 1, true),
  ('Morning Walk', 'Start the day with light movement.', 'fitness', '🚶', '#16a34a', 'easy', 'daily', 1, true),
  ('Read 10 Pages', 'Make steady reading progress.', 'learning', '📚', '#7c3aed', 'easy', 'daily', 1, true),
  ('Sleep Before 11PM', 'Create a consistent bedtime.', 'sleep', '🌙', '#4f46e5', 'medium', 'daily', 1, true),
  ('Meditate 5 Minutes', 'Practice a short mindful reset.', 'mindfulness', '🧘', '#0f766e', 'easy', 'daily', 1, true),
  ('Workout Daily', 'Complete a focused workout.', 'fitness', '🏋️', '#dc2626', 'medium', 'daily', 1, false),
  ('Journal Daily', 'Capture thoughts and reflection.', 'mental-health', '📝', '#9333ea', 'easy', 'daily', 1, false),
  ('Practice Coding', 'Sharpen programming skills.', 'career', '💻', '#0891b2', 'medium', 'daily', 1, false),
  ('Track Expenses', 'Record spending and stay aware.', 'finance', '💰', '#ca8a04', 'easy', 'daily', 1, false),
  ('Stretching', 'Improve mobility with a short session.', 'health', '🤸', '#ea580c', 'easy', 'daily', 1, false)
) AS seed(title, description, slug, icon, color, difficulty, frequency_type, default_goal, is_featured)
JOIN habit_template_categories c ON c.slug = seed.slug
WHERE NOT EXISTS (SELECT 1 FROM habit_templates ht WHERE ht.title = seed.title);

INSERT INTO habit_template_packs (title, description, is_featured)
SELECT seed.title, seed.description, seed.is_featured
FROM (VALUES
  ('Beginner Productivity Pack', 'Simple habits for momentum and consistency.', true),
  ('Morning Routine Pack', 'A balanced start with movement, hydration, and planning.', true),
  ('30-Day Fitness Starter', 'Small daily actions to build a fitness baseline.', false),
  ('Student Focus Pack', 'Reading, coding, and focus habits for study routines.', false),
  ('Mental Wellness Basics', 'Lightweight habits for reflection and mindfulness.', true)
) AS seed(title, description, is_featured)
WHERE NOT EXISTS (SELECT 1 FROM habit_template_packs p WHERE p.title = seed.title);

INSERT INTO habit_template_pack_items (pack_id, template_id, sort_order)
SELECT p.id, t.id, item.sort_order
FROM (VALUES
  ('Beginner Productivity Pack', 'Read 10 Pages', 1),
  ('Beginner Productivity Pack', 'Practice Coding', 2),
  ('Beginner Productivity Pack', 'Track Expenses', 3),
  ('Morning Routine Pack', 'Drink Water', 1),
  ('Morning Routine Pack', 'Morning Walk', 2),
  ('Morning Routine Pack', 'Meditate 5 Minutes', 3),
  ('30-Day Fitness Starter', 'Morning Walk', 1),
  ('30-Day Fitness Starter', 'Workout Daily', 2),
  ('30-Day Fitness Starter', 'Stretching', 3),
  ('Student Focus Pack', 'Read 10 Pages', 1),
  ('Student Focus Pack', 'Practice Coding', 2),
  ('Mental Wellness Basics', 'Meditate 5 Minutes', 1),
  ('Mental Wellness Basics', 'Journal Daily', 2),
  ('Mental Wellness Basics', 'Sleep Before 11PM', 3)
) AS item(pack_title, template_title, sort_order)
JOIN habit_template_packs p ON p.title = item.pack_title
JOIN habit_templates t ON t.title = item.template_title
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_users_status_created_at ON authentication.users(status, created_at);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON authentication.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON authentication.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_templates_active_featured ON habit_templates(is_active, is_featured);
CREATE INDEX IF NOT EXISTS idx_templates_category ON habit_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_template_packs_featured ON habit_template_packs(is_featured);
CREATE INDEX IF NOT EXISTS idx_analytics_event_created ON analytics_events(event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_user_created ON analytics_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON admin_activity_logs(created_at);

DROP TRIGGER IF EXISTS set_template_categories_updated_at ON habit_template_categories;
CREATE TRIGGER set_template_categories_updated_at
BEFORE UPDATE ON habit_template_categories
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_templates_updated_at ON habit_templates;
CREATE TRIGGER set_templates_updated_at
BEFORE UPDATE ON habit_templates
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_template_packs_updated_at ON habit_template_packs;
CREATE TRIGGER set_template_packs_updated_at
BEFORE UPDATE ON habit_template_packs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
