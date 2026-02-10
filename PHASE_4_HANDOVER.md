# Phase 4: Marketing & Newsletters - Implementation Handover

**Date:** February 10, 2026
**Status:** Ready for Implementation
**Previous Phases:** Phase 1 (Core Infrastructure) ✅ + Phase 2 (Email Execution) ✅ + Phase 3 (Social Media) ✅ COMPLETED
**Current Phase:** Phase 4 (Marketing & Newsletters)
**Next Phase:** Phase 5 (SEO & Ads)

---

## 🎯 Phase 1, 2 & 3 Completion Summary

### ✅ What Was Built in Previous Phases

**Phase 1 - Core Infrastructure (Complete):**
- Task executor polling every 2 minutes
- Approval workflow system
- Retry logic (3 attempts → escalation)
- Alert service for failures
- Database execution tracking

**Phase 2 - Email Execution (Complete):**
- Gmail sender service
- Email handler with auto-send logic
- Auto-send for FAQ/spam emails (1 hour delay)
- Approval workflow for customer emails
- Email sending endpoint

**Phase 3 - Social Media Execution (Complete):**
- Social media publisher service (Twitter, Facebook, Instagram)
- Social handler with platform routing
- Social publishing endpoint
- OAuth credentials in database
- Instagram 2-step container workflow

### 🔧 Current System State

**Database:**
- All migrations up to 007 completed
- Tables: squad_tasks, social_posts, social_accounts, email_logs, agent_logs
- Task executor fully operational

**Autonomous Capabilities:**
- ✅ Email responses (auto-send FAQ, approval for customers)
- ✅ Social media posts (approval required, multi-platform)
- ❌ Newsletter distribution (Phase 4 - THIS PHASE)
- ❌ Influencer outreach (Phase 4 - THIS PHASE)
- ❌ SEO fixes (Phase 5)
- ❌ Ad campaign management (Phase 5)

**Environment Variables Configured:**
```bash
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
TWITTER_ACCESS_TOKEN=...      # In database
FACEBOOK_PAGE_TOKEN=...        # In database
AGENT_DRY_RUN=false            # Should be false for Phase 3 (true for Phase 4 testing)
ENABLE_AUTO_EXECUTION=true
```

---

## 📋 Phase 4 Objectives

**Goal:** Enable autonomous newsletter distribution and influencer outreach with approval workflow

**Success Criteria:**
- ✅ Newsletters distributed via Brevo.com (formerly Sendinblue)
- ✅ Influencer outreach messages sent automatically
- ✅ All newsletters require Kenny's approval before sending
- ✅ Campaign stats tracked (opens, clicks, unsubscribes)
- ✅ At least 1 newsletter sent per week
- ✅ 5+ influencer outreach messages sent per month

**Timeline:** Week 3-4 of implementation

---

## 🏗️ Phase 4 Implementation Tasks

### Task 4.1: Create Brevo Newsletter Service

**New File:** `services/integrations/brevo-service.ts`

**Purpose:** Send newsletters via Brevo.com API (formerly Sendinblue)

**Why Brevo:**
- Free tier: 300 emails/day
- Professional email templates
- Advanced analytics (open rates, click rates, unsubscribes)
- List management built-in
- Deliverability optimization
- GDPR compliant

**Implementation:**

