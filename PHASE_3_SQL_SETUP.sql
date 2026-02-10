-- ================================================
-- Phase 3: Social Media Execution - SQL Setup
-- ================================================
-- Run this in Supabase SQL Editor
-- Date: February 10, 2026

-- ================================================
-- STEP 1: Verify Tables Exist
-- ================================================

-- Check if social_accounts table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_accounts') THEN
    RAISE EXCEPTION 'social_accounts table does not exist. Run migration 20240208_social_media_integration_fixed.sql first';
  END IF;
END $$;

-- Check if social_posts table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_posts') THEN
    RAISE EXCEPTION 'social_posts table does not exist. Run migration 003_schema_extensions_fixed.sql first';
  END IF;
END $$;

-- Display current table structures
SELECT
  'social_accounts' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'social_accounts'
ORDER BY ordinal_position;

SELECT
  'social_posts' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'social_posts'
ORDER BY ordinal_position;

-- ================================================
-- STEP 1.5: Add Missing Columns (if needed)
-- ================================================

-- Add is_active column to social_accounts if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_accounts' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE social_accounts ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added is_active column to social_accounts';
  ELSE
    RAISE NOTICE 'is_active column already exists in social_accounts';
  END IF;
END $$;

-- Add metadata column to squad_tasks if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'squad_tasks' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE squad_tasks ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added metadata column to squad_tasks';
  ELSE
    RAISE NOTICE 'metadata column already exists in squad_tasks';
  END IF;
END $$;

-- Add requires_approval column to squad_tasks if it doesn't exist (from Phase 1)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'squad_tasks' AND column_name = 'requires_approval'
  ) THEN
    ALTER TABLE squad_tasks ADD COLUMN requires_approval BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added requires_approval column to squad_tasks';
  ELSE
    RAISE NOTICE 'requires_approval column already exists in squad_tasks';
  END IF;
END $$;

-- Add approved_at column to squad_tasks if it doesn't exist (from Phase 1)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'squad_tasks' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE squad_tasks ADD COLUMN approved_at TIMESTAMPTZ;
    RAISE NOTICE 'Added approved_at column to squad_tasks';
  ELSE
    RAISE NOTICE 'approved_at column already exists in squad_tasks';
  END IF;
END $$;

-- ================================================
-- STEP 2: Insert OAuth Credentials
-- ================================================
-- IMPORTANT: Replace placeholder values with your actual tokens

-- Twitter/X Account
-- Get tokens from environment variables or Twitter Developer Portal
INSERT INTO social_accounts (
  platform,
  account_id,
  account_name,
  access_token,
  refresh_token,
  is_active,
  metadata
) VALUES (
  'twitter',
  'audico_twitter_id',  -- Your Twitter account ID
  'Audico SA',
  'YOUR_TWITTER_ACCESS_TOKEN_HERE',  -- Replace with actual token
  'YOUR_TWITTER_REFRESH_TOKEN_HERE',  -- Replace with actual token
  true,
  '{"username": "audico_sa"}'::jsonb
)
ON CONFLICT (platform, account_id)
DO UPDATE SET
  access_token = EXCLUDED.access_token,
  refresh_token = EXCLUDED.refresh_token,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Facebook Page Account
-- Get token from Graph API Explorer: https://developers.facebook.com/tools/explorer
-- Must be a LONG-LIVED Page Access Token (see PHASE_3_HANDOVER.md for instructions)
INSERT INTO social_accounts (
  platform,
  account_id,
  account_name,
  access_token,
  is_active,
  metadata
) VALUES (
  'facebook',
  'YOUR_FACEBOOK_PAGE_ID_HERE',  -- Replace with your Page ID
  'Audico',
  'YOUR_LONG_LIVED_PAGE_TOKEN_HERE',  -- Replace with actual token
  true,
  '{"page_id": "YOUR_FACEBOOK_PAGE_ID_HERE", "page_name": "Audico"}'::jsonb
)
ON CONFLICT (platform, account_id)
DO UPDATE SET
  access_token = EXCLUDED.access_token,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Instagram Business Account
