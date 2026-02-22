CREATE TABLE IF NOT EXISTS "bonus_riders" (
  "id" serial PRIMARY KEY,
  "leagueId" integer NOT NULL REFERENCES "leagues"("id") ON DELETE CASCADE,
  "teamId" integer NOT NULL REFERENCES "teams"("id"),
  "riderId" integer NOT NULL REFERENCES "riders"("id"),
  "raceId" integer NOT NULL REFERENCES "races"("id"),
  "orderId" integer REFERENCES "orders"("id"),
  "pickOrder" integer NOT NULL,
  "pickedAt" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "bonus_riders_league_idx" ON "bonus_riders" ("leagueId");
CREATE INDEX IF NOT EXISTS "bonus_riders_team_idx" ON "bonus_riders" ("teamId");
CREATE INDEX IF NOT EXISTS "bonus_riders_race_idx" ON "bonus_riders" ("raceId");
CREATE UNIQUE INDEX IF NOT EXISTS "bonus_riders_league_race_team_unique" ON "bonus_riders" ("leagueId", "raceId", "teamId");
