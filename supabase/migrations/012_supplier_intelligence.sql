-- Supplier Intelligence Migration
-- Adds tables for managing suppliers, products, contacts, and quote workflows

-- ============================================
-- SUPPLIERS: Core supplier management
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    specialties TEXT[] DEFAULT ARRAY[]::TEXT[],
    relationship_strength INTEGER NOT NULL DEFAULT 50 CHECK (relationship_strength >= 0 AND relationship_strength <= 100),
    avg_response_time_hours NUMERIC(10, 2),
    reliability_score INTEGER CHECK (reliability_score >= 0 AND reliability_score <= 100),
    last_contact_date TIMESTAMPTZ,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company);
CREATE INDEX IF NOT EXISTS idx_suppliers_relationship_strength ON suppliers(relationship_strength DESC);
CREATE INDEX IF NOT EXISTS idx_suppliers_last_contact ON suppliers(last_contact_date DESC);

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated" ON suppliers FOR ALL USING (true);

-- Updated_at trigger
CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SUPPLIER_PRODUCTS: Product catalog per supplier
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    product_category TEXT,
    manufacturer TEXT,
    model_number TEXT,
    typical_lead_time_days INTEGER,
    avg_markup_percentage NUMERIC(5, 2),
    last_quoted_price NUMERIC(10, 2),
    last_quoted_date TIMESTAMPTZ,
    stock_reliability TEXT NOT NULL DEFAULT 'usually_available' CHECK (stock_reliability IN ('always_in_stock', 'usually_available', 'often_delayed', 'unreliable')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for supplier_products
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_product_name ON supplier_products(product_name);
CREATE INDEX IF NOT EXISTS idx_supplier_products_category ON supplier_products(product_category);
CREATE INDEX IF NOT EXISTS idx_supplier_products_manufacturer ON supplier_products(manufacturer);
CREATE INDEX IF NOT EXISTS idx_supplier_products_model_number ON supplier_products(model_number);

-- Enable RLS
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated" ON supplier_products FOR ALL USING (true);

-- Updated_at trigger
CREATE TRIGGER update_supplier_products_updated_at
    BEFORE UPDATE ON supplier_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SUPPLIER_CONTACTS: Contact persons at suppliers
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    contact_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    role TEXT,
    specializes_in TEXT[] DEFAULT ARRAY[]::TEXT[],
    response_quality_score INTEGER CHECK (response_quality_score >= 0 AND response_quality_score <= 100),
    preferred_contact BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for supplier_contacts
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier_id ON supplier_contacts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_email ON supplier_contacts(email);
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_preferred ON supplier_contacts(preferred_contact) WHERE preferred_contact = true;

-- Enable RLS
ALTER TABLE supplier_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated" ON supplier_contacts FOR ALL USING (true);

-- Updated_at trigger
CREATE TRIGGER update_supplier_contacts_updated_at
    BEFORE UPDATE ON supplier_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- EMAIL_SUPPLIER_INTERACTIONS: Track supplier email interactions
-- ============================================
CREATE TABLE IF NOT EXISTS email_supplier_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_log_id UUID NOT NULL REFERENCES email_logs(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('quote_request', 'quote_response', 'stock_inquiry', 'order_placement', 'support')),
    products_mentioned TEXT[] DEFAULT ARRAY[]::TEXT[],
    pricing_data JSONB DEFAULT '{}'::jsonb,
    stock_info JSONB DEFAULT '{}'::jsonb,
    extracted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for email_supplier_interactions
CREATE INDEX IF NOT EXISTS idx_email_supplier_interactions_email_log_id ON email_supplier_interactions(email_log_id);
CREATE INDEX IF NOT EXISTS idx_email_supplier_interactions_supplier_id ON email_supplier_interactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_email_supplier_interactions_type ON email_supplier_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_email_supplier_interactions_extracted_at ON email_supplier_interactions(extracted_at DESC);

-- Enable RLS
ALTER TABLE email_supplier_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated" ON email_supplier_interactions FOR ALL USING (true);

-- ============================================
-- QUOTE_REQUESTS: Track customer quote requests and workflow
-- ============================================
CREATE TABLE IF NOT EXISTS quote_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_email TEXT NOT NULL,
    customer_name TEXT,
    requested_products JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_email_id UUID REFERENCES email_logs(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'suppliers_contacted', 'quotes_received', 'pdf_generated', 'sent_to_customer', 'completed')),
    confidence_score NUMERIC(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    assigned_agent TEXT REFERENCES squad_agents(name) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quote_requests
CREATE INDEX IF NOT EXISTS idx_quote_requests_customer_email ON quote_requests(customer_email);
CREATE INDEX IF NOT EXISTS idx_quote_requests_source_email_id ON quote_requests(source_email_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_assigned_agent ON quote_requests(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_quote_requests_created_at ON quote_requests(created_at DESC);

-- Enable RLS
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated" ON quote_requests FOR ALL USING (true);

-- Updated_at trigger
CREATE TRIGGER update_quote_requests_updated_at
    BEFORE UPDATE ON quote_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
