-- NotebookLM Integration Migration
-- Adds: notebooklm_notebooks, notebooklm_artifacts tables
-- Extends: social_posts and newsletter_drafts with visual_content_url
-- Configures: Storage bucket for NotebookLM visuals

-- ============================================
-- NOTEBOOKLM_NOTEBOOKS: Track NotebookLM notebooks
-- ============================================
CREATE TABLE IF NOT EXISTS notebooklm_notebooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    notebook_id TEXT NOT NULL UNIQUE,
    purpose TEXT,
    google_cloud_project_id TEXT,
    sources_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived', 'error')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notebooklm_notebooks
CREATE INDEX IF NOT EXISTS idx_notebooklm_notebooks_notebook_id ON notebooklm_notebooks(notebook_id);
CREATE INDEX IF NOT EXISTS idx_notebooklm_notebooks_status ON notebooklm_notebooks(status);
CREATE INDEX IF NOT EXISTS idx_notebooklm_notebooks_created ON notebooklm_notebooks(created_at DESC);

-- ============================================
-- ARTIFACT_TYPE enum
-- ============================================
DO $$ BEGIN
    CREATE TYPE artifact_type AS ENUM ('infographic', 'slide_deck', 'video_overview', 'mind_map');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- NOTEBOOKLM_ARTIFACTS: Track generated artifacts
-- ============================================
CREATE TABLE IF NOT EXISTS notebooklm_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notebook_id UUID NOT NULL REFERENCES notebooklm_notebooks(id) ON DELETE CASCADE,
    artifact_type artifact_type NOT NULL,
    storage_path TEXT,
    thumbnail_url TEXT,
    generation_prompt TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed', 'archived')),
    linked_social_post_id UUID REFERENCES social_posts(id) ON DELETE SET NULL,
    linked_newsletter_id UUID REFERENCES newsletter_drafts(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notebooklm_artifacts
CREATE INDEX IF NOT EXISTS idx_notebooklm_artifacts_notebook_id ON notebooklm_artifacts(notebook_id);
CREATE INDEX IF NOT EXISTS idx_notebooklm_artifacts_artifact_type ON notebooklm_artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_notebooklm_artifacts_status ON notebooklm_artifacts(status);
CREATE INDEX IF NOT EXISTS idx_notebooklm_artifacts_linked_social_post ON notebooklm_artifacts(linked_social_post_id);
CREATE INDEX IF NOT EXISTS idx_notebooklm_artifacts_linked_newsletter ON notebooklm_artifacts(linked_newsletter_id);
CREATE INDEX IF NOT EXISTS idx_notebooklm_artifacts_created ON notebooklm_artifacts(created_at DESC);

-- ============================================
-- EXTEND SOCIAL_POSTS: Add visual_content_url column
-- ============================================
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS visual_content_url TEXT;

-- ============================================
-- EXTEND NEWSLETTER_DRAFTS: Add visual_content_url column
-- ============================================
ALTER TABLE newsletter_drafts ADD COLUMN IF NOT EXISTS visual_content_url TEXT;

-- ============================================
-- Enable RLS (Row Level Security)
-- ============================================
ALTER TABLE notebooklm_notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebooklm_artifacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated" ON notebooklm_notebooks FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON notebooklm_artifacts FOR ALL USING (true);

-- ============================================
-- Updated_at triggers for new tables
-- ============================================
DROP TRIGGER IF EXISTS update_notebooklm_notebooks_updated_at ON notebooklm_notebooks;
CREATE TRIGGER update_notebooklm_notebooks_updated_at
    BEFORE UPDATE ON notebooklm_notebooks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notebooklm_artifacts_updated_at ON notebooklm_artifacts;
CREATE TRIGGER update_notebooklm_artifacts_updated_at
    BEFORE UPDATE ON notebooklm_artifacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STORAGE BUCKET: notebooklm-visuals
-- ============================================
-- Note: Storage bucket configuration must be done via Supabase Dashboard or API
-- This is included here as documentation for the required storage setup:
--
-- Bucket name: notebooklm-visuals
-- Public: true (read access)
-- File size limit: 50MB
-- Allowed MIME types: image/*, video/*, application/pdf
--
-- SQL to insert bucket (if using direct database access):
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'notebooklm-visuals',
    'notebooklm-visuals',
    true,
    52428800,
    ARRAY['image/*', 'video/*', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Set public read access policy for the bucket
DO $$ 
BEGIN
    -- Allow public read access
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Public read access for notebooklm-visuals'
    ) THEN
        CREATE POLICY "Public read access for notebooklm-visuals"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'notebooklm-visuals');
    END IF;

    -- Allow authenticated users to upload
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Authenticated users can upload to notebooklm-visuals'
    ) THEN
        CREATE POLICY "Authenticated users can upload to notebooklm-visuals"
        ON storage.objects FOR INSERT
        WITH CHECK (bucket_id = 'notebooklm-visuals' AND auth.role() = 'authenticated');
    END IF;

    -- Allow authenticated users to update their uploads
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Authenticated users can update notebooklm-visuals'
    ) THEN
        CREATE POLICY "Authenticated users can update notebooklm-visuals"
        ON storage.objects FOR UPDATE
        USING (bucket_id = 'notebooklm-visuals' AND auth.role() = 'authenticated')
        WITH CHECK (bucket_id = 'notebooklm-visuals' AND auth.role() = 'authenticated');
    END IF;

    -- Allow authenticated users to delete
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Authenticated users can delete from notebooklm-visuals'
    ) THEN
        CREATE POLICY "Authenticated users can delete from notebooklm-visuals"
        ON storage.objects FOR DELETE
        USING (bucket_id = 'notebooklm-visuals' AND auth.role() = 'authenticated');
    END IF;
END $$;
