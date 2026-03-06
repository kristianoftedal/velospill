-- Create IR status enum
DO $$ BEGIN
  CREATE TYPE ir_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create ir_requests table
CREATE TABLE IF NOT EXISTS "ir_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "leagueId" integer NOT NULL REFERENCES "leagues"("id") ON DELETE CASCADE,
  "teamId" integer NOT NULL REFERENCES "teams"("id"),
  "riderId" integer NOT NULL REFERENCES "riders"("id"),
  "status" "ir_status" NOT NULL DEFAULT 'pending',
  "reason" text,
  "adminNote" text,
  "submittedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "resolvedAt" timestamp with time zone,
  "resolvedBy" text REFERENCES "user"("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "ir_requests_league_idx" ON "ir_requests" ("leagueId");
CREATE INDEX IF NOT EXISTS "ir_requests_team_idx" ON "ir_requests" ("teamId");
CREATE INDEX IF NOT EXISTS "ir_requests_status_idx" ON "ir_requests" ("status");
