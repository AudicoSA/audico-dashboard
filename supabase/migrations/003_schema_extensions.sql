-- Schema Extensions Migration
-- Adds: email_classifications, social_posts, ad_campaigns, seo_audits, reseller_applications
-- Extends: squad_messages with data JSONB column

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
CREATE POLICY "Allow all for authenticated" ON email_classifications FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON social_posts FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON ad_campaigns FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON seo_audits FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON reseller_applications FOR ALL USING (true);

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
