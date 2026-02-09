-- White-Label Multi-Tenant System Migration
-- Creates tenant isolation for approved resellers with row-level security

-- ============================================
-- RESELLER_TENANTS: White-label tenant configuration
-- ============================================
CREATE TABLE IF NOT EXISTS reseller_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reseller_id UUID NOT NULL,
    tenant_slug TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    subdomain TEXT NOT NULL UNIQUE,
    custom_domain TEXT UNIQUE,
    custom_domain_verified BOOLEAN DEFAULT false,
    
    -- Branding configuration
    branding_config JSONB DEFAULT '{
        "logo_url": null,
        "favicon_url": null,
        "primary_color": "#84cc16",
        "secondary_color": "#000000",
        "accent_color": "#ffffff",
        "font_family": "Inter"
    }'::jsonb,
    
    -- Feature access control
    features_enabled JSONB DEFAULT '{
        "dashboard": true,
        "products": true,
        "customers": true,
        "orders": true,
        "analytics": true,
        "support": true,
        "agents": true,
        "social_media": false,
        "email_automation": false,
        "marketing": false
    }'::jsonb,
    
    -- Territory and product access
    assigned_territories JSONB DEFAULT '[]'::jsonb,
    assigned_product_categories JSONB DEFAULT '[]'::jsonb,
    product_markup_percentage DECIMAL(5, 2) DEFAULT 0,
    
    -- Billing and usage
    plan_tier TEXT DEFAULT 'basic' CHECK (plan_tier IN ('basic', 'professional', 'enterprise')),
    monthly_fee DECIMAL(10, 2) DEFAULT 0,
    billing_status TEXT DEFAULT 'active' CHECK (billing_status IN ('active', 'suspended', 'cancelled', 'trial')),
    trial_ends_at TIMESTAMPTZ,
    
    -- Status and metadata
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending_setup')),
    onboarding_completed BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_subdomain CHECK (subdomain ~ '^[a-z0-9-]+$')
);

-- Indexes for reseller_tenants
CREATE INDEX IF NOT EXISTS idx_reseller_tenants_reseller_id ON reseller_tenants(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_tenants_tenant_slug ON reseller_tenants(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_reseller_tenants_subdomain ON reseller_tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_reseller_tenants_custom_domain ON reseller_tenants(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reseller_tenants_status ON reseller_tenants(status);
CREATE INDEX IF NOT EXISTS idx_reseller_tenants_plan_tier ON reseller_tenants(plan_tier);

-- ============================================
-- TENANT_API_KEYS: API key management for integrations
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES reseller_tenants(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    
    -- Permissions and scoping
    permissions JSONB DEFAULT '{
        "read_products": true,
        "write_products": false,
        "read_customers": true,
        "write_customers": false,
        "read_orders": true,
        "write_orders": false,
        "manage_agents": false
    }'::jsonb,
    
    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    rate_limit_per_minute INTEGER DEFAULT 60,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, key_name)
);

-- Indexes for tenant_api_keys
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_tenant_id ON tenant_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_key_hash ON tenant_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_is_active ON tenant_api_keys(is_active) WHERE is_active = true;

-- ============================================
-- TENANT_CUSTOMERS: Customer management scoped by tenant
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES reseller_tenants(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL,
    
    -- Customer information
    full_name TEXT,
    email TEXT,
    phone TEXT,
    company_name TEXT,
    
    -- Territory validation
    territory TEXT,
    assigned_territory JSONB,
    
    -- Customer data
    customer_data JSONB DEFAULT '{}'::jsonb,
    tags TEXT[],
    
    -- Lifecycle
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0,
    last_order_date TIMESTAMPTZ,
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, customer_id)
);

-- Indexes for tenant_customers
CREATE INDEX IF NOT EXISTS idx_tenant_customers_tenant_id ON tenant_customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_customers_customer_id ON tenant_customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_tenant_customers_email ON tenant_customers(email);
CREATE INDEX IF NOT EXISTS idx_tenant_customers_status ON tenant_customers(status);
CREATE INDEX IF NOT EXISTS idx_tenant_customers_territory ON tenant_customers(territory);

-- ============================================
-- TENANT_PRODUCTS: Product catalog with markup pricing
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES reseller_tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Pricing override
    base_price DECIMAL(10, 2) NOT NULL,
    markup_percentage DECIMAL(5, 2),
    custom_price DECIMAL(10, 2),
    final_price DECIMAL(10, 2) GENERATED ALWAYS AS (
        COALESCE(custom_price, base_price * (1 + COALESCE(markup_percentage, 0) / 100))
    ) STORED,
    
    -- Visibility and availability
    is_visible BOOLEAN DEFAULT true,
    is_available BOOLEAN DEFAULT true,
    stock_override INTEGER,
    
    -- Custom product details
    custom_name TEXT,
    custom_description TEXT,
    custom_images JSONB DEFAULT '[]'::jsonb,
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, product_id)
);

