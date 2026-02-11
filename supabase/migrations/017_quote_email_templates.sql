-- Quote Email Templates and A/B Testing System
-- Tracks email template variants and their effectiveness

-- ============================================
-- QUOTE_EMAIL_TEMPLATES: Store template variants
-- ============================================
CREATE TABLE IF NOT EXISTS quote_email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name TEXT NOT NULL,
    variant_name TEXT NOT NULL,
    tone TEXT NOT NULL CHECK (tone IN ('formal', 'casual', 'friendly', 'professional')),
    urgency_level TEXT CHECK (urgency_level IN ('low', 'medium', 'high', 'urgent')),
    customer_segment TEXT CHECK (customer_segment IN ('first_time', 'repeat', 'high_value', 'dormant', 'any')),
    subject_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    signature_template TEXT NOT NULL,
    follow_up_template TEXT,
    active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(template_name, variant_name)
);

-- Indexes for quote_email_templates
CREATE INDEX IF NOT EXISTS idx_quote_email_templates_tone ON quote_email_templates(tone);
CREATE INDEX IF NOT EXISTS idx_quote_email_templates_segment ON quote_email_templates(customer_segment);
CREATE INDEX IF NOT EXISTS idx_quote_email_templates_active ON quote_email_templates(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_quote_email_templates_priority ON quote_email_templates(priority DESC);

-- ============================================
-- QUOTE_EMAIL_SENDS: Track sent quote emails
-- ============================================
CREATE TABLE IF NOT EXISTS quote_email_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_request_id UUID NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
    template_id UUID REFERENCES quote_email_templates(id) ON DELETE SET NULL,
    customer_email TEXT NOT NULL,
    customer_name TEXT,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    pdf_url TEXT,
    tone_detected TEXT CHECK (tone_detected IN ('formal', 'casual', 'friendly', 'professional')),
    urgency_detected TEXT CHECK (urgency_detected IN ('low', 'medium', 'high', 'urgent')),
    customer_segment TEXT CHECK (customer_segment IN ('first_time', 'repeat', 'high_value', 'dormant')),
    relationship_history JSONB DEFAULT '{}'::jsonb,
    products_mentioned TEXT[] DEFAULT ARRAY[]::TEXT[],
    value_props_highlighted TEXT[] DEFAULT ARRAY[]::TEXT[],
    follow_up_actions TEXT[] DEFAULT ARRAY[]::TEXT[],
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quote_email_sends
CREATE INDEX IF NOT EXISTS idx_quote_email_sends_quote_request ON quote_email_sends(quote_request_id);
CREATE INDEX IF NOT EXISTS idx_quote_email_sends_template ON quote_email_sends(template_id);
CREATE INDEX IF NOT EXISTS idx_quote_email_sends_customer_email ON quote_email_sends(customer_email);
CREATE INDEX IF NOT EXISTS idx_quote_email_sends_segment ON quote_email_sends(customer_segment);
CREATE INDEX IF NOT EXISTS idx_quote_email_sends_sent_at ON quote_email_sends(sent_at DESC);

-- ============================================
-- QUOTE_EMAIL_RESPONSES: Track customer responses
-- ============================================
CREATE TABLE IF NOT EXISTS quote_email_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_send_id UUID NOT NULL REFERENCES quote_email_sends(id) ON DELETE CASCADE,
    quote_request_id UUID NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
    response_type TEXT NOT NULL CHECK (response_type IN ('reply', 'acceptance', 'rejection', 'question', 'negotiation', 'no_response')),
    response_time_hours NUMERIC(10, 2),
    response_email_id UUID REFERENCES email_logs(id) ON DELETE SET NULL,
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
    converted BOOLEAN DEFAULT false,
    conversion_amount NUMERIC(10, 2),
    response_details JSONB DEFAULT '{}'::jsonb,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quote_email_responses
CREATE INDEX IF NOT EXISTS idx_quote_email_responses_email_send ON quote_email_responses(email_send_id);
CREATE INDEX IF NOT EXISTS idx_quote_email_responses_quote_request ON quote_email_responses(quote_request_id);
CREATE INDEX IF NOT EXISTS idx_quote_email_responses_type ON quote_email_responses(response_type);
CREATE INDEX IF NOT EXISTS idx_quote_email_responses_converted ON quote_email_responses(converted) WHERE converted = true;
CREATE INDEX IF NOT EXISTS idx_quote_email_responses_detected_at ON quote_email_responses(detected_at DESC);

-- ============================================
-- QUOTE_TEMPLATE_PERFORMANCE: Aggregate metrics
-- ============================================
CREATE TABLE IF NOT EXISTS quote_template_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES quote_email_templates(id) ON DELETE CASCADE,
    customer_segment TEXT CHECK (customer_segment IN ('first_time', 'repeat', 'high_value', 'dormant', 'all')),
    urgency_level TEXT CHECK (urgency_level IN ('low', 'medium', 'high', 'urgent', 'all')),
    sends_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    reply_rate NUMERIC(5, 2) DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    conversion_rate NUMERIC(5, 2) DEFAULT 0,
    avg_response_time_hours NUMERIC(10, 2),
    total_conversion_amount NUMERIC(12, 2) DEFAULT 0,
    avg_conversion_amount NUMERIC(10, 2),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(template_id, customer_segment, urgency_level)
);

-- Indexes for quote_template_performance
CREATE INDEX IF NOT EXISTS idx_quote_template_performance_template ON quote_template_performance(template_id);
CREATE INDEX IF NOT EXISTS idx_quote_template_performance_segment ON quote_template_performance(customer_segment);
CREATE INDEX IF NOT EXISTS idx_quote_template_performance_reply_rate ON quote_template_performance(reply_rate DESC);
CREATE INDEX IF NOT EXISTS idx_quote_template_performance_conversion_rate ON quote_template_performance(conversion_rate DESC);