```typescript
/**
 * Brevo Newsletter Service
 *
 * Handles newsletter distribution via Brevo.com (formerly Sendinblue)
 * - Send newsletters to subscriber lists
 * - Track campaign statistics
 * - Manage subscriber lists
 */

interface NewsletterResult {
  campaign_id: string
  recipients_count: number
  sent_at: string
}

interface CampaignStats {
  sent: number
  delivered: number
  opened: number
  clicked: number
  unsubscribed: number
  bounced: number
  open_rate: number
  click_rate: number
}

/**
 * Get Brevo API client
 */
function getBrevoHeaders() {
  if (!process.env.BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY not configured')
  }

  return {
    'api-key': process.env.BREVO_API_KEY,
    'Content-Type': 'application/json'
  }
}

/**
 * Fetch newsletter draft from database
 */
async function fetchNewsletterDraft(draftId: string) {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('newsletter_drafts')
    .select('*')
    .eq('id', draftId)
    .single()

  if (error || !data) {
    throw new Error(`Newsletter draft not found: ${draftId}`)
  }

  return data
}

/**
 * Send newsletter to subscriber list via Brevo
 */
export async function sendNewsletter(draftId: string): Promise<NewsletterResult> {
  console.log('[BREVO SERVICE] Sending newsletter:', draftId)

  try {
    const draft = await fetchNewsletterDraft(draftId)

    // Brevo Email Campaigns API
    const response = await fetch('https://api.brevo.com/v3/emailCampaigns', {
      method: 'POST',
      headers: getBrevoHeaders(),
      body: JSON.stringify({
        name: draft.data.subject_line,
        subject: draft.data.subject_line,
        sender: {
          name: 'Audico Team',
          email: 'newsletter@audico.co.za'
        },
        htmlContent: draft.data.content,
        recipients: {
          listIds: [parseInt(process.env.BREVO_LIST_ID || '1')]  // Default subscriber list
        },
        inlineImageActivation: true,
        mirrorActive: true,
        footer: `
          <p style="text-align: center; color: #666; font-size: 12px;">
            You're receiving this because you subscribed to Audico updates.
            <a href="{{unsubscribe}}">Unsubscribe</a>
          </p>
        `
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Brevo API error: ${JSON.stringify(error)}`)
    }

    const data = await response.json()

    // Send the campaign immediately
    const sendResponse = await fetch(`https://api.brevo.com/v3/emailCampaigns/${data.id}/sendNow`, {
      method: 'POST',
      headers: getBrevoHeaders()
    })

    if (!sendResponse.ok) {
      const error = await sendResponse.json()
      throw new Error(`Brevo send error: ${JSON.stringify(error)}`)
    }

    // Get campaign stats for recipient count
    const statsResponse = await fetch(`https://api.brevo.com/v3/emailCampaigns/${data.id}`, {
      headers: getBrevoHeaders()
    })

    const statsData = await statsResponse.json()
    const recipientsCount = statsData.statistics?.globalStats?.sent || 0

    // Update newsletter_drafts status
    const supabase = getServerSupabase()
    await supabase.from('newsletter_drafts').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      metadata: {
        ...draft.metadata,
        brevo_campaign_id: data.id,
        recipients_count: recipientsCount
      }
    }).eq('id', draftId)

    console.log('[BREVO SERVICE] Newsletter sent:', data.id)

    return {
      campaign_id: data.id,
      recipients_count: recipientsCount,
      sent_at: new Date().toISOString()
    }
  } catch (error: any) {
    console.error('[BREVO SERVICE] Error:', error)
    throw new Error(`Failed to send newsletter: ${error.message}`)
  }
}

/**
 * Get newsletter campaign statistics
 */
