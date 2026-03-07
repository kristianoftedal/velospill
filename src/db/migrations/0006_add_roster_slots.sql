-- Create roster_slot_status enum
DO $$ BEGIN
  CREATE TYPE roster_slot_status AS ENUM ('active', 'on_ir', 'return_eligible');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create roster_slots table
CREATE TABLE IF NOT EXISTS "roster_slots" (
  "id" serial PRIMARY KEY NOT NULL,
  "leagueId" integer NOT NULL REFERENCES "leagues"("id") ON DELETE CASCADE,
  "teamId" integer NOT NULL REFERENCES "teams"("id"),
  "riderId" integer NOT NULL REFERENCES "riders"("id"),
  "status" "roster_slot_status" NOT NULL DEFAULT 'active',
  "addedAt" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "roster_slots_rider_league_unique" ON "roster_slots" ("leagueId", "riderId");
CREATE INDEX IF NOT EXISTS "roster_slots_league_idx" ON "roster_slots" ("leagueId");
CREATE INDEX IF NOT EXISTS "roster_slots_team_idx" ON "roster_slots" ("teamId");
