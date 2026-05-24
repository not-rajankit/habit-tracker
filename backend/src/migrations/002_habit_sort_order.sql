ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

WITH ordered_habits AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS position
  FROM habits
  WHERE sort_order IS NULL
)
UPDATE habits
SET sort_order = ordered_habits.position
FROM ordered_habits
WHERE habits.id = ordered_habits.id;

CREATE INDEX IF NOT EXISTS idx_habits_sort_order ON habits(sort_order);