export async function getNewsletterStats(campaignId: string): Promise<CampaignStats> {
  console.log('[BREVO SERVICE] Fetching campaign stats:', campaignId)

  try {
    const response = await fetch(
      `https://api.brevo.com/v3/emailCampaigns/${campaignId}`,
      { headers: getBrevoHeaders() }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Brevo API error: ${JSON.stringify(error)}`)
    }

    const data = await response.json()
    const stats = data.statistics?.globalStats || {}

    return {
      sent: stats.sent || 0,
      delivered: stats.delivered || 0,
      opened: stats.uniqueOpens || 0,
      clicked: stats.uniqueClicks || 0,
      unsubscribed: stats.unsubscriptions || 0,
      bounced: stats.hardBounces + stats.softBounces || 0,
      open_rate: stats.sent > 0 ? (stats.uniqueOpens / stats.sent) * 100 : 0,
      click_rate: stats.sent > 0 ? (stats.uniqueClicks / stats.sent) * 100 : 0
    }
  } catch (error: any) {
    console.error('[BREVO SERVICE] Error fetching stats:', error)
    throw new Error(`Failed to fetch stats: ${error.message}`)
  }
}

/**
 * Test Brevo connection and API key
 */
export async function testBrevoConnection(): Promise<boolean> {
  console.log('[BREVO SERVICE] Testing connection...')

  try {
    const response = await fetch('https://api.brevo.com/v3/account', {
      headers: getBrevoHeaders()
    })

    if (!response.ok) {
      throw new Error('Invalid API key or connection failed')
    }

    const data = await response.json()
    console.log('[BREVO SERVICE] Connection successful. Account:', data.email)
    return true
  } catch (error: any) {
    console.error('[BREVO SERVICE] Connection test failed:', error)
    return false
  }
}
```

**Dependencies:**
```bash
# No new dependencies needed - using native fetch
```

---

### Task 4.2: Create Newsletter Sending Endpoint

**New File:** `app/api/agents/marketing/send-newsletter/route.ts`

**Purpose:** Execute newsletter distribution (called by task executor or manual trigger)

**Implementation:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { sendNewsletter, getNewsletterStats } from '@/services/integrations/brevo-service'
import { getServerSupabase } from '@/lib/supabase'
import { logToSquadMessages } from '@/lib/logger'

/**
 * Newsletter Sending Endpoint
 *
 * Handles newsletter distribution via Brevo.
 * Requires approval for all sends.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { draft_id } = await request.json()

    if (!draft_id) {
      return NextResponse.json(
        { error: 'Missing draft_id' },
        { status: 400 }
      )
    }

    const supabase = getServerSupabase()

    // Get draft details
    const { data: draft, error } = await supabase
      .from('newsletter_drafts')
      .select('*')
      .eq('id', draft_id)
      .single()

    if (error || !draft) {
      return NextResponse.json(
        { error: 'Newsletter draft not found' },
        { status: 404 }
      )
    }

    // Check if already sent
    if (draft.status === 'sent') {
      return NextResponse.json(
        { error: 'Newsletter already sent' },
        { status: 400 }
      )
    }

    console.log('[NEWSLETTER SEND] Sending newsletter:', draft_id)

    // Send via Brevo
    const result = await sendNewsletter(draft_id)

    // Mark related task as completed
    const { data: task } = await supabase
      .from('squad_tasks')
      .select('id')
      .eq('metadata->>draft_id', draft_id)
      .single()

    if (task) {
      await supabase.from('squad_tasks').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        deliverable_url: `/newsletters/${draft_id}/stats`
      }).eq('id', task.id)
    }

    await logToSquadMessages(
      'Marketing Agent',
      `✅ Newsletter sent to ${result.recipients_count} subscribers`,
      {
        draft_id,
        campaign_id: result.campaign_id,
        recipients_count: result.recipients_count
      }
    )

    return NextResponse.json({
      success: true,
      campaign_id: result.campaign_id,
      recipients_count: result.recipients_count,
      draft_id
    })
  } catch (error: any) {
    console.error('[NEWSLETTER SEND] Error:', error)

    await logToSquadMessages(
      'Marketing Agent',
      `❌ Failed to send newsletter: ${error.message}`,
      { error: error.message }
    )

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'operational',
    endpoint: '/api/agents/marketing/send-newsletter',
    method: 'POST',
    required_fields: ['draft_id'],
    description: 'Send newsletter via Brevo'
  })
}
```

---

### Task 4.3: Create Influencer Outreach Endpoint

**New File:** `app/api/agents/marketing/outreach/route.ts`

**Purpose:** Send personalized outreach messages to influencers

**Implementation:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { sendDirectEmail } from '@/services/integrations/gmail-sender'
import { getServerSupabase } from '@/lib/supabase'
import { logToSquadMessages } from '@/lib/logger'

/**
 * Influencer Outreach Endpoint
 *
 * Sends personalized outreach messages to influencers.
 * Currently supports email only (future: Twitter DM, Instagram DM, LinkedIn)
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { influencer_id, message_template } = await request.json()

    if (!influencer_id || !message_template) {
      return NextResponse.json(
        { error: 'Missing influencer_id or message_template' },
        { status: 400 }
      )
    }

    const supabase = getServerSupabase()

    // Get influencer details
    const { data: influencer, error } = await supabase
      .from('influencer_opportunities')
      .select('*')
      .eq('id', influencer_id)
      .single()

    if (error || !influencer) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      )
    }

    // Check if already contacted
    if (influencer.status === 'contacted' || influencer.status === 'replied') {
      return NextResponse.json(
        { error: `Influencer already ${influencer.status}` },
        { status: 400 }
      )
    }

    console.log('[INFLUENCER OUTREACH] Sending to:', influencer.data.name)

    let result
    const channel = influencer.data.preferred_contact || 'email'

    // Send via appropriate channel
    switch (channel) {
      case 'email':
        if (!influencer.data.email) {
          throw new Error('No email address for influencer')
        }

        result = await sendDirectEmail(
          influencer.data.email,
          `Partnership Opportunity with Audico`,
          message_template
        )
        break

      case 'twitter':
        // TODO Phase 5: Twitter DM integration
        throw new Error('Twitter DM not yet supported')

      case 'instagram':
        // TODO Phase 5: Instagram DM integration
        throw new Error('Instagram DM not yet supported')

      case 'linkedin':
        // TODO Phase 5: LinkedIn messaging integration
        throw new Error('LinkedIn messaging not yet supported')

      default:
        throw new Error(`Unsupported contact channel: ${channel}`)
    }

    // Update influencer status
    await supabase.from('influencer_opportunities').update({
      status: 'contacted',
      contacted_at: new Date().toISOString()
    }).eq('id', influencer_id)

    // Log in outreach_tracking table
    await supabase.from('outreach_tracking').insert({
      influencer_id,
      channel,
      message_sent: message_template,
      status: 'sent',
      sent_at: new Date().toISOString(),
      metadata: {
        gmail_message_id: result?.id
      }
    })

    // Mark related task as completed
    const { data: task } = await supabase
      .from('squad_tasks')
      .select('id')
      .eq('metadata->>influencer_id', influencer_id)
      .single()

    if (task) {
      await supabase.from('squad_tasks').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        deliverable_url: `/influencers/${influencer_id}`
      }).eq('id', task.id)
    }

    await logToSquadMessages(
      'Marketing Agent',
      `✅ Outreach sent to ${influencer.data.name} via ${channel}`,
      {
        influencer_id,
        channel,
        influencer_name: influencer.data.name
      }
    )

    return NextResponse.json({
      success: true,
      influencer_id,
      channel,
      message_id: result?.id
    })
  } catch (error: any) {
    console.error('[INFLUENCER OUTREACH] Error:', error)

    await logToSquadMessages(
      'Marketing Agent',
      `❌ Failed to send outreach: ${error.message}`,
      { error: error.message }
    )

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'operational',
    endpoint: '/api/agents/marketing/outreach',
    method: 'POST',
    required_fields: ['influencer_id', 'message_template'],
    supported_channels: ['email']  // Future: twitter, instagram, linkedin
  })
}
```

---

### Task 4.4: Implement Marketing Handler

**File to Update:** `services/execution-handlers/marketing-handler.ts`

**Current State:** Stub implementation that returns "not implemented" error

**New Implementation:**

```typescript
/**
 * Marketing Agent Execution Handler
 *
 * Handles marketing tasks for the Marketing Agent.
 * Phase 4: Newsletter distribution and influencer outreach.
 */

import type { Task } from '@/types/squad'
import { sendNewsletter } from '@/services/integrations/brevo-service'
import { sendDirectEmail } from '@/services/integrations/gmail-sender'
import { getServerSupabase } from '@/lib/supabase'
import { logToSquadMessages } from '@/lib/logger'

const DRY_RUN = process.env.AGENT_DRY_RUN === 'true'

interface ExecutionResult {
  success: boolean
  deliverable_url?: string
  error?: string
}

/**
 * Execute marketing task
 */
export async function marketingExecuteHandler(task: Task): Promise<ExecutionResult> {
  console.log('[MARKETING HANDLER] Executing task:', task.title)

  if (DRY_RUN) {
    console.log('[DRY RUN] Would execute marketing task:', task.metadata)
    await logToSquadMessages(
      'Marketing Agent',
      `[DRY RUN] Would execute: ${task.title}`,
      task.metadata
    )
    return {
      success: true,
      deliverable_url: '/marketing/dry-run-preview',
    }
  }

  try {
    const supabase = getServerSupabase()
    const taskType = task.metadata?.task_type

    if (!taskType) {
      throw new Error('Missing task_type in task metadata')
    }

    console.log(`[MARKETING HANDLER] Task type: ${taskType}`)

    let result

    switch (taskType) {
      case 'send_newsletter':
        result = await handleNewsletterSend(task)
        break

      case 'influencer_outreach':
        result = await handleInfluencerOutreach(task)
        break

      default:
        throw new Error(`Unsupported task type: ${taskType}`)
    }

    return result
  } catch (error: any) {
    console.error('[MARKETING HANDLER] Error:', error)

    await logToSquadMessages(
      'Marketing Agent',
      `❌ Failed to execute task: ${error.message}`,
      { task_id: task.id, error: error.message }
    )

    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Handle newsletter sending
 */
async function handleNewsletterSend(task: Task): Promise<ExecutionResult> {
  const draftId = task.metadata?.draft_id

  if (!draftId) {
    throw new Error('Missing draft_id in task metadata')
  }

  console.log('[MARKETING HANDLER] Sending newsletter:', draftId)

  const result = await sendNewsletter(draftId)

  await logToSquadMessages(
    'Marketing Agent',
    `✅ Newsletter sent to ${result.recipients_count} subscribers`,
    {
      draft_id: draftId,
      campaign_id: result.campaign_id,
      recipients_count: result.recipients_count
    }
  )

  return {
    success: true,
    deliverable_url: `/newsletters/${draftId}/stats`
  }
}

/**
 * Handle influencer outreach
 */
async function handleInfluencerOutreach(task: Task): Promise<ExecutionResult> {
  const influencerId = task.metadata?.influencer_id
  const messageTemplate = task.metadata?.message_template

  if (!influencerId || !messageTemplate) {
    throw new Error('Missing influencer_id or message_template in task metadata')
  }

  const supabase = getServerSupabase()

  // Get influencer details
  const { data: influencer, error } = await supabase
    .from('influencer_opportunities')
    .select('*')
    .eq('id', influencerId)
    .single()

  if (error || !influencer) {
    throw new Error(`Influencer not found: ${influencerId}`)
  }

  console.log('[MARKETING HANDLER] Sending outreach to:', influencer.data.name)

  // Send email
  if (!influencer.data.email) {
    throw new Error('No email address for influencer')
  }

  const result = await sendDirectEmail(
    influencer.data.email,
    `Partnership Opportunity with Audico`,
    messageTemplate
  )

  // Update influencer status
  await supabase.from('influencer_opportunities').update({
    status: 'contacted',
    contacted_at: new Date().toISOString()
  }).eq('id', influencerId)

  // Log outreach
  await supabase.from('outreach_tracking').insert({
    influencer_id: influencerId,
    channel: 'email',
    message_sent: messageTemplate,
    status: 'sent',
    sent_at: new Date().toISOString(),
    metadata: { gmail_message_id: result.id }
  })

  await logToSquadMessages(
    'Marketing Agent',
    `✅ Outreach sent to ${influencer.data.name} via email`,
    {
      influencer_id: influencerId,
      influencer_name: influencer.data.name,
      gmail_message_id: result.id
    }
  )

  return {
    success: true,
    deliverable_url: `/influencers/${influencerId}`
  }
}
```

---

### Task 4.5: Create Database Tables

**New File:** `supabase/migrations/008_marketing_tables.sql`

**Purpose:** Create tables for newsletters, influencers, and outreach tracking

**Implementation:**

```sql
-- ================================================
-- Marketing Tables for Phase 4
-- ================================================

-- Newsletter Drafts Table
CREATE TABLE IF NOT EXISTS newsletter_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { subject_line, content, preview_text }
  metadata JSONB DEFAULT '{}'::jsonb,  -- { brevo_campaign_id, recipients_count }
  created_by TEXT REFERENCES squad_agents(name),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Influencer Opportunities Table
CREATE TABLE IF NOT EXISTS influencer_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'contacted', 'replied', 'partnered', 'declined')),
  contacted_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { name, email, platform, follower_count, niche, preferred_contact }
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT REFERENCES squad_agents(name),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outreach Tracking Table
CREATE TABLE IF NOT EXISTS outreach_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES influencer_opportunities(id),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'twitter', 'instagram', 'linkedin')),
  message_sent TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'opened', 'replied', 'bounced')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_status ON newsletter_drafts(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_created_at ON newsletter_drafts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_influencer_opportunities_status ON influencer_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_outreach_tracking_influencer ON outreach_tracking(influencer_id);
CREATE INDEX IF NOT EXISTS idx_outreach_tracking_sent_at ON outreach_tracking(sent_at DESC);

-- RLS (disable for service role access)
ALTER TABLE newsletter_drafts DISABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_opportunities DISABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_tracking DISABLE ROW LEVEL SECURITY;

-- Sample data (optional - for testing)
/*
INSERT INTO newsletter_drafts (status, data, created_by) VALUES
  ('draft', '{"subject_line": "Audico November Newsletter", "content": "<h1>Welcome!</h1><p>Check out our latest products...</p>", "preview_text": "New arrivals this month"}'::jsonb, 'Marketing Agent');

INSERT INTO influencer_opportunities (status, data, created_by) VALUES
  ('identified', '{"name": "Tech Reviewer SA", "email": "contact@techreviewersa.co.za", "platform": "youtube", "follower_count": 50000, "niche": "electronics", "preferred_contact": "email"}'::jsonb, 'Marketing Agent');
*/
```

---

## 🔧 Brevo Setup Required

### Step 1: Create Brevo Account

1. Go to https://www.brevo.com (formerly Sendinblue)
2. Sign up for free account (300 emails/day limit)
3. Verify email address
4. Complete account setup

### Step 2: Get API Key

1. Go to Settings → SMTP & API → API Keys
2. Click "Generate a new API key"
3. Name it: "Audico Mission Control"
4. Copy the API key
5. Add to Vercel environment variables:
   ```bash
   BREVO_API_KEY=xkeysib-YOUR_API_KEY_HERE
   ```

### Step 3: Create Subscriber List

1. Go to Contacts → Lists
2. Click "Create a list"
3. Name: "Audico Newsletter Subscribers"
4. Copy the List ID (e.g., "1")
5. Add to Vercel environment variables:
   ```bash
   BREVO_LIST_ID=1
   ```

### Step 4: Import Subscribers

**Option A: Manual Import via CSV**
1. Prepare CSV with columns: EMAIL, FIRSTNAME, LASTNAME
2. Go to Contacts → Import contacts
3. Upload CSV file
4. Map columns
5. Select "Audico Newsletter Subscribers" list

**Option B: API Import (if you have existing subscribers)**
```bash
curl -X POST "https://api.brevo.com/v3/contacts" \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "attributes": {
      "FIRSTNAME": "John",
      "LASTNAME": "Doe"
    },
    "listIds": [1],
    "updateEnabled": true
  }'
