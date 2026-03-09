-- Make outRiderId nullable in transfer_bids to support pickup-without-drop
-- when a team has available roster slots
ALTER TABLE "transfer_bids" ALTER COLUMN "outRiderId" DROP NOT NULL;
