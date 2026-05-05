-- ==========================================
-- BUBU GEBEYA - DATABASE SECURITY POLICIES
-- ==========================================
-- Run these commands in your Supabase SQL Editor to lock down the database.

-- 1. Enable RLS on all tables
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 2. ADS TABLE POLICIES
-- Anyone can read active ads
CREATE POLICY "Public read for ads" ON ads 
FOR SELECT USING (true);

-- Authenticated users can insert ads
CREATE POLICY "Authenticated insert" ON ads 
FOR INSERT TO authenticated 
WITH CHECK ((auth.uid())::text = user_id);

-- Users can only update their own ads
CREATE POLICY "Users can update own ads" ON ads 
FOR UPDATE TO authenticated 
USING ((auth.uid())::text = user_id);

-- Users can only delete their own ads
CREATE POLICY "Users can delete own ads" ON ads 
FOR DELETE TO authenticated 
USING ((auth.uid())::text = user_id);

-- 3. PROFILES TABLE POLICIES
-- Users can read any profile (needed for seller profiles)
CREATE POLICY "Profiles are public" ON profiles 
FOR SELECT USING (true);

-- Users can only update their own profile
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