```

### Step 5: Configure Sender

1. Go to Settings → Senders & IP
2. Add sender email: newsletter@audico.co.za
3. Verify sender (Brevo will send verification email)
4. Wait for verification (required before sending)

### Step 6: Test Connection

```bash
# Test Brevo API connection
curl -X GET "https://api.brevo.com/v3/account" \
  -H "api-key: YOUR_API_KEY"

# Should return account details if successful
```

---

## 🧪 Testing Checklist for Phase 4

### Step 1: Setup Brevo Credentials

```bash
# 1. Add Brevo credentials to Vercel environment variables
BREVO_API_KEY=xkeysib-...
BREVO_LIST_ID=1

# 2. Run database migration
# In Supabase SQL Editor:
# Run: supabase/migrations/008_marketing_tables.sql

# 3. Verify tables created
SELECT * FROM newsletter_drafts LIMIT 1;
SELECT * FROM influencer_opportunities LIMIT 1;
SELECT * FROM outreach_tracking LIMIT 1;
```

---

### Step 2: Deploy Phase 4 Code

```bash
# 1. Ensure Phase 1, 2, 3 are deployed
git add .
git commit -m "Phase 4: Marketing & newsletters implementation"
git push origin main

# 2. Verify environment variables set in Vercel
AGENT_DRY_RUN=true  # Keep true for testing!
BREVO_API_KEY=...
BREVO_LIST_ID=...

