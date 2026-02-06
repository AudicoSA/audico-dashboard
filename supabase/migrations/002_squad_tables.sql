-- Squad Tables Migration
-- Run this in Supabase SQL Editor or via supabase db push

-- ============================================
-- SQUAD_AGENTS: Agent profiles and status
-- ============================================
CREATE TABLE IF NOT EXISTS squad_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('active', 'idle', 'offline')),
    last_active TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default agents
INSERT INTO squad_agents (name, role, status) VALUES
    ('Jarvis', 'Orchestrator', 'active'),
    ('Mpho', 'Orders', 'active'),
    ('Thandi', 'Stock', 'idle'),
    ('Sizwe', 'Customer', 'idle'),
    ('Naledi', 'Comms', 'idle'),
    ('Lerato', 'Content', 'idle'),
    ('Vusi', 'SEO', 'idle')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- SQUAD_TASKS: Task management kanban
-- ============================================
CREATE TABLE IF NOT EXISTS squad_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'completed')),
    assigned_agent TEXT NOT NULL REFERENCES squad_agents(name) ON DELETE SET DEFAULT DEFAULT 'Jarvis',
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    mentions_kenny BOOLEAN DEFAULT FALSE,
    deliverable_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_squad_tasks_status ON squad_tasks(status);
CREATE INDEX IF NOT EXISTS idx_squad_tasks_agent ON squad_tasks(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_squad_tasks_mentions ON squad_tasks(mentions_kenny) WHERE mentions_kenny = TRUE;
CREATE INDEX IF NOT EXISTS idx_squad_tasks_created ON squad_tasks(created_at DESC);

-- ============================================
-- SQUAD_MESSAGES: Inter-agent communication
-- ============================================
CREATE TABLE IF NOT EXISTS squad_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_agent TEXT NOT NULL,
    to_agent TEXT,
    message TEXT NOT NULL,
    task_id UUID REFERENCES squad_tasks(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for activity feed
CREATE INDEX IF NOT EXISTS idx_squad_messages_created ON squad_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_squad_messages_task ON squad_messages(task_id);

-- ============================================
-- Enable RLS (Row Level Security)
-- ============================================
ALTER TABLE squad_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE squad_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE squad_messages ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (adjust as needed)
CREATE POLICY "Allow all for authenticated" ON squad_agents FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON squad_tasks FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON squad_messages FOR ALL USING (true);

-- ============================================
-- Updated_at trigger for tasks
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_squad_tasks_updated_at ON squad_tasks;
CREATE TRIGGER update_squad_tasks_updated_at
    BEFORE UPDATE ON squad_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Sample tasks for testing (optional)
-- ============================================
INSERT INTO squad_tasks (title, description, status, assigned_agent, priority, mentions_kenny) VALUES
    ('Process pending orders from today', 'Review and confirm all new orders', 'in_progress', 'Mpho', 'high', false),
    ('Stock audit for Sonos products', 'Verify inventory levels match Supabase', 'new', 'Thandi', 'medium', false),
    ('Customer complaint - Delivery delay', 'Order #45892 - Customer escalated', 'new', 'Sizwe', 'urgent', true),
    ('Write blog post about home automation', 'SEO-optimized content for blog', 'in_progress', 'Lerato', 'low', false),
    ('Optimize product page meta descriptions', 'Improve SEO for top 50 products', 'completed', 'Vusi', 'medium', false),
    ('Send newsletter to subscribers', 'February promo announcement', 'new', 'Naledi', 'high', false)
ON CONFLICT DO NOTHING;

-- Insert sample activity
INSERT INTO squad_messages (from_agent, to_agent, message, task_id) 
SELECT 
    'Jarvis', 
    NULL, 
    'Morning briefing complete. Assigned 6 tasks across the squad.',
    NULL
WHERE NOT EXISTS (SELECT 1 FROM squad_messages LIMIT 1);
