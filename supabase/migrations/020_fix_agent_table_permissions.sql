-- Migration 020: Fix Agent Content Table Permissions
-- The social_posts, social_accounts, seo_audits, ad_campaigns and other
-- agent content tables have RLS enabled but only allow the 'authenticated' role.
-- The dashboard uses the anon key, so we need to grant anon access and add
-- permissive RLS policies — matching the pattern used in migration 009
-- for squad_tasks, squad_messages, etc.
--
-- RUN THIS IN SUPABASE SQL EDITOR

-- ============================================
-- 1. GRANT anon access to agent content tables
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON social_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON social_accounts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON seo_audits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON seo_schema_audits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON seo_vitals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON seo_geo_results TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ad_campaigns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON influencer_opportunities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON outreach_tracking TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO anon;

-- ============================================
-- 2. Add RLS policies for anon role
-- ============================================

-- Social posts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon full access to social_posts') THEN
    CREATE POLICY "Allow anon full access to social_posts"
      ON social_posts FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Social accounts (read-only for anon — tokens should not be exposed to frontend)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon read social_accounts') THEN
    CREATE POLICY "Allow anon read social_accounts"
      ON social_accounts FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- SEO audits
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon full access to seo_audits') THEN
    CREATE POLICY "Allow anon full access to seo_audits"
      ON seo_audits FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- SEO schema audits
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon full access to seo_schema_audits') THEN
    CREATE POLICY "Allow anon full access to seo_schema_audits"
      ON seo_schema_audits FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- SEO vitals
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon full access to seo_vitals') THEN
    CREATE POLICY "Allow anon full access to seo_vitals"
      ON seo_vitals FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- SEO GEO results
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon full access to seo_geo_results') THEN
    CREATE POLICY "Allow anon full access to seo_geo_results"
      ON seo_geo_results FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Ad campaigns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon full access to ad_campaigns') THEN
    CREATE POLICY "Allow anon full access to ad_campaigns"
      ON ad_campaigns FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Influencer opportunities
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon full access to influencer_opportunities') THEN
    CREATE POLICY "Allow anon full access to influencer_opportunities"
      ON influencer_opportunities FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Outreach tracking
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon full access to outreach_tracking') THEN
    CREATE POLICY "Allow anon full access to outreach_tracking"
      ON outreach_tracking FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Products (read-only for anon)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon read products') THEN
    CREATE POLICY "Allow anon read products"
      ON products FOR SELECT TO anon USING (true);
  END IF;
END $$;