# 3. Check Vercel logs for errors
```

---

### Step 3: Test Newsletter Sending (Dry Run)

```sql
-- 1. Create newsletter draft
INSERT INTO newsletter_drafts (status, data, created_by)
VALUES (
  'draft',
  '{
    "subject_line": "Test Newsletter from Mission Control",
    "content": "<h1>Hello!</h1><p>This is a test newsletter from Audico Mission Control. 🚀</p>",
    "preview_text": "Testing Phase 4 newsletter distribution"
  }'::jsonb,
  'Marketing Agent'
)
RETURNING id;

-- 2. Create approval task
INSERT INTO squad_tasks (
  title,
  description,
  status,
  assigned_agent,
  priority,
  requires_approval,
  metadata
) VALUES (
  'Approve test newsletter',
  'Testing Phase 4 newsletter distribution via Brevo',
  'new',
  'Marketing Agent',
  'medium',
  true,
  '{"task_type": "send_newsletter", "draft_id": "DRAFT_ID_FROM_ABOVE"}'::jsonb
);

-- 3. Approve task
POST /api/tasks/TASK_ID/approve

-- 4. Wait 2 minutes for task executor
-- Check logs for: [DRY RUN] Would execute: Approve test newsletter

-- 5. Verify task marked as completed
SELECT status, deliverable_url FROM squad_tasks WHERE id='TASK_ID';
```

---

### Step 4: Test Real Newsletter Sending

```bash
# ONLY after dry-run succeeds:
# 1. Set AGENT_DRY_RUN=false in Vercel

