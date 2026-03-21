-- Migration: Soft-delete support for draftPicks
-- Replaces hard-delete in dropRider() with a droppedAt timestamp.
-- This preserves historical points for dropped riders while keeping the uniqueness
-- invariant (a rider can only be on one team at a time in a league).

-- Step 1: Drop the old full unique index (enforces uniqueness for ALL rows, including dropped ones)
DROP INDEX IF EXISTS "draft_picks_rider_league_unique";

-- Step 2: Add droppedAt column (nullable — NULL means rider is currently active on the team)
ALTER TABLE "draft_picks" ADD COLUMN IF NOT EXISTS "droppedAt" TIMESTAMPTZ;

-- Step 3: Create partial unique index (only enforces uniqueness for active, non-dropped picks)
-- This allows the same rider to be re-added to the same league after being dropped.
CREATE UNIQUE INDEX IF NOT EXISTS "draft_picks_rider_league_unique"
  ON "draft_picks" ("leagueId", "riderId")
  WHERE "droppedAt" IS NULL;
