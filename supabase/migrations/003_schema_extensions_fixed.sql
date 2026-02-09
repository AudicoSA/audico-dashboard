-- Schema Extensions Migration (FIXED for existing agent_logs table)
-- Adds: email_classifications, social_posts, ad_campaigns, seo_audits, reseller_applications
-- Extends: squad_messages with data JSONB column
-- Fixes: agent_logs table schema

-- ============================================
-- EMAIL_CLASSIFICATIONS: Email management and classification
-- ============================================
CREATE TABLE IF NOT EXISTS email_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT,
    classification TEXT NOT NULL CHECK (classification IN ('order', 'support', 'inquiry', 'complaint', 'spam', 'other')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_agent TEXT REFERENCES squad_agents(name) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'archived')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for email_classifications
CREATE INDEX IF NOT EXISTS idx_email_classifications_status ON email_classifications(status);
CREATE INDEX IF NOT EXISTS idx_email_classifications_classification ON email_classifications(classification);
CREATE INDEX IF NOT EXISTS idx_email_classifications_priority ON email_classifications(priority);
CREATE INDEX IF NOT EXISTS idx_email_classifications_agent ON email_classifications(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_email_classifications_created ON email_classifications(created_at DESC);

-- ============================================
-- SOCIAL_POSTS: Social media content management
-- ============================================
CREATE TABLE IF NOT EXISTS social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube')),
    content TEXT NOT NULL,
    media_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    post_url TEXT,
    engagement JSONB DEFAULT '{"likes": 0, "comments": 0, "shares": 0}'::jsonb,
    created_by TEXT REFERENCES squad_agents(name) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for social_posts
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_social_posts_created ON social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_created_by ON social_posts(created_by);

-- ============================================
-- AD_CAMPAIGNS: Advertising campaign management
-- ============================================
CREATE TABLE IF NOT EXISTS ad_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('google_ads', 'facebook_ads', 'instagram_ads', 'linkedin_ads', 'tiktok_ads')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
    budget_total DECIMAL(10, 2),
    budget_spent DECIMAL(10, 2) DEFAULT 0,
    currency TEXT DEFAULT 'ZAR',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    target_audience JSONB DEFAULT '{}'::jsonb,
    ad_content JSONB DEFAULT '{}'::jsonb,
    performance_metrics JSONB DEFAULT '{"impressions": 0, "clicks": 0, "conversions": 0, "ctr": 0, "cpc": 0, "roas": 0}'::jsonb,
    managed_by TEXT REFERENCES squad_agents(name) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ad_campaigns
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_platform ON ad_campaigns(platform);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON ad_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_managed_by ON ad_campaigns(managed_by);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_start_date ON ad_campaigns(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_created ON ad_campaigns(created_at DESC);

-- ============================================
-- SEO_AUDITS: SEO audit tracking and results
-- ============================================
CREATE TABLE IF NOT EXISTS seo_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    audit_type TEXT NOT NULL CHECK (audit_type IN ('full_site', 'page', 'technical', 'content', 'backlinks')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    score INTEGER CHECK (score >= 0 AND score <= 100),
    issues_found JSONB DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,
    metrics JSONB DEFAULT '{}'::jsonb,
    performed_by TEXT REFERENCES squad_agents(name) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for seo_audits
CREATE INDEX IF NOT EXISTS idx_seo_audits_url ON seo_audits(url);
CREATE INDEX IF NOT EXISTS idx_seo_audits_audit_type ON seo_audits(audit_type);
CREATE INDEX IF NOT EXISTS idx_seo_audits_status ON seo_audits(status);
CREATE INDEX IF NOT EXISTS idx_seo_audits_score ON seo_audits(score);
CREATE INDEX IF NOT EXISTS idx_seo_audits_performed_by ON seo_audits(performed_by);
CREATE INDEX IF NOT EXISTS idx_seo_audits_created ON seo_audits(created_at DESC);

-- ============================================
-- RESELLER_APPLICATIONS: Reseller program applications
-- ============================================
CREATE TABLE IF NOT EXISTS reseller_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    business_type TEXT,
    website TEXT,
    annual_revenue TEXT,
    target_market TEXT,
    experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'on_hold')),
    reviewed_by TEXT REFERENCES squad_agents(name) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    approval_notes TEXT,
    business_details JSONB DEFAULT '{}'::jsonb,
    documents JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for reseller_applications
CREATE INDEX IF NOT EXISTS idx_reseller_applications_status ON reseller_applications(status);
CREATE INDEX IF NOT EXISTS idx_reseller_applications_email ON reseller_applications(contact_email);
CREATE INDEX IF NOT EXISTS idx_reseller_applications_reviewed_by ON reseller_applications(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_reseller_applications_created ON reseller_applications(created_at DESC);

-- ============================================
-- EXTEND SQUAD_MESSAGES: Add data JSONB column
-- ============================================
ALTER TABLE squad_messages ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- Index for JSONB queries on squad_messages.data
CREATE INDEX IF NOT EXISTS idx_squad_messages_data ON squad_messages USING gin(data);

-- ============================================
-- Enable RLS (Row Level Security)
-- ============================================
ALTER TABLE email_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all operations for authenticated users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'email_classifications'
        AND policyname = 'Allow all for authenticated'
    ) THEN
        CREATE POLICY "Allow all for authenticated" ON email_classifications FOR ALL USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'social_posts'
        AND policyname = 'Allow all for authenticated'
    ) THEN
        CREATE POLICY "Allow all for authenticated" ON social_posts FOR ALL USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'ad_campaigns'
        AND policyname = 'Allow all for authenticated'
    ) THEN
        CREATE POLICY "Allow all for authenticated" ON ad_campaigns FOR ALL USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'seo_audits'
        AND policyname = 'Allow all for authenticated'
    ) THEN
        CREATE POLICY "Allow all for authenticated" ON seo_audits FOR ALL USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'reseller_applications'
        AND policyname = 'Allow all for authenticated'
    ) THEN
        CREATE POLICY "Allow all for authenticated" ON reseller_applications FOR ALL USING (true);
    END IF;
