-- NotebookLM Configuration and Usage Tracking
-- Adds: notebooklm_config, notebooklm_usage tables
-- Updates: notebooklm_notebooks table structure

-- ============================================
-- NOTEBOOKLM_CONFIG: Store NotebookLM configuration
-- ============================================
CREATE TABLE IF NOT EXISTS notebooklm_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_cloud_project_id TEXT,
    service_account_json JSONB,
    python_path TEXT DEFAULT 'python',
    notebooklm_py_installed BOOLEAN DEFAULT false,
    connection_tested BOOLEAN DEFAULT false,
    last_test_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only allow one config row
CREATE UNIQUE INDEX IF NOT EXISTS idx_notebooklm_config_singleton ON notebooklm_config ((id IS NOT NULL));

-- ============================================
-- NOTEBOOKLM_USAGE: Track usage metrics
-- ============================================
CREATE TABLE IF NOT EXISTS notebooklm_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_calls_count INTEGER DEFAULT 0,
    storage_used_mb NUMERIC(10, 2) DEFAULT 0,
    artifact_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only allow one usage row
CREATE UNIQUE INDEX IF NOT EXISTS idx_notebooklm_usage_singleton ON notebooklm_usage ((id IS NOT NULL));

-- ============================================
-- Update notebooklm_notebooks table structure
-- ============================================
ALTER TABLE notebooklm_notebooks ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE notebooklm_notebooks ADD COLUMN IF NOT EXISTS sources TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE notebooklm_notebooks ADD COLUMN IF NOT EXISTS source_count INTEGER DEFAULT 0;
ALTER TABLE notebooklm_notebooks ADD COLUMN IF NOT EXISTS statistics JSONB DEFAULT '{"queries_count": 0, "artifacts_generated": 0, "last_activity": null}'::jsonb;
ALTER TABLE notebooklm_notebooks ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- Enable RLS (Row Level Security)
-- ============================================
ALTER TABLE notebooklm_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebooklm_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated" ON notebooklm_config FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON notebooklm_usage FOR ALL USING (true);

-- ============================================
-- Updated_at triggers for new tables
-- ============================================
DROP TRIGGER IF EXISTS update_notebooklm_config_updated_at ON notebooklm_config;
CREATE TRIGGER update_notebooklm_config_updated_at
    BEFORE UPDATE ON notebooklm_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notebooklm_usage_updated_at ON notebooklm_usage;
CREATE TRIGGER update_notebooklm_usage_updated_at
    BEFORE UPDATE ON notebooklm_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notebooklm_notebooks_last_updated ON notebooklm_notebooks;
CREATE TRIGGER update_notebooklm_notebooks_last_updated
    BEFORE UPDATE ON notebooklm_notebooks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Insert default config and usage rows
-- ============================================
INSERT INTO notebooklm_config (id) 
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

INSERT INTO notebooklm_usage (id) 
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;
