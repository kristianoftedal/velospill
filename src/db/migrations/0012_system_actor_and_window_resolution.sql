-- Fixes the waiver-resolution cron (/api/cron/resolve-waivers).
--
-- 1. The resolver writes the literal actor id 'system' to transfer_bids.resolvedBy,
--    transfer_audit.performedBy and orders.resolvedBy, all of which are FKs to
--    "user"("id"). No such row existed, so every system-actor write raised a
--    foreign key violation and the cron silently resolved nothing.
--
-- 2. Waiver windows were matched by "closesAt within ±3h of now", which only ever
--    lined up with the 02:00 UTC cron by luck and never matched windows closed
--    early from the admin UI. Windows now carry an explicit resolvedAt marker.

INSERT INTO "user" ("id", "name", "email", "emailVerified", "role")
VALUES ('system', 'System', 'system@velospill.local', true, 'system')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

ALTER TABLE "transfer_windows"
  ADD COLUMN IF NOT EXISTS "resolvedAt" timestamp with time zone;
--> statement-breakpoint

-- Backfill: every window that already closed is marked resolved so the first run
-- after deploy does not retroactively approve a backlog of stale bids. Clear
-- resolvedAt on a specific window to let the cron pick it up.
UPDATE "transfer_windows"
SET "resolvedAt" = "closesAt"
WHERE "windowType" = 'waiver'
  AND "closesAt" <= now()
  AND "resolvedAt" IS NULL;
