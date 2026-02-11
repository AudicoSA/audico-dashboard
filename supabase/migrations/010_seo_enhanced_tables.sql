-- SEO Enhancement Tables Migration
-- Adds tables for Core Web Vitals, Schema.org audits, and GEO analysis

-- ============================================
-- 1. Core Web Vitals Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS seo_vitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    product_id INTEGER,

    -- Core Web Vitals
    lcp DECIMAL(10, 2),           -- Largest Contentful Paint (ms)
    inp DECIMAL(10, 2),           -- Interaction to Next Paint (ms)
    cls DECIMAL(10, 4),           -- Cumulative Layout Shift

    -- Additional metrics
    fcp DECIMAL(10, 2),           -- First Contentful Paint (ms)
    ttfb DECIMAL(10, 2),          -- Time to First Byte (ms)
    si DECIMAL(10, 2),            -- Speed Index

    -- Scoring
    performance_score INTEGER CHECK (performance_score >= 0 AND performance_score <= 100),
    status TEXT CHECK (status IN ('good', 'needs-improvement', 'poor')),

    -- Details
    issues JSONB DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,

    -- Timestamps
    measured_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for vitals
CREATE INDEX IF NOT EXISTS idx_seo_vitals_url ON seo_vitals(url);
CREATE INDEX IF NOT EXISTS idx_seo_vitals_product ON seo_vitals(product_id);
CREATE INDEX IF NOT EXISTS idx_seo_vitals_score ON seo_vitals(performance_score);
CREATE INDEX IF NOT EXISTS idx_seo_vitals_measured ON seo_vitals(measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_vitals_status ON seo_vitals(status);

-- ============================================
-- 2. Schema.org Markup Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS seo_schema_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    product_id INTEGER,

    -- Schema presence
    has_product_schema BOOLEAN DEFAULT false,
    has_breadcrumb_schema BOOLEAN DEFAULT false,
    has_organization_schema BOOLEAN DEFAULT false,
    has_review_schema BOOLEAN DEFAULT false,

    -- Detected schemas (array of {type, format, valid, errors})
    detected_schemas JSONB DEFAULT '[]'::jsonb,

    -- Issues
    missing_required_fields JSONB DEFAULT '[]'::jsonb,
    validation_errors JSONB DEFAULT '[]'::jsonb,

    -- Generated schema (if we created one)
    generated_schema JSONB,

    -- Application tracking
    applied_at TIMESTAMPTZ,
    applied_by TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for schema audits
CREATE INDEX IF NOT EXISTS idx_seo_schema_url ON seo_schema_audits(url);
CREATE INDEX IF NOT EXISTS idx_seo_schema_product ON seo_schema_audits(product_id);
CREATE INDEX IF NOT EXISTS idx_seo_schema_has_product ON seo_schema_audits(has_product_schema);
CREATE INDEX IF NOT EXISTS idx_seo_schema_applied ON seo_schema_audits(applied_at);
CREATE INDEX IF NOT EXISTS idx_seo_schema_created ON seo_schema_audits(created_at DESC);

-- ============================================
-- 3. AI/GEO Optimization Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS seo_geo_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    product_id INTEGER,

    -- AI visibility scoring
    ai_visibility_score INTEGER CHECK (ai_visibility_score >= 0 AND ai_visibility_score <= 100),

    -- Content structure analysis
    content_structure JSONB DEFAULT '{}'::jsonb,

    -- AI search signals
    ai_search_signals JSONB DEFAULT '{}'::jsonb,

    -- E-E-A-T signals
    eeat_signals JSONB DEFAULT '{}'::jsonb,

    -- Recommendations
    recommendations JSONB DEFAULT '[]'::jsonb,

    -- Timestamps
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for GEO analysis
CREATE INDEX IF NOT EXISTS idx_seo_geo_url ON seo_geo_analysis(url);
CREATE INDEX IF NOT EXISTS idx_seo_geo_product ON seo_geo_analysis(product_id);
CREATE INDEX IF NOT EXISTS idx_seo_geo_score ON seo_geo_analysis(ai_visibility_score);
CREATE INDEX IF NOT EXISTS idx_seo_geo_analyzed ON seo_geo_analysis(analyzed_at DESC);

-- ============================================
-- 4. Extend existing seo_audits table (if exists)
-- ============================================

-- Add subtype column if not exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'seo_audits') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'seo_audits' AND column_name = 'audit_subtype') THEN
            ALTER TABLE seo_audits ADD COLUMN audit_subtype TEXT;
        END IF;
    END IF;
END $$;

-- ============================================
-- 5. Views for Dashboard
-- ============================================

-- Latest vitals per product
CREATE OR REPLACE VIEW seo_vitals_latest AS
SELECT DISTINCT ON (product_id)
    id,
    product_id,
    url,
    lcp,
    inp,
    cls,
    fcp,
    ttfb,
    performance_score,
    status,
    issues,
    recommendations,
    measured_at
FROM seo_vitals
WHERE product_id IS NOT NULL
ORDER BY product_id, measured_at DESC;

-- Latest schema audit per product
CREATE OR REPLACE VIEW seo_schema_audits_latest AS
SELECT DISTINCT ON (product_id)
    id,
    product_id,
    url,
    has_product_schema,
    has_breadcrumb_schema,
    has_organization_schema,
    has_review_schema,
    detected_schemas,
    missing_required_fields,
    validation_errors,
    generated_schema,
    created_at
FROM seo_schema_audits
WHERE product_id IS NOT NULL
ORDER BY product_id, created_at DESC;

-- Latest GEO analysis per product
CREATE OR REPLACE VIEW seo_geo_analysis_latest AS
SELECT DISTINCT ON (product_id)
    id,
    product_id,
    url,
    ai_visibility_score,
    content_structure,
    ai_search_signals,
    eeat_signals,
    recommendations,
    analyzed_at
FROM seo_geo_analysis
WHERE product_id IS NOT NULL
ORDER BY product_id, analyzed_at DESC;

-- Combined SEO health summary
CREATE OR REPLACE VIEW seo_health_summary AS
SELECT
    v.product_id,
    v.url,
    v.performance_score as vitals_score,
    v.status as vitals_status,
    s.has_product_schema,
    s.has_breadcrumb_schema,
    g.ai_visibility_score as geo_score,
    GREATEST(v.measured_at, s.created_at, g.analyzed_at) as last_checked
FROM seo_vitals_latest v
LEFT JOIN seo_schema_audits_latest s ON v.product_id = s.product_id
LEFT JOIN seo_geo_analysis_latest g ON v.product_id = g.product_id;

-- ============================================
-- 6. Row Level Security (RLS)
-- ============================================

-- Enable RLS on new tables
ALTER TABLE seo_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_schema_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_geo_analysis ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all data
CREATE POLICY "Allow authenticated read access on seo_vitals"
    ON seo_vitals FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated read access on seo_schema_audits"
    ON seo_schema_audits FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated read access on seo_geo_analysis"
    ON seo_geo_analysis FOR SELECT
    TO authenticated
    USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access on seo_vitals"
    ON seo_vitals FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Allow service role full access on seo_schema_audits"
    ON seo_schema_audits FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Allow service role full access on seo_geo_analysis"
    ON seo_geo_analysis FOR ALL
    TO service_role
    USING (true);

-- ============================================
-- 7. Triggers for updated_at
-- ============================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for seo_schema_audits
DROP TRIGGER IF EXISTS update_seo_schema_audits_updated_at ON seo_schema_audits;
CREATE TRIGGER update_seo_schema_audits_updated_at
    BEFORE UPDATE ON seo_schema_audits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
