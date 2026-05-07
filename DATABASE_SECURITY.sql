-- ==========================================
-- BUBU GEBEYA - DATABASE SECURITY POLICIES
-- ==========================================
-- Run these commands in your Supabase SQL Editor to lock down the database.

-- 1. Enable RLS on all tables
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Allow reading reports (Needed for admin dashboard)
DROP POLICY IF EXISTS "Public read for reports" ON reports;
CREATE POLICY "Public read for reports" ON reports 
FOR SELECT USING (true);

-- Allow authenticated users to insert reports
DROP POLICY IF EXISTS "Public insert for reports" ON reports;
CREATE POLICY "Public insert for reports" ON reports 
FOR INSERT WITH CHECK (true);

-- 2. ADS TABLE POLICIES
-- Anyone can read active ads
DROP POLICY IF EXISTS "Public read for ads" ON ads;
CREATE POLICY "Public read for ads" ON ads 
FOR SELECT USING (true);

-- Authenticated users can insert ads
DROP POLICY IF EXISTS "Authenticated insert" ON ads;
CREATE POLICY "Authenticated insert" ON ads 
FOR INSERT TO authenticated 
WITH CHECK ((auth.uid())::text = user_id);

-- Users can only update their own ads
DROP POLICY IF EXISTS "Users can update own ads" ON ads;
CREATE POLICY "Users can update own ads" ON ads 
FOR UPDATE TO authenticated 
USING ((auth.uid())::text = user_id);

-- Users can only delete their own ads
DROP POLICY IF EXISTS "Users can delete own ads" ON ads;
CREATE POLICY "Users can delete own ads" ON ads 
FOR DELETE TO authenticated 
USING ((auth.uid())::text = user_id);

-- 3. PROFILES TABLE POLICIES
-- Users can read any profile (needed for seller profiles)
DROP POLICY IF EXISTS "Profiles are public" ON profiles;
CREATE POLICY "Profiles are public" ON profiles 
FOR SELECT USING (true);

-- Users can only update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles 
FOR UPDATE TO authenticated 
USING ((auth.uid())::text = id);

-- 4. STORAGE POLICIES (Run in Storage Settings)
-- Allow anyone to read photos
-- Allow authenticated users to upload to 'market-gallery'
-- Allow users to delete their own uploads (requires folder naming conventions)

-- ==========================================
-- GOD LEVEL TIP: Use 'service_role' key ONLY in the admin page (if hosted securely)
-- or better yet, use a dedicated admin flag in the profiles table.
-- ==========================================
