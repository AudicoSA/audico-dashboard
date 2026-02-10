-- CREATE TEST APPROVAL TASK
-- Run this in Supabase SQL Editor to create a test approval task
-- This will make the ApprovalQueue component visible on the dashboard

INSERT INTO squad_tasks (
  title,
  description,
  status,
  assigned_agent,
  priority,
  mentions_kenny,
  requires_approval,
  metadata,
  deliverable_url
) VALUES (
  'TEST - Approve email response to customer complaint',
  'Category: complaint
Subject: Test Complaint Email

This is a TEST task to verify the Approval Queue is working.

Preview:
Dear Customer,

Thank you for reaching out regarding your complaint. We sincerely apologize for the inconvenience you have experienced.

We take all feedback seriously and are committed to resolving this matter promptly. Our team is investigating the issue and will provide you with a resolution within 24 hours.

If you have any urgent concerns, please don''t hesitate to contact us directly.

Best regards,
Audico Team',
  'new',
  'Email Agent',
  'urgent',
  true,
  true,
  '{"email_id": "test_001", "draft_id": "test_draft_001", "email_category": "complaint"}'::jsonb,
  '/emails/test_001/draft'
);

-- Verify the task was created
SELECT
  id,
  title,
  requires_approval,
  approved_at,
  priority,
  created_at
FROM squad_tasks
WHERE requires_approval = true
  AND approved_at IS NULL
ORDER BY created_at DESC
LIMIT 5;
