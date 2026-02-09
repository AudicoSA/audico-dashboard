-- Customer Portal Migration
-- Creates tables for customer authentication, support tickets, document uploads, and audit logging

-- ============================================
-- PORTAL_USERS: Customer portal authentication
-- ============================================
CREATE TABLE IF NOT EXISTS portal_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- Links to Supabase auth.users
    customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE SET NULL,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    company_name TEXT,
    phone TEXT,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    last_login_at TIMESTAMPTZ,
    preferences JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for portal_users
CREATE INDEX IF NOT EXISTS idx_portal_users_auth_user_id ON portal_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_email ON portal_users(email);
CREATE INDEX IF NOT EXISTS idx_portal_users_customer_profile_id ON portal_users(customer_profile_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_status ON portal_users(status);

-- ============================================
-- SUPPORT_TICKETS: Customer support tickets
-- ============================================
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number TEXT NOT NULL UNIQUE,
    portal_user_id UUID NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
    customer_email TEXT NOT NULL,
    customer_name TEXT,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT CHECK (category IN ('technical', 'billing', 'product', 'shipping', 'general', 'other')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'waiting_internal', 'resolved', 'closed')),
    assigned_agent TEXT,
    resolution TEXT,
    ai_generated_status TEXT, -- AI-generated status update
    ai_generated_at TIMESTAMPTZ,
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for support_tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_number ON support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_tickets_portal_user_id ON support_tickets(portal_user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_customer_email ON support_tickets(customer_email);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_agent ON support_tickets(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON support_tickets(created_at DESC);

-- ============================================
-- TICKET_MESSAGES: Support ticket conversation thread
-- ============================================
CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system')),
    sender_id UUID, -- portal_user_id or agent id
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false, -- Internal notes not visible to customer
    attachments JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ticket_messages
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender_type ON ticket_messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created ON ticket_messages(created_at DESC);

-- ============================================
-- TICKET_ATTACHMENTS: File uploads for support tickets
-- ============================================
CREATE TABLE IF NOT EXISTS ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    message_id UUID REFERENCES ticket_messages(id) ON DELETE SET NULL,
    uploaded_by UUID NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    scan_status TEXT DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'infected', 'failed')),
    scanned_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ticket_attachments
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploaded_by ON ticket_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_scan_status ON ticket_attachments(scan_status);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_created ON ticket_attachments(created_at DESC);

