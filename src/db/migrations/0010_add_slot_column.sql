-- Add slot column to race_results for TTT (multiple riders per position)
ALTER TABLE "race_results" ADD COLUMN "slot" integer NOT NULL DEFAULT 1;

-- Drop old position unique constraint
ALTER TABLE "race_results" DROP CONSTRAINT IF EXISTS "race_results_race_position_category_instance_unique";

-- Add new constraint including slot
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_race_position_category_instance_slot_unique"
  UNIQUE ("raceId", "position", "category", "instance", "slot");
