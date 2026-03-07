-- 050: Add rejection_reason column to offers
-- Stores admin's rejection reason/suggestion, shown to business owner
ALTER TABLE offers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