-- ============================================
-- SCHEDULED_CALLS: Customer scheduled calls
-- ============================================
CREATE TABLE IF NOT EXISTS scheduled_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_user_id UUID NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    purpose TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
    call_transcript_id UUID REFERENCES call_transcripts(id) ON DELETE SET NULL,
    assigned_agent TEXT,
    notes TEXT,
    reminder_sent BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for scheduled_calls
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_portal_user_id ON scheduled_calls(portal_user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_status ON scheduled_calls(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_scheduled_for ON scheduled_calls(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_created ON scheduled_calls(created_at DESC);

-- ============================================
-- PORTAL_AUDIT_LOG: POPIA-compliant audit logging
-- ============================================
CREATE TABLE IF NOT EXISTS portal_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_user_id UUID REFERENCES portal_users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- login, logout, view_data, update_profile, download, etc.
    resource_type TEXT, -- ticket, order, document, etc.
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    action_details JSONB DEFAULT '{}'::jsonb,
    data_accessed TEXT[], -- List of data fields accessed (POPIA compliance)
    purpose TEXT, -- Business purpose for data access
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for portal_audit_log
CREATE INDEX IF NOT EXISTS idx_portal_audit_log_portal_user_id ON portal_audit_log(portal_user_id);
CREATE INDEX IF NOT EXISTS idx_portal_audit_log_action_type ON portal_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_portal_audit_log_resource_type ON portal_audit_log(resource_type);
CREATE INDEX IF NOT EXISTS idx_portal_audit_log_created ON portal_audit_log(created_at DESC);

-- ============================================
-- CHATBOT_SESSIONS: Customer chatbot interactions
-- ============================================
CREATE TABLE IF NOT EXISTS chatbot_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL UNIQUE,
    portal_user_id UUID REFERENCES portal_users(id) ON DELETE SET NULL,
    customer_email TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'escalated', 'abandoned')),
    escalated_to_ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL,
    context JSONB DEFAULT '{}'::jsonb, -- Conversation context and history
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for chatbot_sessions
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_session_id ON chatbot_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_portal_user_id ON chatbot_sessions(portal_user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_status ON chatbot_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_last_activity ON chatbot_sessions(last_activity_at DESC);

-- ============================================
-- CHATBOT_MESSAGES: Chatbot conversation messages
-- ============================================
CREATE TABLE IF NOT EXISTS chatbot_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chatbot_sessions(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'bot', 'system')),
    message TEXT NOT NULL,
    intent TEXT, -- Detected customer intent
    confidence DECIMAL(5, 4), -- AI confidence score
    sources TEXT[], -- RAG sources used for response
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for chatbot_messages
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session_id ON chatbot_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_sender_type ON chatbot_messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_created ON chatbot_messages(created_at DESC);

-- ============================================
-- KNOWLEDGE_BASE: RAG knowledge base for chatbot
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('product', 'faq', 'policy', 'troubleshooting', 'other')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
    embedding VECTOR(1536), -- OpenAI embeddings (if using pgvector extension)
    source_type TEXT, -- manual, auto_generated, product_catalog
    source_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    unhelpful_count INTEGER DEFAULT 0,
    last_updated_by TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for knowledge_base
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_status ON knowledge_base(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_keywords ON knowledge_base USING gin(keywords);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_created ON knowledge_base(created_at DESC);

-- ============================================
-- DATA_ACCESS_REQUESTS: POPIA data access/deletion requests
-- ============================================
CREATE TABLE IF NOT EXISTS data_access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_user_id UUID NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL CHECK (request_type IN ('access', 'export', 'correction', 'deletion', 'restriction')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
    reason TEXT,
    processed_by TEXT,
    processed_at TIMESTAMPTZ,
    completion_notes TEXT,
    data_export_url TEXT, -- If type is 'export'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for data_access_requests
CREATE INDEX IF NOT EXISTS idx_data_access_requests_portal_user_id ON data_access_requests(portal_user_id);
CREATE INDEX IF NOT EXISTS idx_data_access_requests_request_type ON data_access_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_data_access_requests_status ON data_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_access_requests_created ON data_access_requests(created_at DESC);

-- ============================================
-- Enable RLS (Row Level Security)
-- ============================================
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for portal_users
-- ============================================
CREATE POLICY "Users can view own data" ON portal_users FOR SELECT USING (auth_user_id = auth.uid());
CREATE POLICY "Users can update own data" ON portal_users FOR UPDATE USING (auth_user_id = auth.uid());
CREATE POLICY "Admin full access" ON portal_users FOR ALL USING (true); -- For admin dashboard

-- ============================================
-- RLS Policies for support_tickets
-- ============================================
CREATE POLICY "Users can view own tickets" ON support_tickets FOR SELECT USING (portal_user_id IN (SELECT id FROM portal_users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can create own tickets" ON support_tickets FOR INSERT WITH CHECK (portal_user_id IN (SELECT id FROM portal_users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admin full access" ON support_tickets FOR ALL USING (true);

-- ============================================
-- RLS Policies for ticket_messages
-- ============================================
CREATE POLICY "Users can view own ticket messages" ON ticket_messages FOR SELECT USING (
    ticket_id IN (SELECT id FROM support_tickets WHERE portal_user_id IN (SELECT id FROM portal_users WHERE auth_user_id = auth.uid()))
    AND is_internal = false
);
CREATE POLICY "Users can create ticket messages" ON ticket_messages FOR INSERT WITH CHECK (
    ticket_id IN (SELECT id FROM support_tickets WHERE portal_user_id IN (SELECT id FROM portal_users WHERE auth_user_id = auth.uid()))
);
CREATE POLICY "Admin full access" ON ticket_messages FOR ALL USING (true);

-- ============================================
-- RLS Policies for ticket_attachments
-- ============================================
CREATE POLICY "Users can view own attachments" ON ticket_attachments FOR SELECT USING (
    uploaded_by IN (SELECT id FROM portal_users WHERE auth_user_id = auth.uid())
);
CREATE POLICY "Users can upload attachments" ON ticket_attachments FOR INSERT WITH CHECK (
    uploaded_by IN (SELECT id FROM portal_users WHERE auth_user_id = auth.uid())
);
CREATE POLICY "Admin full access" ON ticket_attachments FOR ALL USING (true);

-- ============================================
-- RLS Policies for scheduled_calls
-- ============================================
CREATE POLICY "Users can view own calls" ON scheduled_calls FOR SELECT USING (portal_user_id IN (SELECT id FROM portal_users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can create own calls" ON scheduled_calls FOR INSERT WITH CHECK (portal_user_id IN (SELECT id FROM portal_users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admin full access" ON scheduled_calls FOR ALL USING (true);

-- ============================================
-- RLS Policies for portal_audit_log
-- ============================================
CREATE POLICY "Users can view own audit log" ON portal_audit_log FOR SELECT USING (portal_user_id IN (SELECT id FROM portal_users WHERE auth_user_id = auth.uid()));
CREATE POLICY "System can insert audit logs" ON portal_audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin full access" ON portal_audit_log FOR ALL USING (true);

-- ============================================
-- RLS Policies for chatbot_sessions
-- ============================================
CREATE POLICY "Users can view own chatbot sessions" ON chatbot_sessions FOR SELECT USING (portal_user_id IN (SELECT id FROM portal_users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can create chatbot sessions" ON chatbot_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own sessions" ON chatbot_sessions FOR UPDATE USING (portal_user_id IN (SELECT id FROM portal_users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admin full access" ON chatbot_sessions FOR ALL USING (true);

-- ============================================
-- RLS Policies for chatbot_messages
-- ============================================
CREATE POLICY "Users can view own chatbot messages" ON chatbot_messages FOR SELECT USING (
    session_id IN (SELECT id FROM chatbot_sessions WHERE portal_user_id IN (SELECT id FROM portal_users WHERE auth_user_id = auth.uid()))
);
CREATE POLICY "System can insert chatbot messages" ON chatbot_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin full access" ON chatbot_messages FOR ALL USING (true);

-- ============================================
-- RLS Policies for knowledge_base
-- ============================================
CREATE POLICY "Users can view active knowledge base" ON knowledge_base FOR SELECT USING (status = 'active');
CREATE POLICY "Admin full access" ON knowledge_base FOR ALL USING (true);

-- ============================================
-- RLS Policies for data_access_requests
-- ============================================
CREATE POLICY "Users can view own requests" ON data_access_requests FOR SELECT USING (portal_user_id IN (SELECT id FROM portal_users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can create requests" ON data_access_requests FOR INSERT WITH CHECK (portal_user_id IN (SELECT id FROM portal_users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admin full access" ON data_access_requests FOR ALL USING (true);

-- ============================================
-- Updated_at triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_portal_users_updated_at ON portal_users;
CREATE TRIGGER update_portal_users_updated_at BEFORE UPDATE ON portal_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scheduled_calls_updated_at ON scheduled_calls;
CREATE TRIGGER update_scheduled_calls_updated_at BEFORE UPDATE ON scheduled_calls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chatbot_sessions_updated_at ON chatbot_sessions;
CREATE TRIGGER update_chatbot_sessions_updated_at BEFORE UPDATE ON chatbot_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_knowledge_base_updated_at ON knowledge_base;
CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_data_access_requests_updated_at ON data_access_requests;
CREATE TRIGGER update_data_access_requests_updated_at BEFORE UPDATE ON data_access_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Helper functions for ticket numbers
-- ============================================
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    counter INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO counter FROM support_tickets;
    new_number := 'TKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to log audit events
-- ============================================
CREATE OR REPLACE FUNCTION log_audit_event(
    p_portal_user_id UUID,
    p_action_type TEXT,
    p_resource_type TEXT DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_action_details JSONB DEFAULT '{}'::jsonb,
    p_data_accessed TEXT[] DEFAULT ARRAY[]::TEXT[],
    p_purpose TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO portal_audit_log (
        portal_user_id,
        action_type,
        resource_type,
        resource_id,
        ip_address,
        user_agent,
        action_details,
        data_accessed,
        purpose
    ) VALUES (
        p_portal_user_id,
        p_action_type,
        p_resource_type,
        p_resource_id,
        p_ip_address,
        p_user_agent,
        p_action_details,
        p_data_accessed,
        p_purpose
    ) RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE portal_users IS 'Customer portal user accounts with POPIA-compliant access controls';
COMMENT ON TABLE support_tickets IS 'Customer support tickets with AI-generated status updates';
COMMENT ON TABLE ticket_messages IS 'Support ticket conversation threads';
COMMENT ON TABLE ticket_attachments IS 'File uploads for support tickets';
COMMENT ON TABLE scheduled_calls IS 'Customer scheduled calls with transcript linking';
COMMENT ON TABLE portal_audit_log IS 'POPIA-compliant audit log of all data access and modifications';
COMMENT ON TABLE chatbot_sessions IS 'AI chatbot conversation sessions';
COMMENT ON TABLE chatbot_messages IS 'Individual chatbot messages with RAG sources';
COMMENT ON TABLE knowledge_base IS 'RAG knowledge base for chatbot responses';
COMMENT ON TABLE data_access_requests IS 'POPIA data access, correction, and deletion requests';
