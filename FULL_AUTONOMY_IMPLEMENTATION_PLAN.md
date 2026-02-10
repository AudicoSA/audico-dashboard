# Audico Mission Control - Full Autonomy Implementation Plan

**Project:** Audico Dashboard Agent System
**Date:** February 10, 2026
**Status:** Ready for Implementation
**Estimated Timeline:** 5 weeks (25 business days)

---

## 📋 Executive Summary

Transform Audico's Mission Control agent system from a **task creation engine** to a **fully autonomous business management platform**.

**Current State:**
- Agents successfully analyze data and create intelligent task recommendations
- Email polling, classification, and draft creation works perfectly
- Social posts, newsletters, and SEO recommendations are generated
- **BUT:** Everything stops at the draft/recommendation stage (0% task completion)

**Target State:**
- Agents poll → analyze → create → **EXECUTE** → mark complete → report
- Email responses automatically sent (with approval for critical items)
- Social media posts published after approval
- Newsletters distributed via Brevo
- SEO fixes applied to OpenCart database
- Tasks actually complete (not stuck at 0% forever)

**Key Principle:** Graduated autonomy with human oversight for critical operations

---

## 🎯 Context & Problem Statement

### Why This Change is Needed

Audico receives **140+ customer emails daily**, manages resellers, maintains social media presence across 6 platforms, and operates an e-commerce store with hundreds of products. The current agent system can:

✅ **Successfully analyze** all business data
✅ **Intelligently create** task assignments using Claude AI
✅ **Generate drafts** for emails, social posts, newsletters
✅ **Monitor** orders, inventory, customer sentiment

❌ **Cannot execute** any of the created work
❌ **Cannot send** email responses (drafts sit in Gmail forever)
❌ **Cannot publish** social media posts (drafts accumulate)
❌ **Cannot distribute** newsletters (recommendations never act)
❌ **Cannot apply** SEO fixes (recommendations never implement)

**Result:** A bottleneck where Kenny must manually execute every single action, defeating the purpose of an autonomous agent system.

### The Goal

Build a **3-layer execution architecture**:
1. **Core Infrastructure** - Task executor that watches for work and dispatches to agents
2. **Agent Execution** - Each agent can execute its assigned tasks
3. **Safety & Monitoring** - Approval workflows, dry-run mode, oversight dashboard

---

## 🏗️ System Architecture

### Current Workflow (Broken)
```
Gmail → Email Poll → Classify → Jarvis Analyzes → Creates Task → [STOPS]
                                                                    ↓
                                                        Kenny manually executes
```

### New Workflow (Autonomous)
```
Gmail → Email Poll → Classify → Jarvis Analyzes → Creates Task
                                                      ↓
                                            Task Executor (every 2 min)
                                                      ↓
                                   ┌──────────────────┴──────────────────┐
                                   ↓                                     ↓
                            Requires Approval?                    Auto-Execute
                                   ↓                                     ↓
                         Approval Queue (Kenny)              Execute immediately
                                   ↓                                     ↓
                         Approve/Reject                      Mark Complete
                                   ↓                                     ↓
                            Execute & Complete              Store Deliverable
```

### Three-Layer Architecture

**Layer 1: Task Execution Infrastructure (Core)**
- Central task executor service (`services/task-executor.ts`)
- Polls `squad_tasks` table every 2 minutes
- Matches tasks to agent capabilities
- Implements approval workflow for safety
- Marks tasks complete, stores deliverables

**Layer 2: Agent Execution Capabilities (Per-Agent)**
- **Email Agent:** Send email responses via Gmail API
- **Social Media Agent:** Publish posts to Twitter, Facebook, Instagram
- **Marketing Agent:** Send newsletters via Brevo, contact influencers
- **SEO Agent:** Apply fixes to OpenCart MySQL database
- **Google Ads Agent:** Monitor campaigns, adjust bids

**Layer 3: Safety & Monitoring (Oversight)**
- Approval queue in dashboard
- Dry-run mode for testing
- Rate limiting per operation
- Rollback mechanism
- Real-time execution log
- Alert system for failures

---

## 📅 Implementation Phases

### Phase 1: Core Infrastructure (Week 1 - PRIORITY 1)

**Goal:** Build the foundation for task execution

#### 1.1 Task Executor Service
**New File:** `services/task-executor.ts`

Core service that watches for assigned tasks and executes them:
- Polls `squad_tasks` table for `status='new'` tasks every 2 minutes
- Maintains agent capability registry (which agents handle which task types)
- Dispatches tasks to appropriate agent execution handlers
- Implements retry logic (3 attempts with exponential backoff, then escalate)
- Updates task status: new → in_progress → completed
- Logs all execution attempts to `agent_logs` table

**Key Functions:**
```typescript
async function pollTasks() {
  const tasks = await fetchExecutableTasks()
  for (const task of tasks) {
    await executeTask(task)
  }
}

async function executeTask(task: Task) {
  const handler = getHandlerForAgent(task.assigned_agent)
  try {
    const result = await handler.execute(task)
    await markTaskComplete(task.id, result.deliverable_url)
  } catch (error) {
    await retryOrEscalate(task, error)
  }
}
```

#### 1.2 Approval Workflow System
**New File:** `services/approval-workflow.ts`

Defines safety rules for auto-execute vs require-approval:

**Auto-Execute (Safe operations):**
- Email classification and analysis
- SEO audits (recommendations only)
- Social post drafts (creation only)
- FAQ email responses (after 1 hour delay)
- Minor SEO fixes (<10 products)
- Bid decreases in ads

**Require Approval (Customer-facing):**
- Sending emails to customers (orders, complaints)
- Publishing social media posts
- Distributing newsletters
- Bulk SEO changes (>10 products)
- Influencer outreach messages
- Ad budget changes
- Bid increases >10%

**Urgent Escalation (Immediate notify):**
- Customer complaints (priority=urgent)
- Refund requests
- System errors (3+ failures)
- Rate limit exceeded

**Key Functions:**
```typescript
function requiresApproval(task: Task): boolean {
  const rules = APPROVAL_RULES[task.assigned_agent]
  return rules.some(rule => rule.matches(task))
}

async function createApprovalTask(task: Task) {
  await supabase.from('squad_tasks').insert({
    title: `Approve: ${task.title}`,
    assigned_agent: 'Jarvis',
    priority: 'high',
    mentions_kenny: true,
    requires_approval: false, // Approval tasks don't need approval
    metadata: { original_task_id: task.id }
  })
}
```

#### 1.3 Database Schema Updates
**New File:** `supabase/migrations/007_execution_tracking.sql`

Add execution tracking fields to `squad_tasks`:

