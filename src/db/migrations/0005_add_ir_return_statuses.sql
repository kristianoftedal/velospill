-- Add return_eligible and returned values to ir_status enum
ALTER TYPE ir_status ADD VALUE IF NOT EXISTS 'return_eligible';
ALTER TYPE ir_status ADD VALUE IF NOT EXISTS 'returned';