-- Must be linked to Facebook Page
-- Use same Page Access Token as Facebook
-- Get Instagram Account ID: curl "https://graph.facebook.com/v18.0/PAGE_ID?fields=instagram_business_account&access_token=PAGE_TOKEN"
INSERT INTO social_accounts (
  platform,
  account_id,
  account_name,
  access_token,
  is_active,
  metadata
) VALUES (
  'instagram',
  'YOUR_INSTAGRAM_BUSINESS_ACCOUNT_ID_HERE',  -- Replace with IG Business ID
  'Audico',
  'YOUR_PAGE_TOKEN_HERE',  -- Same token as Facebook Page
  true,
  '{"instagram_account_id": "YOUR_INSTAGRAM_BUSINESS_ACCOUNT_ID_HERE", "page_id": "YOUR_FACEBOOK_PAGE_ID_HERE"}'::jsonb
)
ON CONFLICT (platform, account_id)
DO UPDATE SET
  access_token = EXCLUDED.access_token,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ================================================
-- STEP 3: Verify Credentials Inserted
-- ================================================

SELECT
  platform,
  account_name,
  account_id,
  is_active,
  CASE
    WHEN access_token IS NOT NULL THEN '✅ Token exists'
    ELSE '❌ Missing token'
  END as token_status,
  metadata,
  created_at,
  updated_at
FROM social_accounts
ORDER BY platform;

-- ================================================
-- STEP 4: Create Test Social Post (Optional)
-- ================================================
-- Uncomment to create a test post for dry-run testing

/*
INSERT INTO social_posts (
  platform,
  content,
  status,
  created_by
) VALUES (
  'twitter',
  'Test post from Audico Mission Control! 🚀 Phase 3 testing in progress.',
  'draft',
  'Social Media Agent'
)
RETURNING
  id as post_id,
  platform,
  content,
  status;
*/

-- ================================================
-- STEP 5: Create Test Approval Task (Optional)
-- ================================================
-- Uncomment and replace POST_ID with the ID from Step 4

/*
INSERT INTO squad_tasks (
  title,
  description,
  status,
  assigned_agent,
  priority,
  requires_approval,
  metadata
) VALUES (
  'Approve test tweet - Phase 3',
  'Testing Phase 3 social media publishing with Twitter',
  'new',
  'Social Media Agent',
  'medium',
  true,
  '{"post_id": "POST_ID_FROM_STEP_4", "platform": "twitter"}'::jsonb
)
RETURNING
  id as task_id,
  title,
  requires_approval,
  metadata;
*/

-- ================================================
-- STEP 6: Check RLS Policies
-- ================================================
-- Ensure service role can access tables

SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('social_accounts', 'social_posts', 'squad_tasks')
ORDER BY tablename;

-- If RLS is enabled and blocking service role, disable it:
-- (Usually not needed if using SUPABASE_SERVICE_ROLE_KEY)

/*
ALTER TABLE social_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts DISABLE ROW LEVEL SECURITY;
*/

-- ================================================
-- VERIFICATION QUERIES
-- ================================================

-- Check for existing test posts
SELECT
  id,
  platform,
  content,
  status,
  post_url,
  published_at,
  created_at
FROM social_posts
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 5;

-- Check for pending social media tasks
SELECT
  id,
  title,
  status,
  assigned_agent,
  requires_approval,
  approved_at,
  metadata->>'platform' as platform,
  metadata->>'post_id' as post_id,
  created_at
FROM squad_tasks
WHERE assigned_agent = 'Social Media Agent'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 5;

-- ================================================
-- DONE!
-- ================================================
-- Next steps:
-- 1. Verify all 3 platforms show "✅ Token exists" in Step 3 query
-- 2. Set AGENT_DRY_RUN=true in Vercel
-- 3. Create test post and task (uncomment Steps 4-5)
-- 4. Approve task via /api/tasks/{id}/approve
-- 5. Wait 2 minutes for task executor
-- 6. Check Vercel logs for: [DRY RUN] Would publish post
-- 7. Once dry-run succeeds, set AGENT_DRY_RUN=false
-- 8. Test real publishing (Twitter first, then Facebook, then Instagram)