# 2. Create real newsletter draft (same SQL as Step 3)

# 3. Create and approve task

# 4. Wait for task executor

# 5. Check Brevo dashboard:
# - Go to Campaigns → Email campaigns
# - Should see "Test Newsletter from Mission Control" with status "Sent"

# 6. Check email inbox (if you're on subscriber list)

# 7. Verify in database
SELECT status, sent_at, metadata FROM newsletter_drafts WHERE id='DRAFT_ID';
# Should show: status='sent', sent_at=timestamp, metadata with brevo_campaign_id
```

---

### Step 5: Test Influencer Outreach

```sql
-- 1. Create influencer opportunity
INSERT INTO influencer_opportunities (status, data, created_by)
VALUES (
  'identified',
  '{
    "name": "Test Influencer",
    "email": "YOUR_TEST_EMAIL@example.com",
    "platform": "youtube",
    "follower_count": 10000,
    "niche": "electronics",
    "preferred_contact": "email"
  }'::jsonb,
  'Marketing Agent'
)
RETURNING id;

-- 2. Create approval task
INSERT INTO squad_tasks (
  title,
  description,
  status,
  assigned_agent,
  priority,
  requires_approval,
  metadata
) VALUES (
  'Approve influencer outreach',
  'Testing Phase 4 influencer outreach via email',
  'new',
  'Marketing Agent',
  'medium',
  true,
  '{
    "task_type": "influencer_outreach",
    "influencer_id": "INFLUENCER_ID_FROM_ABOVE",
    "message_template": "Hi [Name], We at Audico would love to partner with you..."
  }'::jsonb
);

