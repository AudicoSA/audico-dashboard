-- Email Logs Migration
-- Adds email_logs table for tracking Gmail emails

-- ============================================
-- EMAIL_LOGS: Gmail email tracking
-- ============================================
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gmail_message_id TEXT NOT NULL UNIQUE,
    from_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    category TEXT DEFAULT 'unclassified',
    status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'classified', 'draft_created', 'sent', 'archived')),
    handled_by TEXT REFERENCES squad_agents(name) ON DELETE SET NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for email_logs
CREATE INDEX IF NOT EXISTS idx_email_logs_gmail_id ON email_logs(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_category ON email_logs(category);
CREATE INDEX IF NOT EXISTS idx_email_logs_handled_by ON email_logs(handled_by);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated" ON email_logs FOR ALL USING (true);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_email_logs_updated_at ON email_logs;
CREATE TRIGGER update_email_logs_updated_at
    BEFORE UPDATE ON email_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
