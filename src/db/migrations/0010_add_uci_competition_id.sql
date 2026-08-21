-- Link a velospill race to its UCI competition so results can be imported.
-- Format: "<year>/<disciplineCode>/<competitionId>" e.g. "2026/ROA/76940".
-- Set on the parent race (or the race itself for one-day events); stages inherit it.
ALTER TABLE "races" ADD COLUMN IF NOT EXISTS "uciCompetitionId" text;
