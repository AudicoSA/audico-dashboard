-- Marketing Agent Tables Migration
-- Adds: newsletter_drafts, influencer_opportunities, outreach_tracking, reseller_orders

-- ============================================
-- NEWSLETTER_DRAFTS: Newsletter content management
-- ============================================
CREATE TABLE IF NOT EXISTS newsletter_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subject_line TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ai_suggested', 'reviewed', 'scheduled', 'sent')),
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    recipient_count INTEGER DEFAULT 0,
    open_rate DECIMAL(5, 2) DEFAULT 0,
    click_rate DECIMAL(5, 2) DEFAULT 0,
    ai_suggestions JSONB DEFAULT '[]'::jsonb,
    created_by TEXT REFERENCES squad_agents(name) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for newsletter_drafts
CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_status ON newsletter_drafts(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_scheduled ON newsletter_drafts(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_created ON newsletter_drafts(created_at DESC);

-- ============================================
-- INFLUENCER_OPPORTUNITIES: Influencer partnership tracking
-- ============================================
CREATE TABLE IF NOT EXISTS influencer_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    influencer_name TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'youtube', 'tiktok', 'twitter', 'facebook', 'linkedin')),
    handle TEXT NOT NULL,
    followers_count INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5, 2) DEFAULT 0,
    niche TEXT,
    status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'contacted', 'in_discussion', 'agreed', 'active', 'completed', 'rejected')),
    contact_email TEXT,
    deal_type TEXT CHECK (deal_type IN ('sponsored_post', 'product_review', 'affiliate', 'brand_ambassador', 'giveaway', 'collaboration')),
    compensation_offered TEXT,
    expected_reach INTEGER DEFAULT 0,
    engagement_metrics JSONB DEFAULT '{"likes": 0, "comments": 0, "shares": 0, "views": 0}'::jsonb,
    notes TEXT,
    contacted_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for influencer_opportunities
CREATE INDEX IF NOT EXISTS idx_influencer_opportunities_status ON influencer_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_influencer_opportunities_platform ON influencer_opportunities(platform);
CREATE INDEX IF NOT EXISTS idx_influencer_opportunities_engagement ON influencer_opportunities(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_influencer_opportunities_created ON influencer_opportunities(created_at DESC);

-- ============================================
-- OUTREACH_TRACKING: Track marketing outreach efforts
-- ============================================
CREATE TABLE IF NOT EXISTS outreach_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_name TEXT NOT NULL,
    outreach_type TEXT NOT NULL CHECK (outreach_type IN ('email', 'social_dm', 'phone_call', 'linkedin_message', 'partnership_inquiry')),
    target_name TEXT NOT NULL,
    target_email TEXT,
    target_company TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'replied', 'meeting_scheduled', 'deal_closed', 'no_response', 'rejected')),
    message_content TEXT,
    response_content TEXT,
    follow_up_date TIMESTAMPTZ,
    outcome TEXT,
    conversion_value DECIMAL(10, 2),
    sent_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for outreach_tracking
CREATE INDEX IF NOT EXISTS idx_outreach_tracking_status ON outreach_tracking(status);
CREATE INDEX IF NOT EXISTS idx_outreach_tracking_type ON outreach_tracking(outreach_type);
CREATE INDEX IF NOT EXISTS idx_outreach_tracking_campaign ON outreach_tracking(campaign_name);
CREATE INDEX IF NOT EXISTS idx_outreach_tracking_follow_up ON outreach_tracking(follow_up_date) WHERE status IN ('sent', 'opened');
CREATE INDEX IF NOT EXISTS idx_outreach_tracking_created ON outreach_tracking(created_at DESC);

-- ============================================
-- RESELLER_ORDERS: Track orders from approved resellers
-- ============================================
CREATE TABLE IF NOT EXISTS reseller_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reseller_id UUID NOT NULL REFERENCES reseller_applications(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL UNIQUE,
    total_amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'ZAR',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    items JSONB DEFAULT '[]'::jsonb,
    shipping_address JSONB DEFAULT '{}'::jsonb,
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
    notes TEXT,
    ordered_at TIMESTAMPTZ DEFAULT NOW(),
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for reseller_orders
CREATE INDEX IF NOT EXISTS idx_reseller_orders_reseller ON reseller_orders(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_orders_status ON reseller_orders(status);
CREATE INDEX IF NOT EXISTS idx_reseller_orders_payment ON reseller_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_reseller_orders_ordered ON reseller_orders(ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_reseller_orders_created ON reseller_orders(created_at DESC);

-- ============================================
-- Enable RLS (Row Level Security)
-- ============================================
ALTER TABLE newsletter_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated" ON newsletter_drafts FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON influencer_opportunities FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON outreach_tracking FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON reseller_orders FOR ALL USING (true);

-- ============================================
-- Updated_at triggers for new tables
-- ============================================
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

DROP TRIGGER IF EXISTS update_outreach_tracking_updated_at ON outreach_tracking;
CREATE TRIGGER update_outreach_tracking_updated_at
    BEFORE UPDATE ON outreach_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reseller_orders_updated_at ON reseller_orders;
CREATE TRIGGER update_reseller_orders_updated_at
    BEFORE UPDATE ON reseller_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Sample data for testing
-- ============================================
INSERT INTO newsletter_drafts (title, subject_line, content, status, ai_suggestions) VALUES
    ('February Promo Newsletter', 'Save 20% on Premium Audio This Month!', 'Check out our latest deals on premium audio equipment...', 'draft', '[{"type": "subject_line", "suggestion": "🎵 February Audio Fest - 20% Off Premium Speakers"}, {"type": "cta", "suggestion": "Shop Now & Save Big"}]'::jsonb),
    ('New Product Launch', 'Introducing the Latest in Home Audio', 'We are excited to announce...', 'ai_suggested', '[{"type": "tone", "suggestion": "Consider a more enthusiastic tone to increase engagement"}]'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO influencer_opportunities (influencer_name, platform, handle, followers_count, engagement_rate, niche, status, deal_type) VALUES
    ('TechReviewPro', 'youtube', '@techreviewpro', 125000, 4.5, 'tech_reviews', 'contacted', 'product_review'),
    ('AudiophileZA', 'instagram', '@audiophileza', 45000, 6.2, 'audio_equipment', 'in_discussion', 'sponsored_post'),
    ('HomeTheaterGuru', 'youtube', '@hometheater_guru', 89000, 3.8, 'home_entertainment', 'identified', 'product_review')
ON CONFLICT DO NOTHING;

INSERT INTO outreach_tracking (campaign_name, outreach_type, target_name, target_email, status, sent_at) VALUES
    ('Q1 Partnership Drive', 'email', 'Corporate Tech Solutions', 'partnerships@corptech.co.za', 'replied', NOW() - INTERVAL '3 days'),
    ('Influencer Outreach Feb', 'social_dm', 'SmartHomeSA', 'contact@smarthomesa.com', 'sent', NOW() - INTERVAL '1 day'),
    ('B2B Reseller Program', 'linkedin_message', 'Audio Distributors Ltd', 'info@audiodist.co.za', 'opened', NOW() - INTERVAL '5 hours')
ON CONFLICT DO NOTHING;
