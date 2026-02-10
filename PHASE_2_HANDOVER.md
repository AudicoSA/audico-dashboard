# Phase 2: Email Execution - Implementation Handover

**Date:** February 10, 2026
**Status:** Ready for Implementation
**Previous Phase:** Phase 1 (Core Infrastructure) ✅ COMPLETED
**Current Phase:** Phase 2 (Email Execution)
**Next Phase:** Phase 3 (Social Media Execution)

---

## 🎯 Phase 1 Completion Summary

### ✅ What Was Built in Phase 1

**Core Infrastructure (Foundation Complete):**

1. **Task Executor Service** ([services/task-executor.ts](services/task-executor.ts))
   - Polls `squad_tasks` table every 2 minutes
   - Dispatches tasks to appropriate agent handlers
   - Implements retry logic (3 attempts with exponential backoff)
   - Updates task status: new → in_progress → completed
   - Escalates failed tasks after 3 attempts

2. **Approval Workflow System** ([services/approval-workflow.ts](services/approval-workflow.ts))
   - Defines safety rules for auto-execute vs require-approval
   - Auto-execute rules: FAQ emails, minor SEO fixes, bid decreases
   - Approval required: Customer emails, social posts, newsletters, bulk changes
   - Severity levels: low, medium, high, urgent

3. **Alert Service** ([services/alert-service.ts](services/alert-service.ts))
   - Sends alerts via database, squad messages, dashboard notifications
   - Sends urgent emails to Kenny for critical issues
   - Alert triggers: task failures, rate limits, customer complaints
   - Throttling to prevent alert spam

