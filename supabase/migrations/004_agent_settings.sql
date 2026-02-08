-- Agent Settings Migration
-- Tables for agent configuration, API credentials, and notification preferences

-- ============================================
-- AGENT_CONFIGS: Configuration for each agent
-- ============================================
CREATE TABLE IF NOT EXISTS agent_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT TRUE,
    schedule JSONB DEFAULT '{"enabled": false, "intervals": [], "timezone": "UTC"}'::jsonb,
    token_budget JSONB DEFAULT '{"daily_limit": 20.0, "per_request_max": 1.0, "current_usage": 0.0}'::jsonb,
    behavior_settings JSONB DEFAULT '{"auto_approve": false, "require_review": true, "max_retries": 3, "timeout_seconds": 30}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_agent_configs_name ON agent_configs(name);
CREATE INDEX IF NOT EXISTS idx_agent_configs_enabled ON agent_configs(enabled);

-- Insert default agent configurations
INSERT INTO agent_configs (name, enabled, schedule, token_budget, behavior_settings) VALUES
    ('Email Agent', true, 
     '{"enabled": true, "intervals": ["*/5 * * * *", "0 9 * * *"], "timezone": "Africa/Johannesburg"}'::jsonb,
     '{"daily_limit": 25.0, "per_request_max": 2.0, "current_usage": 12.4}'::jsonb,
     '{"auto_approve": false, "require_review": true, "max_retries": 3, "timeout_seconds": 45}'::jsonb),
    ('Orders Agent', true,
     '{"enabled": true, "intervals": ["*/10 * * * *"], "timezone": "Africa/Johannesburg"}'::jsonb,
     '{"daily_limit": 15.0, "per_request_max": 1.5, "current_usage": 8.2}'::jsonb,
     '{"auto_approve": true, "require_review": false, "max_retries": 5, "timeout_seconds": 60}'::jsonb),
    ('Stock Agent', false,
     '{"enabled": false, "intervals": ["0 */2 * * *"], "timezone": "Africa/Johannesburg"}'::jsonb,
     '{"daily_limit": 10.0, "per_request_max": 1.0, "current_usage": 0.0}'::jsonb,
     '{"auto_approve": false, "require_review": true, "max_retries": 3, "timeout_seconds": 30}'::jsonb),
    ('Customer Support Agent', false,
     '{"enabled": false, "intervals": ["*/15 * * * *"], "timezone": "Africa/Johannesburg"}'::jsonb,
     '{"daily_limit": 20.0, "per_request_max": 2.5, "current_usage": 0.0}'::jsonb,
     '{"auto_approve": false, "require_review": true, "max_retries": 2, "timeout_seconds": 30}'::jsonb),
    ('Social Media Agent', false,
     '{"enabled": false, "intervals": ["0 10,14,18 * * *"], "timezone": "Africa/Johannesburg"}'::jsonb,
     '{"daily_limit": 15.0, "per_request_max": 1.0, "current_usage": 0.0}'::jsonb,
     '{"auto_approve": false, "require_review": true, "max_retries": 3, "timeout_seconds": 45}'::jsonb),
    ('SEO Agent', false,
     '{"enabled": false, "intervals": ["0 8 * * *"], "timezone": "Africa/Johannesburg"}'::jsonb,
     '{"daily_limit": 30.0, "per_request_max": 3.0, "current_usage": 0.0}'::jsonb,
     '{"auto_approve": false, "require_review": true, "max_retries": 3, "timeout_seconds": 120}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- API_CREDENTIALS: Store API keys and tokens
-- ============================================
CREATE TABLE IF NOT EXISTS api_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service TEXT NOT NULL,
    key_name TEXT NOT NULL,
    key_value TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service, key_name)
);

-- Index for fast lookups by service
CREATE INDEX IF NOT EXISTS idx_api_credentials_service ON api_credentials(service);