```sql
ALTER TABLE squad_tasks ADD COLUMN IF NOT EXISTS
  execution_attempts INTEGER DEFAULT 0,
  last_execution_attempt TIMESTAMPTZ,
  execution_error TEXT,
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by TEXT,
  approved_at TIMESTAMPTZ;

-- Index for fast task queries
CREATE INDEX IF NOT EXISTS idx_tasks_executable
  ON squad_tasks(status, requires_approval, approved_at)
  WHERE status = 'new';
```

#### 1.4 Task Execution Cron Job
**New File:** `app/api/cron/tasks/execute/route.ts`

Periodic polling to execute pending tasks:

```typescript
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(AGENT_RATE_LIMITS.task_executor)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  // Fetch executable tasks (no approval needed OR already approved)
  const { data: tasks } = await supabase
    .from('squad_tasks')
    .select('*')
    .eq('status', 'new')
    .or('requires_approval.eq.false,approved_at.not.is.null')
    .limit(10)

  const results = await taskExecutor.executeBatch(tasks)

  return NextResponse.json({
    success: true,
    executed: results.success.length,
    failed: results.failed.length
  })
}
```

**Add to `vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/cron/tasks/execute",
      "schedule": "*/2 * * * *"
    }
  ]
}
```

---

### Phase 2: Email Execution (Week 1-2 - PRIORITY 2)

**Goal:** Enable automatic email sending with approval for critical emails

#### 2.1 Gmail Sending Service
**New File:** `services/integrations/gmail-sender.ts`

Execute email sending via Gmail API:

```typescript
import { google } from 'googleapis'

async function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  )
  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return google.gmail({ version: 'v1', auth: oauth2Client })
}

export async function sendDraft(draftId: string) {
  const gmail = await getGmailClient()
  const response = await gmail.users.drafts.send({
    userId: 'me',
    requestBody: { id: draftId }
  })
  return response.data
}

export async function sendDirectEmail(to: string, subject: string, body: string) {
  const gmail = await getGmailClient()
  const message = createMimeMessage(to, subject, body)
  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: message }
  })
  return response.data
}

export async function archiveEmail(messageId: string) {
  const gmail = await getGmailClient()
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['INBOX'] }
  })
}
```

#### 2.2 Email Response Executor
**Enhanced File:** `app/api/agents/email/respond/route.ts`

After creating draft, check category and either auto-send or create approval task:

```typescript
// After draft creation (existing code)
const draft = await createGmailDraft(...)

// NEW: Determine if auto-send or require approval
const emailCategory = emailLog.category
const autoSendCategories = ['inquiry', 'spam']
const approvalCategories = ['order', 'support', 'complaint']

if (autoSendCategories.includes(emailCategory)) {
  // Auto-send after 1 hour delay (gives Kenny review window)
  await scheduleEmailSend(draft.id, Date.now() + 3600000)

  await logToSquadMessages(
    'Email Agent',
    `📧 Email response scheduled for auto-send in 1 hour: ${emailLog.subject}`,
    { draft_id: draft.id, auto_send: true }
  )
} else if (approvalCategories.includes(emailCategory)) {
  // Create approval task for Kenny
  await supabase.from('squad_tasks').insert({
    title: `Approve email response to ${emailLog.from_email}`,
    description: `Category: ${emailCategory}\nSubject: ${emailLog.subject}\n\nDraft preview:\n${draftBody.substring(0, 300)}...`,
    status: 'new',
    assigned_agent: 'Jarvis',
    priority: emailCategory === 'complaint' ? 'urgent' : 'high',
    mentions_kenny: true,
    requires_approval: true,
    deliverable_url: `/emails/${emailLog.id}/draft`,
    metadata: { email_id: emailLog.id, draft_id: draft.id }
  })
}

// Update email_logs status
await supabase.from('email_logs').update({
  status: autoSendCategories.includes(emailCategory) ? 'scheduled' : 'draft_created'
}).eq('id', emailLog.id)
```

#### 2.3 Email Sending Endpoint
**New File:** `app/api/agents/email/send/route.ts`

Execute email sending (called by task executor or manual trigger):

```typescript
export async function POST(request: NextRequest) {
  const { email_id, draft_id } = await request.json()

  try {
    // Send the draft
    const sentMessage = await gmailSender.sendDraft(draft_id)

    // Update email_logs
    await supabase.from('email_logs').update({
      status: 'sent',
      sent_at: new Date(),
      metadata: { gmail_message_id: sentMessage.id }
    }).eq('id', email_id)

    // Mark related task as completed
    const { data: task } = await supabase
      .from('squad_tasks')
      .select('id')
      .eq('metadata->>email_id', email_id)
      .single()

    if (task) {
      await supabase.from('squad_tasks').update({
        status: 'completed',
        completed_at: new Date(),
        deliverable_url: `https://mail.google.com/mail/u/0/#sent/${sentMessage.id}`
      }).eq('id', task.id)
    }

    await logToSquadMessages(
      'Email Agent',
      `✅ Email sent successfully to ${emailLog.from_email}`,
      { email_id, sent_message_id: sentMessage.id }
    )

    return NextResponse.json({ success: true, message_id: sentMessage.id })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**Safety Rules:**
```javascript
AUTO_SEND_CATEGORIES = ['inquiry', 'spam']  // After 1 hour delay
APPROVAL_REQUIRED = ['order', 'support', 'complaint']  // Wait for Kenny
URGENT_ESCALATION = ['complaint']  // Priority=urgent, immediate notify
```

---

### Phase 3: Social Media Execution (Week 2 - PRIORITY 3)

**Goal:** Enable social media publishing after approval

#### 3.1 Social Media Publishing Service
**New File:** `services/integrations/social-publisher.ts`

Publish posts to social platforms:

```typescript
// Twitter Publishing (OAuth 2.0 already configured)
export async function publishToTwitter(postId: string) {
  const post = await fetchPostFromDB(postId)
  const { access_token } = await getSocialAccountToken('twitter')

  const response = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: post.content })
  })

  const data = await response.json()

  // Update social_posts status
  await supabase.from('social_posts').update({
    status: 'published',
    published_at: new Date(),
    platform_post_id: data.data.id,
    platform_url: `https://twitter.com/user/status/${data.data.id}`
  }).eq('id', postId)

  return data
}

