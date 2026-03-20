-- ============================================================
-- Migration: Auth trigger + RLS for user_pins join model
-- ============================================================

-- 1. Auto-create a public.users row when someone signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. RLS on pins — publicly readable, authenticated users can write
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pins are publicly readable"
  ON pins FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert pins"
  ON pins FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update pins"
  ON pins FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete pins"
  ON pins FOR DELETE
  USING (auth.role() = 'authenticated');

-- 3. RLS on user_pins — users manage only their own associations
ALTER TABLE user_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own saved pins"
  ON user_pins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save pins"
  ON user_pins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave pins"
  ON user_pins FOR DELETE
  USING (auth.uid() = user_id);
