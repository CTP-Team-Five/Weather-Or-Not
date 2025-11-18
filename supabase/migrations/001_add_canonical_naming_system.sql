-- Migration: Add canonical naming, slugs, popularity, and tags to pins table
-- Run this in your Supabase SQL Editor

-- Add new columns to pins table
ALTER TABLE pins
ADD COLUMN IF NOT EXISTS canonical_name TEXT,
ADD COLUMN IF NOT EXISTS slug TEXT,
ADD COLUMN IF NOT EXISTS popularity_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pins_canonical_name ON pins(canonical_name);
CREATE INDEX IF NOT EXISTS idx_pins_popularity ON pins(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_pins_slug ON pins(slug);

-- Add unique constraint on slug
ALTER TABLE pins
ADD CONSTRAINT unique_slug UNIQUE (slug);

-- Optionally backfill existing pins with default values
UPDATE pins
SET
  canonical_name = COALESCE(canonical_name, area),
  slug = COALESCE(slug, CONCAT(LOWER(REPLACE(area, ' ', '-')), '-', SUBSTRING(MD5(RANDOM()::TEXT), 1, 4))),
  popularity_score = COALESCE(popularity_score, 0),
  tags = COALESCE(tags, '{}')
WHERE canonical_name IS NULL OR slug IS NULL;

-- Make canonical_name and slug NOT NULL after backfill
ALTER TABLE pins
ALTER COLUMN canonical_name SET NOT NULL,
ALTER COLUMN slug SET NOT NULL;

-- Create function to increment popularity score
CREATE OR REPLACE FUNCTION increment_pin_popularity(pin_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE pins
  SET popularity_score = popularity_score + 1
  WHERE id = pin_id;
END;
$$ LANGUAGE plpgsql;