// Facebook Publishing (requires Page Access Token)
export async function publishToFacebook(postId: string) {
  const post = await fetchPostFromDB(postId)
  const { access_token, page_id } = await getSocialAccountToken('facebook')

  const response = await fetch(`https://graph.facebook.com/v18.0/${page_id}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: post.content,
      access_token: access_token
    })
  })

  const data = await response.json()

  await supabase.from('social_posts').update({
    status: 'published',
    published_at: new Date(),
    platform_post_id: data.id
  }).eq('id', postId)

  return data
}

// Instagram Publishing (requires Instagram Business Account)
export async function publishToInstagram(postId: string) {
  const post = await fetchPostFromDB(postId)
  const { access_token, instagram_account_id } = await getSocialAccountToken('instagram')

  // Instagram requires 2-step: create container, then publish
  const containerResponse = await fetch(
    `https://graph.facebook.com/v18.0/${instagram_account_id}/media`,
    {
      method: 'POST',
      body: JSON.stringify({
        image_url: post.visual_content_url,
        caption: post.content,
        access_token: access_token
      })
    }
  )

  const container = await containerResponse.json()

  const publishResponse = await fetch(
    `https://graph.facebook.com/v18.0/${instagram_account_id}/media_publish`,
    {
      method: 'POST',
      body: JSON.stringify({
        creation_id: container.id,
        access_token: access_token
      })
    }
  )

  const data = await publishResponse.json()

  await supabase.from('social_posts').update({
    status: 'published',
    published_at: new Date(),
    platform_post_id: data.id
  }).eq('id', postId)

  return data
}
```

#### 3.2 Social Post Publisher Endpoint
**New File:** `app/api/agents/social/publish/route.ts`

Execute social media publishing:

```typescript
export async function POST(request: NextRequest) {
  const { post_id, platform } = await request.json()

  try {
    let result
    switch (platform) {
      case 'twitter':
        result = await socialPublisher.publishToTwitter(post_id)
        break
      case 'facebook':
        result = await socialPublisher.publishToFacebook(post_id)
        break
      case 'instagram':
        result = await socialPublisher.publishToInstagram(post_id)
        break
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }

    // Mark related task as completed
    const { data: task } = await supabase
      .from('squad_tasks')
      .select('id')
      .eq('deliverable_url', `/social-posts/${post_id}`)
      .single()

    if (task) {
      await supabase.from('squad_tasks').update({
        status: 'completed',
        completed_at: new Date(),
        deliverable_url: result.platform_url
      }).eq('id', task.id)
    }

    await logToSquadMessages(
      'Social Media Agent',
      `✅ Post published to ${platform}`,
      { post_id, platform_post_id: result.id }
    )

    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

#### 3.3 OAuth Setup Required

**Facebook/Instagram:**
1. Create Facebook App at developers.facebook.com
2. Add Facebook Login and Instagram Graph API products
3. Get Page Access Token (Settings → Advanced → Page Access Token)
4. Get Instagram Business Account ID (link to Facebook Page)
5. Store tokens in `social_accounts` table:
```sql
INSERT INTO social_accounts (platform, access_token, metadata)
VALUES
  ('facebook', 'YOUR_PAGE_ACCESS_TOKEN', '{"page_id": "YOUR_PAGE_ID"}'),
  ('instagram', 'YOUR_PAGE_ACCESS_TOKEN', '{"instagram_account_id": "YOUR_IG_ID"}');
```

**Environment Variables:**
```bash
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
FACEBOOK_PAGE_ACCESS_TOKEN=...
INSTAGRAM_BUSINESS_ACCOUNT_ID=...
```

**Approval Workflow:**
- ALL social posts require approval (too visible to auto-publish)
- Social agent creates post → saves as draft → creates approval task
- Kenny approves in dashboard → task executor publishes → marks complete

---

### Phase 4: Marketing & Newsletters (Week 3 - PRIORITY 4)

**Goal:** Enable newsletter distribution and influencer outreach

#### 4.1 Brevo Newsletter Integration
**New File:** `services/integrations/brevo-service.ts`

Send newsletters via Brevo.com (formerly Sendinblue):

```typescript
export async function sendNewsletter(draftId: string) {
  const draft = await supabase
    .from('newsletter_drafts')
    .select('*')
    .eq('id', draftId)
    .single()

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: {
        email: 'newsletter@audico.co.za',
        name: 'Audico Team'
      },
      to: [{ email: '{{contact.email}}' }],  // Brevo handles list
      subject: draft.data.subject_line,
      htmlContent: draft.data.content,
      params: {
        FIRSTNAME: '{{contact.FIRSTNAME}}',
        LASTNAME: '{{contact.LASTNAME}}'
      }
    })
  })

  const data = await response.json()

  // Update newsletter_drafts status
  await supabase.from('newsletter_drafts').update({
    status: 'sent',
    sent_at: new Date(),
    metadata: {
      brevo_campaign_id: data.messageId,
      recipients_count: data.recipientsCount
    }
  }).eq('id', draftId)

  return data
}

export async function getNewsletterStats(campaignId: string) {
  const response = await fetch(
    `https://api.brevo.com/v3/emailCampaigns/${campaignId}`,
    {
      headers: { 'api-key': process.env.BREVO_API_KEY }
    }
  )
  return response.json()
}
```

**Setup Steps:**
1. Create Brevo account at brevo.com
2. Get API key from Settings → API Keys
3. Import subscriber list to Brevo
4. Create email template in Brevo (or use dynamic HTML)
5. Add `BREVO_API_KEY` to Vercel environment variables

#### 4.2 Newsletter Sending Endpoint
**New File:** `app/api/agents/marketing/send-newsletter/route.ts`

Execute newsletter distribution:

```typescript
export async function POST(request: NextRequest) {
  const { draft_id } = await request.json()

  try {
    const result = await brevoService.sendNewsletter(draft_id)

    // Mark related task as completed
    const { data: task } = await supabase
      .from('squad_tasks')
      .select('id')
      .eq('deliverable_url', `/newsletters/${draft_id}/preview`)
      .single()

    if (task) {
      await supabase.from('squad_tasks').update({
        status: 'completed',
        completed_at: new Date(),
        deliverable_url: `/newsletters/${draft_id}/stats`
      }).eq('id', task.id)
    }

    await logToSquadMessages(
      'Marketing Agent',
      `✅ Newsletter sent to ${result.recipientsCount} subscribers`,
      { draft_id, campaign_id: result.messageId }
    )

    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

#### 4.3 Influencer Outreach Executor
**New File:** `app/api/agents/marketing/outreach/route.ts`

Send outreach messages to influencers:

```typescript
export async function POST(request: NextRequest) {
  const { influencer_id, message_template } = await request.json()

  const influencer = await supabase
    .from('influencer_opportunities')
    .select('*')
    .eq('id', influencer_id)
    .single()

  let result

  // Send via appropriate channel
  switch (influencer.data.preferred_contact) {
    case 'email':
      result = await sendEmailOutreach(influencer.data.email, message_template)
      break
    case 'twitter':
      result = await sendTwitterDM(influencer.data.twitter_handle, message_template)
      break
    case 'instagram':
      result = await sendInstagramDM(influencer.data.instagram_handle, message_template)
      break
    case 'linkedin':
      result = await sendLinkedInMessage(influencer.data.linkedin_url, message_template)
      break
  }

  // Update influencer status
  await supabase.from('influencer_opportunities').update({
    status: 'contacted',
    contacted_at: new Date()
  }).eq('id', influencer_id)

  // Log in outreach_tracking
  await supabase.from('outreach_tracking').insert({
    influencer_id,
    channel: influencer.data.preferred_contact,
    message_sent: message_template,
    status: 'sent',
    sent_at: new Date()
  })

  return NextResponse.json({ success: true, result })
}
```

**Approval Requirements:**
- Newsletters: ALWAYS require approval (mass communication)
- Influencer outreach: Require approval per campaign
- Reseller approvals: Auto-approve if Google Places verified (existing logic)

---

### Phase 5: SEO & Ads Execution (Week 3-4 - PRIORITY 5)

**Goal:** Enable SEO fix application and ad campaign management

#### 5.1 OpenCart SEO Updater
**New File:** `services/integrations/opencart-updater.ts`

Apply SEO fixes directly to OpenCart MySQL database:

```typescript
import mysql from 'mysql2/promise'

async function getOpenCartConnection() {
  return mysql.createConnection({
    host: process.env.OPENCART_DB_HOST,
    user: process.env.OPENCART_DB_USER,
    password: process.env.OPENCART_DB_PASSWORD,
    database: process.env.OPENCART_DB_NAME
  })
}

export async function updateProductMeta(productId: number, meta: {
  title?: string,
  description?: string,
  keywords?: string
}) {
  const conn = await getOpenCartConnection()

  await conn.execute(
    `UPDATE oc_product_description
     SET meta_title = COALESCE(?, meta_title),
         meta_description = COALESCE(?, meta_description),
         meta_keyword = COALESCE(?, meta_keyword)
     WHERE product_id = ? AND language_id = 1`,
    [meta.title, meta.description, meta.keywords, productId]
  )

  await conn.end()
}

export async function addImageAltTags(productId: number) {
  const conn = await getOpenCartConnection()

  // Get product name for alt tag
  const [rows] = await conn.execute(
    `SELECT name FROM oc_product_description WHERE product_id = ? AND language_id = 1`,
    [productId]
  )
  const productName = rows[0].name

  // Update images with alt tags
  await conn.execute(
    `UPDATE oc_product_image
     SET alt_tag = CONCAT(?, ' - Image ', image_id)
     WHERE product_id = ? AND (alt_tag IS NULL OR alt_tag = '')`,
    [productName, productId]
  )

  await conn.end()
}

export async function bulkApplySEOFixes(auditId: string) {
  const audit = await supabase
    .from('seo_audits')
    .select('*')
    .eq('id', auditId)
    .single()

  const recommendations = audit.data.recommendations
  const conn = await getOpenCartConnection()

  for (const rec of recommendations) {
    switch (rec.type) {
      case 'meta_description':
        await updateProductMeta(rec.product_id, { description: rec.suggested_value })
        break
      case 'meta_title':
        await updateProductMeta(rec.product_id, { title: rec.suggested_value })
        break
      case 'image_alt':
        await addImageAltTags(rec.product_id)
        break
    }
  }

  await conn.end()

  // Update audit with applied status
  await supabase.from('seo_audits').update({
    status: 'applied',
    applied_at: new Date(),
    applied_count: recommendations.length
  }).eq('id', auditId)
}
```

#### 5.2 SEO Fix Applicator Endpoint
**New File:** `app/api/agents/seo/apply-fixes/route.ts`

Execute SEO fix application:

```typescript
export async function POST(request: NextRequest) {
  const { audit_id } = await request.json()

  try {
    const audit = await supabase
      .from('seo_audits')
      .select('*')
      .eq('id', audit_id)
      .single()

    const recommendationCount = audit.data.recommendations.length

    // Safety check: >10 products requires approval
    if (recommendationCount > 10) {
      // Create approval task
      await supabase.from('squad_tasks').insert({
        title: `Approve ${recommendationCount} SEO fixes`,
        description: `Audit findings:\n${summarizeRecommendations(audit.data.recommendations)}`,
        status: 'new',
        assigned_agent: 'SEO Agent',
        priority: 'medium',
        mentions_kenny: true,
        requires_approval: true,
        deliverable_url: `/seo-audits/${audit_id}`
      })

      return NextResponse.json({
        success: true,
        requires_approval: true,
        message: `Approval required for ${recommendationCount} fixes`
      })
    }

    // Auto-apply minor fixes
    await opencartUpdater.bulkApplySEOFixes(audit_id)

    // Mark task complete
    const { data: task } = await supabase
      .from('squad_tasks')
      .select('id')
      .eq('metadata->>audit_id', audit_id)
      .single()

    if (task) {
      await supabase.from('squad_tasks').update({
        status: 'completed',
        completed_at: new Date(),
        deliverable_url: `/seo-audits/${audit_id}/results`
      }).eq('id', task.id)
    }

    await logToSquadMessages(
      'SEO Agent',
      `✅ Applied ${recommendationCount} SEO fixes to OpenCart`,
      { audit_id, recommendations_count: recommendationCount }
    )

    return NextResponse.json({
      success: true,
      applied: recommendationCount
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**Safety Rules:**
```javascript
MINOR_FIXES_THRESHOLD = 10  // Auto-apply if ≤10 products affected
MAJOR_FIXES_THRESHOLD = 11  // Require approval if >10 products

AUTO_APPLY_TYPES = [
  'meta_description',  // Missing/short meta descriptions
  'meta_title',        // Missing meta titles
  'image_alt'          // Missing image alt tags
]

REQUIRE_APPROVAL_TYPES = [
  'url_rewrite',       // URL slug changes
  'category_move',     // Product category changes
  'bulk_delete'        // Mass deletions
]
```

#### 5.3 Google Ads Integration (Optional)
**New File:** `services/integrations/google-ads-service.ts`

Monitor campaigns and apply bid adjustments:

```typescript
import { GoogleAdsApi } from 'google-ads-api'

async function getGoogleAdsClient() {
  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  })

  const customer = client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN
  })

  return customer
}

