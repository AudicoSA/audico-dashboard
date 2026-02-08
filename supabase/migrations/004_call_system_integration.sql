-- Call System Integration Migration
-- Adds: call_transcripts, customer_interactions, interaction_timeline

-- ============================================
-- CALL_TRANSCRIPTS: Store call transcripts from audico-call-system
-- ============================================
CREATE TABLE IF NOT EXISTS call_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id TEXT NOT NULL UNIQUE,
    customer_phone TEXT NOT NULL,
    customer_name TEXT,
    customer_email TEXT,
    call_duration INTEGER,
    call_start_time TIMESTAMPTZ NOT NULL,
    call_end_time TIMESTAMPTZ,
    transcript TEXT NOT NULL,
    summary TEXT,
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
    call_outcome TEXT CHECK (call_outcome IN ('resolved', 'follow_up_needed', 'escalation', 'inquiry', 'order', 'complaint', 'other')),
    customer_intent TEXT,
    key_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for call_transcripts
CREATE INDEX IF NOT EXISTS idx_call_transcripts_call_id ON call_transcripts(call_id);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_customer_phone ON call_transcripts(customer_phone);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_customer_email ON call_transcripts(customer_email);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_call_outcome ON call_transcripts(call_outcome);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_sentiment ON call_transcripts(sentiment);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_call_start_time ON call_transcripts(call_start_time DESC);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_created ON call_transcripts(created_at DESC);

-- ============================================
-- CUSTOMER_INTERACTIONS: Unified customer interaction history
-- ============================================
CREATE TABLE IF NOT EXISTS customer_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('call', 'email', 'chat', 'social', 'order', 'support_ticket', 'other')),
    interaction_source TEXT NOT NULL,
    interaction_date TIMESTAMPTZ NOT NULL,
    subject TEXT,
    summary TEXT,
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
    outcome TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'in_progress', 'completed', 'follow_up_required')),
    assigned_agent TEXT REFERENCES squad_agents(name) ON DELETE SET NULL,
    reference_id TEXT,
    reference_type TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for customer_interactions
CREATE INDEX IF NOT EXISTS idx_customer_interactions_customer_id ON customer_interactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_customer_email ON customer_interactions(customer_email);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_customer_phone ON customer_interactions(customer_phone);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_type ON customer_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_date ON customer_interactions(interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_status ON customer_interactions(status);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_assigned_agent ON customer_interactions(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_reference ON customer_interactions(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_created ON customer_interactions(created_at DESC);

-- Index for customer timeline queries
CREATE INDEX IF NOT EXISTS idx_customer_interactions_timeline ON customer_interactions(customer_id, interaction_date DESC);

-- ============================================
-- Enable RLS (Row Level Security)
-- ============================================
ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated" ON call_transcripts FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON customer_interactions FOR ALL USING (true);

-- ============================================
-- Updated_at triggers for new tables
-- ============================================
DROP TRIGGER IF EXISTS update_call_transcripts_updated_at ON call_transcripts;
CREATE TRIGGER update_call_transcripts_updated_at
    BEFORE UPDATE ON call_transcripts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_interactions_updated_at ON customer_interactions;
CREATE TRIGGER update_customer_interactions_updated_at
    BEFORE UPDATE ON customer_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