-- Insert sample credentials (placeholder values - replace with actual credentials)
INSERT INTO api_credentials (service, key_name, key_value, expires_at) VALUES
    ('Gmail OAuth', 'Client ID', 'your-gmail-client-id.apps.googleusercontent.com', NULL),
    ('Gmail OAuth', 'Client Secret', 'your-gmail-client-secret', NULL),
    ('Gmail OAuth', 'Refresh Token', 'your-gmail-refresh-token', NULL),
    ('Google Ads', 'Developer Token', 'your-google-ads-dev-token', NULL),
    ('Google Ads', 'Client ID', 'your-google-ads-client-id', NULL),
    ('Google Ads', 'Client Secret', 'your-google-ads-client-secret', NULL),
    ('Facebook', 'Access Token', 'your-facebook-access-token', '2025-12-31 23:59:59+00'),
    ('Instagram', 'Access Token', 'your-instagram-access-token', '2025-12-31 23:59:59+00'),
    ('Twitter', 'API Key', 'your-twitter-api-key', NULL),
    ('Twitter', 'API Secret', 'your-twitter-api-secret', NULL),
    ('LinkedIn', 'Access Token', 'your-linkedin-access-token', '2025-12-31 23:59:59+00'),
    ('YouTube', 'API Key', 'your-youtube-api-key', NULL)
ON CONFLICT (service, key_name) DO NOTHING;

-- ============================================
-- NOTIFICATION_PREFERENCES: Control notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT TRUE,
    channels TEXT[] DEFAULT ARRAY['email', 'dashboard']::TEXT[],
    kenny_mentions_only BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_event ON notification_preferences(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_enabled ON notification_preferences(enabled);

-- Insert default notification preferences
INSERT INTO notification_preferences (event_type, enabled, channels, kenny_mentions_only) VALUES
    ('agent_error', true, ARRAY['email', 'dashboard', 'slack']::TEXT[], false),
    ('task_completed', true, ARRAY['dashboard', 'email']::TEXT[], false),
    ('order_received', true, ARRAY['dashboard', 'email']::TEXT[], false),
    ('stock_low', true, ARRAY['email', 'dashboard']::TEXT[], false),
    ('customer_escalation', true, ARRAY['email', 'sms', 'dashboard']::TEXT[], true),
    ('kenny_mention', true, ARRAY['email', 'sms', 'dashboard', 'slack']::TEXT[], true),
    ('budget_exceeded', true, ARRAY['email', 'dashboard']::TEXT[], false),
    ('approval_required', true, ARRAY['dashboard', 'email']::TEXT[], false),
    ('daily_summary', true, ARRAY['email']::TEXT[], false),
    ('social_engagement', false, ARRAY['dashboard']::TEXT[], false)
ON CONFLICT (event_type) DO NOTHING;

-- ============================================
-- Enable RLS (Row Level Security)
-- ============================================
ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (adjust as needed)
CREATE POLICY "Allow all for authenticated" ON agent_configs FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON api_credentials FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON notification_preferences FOR ALL USING (true);

-- ============================================
-- Updated_at triggers
-- ============================================
DROP TRIGGER IF EXISTS update_agent_configs_updated_at ON agent_configs;
CREATE TRIGGER update_agent_configs_updated_at
    BEFORE UPDATE ON agent_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_credentials_updated_at ON api_credentials;
CREATE TRIGGER update_api_credentials_updated_at
    BEFORE UPDATE ON api_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Helper function to reset daily token usage
-- ============================================
CREATE OR REPLACE FUNCTION reset_daily_token_usage()
RETURNS void AS $$
BEGIN
    UPDATE agent_configs 
    SET token_budget = jsonb_set(
        token_budget, 
        '{current_usage}', 
        '0.0'
    );
END;
$$ LANGUAGE plpgsql;

-- Schedule this to run daily at midnight (set up in Supabase cron or external scheduler)
-- SELECT cron.schedule('reset-tokens', '0 0 * * *', 'SELECT reset_daily_token_usage();');