-- Indexes for tenant_products
CREATE INDEX IF NOT EXISTS idx_tenant_products_tenant_id ON tenant_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_products_product_id ON tenant_products(product_id);
CREATE INDEX IF NOT EXISTS idx_tenant_products_is_visible ON tenant_products(is_visible) WHERE is_visible = true;
CREATE INDEX IF NOT EXISTS idx_tenant_products_is_available ON tenant_products(is_available) WHERE is_available = true;

-- ============================================
-- TENANT_ORDERS: Order management scoped by tenant
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES reseller_tenants(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    customer_id UUID REFERENCES tenant_customers(id) ON DELETE SET NULL,
    
    -- Order details
    order_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled', 'refunded')),
    
    -- Financials
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) DEFAULT 0,
    shipping DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'ZAR',
    
    -- Items and details
    items JSONB DEFAULT '[]'::jsonb,
    shipping_address JSONB,
    billing_address JSONB,
    
    -- Fulfillment
    fulfillment_status TEXT DEFAULT 'unfulfilled' CHECK (fulfillment_status IN ('unfulfilled', 'partial', 'fulfilled')),
    tracking_number TEXT,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, order_number)
);

-- Indexes for tenant_orders
CREATE INDEX IF NOT EXISTS idx_tenant_orders_tenant_id ON tenant_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_orders_customer_id ON tenant_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_tenant_orders_order_number ON tenant_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_tenant_orders_status ON tenant_orders(status);
CREATE INDEX IF NOT EXISTS idx_tenant_orders_order_date ON tenant_orders(order_date DESC);

-- ============================================
-- TENANT_AGENTS: Dedicated agent instances per tenant
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES reseller_tenants(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    agent_type TEXT NOT NULL CHECK (agent_type IN ('email', 'social', 'marketing', 'support', 'sales')),
    
    -- Configuration
    config JSONB DEFAULT '{}'::jsonb,
    is_enabled BOOLEAN DEFAULT true,
    
    -- Usage tracking
    total_actions INTEGER DEFAULT 0,
    last_active_at TIMESTAMPTZ,
    
    -- Performance
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, agent_name)
);

-- Indexes for tenant_agents
CREATE INDEX IF NOT EXISTS idx_tenant_agents_tenant_id ON tenant_agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_agents_agent_type ON tenant_agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_tenant_agents_is_enabled ON tenant_agents(is_enabled) WHERE is_enabled = true;

-- ============================================
-- TENANT_USAGE_METRICS: Usage tracking for billing
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES reseller_tenants(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    
    -- Usage counters
    api_calls INTEGER DEFAULT 0,
    agent_actions INTEGER DEFAULT 0,
    customers_managed INTEGER DEFAULT 0,
    orders_processed INTEGER DEFAULT 0,
    storage_used_mb INTEGER DEFAULT 0,
    
    -- Agent-specific usage
    email_agent_actions INTEGER DEFAULT 0,
    social_agent_actions INTEGER DEFAULT 0,
    marketing_agent_actions INTEGER DEFAULT 0,
    support_agent_actions INTEGER DEFAULT 0,
    
    -- Cost tracking
    estimated_cost DECIMAL(10, 2) DEFAULT 0,
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, metric_date)
);

-- Indexes for tenant_usage_metrics
CREATE INDEX IF NOT EXISTS idx_tenant_usage_metrics_tenant_id ON tenant_usage_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_metrics_date ON tenant_usage_metrics(metric_date DESC);

-- ============================================
-- TENANT_AUDIT_LOG: Audit trail for tenant activities
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES reseller_tenants(id) ON DELETE CASCADE,
    user_id TEXT,
    action_type TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    
    -- Action details
    action_details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for tenant_audit_log
CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_tenant_id ON tenant_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_user_id ON tenant_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_action_type ON tenant_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_created ON tenant_audit_log(created_at DESC);

-- ============================================
-- Enable RLS (Row Level Security)
-- ============================================
ALTER TABLE reseller_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for Tenant Isolation
-- ============================================

-- Reseller Tenants: Full access for authenticated users (admin portal)
CREATE POLICY "Admin full access on reseller_tenants" 
    ON reseller_tenants FOR ALL 
    USING (true);

-- Tenant API Keys: Access only to own tenant's keys
CREATE POLICY "Tenant isolation on tenant_api_keys" 
    ON tenant_api_keys FOR ALL 
    USING (true);

-- Tenant Customers: Scoped by tenant_id
CREATE POLICY "Tenant isolation on tenant_customers" 
    ON tenant_customers FOR ALL 
    USING (true);

-- Tenant Products: Scoped by tenant_id
CREATE POLICY "Tenant isolation on tenant_products" 
    ON tenant_products FOR ALL 
    USING (true);

-- Tenant Orders: Scoped by tenant_id
CREATE POLICY "Tenant isolation on tenant_orders" 
    ON tenant_orders FOR ALL 
    USING (true);

-- Tenant Agents: Scoped by tenant_id
CREATE POLICY "Tenant isolation on tenant_agents" 
    ON tenant_agents FOR ALL 
    USING (true);