4. **Execution Handler Stubs** (services/execution-handlers/*)
   - [email-handler.ts](services/execution-handlers/email-handler.ts) - Ready for implementation
   - [social-handler.ts](services/execution-handlers/social-handler.ts) - Stub (Phase 3)
   - [marketing-handler.ts](services/execution-handlers/marketing-handler.ts) - Stub (Phase 4)
   - [seo-handler.ts](services/execution-handlers/seo-handler.ts) - Stub (Phase 5)
   - [ads-handler.ts](services/execution-handlers/ads-handler.ts) - Stub (Phase 5)

5. **Database Migration** ([supabase/migrations/007_execution_tracking.sql](supabase/migrations/007_execution_tracking.sql))
   - Added execution tracking columns to `squad_tasks`
   - Created `alerts` table
   - Created `dashboard_notifications` table
   - Created `agent_configs` table
   - Created `execution_snapshots` table for rollback

6. **API Endpoints:**
   - [/api/cron/tasks/execute](app/api/cron/tasks/execute/route.ts) - Task executor cron job (every 2 minutes)
   - [/api/tasks/[id]/approve](app/api/tasks/[id]/approve/route.ts) - Approve tasks
   - [/api/tasks/[id]/reject](app/api/tasks/[id]/reject/route.ts) - Reject tasks

7. **Configuration:**
   - Updated [vercel.json](vercel.json) with task execution cron job
   - Updated [lib/rate-limiter.ts](lib/rate-limiter.ts) with execution rate limits

### 🔧 Current System State

**Database:**
- Migration 007 needs to be run on Supabase
- New tables: `alerts`, `dashboard_notifications`, `agent_configs`, `execution_snapshots`
- New columns on `squad_tasks`: `execution_attempts`, `last_execution_attempt`, `execution_error`, `requires_approval`, `approved_by`, `approved_at`, `rejected_by`, `rejected_at`, `rejection_reason`

**Environment Variables Needed:**
```bash
# Already Configured (from Phase 0):
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_REDIRECT_URI=...

# New Variables Needed for Phase 2:
ENABLE_AUTO_EXECUTION=false    # Set to true when ready for production
AGENT_DRY_RUN=true             # Start with true for testing
ALERT_EMAIL=kenny@audico.co.za # Already in use
```

**Deployment Status:**
- All Phase 1 code is written and ready to deploy
- Task executor will run every 2 minutes once deployed
- Currently in DRY_RUN mode (no actual actions taken)

---

## 📋 Phase 2 Objectives

**Goal:** Enable automatic email sending with approval for critical emails

**Success Criteria:**
- ✅ Email drafts auto-sent for FAQ/inquiry categories (after 1 hour delay)
- ✅ Approval tasks created for order/support/complaint emails
- ✅ Kenny can approve/reject email sending via dashboard
- ✅ Email sending endpoint functional
- ✅ Email status tracked: draft → scheduled → sent
- ✅ At least 20+ emails auto-sent per day

**Timeline:** Week 1-2 of implementation

---

## 🏗️ Phase 2 Implementation Tasks

### Task 2.1: Create Gmail Sender Service

**New File:** `services/integrations/gmail-sender.ts`

**Purpose:** Execute email sending via Gmail API

**Implementation:**
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

function createMimeMessage(to: string, subject: string, body: string): string {
  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    body
  ]
  const message = messageParts.join('\n')
  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
```

**Dependencies:**
```bash
npm install googleapis
```

**Testing:**
```bash
# Test draft sending
curl -X POST http://localhost:3000/api/agents/email/send \
  -H "Content-Type: application/json" \
  -d '{"draft_id":"r123456789"}'
```

---

### Task 2.2: Implement Email Handler

**File to Update:** `services/execution-handlers/email-handler.ts`

**Current State:** Stub implementation that returns "not implemented" error

**New Implementation:**
```typescript
import type { Task } from '@/types/squad'
import { sendDraft } from '@/services/integrations/gmail-sender'
import { supabase } from '@/lib/supabase'
import { logToSquadMessages } from '@/lib/logger'

const DRY_RUN = process.env.AGENT_DRY_RUN === 'true'

export async function emailSendHandler(task: Task): Promise<ExecutionResult> {
  console.log('[EMAIL HANDLER] Executing task:', task.title)

  if (DRY_RUN) {
    console.log('[DRY RUN] Would send email:', task.metadata)
    await logToSquadMessages('Email Agent', `[DRY RUN] Would send email: ${task.title}`)
    return {
      success: true,
      deliverable_url: '/emails/dry-run-preview'
    }
  }

  try {
    // Get email metadata
    const emailId = task.metadata?.email_id
    const draftId = task.metadata?.draft_id

    if (!emailId || !draftId) {
      throw new Error('Missing email_id or draft_id in task metadata')
    }

    // Fetch email details
    const { data: emailLog, error: emailError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('id', emailId)
      .single()

    if (emailError || !emailLog) {
      throw new Error(`Email not found: ${emailId}`)
    }

    // Send the draft
    const sentMessage = await sendDraft(draftId)

    // Update email_logs
    await supabase.from('email_logs').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      metadata: {
        ...emailLog.metadata,
        gmail_message_id: sentMessage.id,
        sent_via: 'auto_execution'
      }
    }).eq('id', emailId)

    // Log success
    await logToSquadMessages(
      'Email Agent',
      `✅ Email sent to ${emailLog.from_email}: "${emailLog.subject}"`,
      { email_id: emailId, message_id: sentMessage.id }
    )

    return {
      success: true,
      deliverable_url: `https://mail.google.com/mail/u/0/#sent/${sentMessage.id}`
    }
  } catch (error: any) {
    console.error('[EMAIL HANDLER] Error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
```

---

### Task 2.3: Enhance Email Respond Route

**File to Update:** `app/api/agents/email/respond/route.ts`

**Current State:** Creates email drafts but doesn't schedule sending

**Enhancement Needed:** Add auto-send logic after draft creation

**Code to Add (after draft creation):**
```typescript
// After creating draft (existing code continues...)
const draft = await createGmailDraft(...)

// NEW: Determine if auto-send or require approval
const emailCategory = emailLog.category
const autoSendCategories = ['inquiry', 'spam']
const approvalCategories = ['order', 'support', 'complaint']

if (autoSendCategories.includes(emailCategory)) {
  // Auto-send after 1 hour delay (gives Kenny review window)
  const scheduledSendTime = new Date(Date.now() + 3600000) // 1 hour from now

  await supabase.from('squad_tasks').insert({
    title: `Send email to ${emailLog.from_email}`,
    description: `Auto-send email response (${emailCategory}):\n\nSubject: ${emailLog.subject}`,
    status: 'new',
    assigned_agent: 'Email Agent',
    priority: 'low',
    requires_approval: false, // Auto-execute
    metadata: {
      email_id: emailLog.id,
      draft_id: draft.id,
      email_category: emailCategory,
      scheduled_for: scheduledSendTime.toISOString()
    },
    deliverable_url: `/emails/${emailLog.id}/draft`
  })

  await supabase.from('email_logs').update({
    status: 'scheduled',
    metadata: { ...emailLog.metadata, scheduled_for: scheduledSendTime.toISOString() }
  }).eq('id', emailLog.id)

  await logToSquadMessages(
    'Email Agent',
    `📧 Email response scheduled for auto-send in 1 hour: ${emailLog.subject}`,
    { email_id: emailLog.id, draft_id: draft.id, auto_send: true }
  )

} else if (approvalCategories.includes(emailCategory)) {
  // Create approval task for Kenny
  await supabase.from('squad_tasks').insert({
    title: `Approve email response to ${emailLog.from_email}`,
    description: `Category: ${emailCategory}\nSubject: ${emailLog.subject}\n\nPreview: ${draftBody.substring(0, 300)}...`,
    status: 'new',
    assigned_agent: 'Email Agent',
    priority: emailCategory === 'complaint' ? 'urgent' : 'high',
    mentions_kenny: true,
    requires_approval: true,
    metadata: {
      email_id: emailLog.id,
      draft_id: draft.id,
      email_category: emailCategory
    },
    deliverable_url: `/emails/${emailLog.id}/draft`
  })

  await supabase.from('email_logs').update({
    status: 'awaiting_approval'
  }).eq('id', emailLog.id)

  await logToSquadMessages(
    'Email Agent',
    `⏸️ Email response requires approval: ${emailLog.subject}`,
    { email_id: emailLog.id, draft_id: draft.id, requires_approval: true }
  )
}
```

---

### Task 2.4: Create Email Sending Endpoint

**New File:** `app/api/agents/email/send/route.ts`

**Purpose:** Direct endpoint for sending emails (can be called manually or by task executor)

**Implementation:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { sendDraft } from '@/services/integrations/gmail-sender'
import { supabase } from '@/lib/supabase'
import { logToSquadMessages } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email_id, draft_id } = await request.json()

    if (!email_id || !draft_id) {
      return NextResponse.json(
        { error: 'Missing email_id or draft_id' },
        { status: 400 }
      )
    }

    // Get email details
    const { data: emailLog, error } = await supabase
      .from('email_logs')
      .select('*')
      .eq('id', email_id)
      .single()

    if (error || !emailLog) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      )
    }

    // Send the draft
    const sentMessage = await sendDraft(draft_id)

    // Update email_logs
    await supabase.from('email_logs').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      metadata: {
        ...emailLog.metadata,
        gmail_message_id: sentMessage.id
      }
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
        completed_at: new Date().toISOString(),
        deliverable_url: `https://mail.google.com/mail/u/0/#sent/${sentMessage.id}`
      }).eq('id', task.id)
    }

    await logToSquadMessages(
      'Email Agent',
      `✅ Email sent to ${emailLog.from_email}: "${emailLog.subject}"`,
      { email_id, sent_message_id: sentMessage.id }
    )

    return NextResponse.json({
      success: true,
      message_id: sentMessage.id,
      email_id
    })
  } catch (error: any) {
    console.error('[EMAIL SEND] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'operational',
    endpoint: '/api/agents/email/send',
    method: 'POST',
    required_fields: ['email_id', 'draft_id']
  })
}
```

---

## 🧪 Testing Checklist for Phase 2

### Step 1: Deploy Phase 1 Infrastructure

```bash
# 1. Run database migration
# In Supabase SQL Editor, run:
# supabase/migrations/007_execution_tracking.sql

# 2. Deploy to Vercel
git add .
git commit -m "Phase 1: Core infrastructure for autonomous task execution"
git push origin main

# 3. Verify cron job is registered
# Check Vercel Dashboard → Cron Jobs
# Should see: /api/cron/tasks/execute (*/2 * * * *)
```

### Step 2: Test Task Executor (Dry Run)

```bash
# Set environment variables in Vercel:
ENABLE_AUTO_EXECUTION=true
AGENT_DRY_RUN=true

