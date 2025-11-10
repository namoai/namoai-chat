-- Add title column to reports table
ALTER TABLE reports ADD COLUMN IF NOT EXISTS title VARCHAR(255);