export async function getCampaignPerformance() {
  const customer = await getGoogleAdsClient()

  const campaigns = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign_budget.amount_micros,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
  `)

  return campaigns
}

export async function applyBidAdjustment(campaignId: string, adjustment: number) {
  const customer = await getGoogleAdsClient()

  // Get current bid
  const campaign = await customer.campaigns.get(campaignId)
  const currentBid = campaign.manual_cpc.enhanced_cpc_enabled

  // Calculate new bid
  const newBid = currentBid * (1 + adjustment / 100)

  // Update campaign
  await customer.campaigns.update({
    resource_name: campaign.resource_name,
    manual_cpc: {
      enhanced_cpc_enabled: true,
      enhanced_cpc_bid_ceiling: newBid
    }
  })

  return { currentBid, newBid, adjustment }
}
```

**Setup Required:**
1. Create Google Ads Manager account
2. Link client account to Manager
3. Create OAuth credentials in Google Cloud Console
4. Get refresh token via OAuth Playground
5. Add environment variables to Vercel

**Safety Rules:**
```javascript
AUTO_APPLY = {
  bid_decrease: true,           // Always auto-apply decreases
  bid_increase_small: true,     // Auto if <10%
  bid_increase_large: false,    // Require approval if ≥10%
  budget_change: false,         // Always require approval
  pause_campaign: false         // Always require approval
}
```

---

### Phase 6: Dashboard & Monitoring (Week 4 - PRIORITY 6)

**Goal:** Build oversight and control interface for Kenny

#### 6.1 Approval Queue Component
**New Component:** `app/squad/components/ApprovalQueue.tsx`

Display pending approval tasks with one-click approve/reject:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function ApprovalQueue() {
  const [pendingTasks, setPendingTasks] = useState([])

  useEffect(() => {
    fetchPendingTasks()

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('approval_queue')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'squad_tasks', filter: 'requires_approval=eq.true' },
        (payload) => fetchPendingTasks()
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [])

  async function fetchPendingTasks() {
    const { data } = await supabase
      .from('squad_tasks')
      .select('*')
      .eq('requires_approval', true)
      .is('approved_at', null)
      .order('created_at', { ascending: false })

    setPendingTasks(data || [])
  }

  async function approveTask(taskId: string) {
    await fetch(`/api/tasks/${taskId}/approve`, { method: 'POST' })
    fetchPendingTasks()
  }

  async function rejectTask(taskId: string) {
    const reason = prompt('Rejection reason:')
    await fetch(`/api/tasks/${taskId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    })
    fetchPendingTasks()
  }

  return (
    <div className="approval-queue">
      <h3>Pending Approvals ({pendingTasks.length})</h3>
      {pendingTasks.map(task => (
        <div key={task.id} className="approval-card">
          <h4>{task.title}</h4>
          <p>{task.description}</p>
          <div className="actions">
            <button onClick={() => approveTask(task.id)}>✅ Approve</button>
            <button onClick={() => rejectTask(task.id)}>❌ Reject</button>
            <a href={task.deliverable_url} target="_blank">👁️ Preview</a>
          </div>
        </div>
      ))}
    </div>
  )
}
```

#### 6.2 Execution Log Component
**New Component:** `app/squad/components/ExecutionLog.tsx`

Show recent agent actions:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function ExecutionLog() {
  const [logs, setLogs] = useState([])

  useEffect(() => {
    fetchLogs()

    const interval = setInterval(fetchLogs, 5000) // Refresh every 5s
    return () => clearInterval(interval)
  }, [])

  async function fetchLogs() {
    const { data } = await supabase
      .from('agent_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    setLogs(data || [])
  }

  return (
    <div className="execution-log">
      <h3>Recent Activity</h3>
      <div className="log-entries">
        {logs.map(log => (
          <div key={log.id} className={`log-entry log-${log.log_level}`}>
            <span className="timestamp">{formatTime(log.created_at)}</span>
            <span className="agent">{log.agent_name}</span>
            <span className="event">{log.event_type}</span>
            <span className="message">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

#### 6.3 Manual Control Endpoints

**Task Approval:**
**New File:** `app/api/tasks/[id]/approve/route.ts`

```typescript
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const taskId = params.id

  await supabase.from('squad_tasks').update({
    approved_by: 'Kenny',
    approved_at: new Date(),
    requires_approval: false  // Allow execution
  }).eq('id', taskId)

  await logToSquadMessages(
    'Jarvis',
    `✅ Task approved by Kenny: ${taskId}`,
    { task_id: taskId, approved_by: 'Kenny' }
  )

  return NextResponse.json({ success: true })
}
```

**Task Rejection:**
**New File:** `app/api/tasks/[id]/reject/route.ts`

```typescript
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { reason } = await request.json()
  const taskId = params.id

  await supabase.from('squad_tasks').update({
    status: 'rejected',
    rejected_by: 'Kenny',
    rejected_at: new Date(),
    rejection_reason: reason
  }).eq('id', taskId)

  await logToSquadMessages(
    'Jarvis',
    `❌ Task rejected by Kenny: ${reason}`,
    { task_id: taskId, reason }
  )

  return NextResponse.json({ success: true })
}
```

**Agent Pause/Resume:**
**New File:** `app/api/agents/pause/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // Set global pause flag in database
  await supabase.from('agent_configs').upsert({
    key: 'global_pause',
    value: true,
    updated_at: new Date()
  })

  // Update all agents to paused status
  await supabase.from('squad_agents').update({
    status: 'paused'
  })

  await logToSquadMessages(
    'System',
    '⏸️ All agents paused by Kenny',
    { action: 'pause_all' }
  )

  return NextResponse.json({ success: true, status: 'paused' })
}
```

#### 6.4 Alert System
**New File:** `services/alert-service.ts`

Notify Kenny of critical events:

```typescript
export async function sendAlert(alert: {
  type: 'approval_needed' | 'agent_error' | 'rate_limit' | 'customer_complaint',
  severity: 'low' | 'medium' | 'high' | 'urgent',
  title: string,
  message: string,
  metadata?: any
}) {
  // Log to database
  await supabase.from('alerts').insert({
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    metadata: alert.metadata,
    created_at: new Date()
  })

  // Send email if urgent
  if (alert.severity === 'urgent') {
    await gmailSender.sendDirectEmail(
      process.env.ALERT_EMAIL || 'kenny@audico.co.za',
      `🚨 URGENT: ${alert.title}`,
      alert.message
    )
  }

  // Show in dashboard banner
  await supabase.from('dashboard_notifications').insert({
    type: alert.type,
    message: alert.title,
    read: false,
    created_at: new Date()
  })

  // Future: SMS via Twilio, Slack webhook
}
```

**Alert Triggers:**
```javascript
ALERT_TRIGGERS = {
  approval_needed: {
    condition: 'task.requires_approval AND task.priority = urgent',
    severity: 'high'
  },
  agent_error: {
    condition: 'task.execution_attempts >= 3',
    severity: 'urgent'
  },
  rate_limit: {
    condition: 'rate_limit.remaining / rate_limit.max < 0.1',
    severity: 'medium'
  },
  customer_complaint: {
    condition: 'email.category = complaint',
    severity: 'urgent'
  }
}
```

---

### Phase 7: Safety & Testing (Week 5 - PRIORITY 7)

**Goal:** Ensure safe rollout with comprehensive testing

#### 7.1 Dry-Run Mode

Add to ALL execution functions:

```typescript
const DRY_RUN = process.env.AGENT_DRY_RUN === 'true'

async function sendEmail(draftId: string) {
  if (DRY_RUN) {
    console.log('[DRY RUN] Would send email:', draftId)
    await logToSquadMessages('email_agent', `[DRY RUN] Email would be sent: ${draftId}`)
    return { id: 'DRY_RUN_MESSAGE_ID', success: true }
  }

  // Actual send logic
  return await gmailSender.sendDraft(draftId)
}

async function publishToTwitter(postId: string) {
  if (DRY_RUN) {
    console.log('[DRY RUN] Would publish to Twitter:', postId)
    await logToSquadMessages('social_agent', `[DRY RUN] Would publish post ${postId}`)
    return { id: 'DRY_RUN_TWEET_ID', success: true }
  }

  // Actual publish logic
  return await socialPublisher.publishToTwitter(postId)
}
```

**Environment Variables:**
```bash
AGENT_DRY_RUN=true   # Enable for testing
ENABLE_AUTO_EXECUTION=false  # Master switch
```

#### 7.2 Execution Rate Limits

Add operation-specific rate limits:

```typescript
// In lib/rate-limiter.ts
export const EXECUTION_RATE_LIMITS = {
  email_send: {
    agentName: 'email_send',
    maxExecutions: 50,
    windowSeconds: 86400  // 50 emails per day
  },
  social_publish: {
    agentName: 'social_publish',
    maxExecutions: 20,
    windowSeconds: 86400  // 20 posts per day
  },
  newsletter_send: {
    agentName: 'newsletter_send',
    maxExecutions: 1,
    windowSeconds: 86400  // 1 newsletter per day
  },
  seo_bulk_apply: {
    agentName: 'seo_bulk_apply',
    maxExecutions: 5,
    windowSeconds: 86400  // 5 bulk updates per day
  }
}
```

**Enforce in execution functions:**
```typescript
async function executeEmailSend(task: Task) {
  const rateLimit = await checkRateLimit(EXECUTION_RATE_LIMITS.email_send)

  if (!rateLimit.allowed) {
    throw new Error(`Rate limit exceeded: ${rateLimit.remaining}/${rateLimit.max} remaining`)
  }

  // Proceed with execution
}
```

#### 7.3 Rollback Mechanism

Capture state before execution for rollback:

```typescript
async function executeWithRollback(task: Task, executor: Function) {
  // Capture pre-execution state
  const snapshot = await captureState(task)

  try {
    const result = await executor(task)
    return result
  } catch (error) {
    // Rollback on error
    console.error('Execution failed, attempting rollback:', error)
    await rollback(snapshot)
    throw error
  }
}

async function captureState(task: Task) {
  // Save current state for potential rollback
  const snapshot = {
    task_id: task.id,
    timestamp: new Date(),
    task_state: { ...task },
    related_records: {}
  }

  // For email tasks, save current email_logs state
  if (task.assigned_agent === 'Email Agent' && task.metadata?.email_id) {
    const { data: emailLog } = await supabase
      .from('email_logs')
      .select('*')
      .eq('id', task.metadata.email_id)
      .single()

    snapshot.related_records.email_log = emailLog
  }

  // Store snapshot
  await supabase.from('execution_snapshots').insert(snapshot)

  return snapshot
}

async function rollback(snapshot: any) {
  // Restore previous state
  await supabase.from('squad_tasks').update(snapshot.task_state).eq('id', snapshot.task_id)

  // Restore related records
  if (snapshot.related_records.email_log) {
    await supabase.from('email_logs')
      .update(snapshot.related_records.email_log)
      .eq('id', snapshot.related_records.email_log.id)
  }

  await logToSquadMessages(
    'System',
    `⚠️ Rolled back failed execution for task ${snapshot.task_id}`,
    { snapshot_id: snapshot.id }
  )
}
```

#### 7.4 Testing Checklist

**Manual Testing (Week 5):**

- [ ] **Email Auto-Send:**
  - Send FAQ email to support@audicoonline.co.za
  - Wait for poll (15min) + classify (20min) + respond
  - Verify draft created in Gmail
  - Wait 1 hour, verify auto-send occurred
  - Check `email_logs.status='sent'` and task completed

- [ ] **Email Approval:**
  - Send complaint email
  - Verify approval task created with `mentions_kenny=true`
  - Approve via dashboard
  - Verify email sent after approval

- [ ] **Social Post Publishing:**
  - Create social post draft
  - Verify approval task created
  - Approve in dashboard
  - Verify post published to Twitter
  - Check `social_posts.status='published'`

- [ ] **Newsletter Distribution:**
  - Create newsletter draft
  - Verify approval task created
  - Approve in dashboard
  - Verify sent via Brevo (check campaign stats)

- [ ] **SEO Minor Fixes:**
  - Run SEO audit with <10 recommendations
  - Verify fixes auto-applied to OpenCart
  - Check `oc_product_description` table

- [ ] **SEO Bulk Fixes:**
  - Run SEO audit with >10 recommendations
  - Verify approval task created
  - Approve in dashboard
  - Verify fixes applied

- [ ] **Task Completion:**
  - Verify tasks move: new → in_progress → completed
  - Check task completion counter increases
  - Verify `deliverable_url` populated

- [ ] **Dry-Run Mode:**
  - Set `AGENT_DRY_RUN=true`
  - Create test tasks
  - Verify logs show "[DRY RUN]" messages
  - Verify no actual emails/posts sent

- [ ] **Rate Limiting:**
  - Attempt to exceed email send limit (50/day)
  - Verify rate limit error returned
  - Check Redis keys for rate limit tracking

- [ ] **Error Handling:**
  - Simulate API failure (invalid token)
  - Verify task retries 3 times
  - Verify escalation after 3 failures

**Automated Tests:**
**New File:** `__tests__/task-executor.test.ts`

```typescript
import { taskExecutor } from '@/services/task-executor'
import { supabase } from '@/lib/supabase'

describe('Task Executor', () => {
  beforeEach(async () => {
    // Clean test database
    await supabase.from('squad_tasks').delete().neq('id', '')
  })

  it('should execute approved email tasks', async () => {
    const task = await createTestTask({
      assigned_agent: 'Email Agent',
      requires_approval: false,
      metadata: { email_id: 'test_email_1' }
    })

    await taskExecutor.executeTask(task)

    const { data: updated } = await supabase
      .from('squad_tasks')
      .select('status')
      .eq('id', task.id)
      .single()

    expect(updated.status).toBe('completed')
  })

  it('should create approval task for customer-facing emails', async () => {
    const task = await createTestTask({
      assigned_agent: 'Email Agent',
      metadata: { email_category: 'complaint' }
    })

    await taskExecutor.executeTask(task)

    const { data: approvalTask } = await supabase
      .from('squad_tasks')
      .select('*')
      .eq('mentions_kenny', true)
      .single()

    expect(approvalTask).toBeDefined()
    expect(approvalTask.requires_approval).toBe(true)
  })

  it('should retry failed tasks with backoff', async () => {
    const task = await createTestTask({ assigned_agent: 'Email Agent' })

    // Simulate failure
    jest.spyOn(taskExecutor, 'executeEmailTask').mockRejectedValue(new Error('API error'))

    await taskExecutor.executeTask(task)

    const { data: updated } = await supabase
      .from('squad_tasks')
      .select('execution_attempts')
      .eq('id', task.id)
      .single()

    expect(updated.execution_attempts).toBe(1)
  })

  it('should escalate after 3 failures', async () => {
    const task = await createTestTask({
      assigned_agent: 'Email Agent',
      execution_attempts: 3
    })

    await taskExecutor.executeTask(task)

    const { data: escalationTask } = await supabase
      .from('squad_tasks')
      .select('*')
      .eq('title', `ESCALATION: ${task.title}`)
      .single()

    expect(escalationTask).toBeDefined()
    expect(escalationTask.priority).toBe('urgent')
  })
})
```

---

## 🔧 Environment Variables Required

Add to Vercel:

```bash
# Execution Control
AGENT_DRY_RUN=false                    # Set true for testing (NO real actions)
ENABLE_AUTO_EXECUTION=true              # Master switch for autonomy

# Brevo Newsletter (PRIORITY: High)
BREVO_API_KEY=xkeysib-...              # Get from brevo.com

# Facebook/Instagram (PRIORITY: Medium)
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
FACEBOOK_PAGE_ACCESS_TOKEN=...         # From Facebook Page settings
INSTAGRAM_BUSINESS_ACCOUNT_ID=...      # Link IG Business to FB Page

# Google Ads (PRIORITY: Low - Optional)
GOOGLE_ADS_CLIENT_ID=...
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_REFRESH_TOKEN=...
GOOGLE_ADS_CUSTOMER_ID=...
GOOGLE_ADS_DEVELOPER_TOKEN=...

# OpenCart Database (Already Configured)
OPENCART_DB_HOST=...
OPENCART_DB_USER=...
OPENCART_DB_PASSWORD=...
OPENCART_DB_NAME=...

# Alerting
ALERT_EMAIL=kenny@audico.co.za

# Future Integrations
TWILIO_ACCOUNT_SID=...                 # For SMS alerts
TWILIO_AUTH_TOKEN=...
SLACK_WEBHOOK_URL=...                  # For Slack notifications
```

---

## 📊 Success Metrics

### Week 1-2 (Infrastructure + Email)
- ✅ Task executor polls every 2 minutes
- ✅ Tasks transition: new → in_progress → completed
- ✅ At least 10 tasks complete per day
- ✅ Email drafts auto-sent for FAQ (after 1hr)
- ✅ Approval workflow functional

### Week 3 (Email + Social)
- ✅ 20+ emails auto-sent per day
- ✅ Social posts published after approval
- ✅ 50+ total tasks completed per day
- ✅ <5% email send failure rate

### Week 4 (Marketing + SEO)
- ✅ Newsletter sent via Brevo
- ✅ SEO fixes applied to OpenCart
- ✅ 100+ tasks completed per day
- ✅ All deliverables have URLs

### Week 5 (Full System)
- ✅ 200+ tasks completed per day
- ✅ <2% task failure rate
- ✅ <1 hour average approval time
- ✅ Zero unauthorized executions
- ✅ Dashboard shows real-time activity

---

## 🚨 Safety & Risk Mitigation

### High-Risk Operations

**1. Email Sending**
- **Risk:** Sending incorrect/duplicate emails to customers
- **Mitigation:**
  - Start with dry-run mode
  - Test with internal emails first
  - 1-hour delay before auto-send (review window)
  - Require approval for orders/complaints

**2. Social Media Publishing**
- **Risk:** Publishing inappropriate content
- **Mitigation:**
  - ALL posts require approval
  - Test on non-production accounts first
  - Preview before approval

**3. SEO Database Changes**
- **Risk:** Breaking product pages, 404 errors
- **Mitigation:**
  - Database backup before bulk operations
  - Auto-apply only <10 products
  - Require approval for >10 products
  - Rollback mechanism

**4. Newsletter Distribution**
- **Risk:** Spam/unsubscribes, deliverability issues
- **Mitigation:**
  - ALWAYS require approval
  - Test send to <10 recipients first
  - Monitor Brevo stats

### Rollback Plan

If something goes wrong:

1. **Immediate Actions:**
   - Set `ENABLE_AUTO_EXECUTION=false` in Vercel
   - POST to `/api/agents/pause` to halt all agents
   - Review execution logs in `agent_logs` table

2. **Email Rollback:**
   - Check Gmail Sent folder
   - Recall messages if still within window (Gmail doesn't support recall, but can send correction)
   - Draft apology/correction email if needed

3. **Social Media Rollback:**
   - Delete published posts manually
   - Draft correction post if needed

4. **Database Rollback:**
   - Restore from daily Supabase backup
   - Or run rollback from `execution_snapshots` table

5. **Recovery:**
   - Fix underlying issue
   - Test in dry-run mode
   - Gradually re-enable auto-execution

### Deployment Strategy

**Phase A: Dry-Run Only (Week 1-2)**
- Set `AGENT_DRY_RUN=true`
- Verify all execution flows work
- Test approval workflow
- NO real actions taken

**Phase B: Limited Production (Week 3)**
- Enable email execution only
- Start with internal test emails
- Auto-send FAQ responses only
- Monitor for 48 hours

**Phase C: Expand Scope (Week 4)**
- Enable social media (with approval)
- Enable newsletters (with approval)
- Monitor closely

**Phase D: Full Autonomy (Week 5)**
- Enable all auto-execution rules
- Daily dashboard reviews
- Weekly metrics analysis

---

## 📁 Critical Files Summary

### New Files (28 total)

**Core Infrastructure (4):**
1. `services/task-executor.ts`
2. `services/approval-workflow.ts`
3. `app/api/cron/tasks/execute/route.ts`
4. `services/alert-service.ts`

**Integrations (5):**
5. `services/integrations/gmail-sender.ts`
6. `services/integrations/social-publisher.ts`
7. `services/integrations/brevo-service.ts`
8. `services/integrations/opencart-updater.ts`
9. `services/integrations/google-ads-service.ts` (optional)

**API Endpoints (7):**
10. `app/api/agents/email/send/route.ts`
11. `app/api/agents/social/publish/route.ts`
12. `app/api/agents/marketing/send-newsletter/route.ts`
13. `app/api/agents/marketing/outreach/route.ts`
14. `app/api/agents/seo/apply-fixes/route.ts`
15. `app/api/tasks/[id]/approve/route.ts`
16. `app/api/tasks/[id]/reject/route.ts`

**Dashboard Components (3):**
17. `app/squad/components/ApprovalQueue.tsx`
18. `app/squad/components/ExecutionLog.tsx`
19. `app/squad/components/DeliverableGallery.tsx`

**Database & Config (2):**
20. `supabase/migrations/007_execution_tracking.sql`
21. `__tests__/task-executor.test.ts`

### Enhanced Files (7)

22. `app/api/agents/email/respond/route.ts` - Add auto-send logic
23. `app/api/agents/jarvis/orchestrate/route.ts` - Set requires_approval flag
24. `services/agents/social-agent.ts` - Add publishing logic
25. `services/agents/marketing-agent.ts` - Add Brevo/outreach
26. `services/agents/seo-agent.ts` - Add OpenCart updates
27. `services/agents/ads-agent.ts` - Add Google Ads API
28. `app/squad/page.tsx` - Add approval queue, execution log

### Configuration Files (2)

29. `vercel.json` - Add task execution cron job
30. `.env.example` - Document all required env vars

---

## 🎯 Verification Steps

After implementation, verify each component:

### 1. Task Execution Flow
```bash
# Create test task
curl -X POST https://audico-dashboard.vercel.app/api/tasks/create \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d '{"title":"Test task","assigned_agent":"Email Agent","requires_approval":false}'

# Wait 2 minutes for cron
# Verify status changed to 'completed' in dashboard
```

### 2. Email Auto-Send
```bash
# Send test inquiry email to support@audicoonline.co.za
# Wait: poll (15min) + classify (20min) + respond
# After 1 hour, check Gmail Sent folder
# Verify email_logs.status='sent' in Supabase
```

### 3. Approval Workflow
```bash
# Send test complaint email
# Verify approval task appears in dashboard
# Click "Approve"
# Verify email sent immediately
```

### 4. Social Publishing
```bash
# Create social post draft
# Approve in dashboard
# Check Twitter for published post
# Verify social_posts.status='published'
```

### 5. Dashboard Monitoring
- Open `/squad` dashboard
- Verify approval queue shows pending tasks
- Verify execution log shows recent activity
- Verify task completion counter increases
- Click deliverable URLs to view outputs

### 6. Dry-Run Mode
```bash
# Set AGENT_DRY_RUN=true in Vercel
# Create test tasks
# Check logs for "[DRY RUN]" messages
# Verify NO actual emails/posts sent
```

---

## 📝 Implementation Notes

### Reuse Existing Patterns

**Database Clients:**
- Use existing Supabase client from `lib/supabase.ts`
- Use existing OpenCart connection pattern from SEO agent

**Logging:**
- Use `logToSquadMessages()` for all agent communications
- Use `logAgentActivity()` from `lib/logger.ts` for detailed logs
- Use `logAgentExecution()` from `lib/rate-limiter.ts` for metrics

**Rate Limiting:**
- Use `checkRateLimit()` from `lib/rate-limiter.ts`
- Add new rate limit configs to `AGENT_RATE_LIMITS` object

**Error Handling:**
- Follow existing try/catch patterns from email/respond route
- Always log errors to both console and `agent_logs` table

**Cron Authentication:**
- Use existing pattern: check `Authorization: Bearer ${CRON_SECRET}`
- Return 401 if header doesn't match

### Code Quality Standards

- **TypeScript:** Add types for all new interfaces
- **Error Handling:** Wrap all execution logic in try/catch
- **Rate Limiting:** Apply to all execution endpoints
- **Logging:** Log start, success, failure for all operations
- **Testing:** Write tests for critical execution paths

### Database Migrations

Run migrations in order:
1. `007_execution_tracking.sql` - Add execution fields to squad_tasks
2. Test on staging database first
3. Backup production before running
4. Monitor for errors after deployment

### Deployment Order

1. **Database:** Run migrations first
2. **Backend:** Deploy new services and endpoints
3. **Environment:** Add required env vars to Vercel
4. **Frontend:** Deploy dashboard enhancements
5. **Testing:** Enable dry-run mode initially
6. **Rollout:** Gradually enable auto-execution

---

## 🏆 Expected Outcomes

### Immediate (Week 1-2)
- Task executor operational
- Approval workflow functional
- Email drafts being created and sent (FAQ auto-send)
- Dashboard shows task progression

### Mid-Term (Week 3-4)
- Social media posts published
- Newsletters distributed
- SEO fixes applied
- 100+ tasks completed daily

### Long-Term (Week 5+)
- Fully autonomous business management
- 200+ tasks completed daily
- <2% failure rate
- Kenny only handles approvals + exceptions
- Visible ROI: time saved, faster response times, better customer experience

---

## 🎁 Handover to Implementation Agent

This document is ready for a new chat session to implement. The plan is:
- ✅ Comprehensive and detailed
- ✅ Prioritized by impact (Phases 1-7)
- ✅ Safety-first approach with approval workflows
- ✅ Clear success metrics
- ✅ Well-defined verification steps
- ✅ Complete file list (30 files to create/enhance)
- ✅ Environment variables documented
- ✅ Risk mitigation strategies

**Recommended Approach for Implementation:**
1. Start with Phase 1 (Core Infrastructure) - Foundation is critical
2. Move to Phase 2 (Email Execution) - Highest immediate value
3. Continue phases in order based on priority
4. Test thoroughly at each phase before moving to next
5. Use dry-run mode extensively
6. Deploy incrementally, monitor closely

**Good luck! This will transform Audico's operations.** 🚀
