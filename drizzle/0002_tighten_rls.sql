-- ============================================================
-- Migration 0002: tighten RLS so users only see/mutate their own pins
-- ============================================================
-- 0001 turned RLS on for the `pins` table but used `USING (true)` for
-- SELECT and `auth.role() = 'authenticated'` for UPDATE/DELETE — i.e.
-- RLS-on-paper, wide-open in practice. Result: any anon visitor or
-- signed-in user could SELECT every row, and any signed-in user could
-- UPDATE/DELETE another user's pins.
--
-- This migration:
--   1. Drops the four permissive policies on `pins`
--   2. Replaces them with owner-aware policies that join through
--      `user_pins` so SELECT/UPDATE/DELETE only succeed for rows the
--      caller actually owns
--   3. Leaves `user_pins` policies from 0001 in place — those are
--      already correct (auth.uid() = user_id)
--   4. Enables RLS on the three advisor-flagged tables (`users`,
--      `settings`, `user_settings`) with NO policies. These are
--      currently aspirational (per CLAUDE.md the auth/settings
--      surfaces aren't wired up), so locking them down is the right
--      default — the Supabase trigger that writes to public.users on
--      signup uses SECURITY DEFINER and bypasses RLS, so signup still
--      works.
--
-- Reversible. To roll back any individual table:
--   ALTER TABLE public.<name> DISABLE ROW LEVEL SECURITY;
-- (then re-create the old policies if you want the 0001 behavior).

-- ============================================================
-- (Optional) Pre-flight checks — run these in the SQL editor BEFORE
-- the migration to confirm no pins will be lost.
-- ============================================================
-- -- How many pins each account owns via user_pins:
-- SELECT u.email, COUNT(up.pin_id) AS linked_pins
-- FROM auth.users u
-- LEFT JOIN public.user_pins up ON up.user_id = u.id
-- GROUP BY u.email
-- ORDER BY linked_pins DESC;
--
-- -- Orphan pins (in `pins` but no user_pins link). After this
-- -- migration these become invisible to everyone except service_role.
-- SELECT COUNT(*) AS total_pins,
--        COUNT(*) FILTER (
--          WHERE id NOT IN (SELECT pin_id FROM public.user_pins)
--        ) AS orphan_pins
-- FROM public.pins;

-- ============================================================
-- 1. Drop existing policies — both the 0001 old names AND the 0002
--    new names (so this file is safe to re-run after a partial apply
--    without "policy already exists" errors).
-- ============================================================
DROP POLICY IF EXISTS "Pins are publicly readable"          ON public.pins;
DROP POLICY IF EXISTS "Authenticated users can insert pins" ON public.pins;
DROP POLICY IF EXISTS "Authenticated users can update pins" ON public.pins;
DROP POLICY IF EXISTS "Authenticated users can delete pins" ON public.pins;
DROP POLICY IF EXISTS "auth users insert pins"              ON public.pins;
DROP POLICY IF EXISTS "users read pins they own"            ON public.pins;
DROP POLICY IF EXISTS "users update pins they own"          ON public.pins;
DROP POLICY IF EXISTS "users delete pins they own"          ON public.pins;

-- ============================================================
-- 2. Owner-aware policies on pins
--    Ownership is recorded in user_pins (the join table), not on
--    pins itself, so each policy joins through it.
-- ============================================================

-- Insert: any authenticated user can create a pin row. Until they
-- also write the matching user_pins link, the row is invisible even
-- to them, so this can't leak data — at worst a user creates orphans
-- they can't see. The client always writes both rows.
CREATE POLICY "auth users insert pins"
  ON public.pins FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "users read pins they own"
  ON public.pins FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_pins up
      WHERE up.pin_id = pins.id
        AND up.user_id = auth.uid()
    )
  );

CREATE POLICY "users update pins they own"
  ON public.pins FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_pins up
      WHERE up.pin_id = pins.id
        AND up.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_pins up
      WHERE up.pin_id = pins.id
        AND up.user_id = auth.uid()
    )
  );

CREATE POLICY "users delete pins they own"
  ON public.pins FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_pins up
      WHERE up.pin_id = pins.id
        AND up.user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. user_pins — 0001's policies are already correct
--    (auth.uid() = user_id for SELECT/INSERT/DELETE). Nothing to do.
-- ============================================================

-- ============================================================
-- 4. Lock the advisor-flagged aspirational tables
-- ============================================================
ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- No policies on these three = default deny for all roles except
-- service_role and SECURITY DEFINER functions (which bypass RLS).
-- The signup trigger from 0001 (handle_new_user) uses SECURITY DEFINER
-- so user creation still works. Add policies later when these tables
-- are actually consumed by features.
