-- Social Media Integration Tables
-- This migration adds tables for managing social media accounts and OAuth tokens

-- Create social_accounts table
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('facebook', 'instagram', 'twitter')),
  account_id VARCHAR(255) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, account_id)
);

-- Create index on platform for faster lookups
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);

-- Create oauth_temp_tokens table for Twitter OAuth flow
CREATE TABLE IF NOT EXISTS oauth_temp_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  oauth_token VARCHAR(255) NOT NULL,
  oauth_token_secret VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(oauth_token)
);

-- Create indexes for oauth_temp_tokens
CREATE INDEX IF NOT EXISTS idx_oauth_temp_tokens_token ON oauth_temp_tokens(oauth_token);
CREATE INDEX IF NOT EXISTS idx_oauth_temp_tokens_created ON oauth_temp_tokens(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_social_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER social_accounts_updated_at
  BEFORE UPDATE ON social_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_social_accounts_updated_at();

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_temp_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access
CREATE POLICY "Enable full access for service role" ON social_accounts
  FOR ALL
  USING (true);

CREATE POLICY "Enable full access for service role" ON oauth_temp_tokens
  FOR ALL
  USING (true);

-- Create function to cleanup old OAuth tokens (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_oauth_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_temp_tokens WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Add comment to tables
COMMENT ON TABLE social_accounts IS 'Stores connected social media accounts with OAuth tokens';
COMMENT ON TABLE oauth_temp_tokens IS 'Temporary storage for OAuth tokens during Twitter authentication flow';
