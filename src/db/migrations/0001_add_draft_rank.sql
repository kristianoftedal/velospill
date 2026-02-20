-- Add draft_rank column to riders table
ALTER TABLE "riders" ADD COLUMN "draft_rank" integer DEFAULT 9999;

-- Create index for draft_rank for faster sorting during drafts
CREATE INDEX IF NOT EXISTS "riders_draft_rank_idx" ON "riders" ("draft_rank");
