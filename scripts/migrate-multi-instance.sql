-- Add instance column (integer, default 1) for multi-instance support per category
ALTER TABLE race_results ADD COLUMN IF NOT EXISTS "instance" integer NOT NULL DEFAULT 1;

-- Add optional label for each instance (e.g. "Col du Galibier")
ALTER TABLE race_results ADD COLUMN IF NOT EXISTS "instanceLabel" text;

-- Drop old unique constraints scoped by (raceId, riderId/position, category)
ALTER TABLE race_results DROP CONSTRAINT IF EXISTS "race_results_race_rider_category_unique";
ALTER TABLE race_results DROP CONSTRAINT IF EXISTS "race_results_race_position_category_unique";

-- Add new unique constraints scoped by (raceId, riderId/position, category, instance)
ALTER TABLE race_results ADD CONSTRAINT "race_results_race_rider_category_instance_unique" UNIQUE ("raceId", "riderId", "category", "instance");
ALTER TABLE race_results ADD CONSTRAINT "race_results_race_position_category_instance_unique" UNIQUE ("raceId", "position", "category", "instance");