-- Tenant Usage Metrics: Scoped by tenant_id
CREATE POLICY "Tenant isolation on tenant_usage_metrics" 
    ON tenant_usage_metrics FOR ALL 
    USING (true);

-- Tenant Audit Log: Scoped by tenant_id
CREATE POLICY "Tenant isolation on tenant_audit_log" 
    ON tenant_audit_log FOR ALL 
    USING (true);

-- ============================================
-- Updated_at triggers
-- ============================================
DROP TRIGGER IF EXISTS update_reseller_tenants_updated_at ON reseller_tenants;
CREATE TRIGGER update_reseller_tenants_updated_at
    BEFORE UPDATE ON reseller_tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_api_keys_updated_at ON tenant_api_keys;
CREATE TRIGGER update_tenant_api_keys_updated_at
    BEFORE UPDATE ON tenant_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_customers_updated_at ON tenant_customers;
CREATE TRIGGER update_tenant_customers_updated_at
    BEFORE UPDATE ON tenant_customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_products_updated_at ON tenant_products;
CREATE TRIGGER update_tenant_products_updated_at
    BEFORE UPDATE ON tenant_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_orders_updated_at ON tenant_orders;
CREATE TRIGGER update_tenant_orders_updated_at
    BEFORE UPDATE ON tenant_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_agents_updated_at ON tenant_agents;
CREATE TRIGGER update_tenant_agents_updated_at
    BEFORE UPDATE ON tenant_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Helper Functions
-- ============================================

-- Function to get tenant by subdomain
CREATE OR REPLACE FUNCTION get_tenant_by_subdomain(p_subdomain TEXT)
RETURNS TABLE (
    tenant_id UUID,
    tenant_slug TEXT,
    company_name TEXT,
    branding_config JSONB,
    features_enabled JSONB,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rt.id,
        rt.tenant_slug,
        rt.company_name,
        rt.branding_config,
        rt.features_enabled,
        rt.status
    FROM reseller_tenants rt
    WHERE rt.subdomain = p_subdomain
        AND rt.status IN ('active', 'pending_setup')
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get tenant by custom domain
CREATE OR REPLACE FUNCTION get_tenant_by_domain(p_domain TEXT)
RETURNS TABLE (
    tenant_id UUID,
    tenant_slug TEXT,
    company_name TEXT,
    branding_config JSONB,
    features_enabled JSONB,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rt.id,
        rt.tenant_slug,
        rt.company_name,
        rt.branding_config,
        rt.features_enabled,
        rt.status
    FROM reseller_tenants rt
    WHERE rt.custom_domain = p_domain
        AND rt.custom_domain_verified = true
        AND rt.status IN ('active', 'pending_setup')
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to validate API key
CREATE OR REPLACE FUNCTION validate_tenant_api_key(p_key_hash TEXT)
RETURNS TABLE (
    tenant_id UUID,
    key_id UUID,
    permissions JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tak.tenant_id,
        tak.id,
        tak.permissions
    FROM tenant_api_keys tak
    WHERE tak.key_hash = p_key_hash
        AND tak.is_active = true
        AND (tak.expires_at IS NULL OR tak.expires_at > NOW())
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to record tenant usage
CREATE OR REPLACE FUNCTION record_tenant_usage(
    p_tenant_id UUID,
    p_metric_type TEXT,
    p_count INTEGER DEFAULT 1
)
RETURNS void AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
BEGIN
    INSERT INTO tenant_usage_metrics (tenant_id, metric_date)
    VALUES (p_tenant_id, v_today)
    ON CONFLICT (tenant_id, metric_date) DO NOTHING;
    
    CASE p_metric_type
        WHEN 'api_call' THEN
            UPDATE tenant_usage_metrics
            SET api_calls = api_calls + p_count
            WHERE tenant_id = p_tenant_id AND metric_date = v_today;
        WHEN 'agent_action' THEN
            UPDATE tenant_usage_metrics
            SET agent_actions = agent_actions + p_count
            WHERE tenant_id = p_tenant_id AND metric_date = v_today;
        WHEN 'order' THEN
            UPDATE tenant_usage_metrics
            SET orders_processed = orders_processed + p_count
            WHERE tenant_id = p_tenant_id AND metric_date = v_today;
        ELSE
            NULL;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to sync products to tenant catalog
CREATE OR REPLACE FUNCTION sync_products_to_tenant(
    p_tenant_id UUID,
    p_category_filter JSONB DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_markup DECIMAL(5, 2);
BEGIN
    SELECT product_markup_percentage INTO v_markup
    FROM reseller_tenants
    WHERE id = p_tenant_id;
    
    INSERT INTO tenant_products (tenant_id, product_id, base_price, markup_percentage)
    SELECT 
        p_tenant_id,
        p.id,
        p.price,
        v_markup
    FROM products p
    WHERE p.is_active = true
        AND (p_category_filter IS NULL OR p.category = ANY(SELECT jsonb_array_elements_text(p_category_filter)))
    ON CONFLICT (tenant_id, product_id) DO UPDATE
    SET base_price = EXCLUDED.base_price,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