-- ============================================
-- Enable RLS (Row Level Security)
-- ============================================
ALTER TABLE quote_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_email_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_template_performance ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated" ON quote_email_templates FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON quote_email_sends FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON quote_email_responses FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON quote_template_performance FOR ALL USING (true);

-- ============================================
-- Updated_at triggers
-- ============================================
CREATE TRIGGER update_quote_email_templates_updated_at
    BEFORE UPDATE ON quote_email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Insert default templates
-- ============================================

-- Formal templates for first-time customers
INSERT INTO quote_email_templates (
    template_name, variant_name, tone, customer_segment, urgency_level,
    subject_template, body_template, signature_template, follow_up_template, priority
) VALUES 
(
    'formal_first_time',
    'variant_a',
    'formal',
    'first_time',
    'medium',
    'Quote #{quote_number} for {customer_name} - {company_name}',
    'Dear {customer_name},

Thank you for your inquiry regarding {product_list}. We are pleased to present our quotation for your consideration.

Please find attached our detailed quote (#{quote_number}) with competitive pricing on the products you requested. Our quote includes:

{value_props}

We have {stock_availability} and can arrange {delivery_timeframe}.

Should you have any questions or require clarification on any aspect of this quotation, please do not hesitate to contact us.

{follow_up_action}',
    'Best regards,

{sender_name}
{company_name}
{contact_info}',
    'We look forward to the opportunity to serve you and build a lasting business relationship.',
    100
),
(
    'casual_repeat',
    'variant_a',
    'casual',
    'repeat',
    'medium',
    'Your Quote is Ready - {product_summary}',
    'Hi {customer_name},

Great to hear from you again! I''ve put together the quote you asked for on {product_list}.

Here''s what makes this a great deal:

{value_props}

Good news - {stock_availability}, so we can get this to you {delivery_timeframe}.

The full details are in the attached PDF (Quote #{quote_number}).

{follow_up_action}',
    'Cheers,

{sender_name}
{company_name}
{contact_info}',
    'Any questions? Just hit reply or give me a call. Always happy to help!',
    100
),
(
    'urgent_high_value',
    'variant_a',
    'professional',
    'high_value',
    'urgent',
    'URGENT: Priority Quote #{quote_number} - {product_summary}',
    'Hi {customer_name},

I understand this is time-sensitive, so I''ve fast-tracked your quote for {product_list}.

Priority highlights:

{value_props}

✓ {stock_availability}
✓ Priority processing available
✓ {delivery_timeframe}

Your quote (#{quote_number}) is attached with full specifications and pricing.

{follow_up_action}',
    'Best regards,

{sender_name}
{company_name}
{contact_info}
Priority Line: {priority_contact}',
    'I''m standing by to expedite your order. Call me directly or reply to get this moving right away.',
    150
)
ON CONFLICT (template_name, variant_name) DO NOTHING;

-- Create function to update performance metrics
CREATE OR REPLACE FUNCTION update_quote_template_performance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert performance record
    INSERT INTO quote_template_performance (
        template_id,
        customer_segment,
        urgency_level,
        sends_count,
        reply_count,
        conversion_count,
        total_conversion_amount
    )
    SELECT 
        qes.template_id,
        COALESCE(qes.customer_segment, 'all'),
        COALESCE(qes.urgency_detected, 'all'),
        COUNT(DISTINCT qes.id),
        COUNT(DISTINCT CASE WHEN qer.response_type IN ('reply', 'question', 'negotiation', 'acceptance') THEN qer.id END),
        COUNT(DISTINCT CASE WHEN qer.converted = true THEN qer.id END),
        SUM(COALESCE(qer.conversion_amount, 0))
    FROM quote_email_sends qes
    LEFT JOIN quote_email_responses qer ON qer.email_send_id = qes.id
    WHERE qes.template_id = COALESCE(NEW.template_id, OLD.template_id)
    GROUP BY qes.template_id, COALESCE(qes.customer_segment, 'all'), COALESCE(qes.urgency_detected, 'all')
    ON CONFLICT (template_id, customer_segment, urgency_level) 
    DO UPDATE SET
        sends_count = EXCLUDED.sends_count,
        reply_count = EXCLUDED.reply_count,
        reply_rate = CASE 
            WHEN EXCLUDED.sends_count > 0 
            THEN ROUND((EXCLUDED.reply_count::NUMERIC / EXCLUDED.sends_count::NUMERIC) * 100, 2)
            ELSE 0 
        END,
        conversion_count = EXCLUDED.conversion_count,
        conversion_rate = CASE 
            WHEN EXCLUDED.sends_count > 0 
            THEN ROUND((EXCLUDED.conversion_count::NUMERIC / EXCLUDED.sends_count::NUMERIC) * 100, 2)
            ELSE 0 
        END,
        total_conversion_amount = EXCLUDED.total_conversion_amount,
        avg_conversion_amount = CASE 
            WHEN EXCLUDED.conversion_count > 0 
            THEN ROUND(EXCLUDED.total_conversion_amount::NUMERIC / EXCLUDED.conversion_count::NUMERIC, 2)
            ELSE 0 
        END,
        last_updated = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update performance on new response
CREATE TRIGGER update_template_performance_on_response
    AFTER INSERT OR UPDATE ON quote_email_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_quote_template_performance();

-- Trigger to update performance on new send
CREATE TRIGGER update_template_performance_on_send
    AFTER INSERT ON quote_email_sends
    FOR EACH ROW
    EXECUTE FUNCTION update_quote_template_performance();
