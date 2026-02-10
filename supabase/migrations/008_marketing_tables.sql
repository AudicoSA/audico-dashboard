-- ================================================
-- Marketing Tables for Phase 4
-- ================================================

-- Newsletter Drafts Table
CREATE TABLE IF NOT EXISTS newsletter_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { subject_line, content, preview_text }
  metadata JSONB DEFAULT '{}'::jsonb,  -- { brevo_campaign_id, recipients_count }
  created_by TEXT REFERENCES squad_agents(name),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Influencer Opportunities Table
CREATE TABLE IF NOT EXISTS influencer_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'contacted', 'replied', 'partnered', 'declined')),
  contacted_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { name, email, platform, follower_count, niche, preferred_contact }
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT REFERENCES squad_agents(name),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outreach Tracking Table
CREATE TABLE IF NOT EXISTS outreach_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES influencer_opportunities(id),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'twitter', 'instagram', 'linkedin')),
  message_sent TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'opened', 'replied', 'bounced')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_status ON newsletter_drafts(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_created_at ON newsletter_drafts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_influencer_opportunities_status ON influencer_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_outreach_tracking_influencer ON outreach_tracking(influencer_id);
CREATE INDEX IF NOT EXISTS idx_outreach_tracking_sent_at ON outreach_tracking(sent_at DESC);

-- RLS (disable for service role access)
ALTER TABLE newsletter_drafts DISABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_opportunities DISABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_tracking DISABLE ROW LEVEL SECURITY;

-- Grant permissions to anon role (for frontend access)
GRANT SELECT, INSERT, UPDATE, DELETE ON newsletter_drafts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON influencer_opportunities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON outreach_tracking TO anon;

-- Sample data (optional - for testing)
/*
INSERT INTO newsletter_drafts (status, data, created_by) VALUES
  ('draft', '{"subject_line": "Audico November Newsletter", "content": "<h1>Welcome!</h1><p>Check out our latest products...</p>", "preview_text": "New arrivals this month"}'::jsonb, 'Marketing Agent');

INSERT INTO influencer_opportunities (status, data, created_by) VALUES
  ('identified', '{"name": "Tech Reviewer SA", "email": "contact@techreviewersa.co.za", "platform": "youtube", "follower_count": 50000, "niche": "electronics", "preferred_contact": "email"}'::jsonb, 'Marketing Agent');
*/