# Wait 2 minutes, check logs
# Should see: [TASK EXECUTOR] Polling for executable tasks...
# Should see: [DRY RUN] messages in logs
```

### Step 3: Implement Phase 2 Email Features

```bash
# 1. Install googleapis
npm install googleapis

# 2. Create gmail-sender.ts
# 3. Update email-handler.ts
# 4. Enhance email/respond route
# 5. Create email/send endpoint

# 6. Deploy
git add .
git commit -m "Phase 2: Email execution with auto-send and approval workflow"
git push origin main
```

### Step 4: Test Email Auto-Send (Dry Run)

```bash
# Send test inquiry email to support@audicoonline.co.za
# Subject: "What are your business hours?"

# Wait for:
# 1. Email poll (15 min)
# 2. Email classify (20 min)
# 3. Email respond (creates draft + task)
# 4. Task executor picks up task (2 min)

# Check logs for:
# [DRY RUN] Would send email: ...

# Check squad_tasks table:
# - Should have task with status='completed'
# - Should have deliverable_url
```

### Step 5: Test Email Approval Flow (Dry Run)

```bash
# Send test complaint email to support@audicoonline.co.za
# Subject: "Unhappy with my order"

# Check squad_tasks table:
# - Should have task with requires_approval=true
# - Should have mentions_kenny=true
# - Should have priority='urgent'