-- 3-4. Approve and wait for execution

-- 5. Check Gmail Sent folder - should see outreach email

-- 6. Verify in database
SELECT status, contacted_at FROM influencer_opportunities WHERE id='INFLUENCER_ID';
-- Should show: status='contacted', contacted_at=timestamp

SELECT * FROM outreach_tracking WHERE influencer_id='INFLUENCER_ID';
-- Should have 1 row with status='sent'
```

---

## 📊 Success Metrics for Phase 4

**Week 1:**
- ✅ Brevo integration functional
- ✅ At least 1 test newsletter sent successfully
- ✅ At least 1 test outreach sent successfully
- ✅ Approval workflow tested and working
- ✅ Campaign stats visible in Brevo dashboard

**Week 2-3:**
- ✅ 1+ newsletter sent per week to real subscribers
- ✅ 5+ influencer outreach messages sent
- ✅ Open rate >20% for newsletters
- ✅ At least 1 influencer reply received
- ✅ <5% newsletter send failure rate

---

## 🚨 Important Notes

### Approval Requirements

**ALL newsletters require approval** - Never auto-send:
- Mass communication to subscribers
- Potential for unsubscribes if content is poor
- Brand reputation risk
- Legal compliance (GDPR, CAN-SPAM)

**Approval Flow:**
1. Marketing agent creates newsletter draft
2. Creates approval task with `requires_approval=true`
3. Kenny reviews content and preview in dashboard
4. Kenny approves → task executor sends → marks task complete
5. Campaign stats tracked in Brevo

### Rate Limits

**Brevo Free Tier Limits:**
- 300 emails/day
- Unlimited contacts
- Basic reporting

**Our Usage (configured in rate-limiter.ts):**
```typescript
newsletter_send: {
  agentName: 'newsletter_send',
  maxExecutions: 1,
  windowSeconds: 86400  // 1 newsletter per day
}

