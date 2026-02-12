-- Quote Approval Feedback and Learning System
-- Tracks Kenny's approval patterns, edits, and rejections for AI learning

-- ============================================
-- QUOTE_APPROVAL_FEEDBACK: Track Kenny's feedback on generated quotes
-- ============================================
CREATE TABLE IF NOT EXISTS quote_approval_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_request_id UUID NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
    quote_number TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'edited')),
    reason TEXT,
    original_total NUMERIC(10, 2),
    edited_total NUMERIC(10, 2),
    edits JSONB DEFAULT '[]'::jsonb,
    approval_time_seconds INTEGER,
    patterns JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quote_approval_feedback
CREATE INDEX IF NOT EXISTS idx_quote_approval_feedback_quote_request ON quote_approval_feedback(quote_request_id);
CREATE INDEX IF NOT EXISTS idx_quote_approval_feedback_action ON quote_approval_feedback(action);
CREATE INDEX IF NOT EXISTS idx_quote_approval_feedback_created ON quote_approval_feedback(created_at DESC);

-- Enable RLS
ALTER TABLE quote_approval_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated" ON quote_approval_feedback FOR ALL USING (true);

-- ============================================
-- QUOTE_EDITS: Track individual edits made to quotes
-- ============================================
CREATE TABLE IF NOT EXISTS quote_edits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_request_id UUID NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
    quote_number TEXT NOT NULL,
    edit_type TEXT NOT NULL CHECK (edit_type IN ('price_adjustment', 'product_added', 'product_removed', 'quantity_changed', 'markup_changed', 'other')),
    item_name TEXT,
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    edited_by TEXT DEFAULT 'Kenny',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quote_edits
CREATE INDEX IF NOT EXISTS idx_quote_edits_quote_request ON quote_edits(quote_request_id);
CREATE INDEX IF NOT EXISTS idx_quote_edits_type ON quote_edits(edit_type);
CREATE INDEX IF NOT EXISTS idx_quote_edits_created ON quote_edits(created_at DESC);

-- Enable RLS
ALTER TABLE quote_edits ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated" ON quote_edits FOR ALL USING (true);

-- ============================================
-- Add metadata column to squad_tasks if not exists
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'squad_tasks' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE squad_tasks ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Create index on metadata for quote approval tasks
CREATE INDEX IF NOT EXISTS idx_squad_tasks_metadata_action_required 
ON squad_tasks((metadata->>'action_required')) 
WHERE metadata->>'action_required' = 'approve_quote';
