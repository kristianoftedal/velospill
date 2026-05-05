-- Add isRestDay flag to races table (for Grand Tour rest day stages)
ALTER TABLE "races" ADD COLUMN "isRestDay" boolean NOT NULL DEFAULT false;

-- Add lineupPeriod to race_lineups (nullable: null = whole-race lineup, integer = period within Grand Tour)
ALTER TABLE "race_lineups" ADD COLUMN "lineupPeriod" integer;

-- Replace unique index to include lineupPeriod (allows same rider in different periods)
DROP INDEX IF EXISTS "race_lineups_unique";
CREATE UNIQUE INDEX "race_lineups_unique" ON "race_lineups" ("leagueId", "teamId", "raceId", "riderId", "lineupPeriod");
