-- Add user_id to pins, referencing Supabase auth.users (nullable for backward compat)
ALTER TABLE pins ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

-- Anyone can read all pins (needed for TopSpots cross-user discovery)
CREATE POLICY "Pins are publicly readable"
  ON pins FOR SELECT
  USING (true);

-- Only authenticated users can insert their own pins
CREATE POLICY "Users can insert own pins"
  ON pins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only the owner can update their pins
CREATE POLICY "Users can update own pins"
  ON pins FOR UPDATE
  USING (auth.uid() = user_id);

-- Only the owner can delete their pins
CREATE POLICY "Users can delete own pins"
  ON pins FOR DELETE
  USING (auth.uid() = user_id);
