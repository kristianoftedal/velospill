-- Link a velospill race to its Tissot Timing competition so intermediate sprint
-- and per-climb mountain points can be imported.
-- Format: "<code><year>" e.g. "vue2026", "tdf2026".
-- Set on the parent race; stages inherit it.
ALTER TABLE "races" ADD COLUMN IF NOT EXISTS "tissotCompetitionCode" text;