END $$;

-- ============================================
-- Updated_at triggers for new tables
-- ============================================
DROP TRIGGER IF EXISTS update_email_classifications_updated_at ON email_classifications;
CREATE TRIGGER update_email_classifications_updated_at
    BEFORE UPDATE ON email_classifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_posts_updated_at ON social_posts;
CREATE TRIGGER update_social_posts_updated_at
    BEFORE UPDATE ON social_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ad_campaigns_updated_at ON ad_campaigns;
CREATE TRIGGER update_ad_campaigns_updated_at
    BEFORE UPDATE ON ad_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_seo_audits_updated_at ON seo_audits;
CREATE TRIGGER update_seo_audits_updated_at
    BEFORE UPDATE ON seo_audits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reseller_applications_updated_at ON reseller_applications;
CREATE TRIGGER update_reseller_applications_updated_at
    BEFORE UPDATE ON reseller_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- APPROVED_RESELLERS: Track approved resellers with order history
-- ============================================
CREATE TABLE IF NOT EXISTS approved_resellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES reseller_applications(id) ON DELETE SET NULL,
    company_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    website TEXT,
    commission_rate DECIMAL(5, 2) DEFAULT 10.00,
    discount_tier TEXT DEFAULT 'standard' CHECK (discount_tier IN ('standard', 'premium', 'platinum')),
    total_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(12, 2) DEFAULT 0,
    last_order_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for approved_resellers
CREATE INDEX IF NOT EXISTS idx_approved_resellers_status ON approved_resellers(status);
CREATE INDEX IF NOT EXISTS idx_approved_resellers_email ON approved_resellers(contact_email);
CREATE INDEX IF NOT EXISTS idx_approved_resellers_created ON approved_resellers(created_at DESC);

-- ============================================
-- RESELLER_ORDERS: Track individual reseller orders
-- ============================================
CREATE TABLE IF NOT EXISTS reseller_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reseller_id UUID NOT NULL REFERENCES approved_resellers(id) ON DELETE CASCADE,
    order_reference TEXT NOT NULL,
    order_date TIMESTAMPTZ DEFAULT NOW(),
    total_amount DECIMAL(12, 2) NOT NULL,
    commission_amount DECIMAL(12, 2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
    items JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for reseller_orders
CREATE INDEX IF NOT EXISTS idx_reseller_orders_reseller_id ON reseller_orders(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_orders_status ON reseller_orders(status);
CREATE INDEX IF NOT EXISTS idx_reseller_orders_date ON reseller_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_reseller_orders_created ON reseller_orders(created_at DESC);

-- ============================================
-- NEWSLETTER_DRAFTS: Newsletter content management
-- ============================================
CREATE TABLE IF NOT EXISTS newsletter_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subject_line TEXT NOT NULL,
    preview_text TEXT,
    content TEXT NOT NULL,
    html_content TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'scheduled', 'sent')),
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    recipient_count INTEGER DEFAULT 0,
    open_rate DECIMAL(5, 2),
    click_rate DECIMAL(5, 2),
    ai_suggestions JSONB DEFAULT '[]'::jsonb,
    created_by TEXT REFERENCES squad_agents(name) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for newsletter_drafts
CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_status ON newsletter_drafts(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_scheduled ON newsletter_drafts(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_created_by ON newsletter_drafts(created_by);
CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_created ON newsletter_drafts(created_at DESC);

-- ============================================
-- INFLUENCER_OPPORTUNITIES: Track influencer partnerships
-- ============================================
CREATE TABLE IF NOT EXISTS influencer_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'youtube', 'tiktok', 'twitter', 'linkedin', 'facebook')),
    handle TEXT NOT NULL,
    follower_count INTEGER,
    engagement_rate DECIMAL(5, 2),
    niche TEXT,
    status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'contacted', 'negotiating', 'agreed', 'active', 'completed', 'declined')),
    outreach_date TIMESTAMPTZ,
    response_date TIMESTAMPTZ,
    campaign_start TIMESTAMPTZ,
    campaign_end TIMESTAMPTZ,
    budget_allocated DECIMAL(10, 2),
    budget_spent DECIMAL(10, 2) DEFAULT 0,
    deliverables JSONB DEFAULT '[]'::jsonb,
    performance_metrics JSONB DEFAULT '{"reach": 0, "impressions": 0, "clicks": 0, "conversions": 0}'::jsonb,
    notes TEXT,
    managed_by TEXT REFERENCES squad_agents(name) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for influencer_opportunities
CREATE INDEX IF NOT EXISTS idx_influencer_opportunities_platform ON influencer_opportunities(platform);
CREATE INDEX IF NOT EXISTS idx_influencer_opportunities_status ON influencer_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_influencer_opportunities_managed_by ON influencer_opportunities(managed_by);
CREATE INDEX IF NOT EXISTS idx_influencer_opportunities_created ON influencer_opportunities(created_at DESC);

-- ============================================
-- Enable RLS for new tables
-- ============================================
ALTER TABLE approved_resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_opportunities ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all operations for authenticated users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'approved_resellers'
        AND policyname = 'Allow all for authenticated'
    ) THEN
        CREATE POLICY "Allow all for authenticated" ON approved_resellers FOR ALL USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'reseller_orders'
        AND policyname = 'Allow all for authenticated'
    ) THEN
        CREATE POLICY "Allow all for authenticated" ON reseller_orders FOR ALL USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'newsletter_drafts'
        AND policyname = 'Allow all for authenticated'
    ) THEN
        CREATE POLICY "Allow all for authenticated" ON newsletter_drafts FOR ALL USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'influencer_opportunities'
        AND policyname = 'Allow all for authenticated'
    ) THEN
        CREATE POLICY "Allow all for authenticated" ON influencer_opportunities FOR ALL USING (true);
    END IF;
END $$;

-- ============================================
-- Updated_at triggers for new tables
-- ============================================
DROP TRIGGER IF EXISTS update_approved_resellers_updated_at ON approved_resellers;
CREATE TRIGGER update_approved_resellers_updated_at
    BEFORE UPDATE ON approved_resellers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reseller_orders_updated_at ON reseller_orders;
CREATE TRIGGER update_reseller_orders_updated_at
    BEFORE UPDATE ON reseller_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_newsletter_drafts_updated_at ON newsletter_drafts;
CREATE TRIGGER update_newsletter_drafts_updated_at
    BEFORE UPDATE ON newsletter_drafts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_influencer_opportunities_updated_at ON influencer_opportunities;
CREATE TRIGGER update_influencer_opportunities_updated_at
    BEFORE UPDATE ON influencer_opportunities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- AGENT_LOGS: Agent error and activity logging
-- FIX: Use ALTER TABLE to add columns to existing table
-- ============================================

-- Create table if it doesn't exist (with all columns)
CREATE TABLE IF NOT EXISTS agent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL,
    log_level TEXT NOT NULL CHECK (log_level IN ('info', 'warning', 'error', 'critical')),
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    error_details JSONB,
    context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if table already existed with old schema
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS log_level TEXT;
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS error_details JSONB;
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}'::jsonb;
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add constraints if they don't exist (will fail silently if they do)
DO $$
BEGIN
    -- Add NOT NULL constraints
    ALTER TABLE agent_logs ALTER COLUMN agent_name SET NOT NULL;
EXCEPTION
    WHEN others THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE agent_logs ALTER COLUMN log_level SET NOT NULL;
EXCEPTION
    WHEN others THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE agent_logs ALTER COLUMN event_type SET NOT NULL;
EXCEPTION
    WHEN others THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE agent_logs ALTER COLUMN message SET NOT NULL;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- Add CHECK constraint for log_level if it doesn't exist
DO $$
BEGIN
    ALTER TABLE agent_logs ADD CONSTRAINT agent_logs_log_level_check
        CHECK (log_level IN ('info', 'warning', 'error', 'critical'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for agent_logs (safe to create even if table existed)
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_name ON agent_logs(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_logs_log_level ON agent_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_agent_logs_event_type ON agent_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON agent_logs(created_at DESC);

-- Enable RLS for agent_logs
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all operations for authenticated users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'agent_logs'
        AND policyname = 'Allow all for authenticated'
    ) THEN
        CREATE POLICY "Allow all for authenticated" ON agent_logs FOR ALL USING (true);
    END IF;
END $$;
