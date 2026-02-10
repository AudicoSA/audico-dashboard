-- Replace Demo Agents with Real Working Agents
-- This migration removes the old demo agents and inserts the actual working agents

-- ============================================
-- STEP 1: Delete old demo agents and their data
-- ============================================

-- Delete demo tasks first (due to foreign key)
DELETE FROM squad_tasks WHERE assigned_agent IN (
  'Jarvis', 'Mpho', 'Thandi', 'Sizwe', 'Naledi', 'Lerato', 'Vusi'
);

-- Delete demo messages
DELETE FROM squad_messages WHERE from_agent IN (
  'Jarvis', 'Mpho', 'Thandi', 'Sizwe', 'Naledi', 'Lerato', 'Vusi'
) OR to_agent IN (
  'Jarvis', 'Mpho', 'Thandi', 'Sizwe', 'Naledi', 'Lerato', 'Vusi'
);

-- Delete demo agents
DELETE FROM squad_agents WHERE name IN (
  'Jarvis', 'Mpho', 'Thandi', 'Sizwe', 'Naledi', 'Lerato', 'Vusi'
);

-- ============================================
-- STEP 2: Insert real working agents
-- ============================================

INSERT INTO squad_agents (name, role, status) VALUES
    ('Jarvis', 'Master Orchestrator (Claude AI)', 'active'),
    ('Email Agent', 'Email Management', 'active'),
    ('Social Media Agent', 'Social Media & Content', 'active'),
    ('Google Ads Agent', 'Advertising & PPC', 'active'),
    ('SEO Agent', 'SEO & Product Optimization', 'active'),
    ('Marketing Agent', 'Marketing & Resellers', 'active')
ON CONFLICT (name) DO UPDATE SET
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    last_active = NOW();

-- ============================================
-- STEP 3: Insert welcome message from system
-- ============================================

INSERT INTO squad_messages (from_agent, to_agent, message)
VALUES (
    'Jarvis',
    NULL,
    '🧠 Master Orchestrator online. Managing 5 specialized agents with Claude AI.'
);

-- ============================================
-- STEP 4: Create initial task for each agent (optional)
-- ============================================

INSERT INTO squad_tasks (title, description, status, assigned_agent, priority, mentions_kenny) VALUES
    ('Poll Gmail for new emails', 'Check for customer inquiries, orders, and support requests', 'in_progress', 'Email Agent', 'high', false),
    ('Generate social media posts', 'Create AI-powered content for Facebook, Instagram, Twitter', 'new', 'Social Media Agent', 'medium', false),
    ('Monitor Google Ads campaigns', 'Check performance and suggest bid optimizations', 'new', 'Google Ads Agent', 'medium', false),
    ('Audit product SEO', 'Review OpenCart products for SEO improvements', 'new', 'SEO Agent', 'low', false),
    ('Process reseller applications', 'Review and approve new reseller signups', 'new', 'Marketing Agent', 'low', false)
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 5: Add comment for documentation
-- ============================================

COMMENT ON TABLE squad_agents IS 'Real working AI agents - Email, Social Media, Google Ads, SEO, Marketing';

