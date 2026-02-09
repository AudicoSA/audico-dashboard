-- Customer Timeline Dashboard Enhancements
-- Adds: social_interactions, opencart_orders_cache, customer_profiles, timeline views

-- ============================================
-- SOCIAL_INTERACTIONS: Track brand mentions and DMs
-- ============================================
CREATE TABLE IF NOT EXISTS social_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube')),
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('mention', 'dm', 'comment', 'reply', 'share', 'reaction')),
    customer_name TEXT,
    customer_email TEXT,
    customer_handle TEXT,
    customer_id TEXT,
    content TEXT NOT NULL,
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
    post_url TEXT,
    requires_response BOOLEAN DEFAULT false,
    response_status TEXT DEFAULT 'pending' CHECK (response_status IN ('pending', 'responded', 'ignored')),
    responded_at TIMESTAMPTZ,
    responded_by TEXT REFERENCES squad_agents(name) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    interaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for social_interactions
CREATE INDEX IF NOT EXISTS idx_social_interactions_platform ON social_interactions(platform);
CREATE INDEX IF NOT EXISTS idx_social_interactions_customer_id ON social_interactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_social_interactions_customer_email ON social_interactions(customer_email);
CREATE INDEX IF NOT EXISTS idx_social_interactions_customer_handle ON social_interactions(customer_handle);
CREATE INDEX IF NOT EXISTS idx_social_interactions_type ON social_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_social_interactions_date ON social_interactions(interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_social_interactions_sentiment ON social_interactions(sentiment);
CREATE INDEX IF NOT EXISTS idx_social_interactions_response_status ON social_interactions(response_status);

-- ============================================
-- OPENCART_ORDERS_CACHE: Cached order data from OpenCart
-- ============================================
CREATE TABLE IF NOT EXISTS opencart_orders_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id INTEGER NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    order_status TEXT NOT NULL,
    order_total DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'ZAR',
    payment_method TEXT,
    shipping_method TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    shipping_address JSONB DEFAULT '{}'::jsonb,
    order_date TIMESTAMPTZ NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for opencart_orders_cache
CREATE INDEX IF NOT EXISTS idx_opencart_orders_order_id ON opencart_orders_cache(order_id);
CREATE INDEX IF NOT EXISTS idx_opencart_orders_customer_id ON opencart_orders_cache(customer_id);
CREATE INDEX IF NOT EXISTS idx_opencart_orders_customer_email ON opencart_orders_cache(customer_email);
CREATE INDEX IF NOT EXISTS idx_opencart_orders_customer_phone ON opencart_orders_cache(customer_phone);
CREATE INDEX IF NOT EXISTS idx_opencart_orders_status ON opencart_orders_cache(order_status);
CREATE INDEX IF NOT EXISTS idx_opencart_orders_date ON opencart_orders_cache(order_date DESC);

-- ============================================
-- CUSTOMER_PROFILES: Unified customer profiles
-- ============================================
CREATE TABLE IF NOT EXISTS customer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL UNIQUE,
    primary_email TEXT,
    primary_phone TEXT,
    full_name TEXT,
    company_name TEXT,
    contact_emails TEXT[] DEFAULT ARRAY[]::TEXT[],
    contact_phones TEXT[] DEFAULT ARRAY[]::TEXT[],
    social_handles JSONB DEFAULT '{}'::jsonb,
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0,
    average_order_value DECIMAL(10, 2) DEFAULT 0,
    lifetime_value DECIMAL(10, 2) DEFAULT 0,
    first_interaction_date TIMESTAMPTZ,
    last_interaction_date TIMESTAMPTZ,
    last_order_date TIMESTAMPTZ,
    customer_status TEXT DEFAULT 'active' CHECK (customer_status IN ('active', 'inactive', 'vip', 'blocked')),
    sentiment_score DECIMAL(3, 2) DEFAULT 0.00,
    sentiment_trend TEXT CHECK (sentiment_trend IN ('improving', 'stable', 'declining')),
    interaction_count INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for customer_profiles
CREATE INDEX IF NOT EXISTS idx_customer_profiles_customer_id ON customer_profiles(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_primary_email ON customer_profiles(primary_email);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_primary_phone ON customer_profiles(primary_phone);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_status ON customer_profiles(customer_status);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_ltv ON customer_profiles(lifetime_value DESC);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_last_interaction ON customer_profiles(last_interaction_date DESC);

-- ============================================
-- Enable RLS (Row Level Security)
-- ============================================
ALTER TABLE social_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE opencart_orders_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated" ON social_interactions FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON opencart_orders_cache FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON customer_profiles FOR ALL USING (true);

-- ============================================
-- Updated_at triggers
-- ============================================
DROP TRIGGER IF EXISTS update_social_interactions_updated_at ON social_interactions;
CREATE TRIGGER update_social_interactions_updated_at
    BEFORE UPDATE ON social_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_profiles_updated_at ON customer_profiles;
CREATE TRIGGER update_customer_profiles_updated_at
    BEFORE UPDATE ON customer_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS: Unified customer timeline view
-- ============================================
CREATE OR REPLACE VIEW customer_timeline_unified AS
SELECT 
    'call' as source,
    ct.id,
    COALESCE(ct.customer_email, ct.customer_phone) as customer_id,
    ct.customer_name,
    ct.customer_email,
    ct.customer_phone,
    ct.call_start_time as interaction_date,
    'Call' as interaction_type,
    ct.customer_intent as subject,
    ct.summary,
    ct.sentiment,
    ct.call_outcome as outcome,
    ct.metadata,
    ct.created_at
FROM call_transcripts ct

UNION ALL

SELECT 
    'email' as source,
    el.id,
    el.from_email as customer_id,
    el.payload->>'from_name' as customer_name,
    el.from_email as customer_email,
    el.payload->>'phone' as customer_phone,
    el.created_at as interaction_date,
    'Email' as interaction_type,
    el.subject,
    el.payload->>'body' as summary,
    el.payload->>'sentiment' as sentiment,
    el.status as outcome,
    el.payload as metadata,
    el.created_at
FROM email_logs el

UNION ALL

SELECT 
    'chat' as source,
    qs.id,
    COALESCE(qs.customer_email, qs.customer_phone, qs.session_id) as customer_id,
    qs.customer_name,
    qs.customer_email,
    qs.customer_phone,
    qs.last_activity_at as interaction_date,
    'Quote Chat' as interaction_type,
    qs.company_name as subject,
    'Quote request session' as summary,
    NULL as sentiment,
    qs.status as outcome,
    jsonb_build_object(
        'total_amount', qs.total_amount,
        'currency', qs.currency,
        'quote_items', qs.quote_items
    ) as metadata,
    qs.created_at
FROM customer_interactions qs
WHERE qs.interaction_type = 'chat'

UNION ALL

SELECT 
    'social' as source,
    si.id,
    COALESCE(si.customer_email, si.customer_handle, si.customer_id) as customer_id,
    si.customer_name,
    si.customer_email,
    si.customer_handle as customer_phone,
    si.interaction_date,
    CONCAT(si.platform, ' ', si.interaction_type) as interaction_type,
    NULL as subject,
    si.content as summary,
    si.sentiment,
    si.response_status as outcome,
    si.metadata,
    si.created_at
FROM social_interactions si

UNION ALL

SELECT 
    'order' as source,
    oc.id,
    oc.customer_email as customer_id,
    oc.customer_name,
    oc.customer_email,
    oc.customer_phone,
    oc.order_date as interaction_date,
    'Order' as interaction_type,
    CONCAT('Order #', oc.order_id) as subject,
    CONCAT(oc.order_status, ' - ', oc.currency, ' ', oc.order_total) as summary,
    NULL as sentiment,
    oc.order_status as outcome,
    jsonb_build_object(
        'order_id', oc.order_id,
        'order_total', oc.order_total,
        'currency', oc.currency,
        'items', oc.items,
        'payment_method', oc.payment_method
    ) as metadata,
    oc.created_at
FROM opencart_orders_cache oc

ORDER BY interaction_date DESC;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update customer profile statistics
CREATE OR REPLACE FUNCTION update_customer_profile_stats(p_customer_id TEXT)
RETURNS void AS $$
DECLARE
    v_profile customer_profiles;
    v_total_orders INTEGER;
    v_total_spent DECIMAL(10, 2);
    v_interaction_count INTEGER;
    v_first_date TIMESTAMPTZ;
    v_last_date TIMESTAMPTZ;
    v_last_order_date TIMESTAMPTZ;
    v_avg_sentiment DECIMAL(3, 2);
BEGIN
    -- Get order statistics
    SELECT 
        COUNT(*),
        COALESCE(SUM(order_total), 0),
        MAX(order_date)
    INTO v_total_orders, v_total_spent, v_last_order_date
    FROM opencart_orders_cache
    WHERE customer_email IN (
        SELECT unnest(contact_emails) FROM customer_profiles WHERE customer_id = p_customer_id
    );

    -- Get interaction statistics
    SELECT COUNT(*) INTO v_interaction_count
    FROM customer_interactions
    WHERE customer_id = p_customer_id;

    -- Get date ranges
    SELECT MIN(interaction_date), MAX(interaction_date)
    INTO v_first_date, v_last_date
    FROM customer_timeline_unified
    WHERE customer_id = p_customer_id;

    -- Calculate average sentiment
    SELECT AVG(
        CASE sentiment
            WHEN 'positive' THEN 1.0
            WHEN 'neutral' THEN 0.5
            WHEN 'negative' THEN 0.0
            WHEN 'mixed' THEN 0.5
            ELSE 0.5
        END
    )
    INTO v_avg_sentiment
    FROM customer_timeline_unified
    WHERE customer_id = p_customer_id AND sentiment IS NOT NULL;

    -- Update or insert customer profile
    INSERT INTO customer_profiles (
        customer_id,
        total_orders,
        total_spent,
        average_order_value,
        lifetime_value,
        first_interaction_date,
        last_interaction_date,
        last_order_date,
        sentiment_score,
        interaction_count
    ) VALUES (
        p_customer_id,
        v_total_orders,
        v_total_spent,
        CASE WHEN v_total_orders > 0 THEN v_total_spent / v_total_orders ELSE 0 END,
        v_total_spent * 1.2, -- Simple LTV calculation
        v_first_date,
        v_last_date,
        v_last_order_date,
        COALESCE(v_avg_sentiment, 0.5),
        v_interaction_count
    )
    ON CONFLICT (customer_id) DO UPDATE SET
        total_orders = EXCLUDED.total_orders,
        total_spent = EXCLUDED.total_spent,
        average_order_value = EXCLUDED.average_order_value,
        lifetime_value = EXCLUDED.lifetime_value,
        first_interaction_date = EXCLUDED.first_interaction_date,
        last_interaction_date = EXCLUDED.last_interaction_date,
        last_order_date = EXCLUDED.last_order_date,
        sentiment_score = EXCLUDED.sentiment_score,
        interaction_count = EXCLUDED.interaction_count,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE social_interactions IS 'Tracks social media brand mentions, DMs, and customer interactions';
COMMENT ON TABLE opencart_orders_cache IS 'Cached order data from OpenCart database for unified customer view';
COMMENT ON TABLE customer_profiles IS 'Unified customer profiles with LTV and sentiment analysis';
COMMENT ON VIEW customer_timeline_unified IS 'Unified view of all customer interactions across channels';
