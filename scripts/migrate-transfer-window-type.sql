-- Add windowType column to transfer_windows: 'waiver' (default, bid-based) or 'free_agency' (instant)
ALTER TABLE transfer_windows ADD COLUMN IF NOT EXISTS "windowType" text NOT NULL DEFAULT 'waiver';

-- Migrate all existing windows to 'waiver' type (they all used bid-based resolution)
UPDATE transfer_windows SET "windowType" = 'waiver' WHERE "windowType" = 'waiver';