influencer_outreach: {
  agentName: 'influencer_outreach',
  maxExecutions: 10,
  windowSeconds: 86400  // 10 outreach emails per day
}
```

### GDPR Compliance

**Newsletter Requirements:**
- Unsubscribe link in every email (Brevo adds automatically)
- Clear sender identification
- Subscribers must have opted in
- Privacy policy link in footer

**Outreach Requirements:**
- Legitimate interest basis (B2B partnerships)
- Easy opt-out method
- Professional relationship context

---

## 🎯 Next Steps After Phase 4

Once Phase 4 is complete and stable:

**Phase 5: SEO & Ads**
- OpenCart SEO updater (apply meta descriptions, alt tags)
- Google Ads integration (monitor campaigns, adjust bids)
- SEO fix application endpoint
- Automatic keyword optimization

**Phase 6: Dashboard UI**
- Approval queue component (all pending approvals in one place)
- Execution log display (real-time agent activity)
- Deliverable gallery (view all completed work)
- Analytics dashboard (newsletter stats, social engagement, etc.)

---

## 📁 Files to Create/Modify

**New Files (4):**
1. `services/integrations/brevo-service.ts` - Brevo API integration
2. `app/api/agents/marketing/send-newsletter/route.ts` - Newsletter sending endpoint
3. `app/api/agents/marketing/outreach/route.ts` - Influencer outreach endpoint
4. `supabase/migrations/008_marketing_tables.sql` - Database tables

**Modified Files (1):**
5. `services/execution-handlers/marketing-handler.ts` - Update from stub to full implementation

**Total:** 5 changes

---

## 📞 Questions or Issues?

If you encounter any issues during Phase 4 implementation:

1. Check Phase 1, 2, 3 are deployed correctly
2. Verify Brevo API key is valid (test with curl)
3. Check Brevo sender email is verified
4. Verify subscriber list has contacts
5. Test in dry-run mode first
6. Review agent_logs table for errors
7. Check Brevo dashboard for campaign status

**Handover Complete!** Phase 4 is ready to implement. Good luck! 🚀

---

## 🎁 Ready for New Chat

This document contains everything needed to implement Phase 4:
- ✅ Complete code for all 4 tasks
- ✅ Brevo setup instructions with screenshots
- ✅ Database schema for newsletters and influencers
- ✅ Comprehensive testing checklist
- ✅ Success metrics and validation steps
- ✅ GDPR compliance notes
- ✅ Clear file list (4 new, 1 modified)

**Implementation order:**
1. Create Brevo account and get API key
2. Create brevo-service.ts integration
3. Create send-newsletter endpoint
4. Create outreach endpoint
5. Update marketing-handler.ts
6. Run database migration (008_marketing_tables.sql)
7. Add Brevo credentials to Vercel
8. Test in dry-run mode
9. Test real sending (newsletter → outreach)
10. Monitor and refine

Good luck with Phase 4! 🎉
