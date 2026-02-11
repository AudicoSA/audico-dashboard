-- Add pdf_url column to quote_requests table
ALTER TABLE quote_requests
ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Add index for pdf_url lookups
CREATE INDEX IF NOT EXISTS idx_quote_requests_pdf_url 
ON quote_requests(pdf_url) WHERE pdf_url IS NOT NULL;

-- Create email_drafts table for storing draft emails before sending
CREATE TABLE IF NOT EXISTS email_drafts (
    id TEXT PRIMARY KEY,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    attachments TEXT[] DEFAULT ARRAY[]::TEXT[],
    status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'sent', 'rejected')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for email_drafts
CREATE INDEX IF NOT EXISTS idx_email_drafts_to_email ON email_drafts(to_email);
CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_created_at ON email_drafts(created_at DESC);

-- Enable RLS
ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated" ON email_drafts FOR ALL USING (true);

-- Updated_at trigger
CREATE TRIGGER update_email_drafts_updated_at
    BEFORE UPDATE ON email_drafts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create pricing_rules table for markup configuration
CREATE TABLE IF NOT EXISTS pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL,
    product_category TEXT,
    markup_percentage NUMERIC(5, 2) NOT NULL,
    min_margin NUMERIC(5, 2),
    max_discount NUMERIC(5, 2),
    active BOOLEAN DEFAULT true,
    conditions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for pricing_rules
CREATE INDEX IF NOT EXISTS idx_pricing_rules_product_category ON pricing_rules(product_category);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON pricing_rules(active) WHERE active = true;

-- Enable RLS
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated" ON pricing_rules FOR ALL USING (true);

-- Updated_at trigger
CREATE TRIGGER update_pricing_rules_updated_at
    BEFORE UPDATE ON pricing_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default pricing rules
INSERT INTO pricing_rules (rule_name, product_category, markup_percentage, active)
VALUES 
    ('Default Audio Equipment', 'audio', 30.0, true),
    ('Default Visual Equipment', 'visual', 28.0, true),
    ('Default Cables & Accessories', 'cables', 40.0, true),
    ('Default General', NULL, 25.0, true)
ON CONFLICT DO NOTHING;
