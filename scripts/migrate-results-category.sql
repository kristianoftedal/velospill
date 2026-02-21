-- Add category column with default 'finish' for existing rows
ALTER TABLE race_results ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'finish';

-- Drop old unique constraints
ALTER TABLE race_results DROP CONSTRAINT IF EXISTS "race_results_race_rider_unique";
ALTER TABLE race_results DROP CONSTRAINT IF EXISTS "race_results_race_position_unique";

-- Add new unique constraints scoped by category
ALTER TABLE race_results ADD CONSTRAINT "race_results_race_rider_category_unique" UNIQUE ("raceId", "riderId", "category");
ALTER TABLE race_results ADD CONSTRAINT "race_results_race_position_category_unique" UNIQUE ("raceId", "position", "category");

-- Add category index
CREATE INDEX IF NOT EXISTS "race_results_category_idx" ON race_results ("category");