# Approve via API:
curl -X POST https://audico-dashboard.vercel.app/api/tasks/[task_id]/approve

# Check task updated:
# - approved_by='Kenny'
# - approved_at is set
# - requires_approval=false (now executable)

# Wait 2 minutes for task executor
# Check logs:
# [DRY RUN] Would send email: ...
```

### Step 6: Enable Production Email Sending

```bash
# ONLY after dry-run testing is successful:
AGENT_DRY_RUN=false

# Start with just inquiry emails:
# Modify approval-workflow.ts AUTO_EXECUTE_RULES to only include 'inquiry'

# Monitor closely for 24 hours
# Check Gmail Sent folder
# Check email_logs.status='sent'
```

---

## 📊 Success Metrics for Phase 2

**Week 1:**
- ✅ Gmail sender service functional
- ✅ Email handler executes successfully
- ✅ At least 5 test emails sent in dry-run mode
- ✅ Approval workflow tested and working

**Week 2:**
- ✅ 20+ inquiry emails auto-sent per day
- ✅ Complaint emails create approval tasks
- ✅ Kenny can approve/reject via API
- ✅ <5% email send failure rate
- ✅ All email statuses tracked correctly

---

## 🚨 Important Notes

**Safety First:**
1. Always start with `AGENT_DRY_RUN=true`
2. Test thoroughly before enabling production sending
3. Monitor Gmail Sent folder closely
4. Have rollback plan ready (pause cron job)

**Email Categories (from existing classifier):**
- `inquiry` - Auto-send after 1 hour ✅
- `spam` - Auto-send immediately ✅
- `order` - Require approval ⏸️
- `support` - Require approval ⏸️
- `complaint` - Require approval (urgent) 🚨

**Rate Limits:**
- Email sending: 50 per day (already configured in rate-limiter.ts)
- Task executor: 720 per day (already configured)

**Database Schema:**
```sql
-- email_logs.status values:
- 'classified' (existing)
- 'scheduled' (NEW - scheduled for auto-send)
- 'awaiting_approval' (NEW - needs approval)
- 'sent' (NEW - email sent)
- 'failed' (NEW - send failed)
```

---

## 🎯 Next Steps After Phase 2

Once Phase 2 is complete and stable:

**Phase 3: Social Media Execution**
- Implement social-publisher.ts
- Create social/publish endpoint
- Enhance social-handler.ts
- Add Facebook/Instagram OAuth

**Phase 4: Marketing & Newsletters**
- Implement Brevo newsletter integration
- Create newsletter sending endpoint
- Implement influencer outreach

**Phase 5: SEO & Ads**
- Implement OpenCart SEO updater
- Create SEO fix application endpoint
- Add Google Ads integration (optional)

---

## 📞 Questions or Issues?

If you encounter any issues during Phase 2 implementation:

1. Check Phase 1 is deployed correctly (cron job running)
2. Verify database migration was applied
3. Check environment variables are set
4. Review agent_logs table for errors
5. Test in dry-run mode first

**Handover Complete!** Phase 2 is ready to implement. Good luck! 🚀
