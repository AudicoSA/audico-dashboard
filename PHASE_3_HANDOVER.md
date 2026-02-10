# Phase 3: Social Media Execution - Implementation Handover

**Date:** February 10, 2026
**Status:** Ready for Implementation
**Previous Phases:** Phase 1 (Core Infrastructure) ✅ + Phase 2 (Email Execution) ✅ COMPLETED
**Current Phase:** Phase 3 (Social Media Execution)
**Next Phase:** Phase 4 (Marketing & Newsletters)

---

## 🎯 Phase 1 & 2 Completion Summary

### ✅ What Was Built in Phase 1 & 2

**Phase 1 - Core Infrastructure (Foundation Complete):**

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
   - [email-handler.ts](services/execution-handlers/email-handler.ts) - ✅ COMPLETE (Phase 2)
   - [social-handler.ts](services/execution-handlers/social-handler.ts) - Stub (Phase 3 - THIS PHASE)
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

**Phase 2 - Email Execution (Complete):**

1. **Gmail Sender Service** ([services/integrations/gmail-sender.ts](services/integrations/gmail-sender.ts))
   - Send Gmail drafts via Gmail API
   - Send direct emails
   - Archive emails
   - MIME message formatting

2. **Email Handler** ([services/execution-handlers/email-handler.ts](services/execution-handlers/email-handler.ts))
   - Executes email sending tasks from task executor
   - Dry-run mode support
   - Updates email_logs table
   - Returns Gmail sent message URLs

3. **Enhanced Email Respond Route** ([app/api/agents/email/respond/route.ts](app/api/agents/email/respond/route.ts))
   - Auto-send logic for inquiry/spam emails (1 hour delay)
   - Approval workflow for order/support/complaint emails
   - Creates squad_tasks for execution

4. **Email Sending Endpoint** ([app/api/agents/email/send/route.ts](app/api/agents/email/send/route.ts))
   - Direct endpoint for sending emails
   - Updates related tasks as completed

### 🔧 Current System State

**Database:**
- Migration 007 needs to be run on Supabase (if not already done)
- New tables: `alerts`, `dashboard_notifications`, `agent_configs`, `execution_snapshots`
- `squad_tasks` has execution tracking columns

**Environment Variables Configured:**
```bash
# Already Configured (from Phase 0-2):
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_REDIRECT_URI=...
AGENT_DRY_RUN=true             # Should be true for Phase 3 testing
ENABLE_AUTO_EXECUTION=true     # Task executor enabled
CRON_SECRET=...                # For cron authentication
```

**Deployment Status:**
- Phase 1 & 2 code committed and ready to deploy
- Task executor will run every 2 minutes once deployed
- Email execution fully functional

---

## 📋 Phase 3 Objectives

**Goal:** Enable social media publishing with approval workflow

**Success Criteria:**
- ✅ Social posts published to Twitter/X
- ✅ Social posts published to Facebook
- ✅ Social posts published to Instagram
- ✅ All posts require Kenny's approval before publishing
- ✅ Post status tracked: draft → scheduled → published
- ✅ Platform URLs captured for published posts
- ✅ At least 5+ posts published per week

**Timeline:** Week 2-3 of implementation

---

## 🏗️ Phase 3 Implementation Tasks

### Task 3.1: Create Social Media Publisher Service

**New File:** `services/integrations/social-publisher.ts`

**Purpose:** Execute social media publishing to Twitter, Facebook, and Instagram

**Implementation:**

```typescript
import { getServerSupabase } from '@/lib/supabase'

/**
 * Social Media Publisher Service
 *
 * Handles publishing posts to social platforms:
 * - Twitter/X (OAuth 2.0)
 * - Facebook Pages
 * - Instagram Business
 */

interface PublishResult {
  platform_post_id: string
  platform_url?: string
  published_at: string
}

/**
 * Get social account credentials from database
 */
async function getSocialAccountToken(platform: string) {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('social_accounts')
    .select('access_token, refresh_token, metadata')
    .eq('platform', platform)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    throw new Error(`No active ${platform} account configured`)
  }

  return data
}

/**
 * Fetch post from database
 */
async function fetchPostFromDB(postId: string) {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .eq('id', postId)
    .single()

  if (error || !data) {
    throw new Error(`Post not found: ${postId}`)
  }

  return data
}

/**
 * Publish post to Twitter/X
 * Uses OAuth 2.0 (already configured)
 */
export async function publishToTwitter(postId: string): Promise<PublishResult> {
  console.log('[SOCIAL PUBLISHER] Publishing to Twitter:', postId)

  try {
    const post = await fetchPostFromDB(postId)
    const account = await getSocialAccountToken('twitter')

    // Twitter API v2 endpoint
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: post.content
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Twitter API error: ${JSON.stringify(error)}`)
    }

    const data = await response.json()

    // Update social_posts status
    const supabase = getServerSupabase()
    await supabase.from('social_posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      post_url: `https://twitter.com/user/status/${data.data.id}`,
      metadata: {
        ...post.metadata,
        platform_post_id: data.data.id
      }
    }).eq('id', postId)

    console.log('[SOCIAL PUBLISHER] Twitter post published:', data.data.id)

    return {
      platform_post_id: data.data.id,
      platform_url: `https://twitter.com/user/status/${data.data.id}`,
      published_at: new Date().toISOString()
    }
  } catch (error: any) {
    console.error('[SOCIAL PUBLISHER] Twitter error:', error)
    throw new Error(`Failed to publish to Twitter: ${error.message}`)
  }
}

/**
 * Publish post to Facebook Page
 * Requires Page Access Token
 */
export async function publishToFacebook(postId: string): Promise<PublishResult> {
  console.log('[SOCIAL PUBLISHER] Publishing to Facebook:', postId)

  try {
    const post = await fetchPostFromDB(postId)
    const account = await getSocialAccountToken('facebook')
    const pageId = account.metadata.page_id

    if (!pageId) {
      throw new Error('Facebook Page ID not configured')
    }

    // Facebook Graph API
    const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: post.content,
        access_token: account.access_token
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Facebook API error: ${JSON.stringify(error)}`)
    }

    const data = await response.json()

    // Update social_posts status
    const supabase = getServerSupabase()
    await supabase.from('social_posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      post_url: `https://facebook.com/${data.id}`,
      metadata: {
        ...post.metadata,
        platform_post_id: data.id
      }
    }).eq('id', postId)

    console.log('[SOCIAL PUBLISHER] Facebook post published:', data.id)

    return {
      platform_post_id: data.id,
      platform_url: `https://facebook.com/${data.id}`,
      published_at: new Date().toISOString()
    }
  } catch (error: any) {
    console.error('[SOCIAL PUBLISHER] Facebook error:', error)
    throw new Error(`Failed to publish to Facebook: ${error.message}`)
  }
}

/**
 * Publish post to Instagram Business Account
 * Requires Instagram Business Account linked to Facebook Page
 * Instagram API requires 2-step: create container, then publish
 */
export async function publishToInstagram(postId: string): Promise<PublishResult> {
  console.log('[SOCIAL PUBLISHER] Publishing to Instagram:', postId)

  try {
    const post = await fetchPostFromDB(postId)
    const account = await getSocialAccountToken('instagram')
    const instagramAccountId = account.metadata.instagram_account_id

    if (!instagramAccountId) {
      throw new Error('Instagram Business Account ID not configured')
    }

    // Check if post has image URL
    if (!post.media_urls || post.media_urls.length === 0) {
      throw new Error('Instagram posts require at least one image URL')
    }

    const imageUrl = post.media_urls[0]

    // Step 1: Create container
    const containerResponse = await fetch(
      `https://graph.facebook.com/v18.0/${instagramAccountId}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: post.content,
          access_token: account.access_token
        })
      }
    )

    if (!containerResponse.ok) {
      const error = await containerResponse.json()
      throw new Error(`Instagram container error: ${JSON.stringify(error)}`)
    }

    const containerData = await containerResponse.json()

    // Step 2: Publish container
    const publishResponse = await fetch(
      `https://graph.facebook.com/v18.0/${instagramAccountId}/media_publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: account.access_token
        })
      }
    )

    if (!publishResponse.ok) {
      const error = await publishResponse.json()
      throw new Error(`Instagram publish error: ${JSON.stringify(error)}`)
    }

    const data = await publishResponse.json()

    // Update social_posts status
    const supabase = getServerSupabase()
    await supabase.from('social_posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      post_url: `https://instagram.com/p/${data.id}`,
      metadata: {
        ...post.metadata,
        platform_post_id: data.id,
        container_id: containerData.id
      }
    }).eq('id', postId)

    console.log('[SOCIAL PUBLISHER] Instagram post published:', data.id)

    return {
      platform_post_id: data.id,
      platform_url: `https://instagram.com/p/${data.id}`,
      published_at: new Date().toISOString()
    }
  } catch (error: any) {
    console.error('[SOCIAL PUBLISHER] Instagram error:', error)
    throw new Error(`Failed to publish to Instagram: ${error.message}`)
  }
}

/**
 * Get post details (for preview/debugging)
 */
export async function getPostDetails(postId: string) {
  console.log('[SOCIAL PUBLISHER] Fetching post:', postId)
  return await fetchPostFromDB(postId)
}
```

**Dependencies:**
```bash
# No new dependencies needed - using native fetch
```

---

### Task 3.2: Implement Social Media Handler

**File to Update:** `services/execution-handlers/social-handler.ts`

**Current State:** Stub implementation that returns "not implemented" error

**New Implementation:**

```typescript
/**
 * Social Media Agent Execution Handler
 *
 * Handles social media publishing tasks for the Social Media Agent.
 * Phase 3: Full implementation with multi-platform support.
 */

import type { Task } from '@/types/squad'
import { publishToTwitter, publishToFacebook, publishToInstagram } from '@/services/integrations/social-publisher'
import { getServerSupabase } from '@/lib/supabase'
import { logToSquadMessages } from '@/lib/logger'

const DRY_RUN = process.env.AGENT_DRY_RUN === 'true'

interface ExecutionResult {
  success: boolean
  deliverable_url?: string
  error?: string
}

/**
 * Execute social media publishing task
 */
export async function socialPublishHandler(task: Task): Promise<ExecutionResult> {
  console.log('[SOCIAL HANDLER] Executing task:', task.title)

  if (DRY_RUN) {
    console.log('[DRY RUN] Would publish social post:', task.metadata)
    await logToSquadMessages(
      'Social Media Agent',
      `[DRY RUN] Would publish post: ${task.title}`,
      task.metadata
    )
    return {
      success: true,
      deliverable_url: '/social-posts/dry-run-preview',
    }
  }

  try {
    const supabase = getServerSupabase()

    // Get post metadata
    const postId = task.metadata?.post_id
    const platform = task.metadata?.platform

    if (!postId || !platform) {
      throw new Error('Missing post_id or platform in task metadata')
    }

    console.log(`[SOCIAL HANDLER] Publishing to ${platform}:`, postId)

    let result

    // Publish to appropriate platform
    switch (platform.toLowerCase()) {
      case 'twitter':
      case 'x':
        result = await publishToTwitter(postId)
        break

      case 'facebook':
        result = await publishToFacebook(postId)
        break

      case 'instagram':
        result = await publishToInstagram(postId)
        break

      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }

    // Log success
    await logToSquadMessages(
      'Social Media Agent',
      `✅ Post published to ${platform}: ${result.platform_url}`,
      {
        post_id: postId,
        platform,
        platform_post_id: result.platform_post_id,
        platform_url: result.platform_url
      }
    )

    return {
      success: true,
      deliverable_url: result.platform_url || `/social-posts/${postId}`
    }
  } catch (error: any) {
    console.error('[SOCIAL HANDLER] Error:', error)

    // Log error to squad messages
    await logToSquadMessages(
      'Social Media Agent',
      `❌ Failed to publish post: ${error.message}`,
      { task_id: task.id, error: error.message }
    )

    return {
      success: false,
      error: error.message
    }
  }
}
```

---

### Task 3.3: Create Social Media Publishing Endpoint

**New File:** `app/api/agents/social/publish/route.ts`

**Purpose:** Direct endpoint for publishing social media posts

**Implementation:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { publishToTwitter, publishToFacebook, publishToInstagram } from '@/services/integrations/social-publisher'
import { getServerSupabase } from '@/lib/supabase'
import { logToSquadMessages } from '@/lib/logger'

/**
 * Social Media Publishing Endpoint
 *
 * Handles publishing social media posts via platform APIs.
 * Can be called manually or by the task executor.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { post_id, platform } = await request.json()

    if (!post_id || !platform) {
      return NextResponse.json(
        { error: 'Missing post_id or platform' },
        { status: 400 }
      )
    }

    const supabase = getServerSupabase()

    // Get post details
    const { data: post, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', post_id)
      .single()

    if (error || !post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    console.log(`[SOCIAL PUBLISH] Publishing to ${platform}:`, post_id)

    let result

    // Publish to appropriate platform
    switch (platform.toLowerCase()) {
      case 'twitter':
      case 'x':
        result = await publishToTwitter(post_id)
        break

      case 'facebook':
        result = await publishToFacebook(post_id)
        break

      case 'instagram':
        result = await publishToInstagram(post_id)
        break

      default:
        return NextResponse.json(
          { error: `Unsupported platform: ${platform}` },
          { status: 400 }
        )
    }

    // Mark related task as completed
    const { data: task } = await supabase
      .from('squad_tasks')
      .select('id')
      .eq('metadata->>post_id', post_id)
      .single()

    if (task) {
      await supabase.from('squad_tasks').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        deliverable_url: result.platform_url || `/social-posts/${post_id}`
      }).eq('id', task.id)
    }

    await logToSquadMessages(
      'social_agent',
      `✅ Post published to ${platform}`,
      {
        post_id,
        platform,
        platform_post_id: result.platform_post_id,
        platform_url: result.platform_url
      }
    )

    return NextResponse.json({
      success: true,
      platform_post_id: result.platform_post_id,
      platform_url: result.platform_url,
      post_id
    })
  } catch (error: any) {
    console.error('[SOCIAL PUBLISH] Error:', error)

    await logToSquadMessages(
      'social_agent',
      `❌ Failed to publish post: ${error.message}`,
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
    endpoint: '/api/agents/social/publish',
    method: 'POST',
    required_fields: ['post_id', 'platform'],
    supported_platforms: ['twitter', 'facebook', 'instagram']
  })
}
```

---

### Task 3.4: Create Social Accounts Table (if not exists)

**Database Migration:** Add to existing migrations or create new one

**SQL to Run in Supabase SQL Editor:**

```sql
-- Social accounts table for storing platform credentials
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(platform, is_active)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform_active
  ON social_accounts(platform, is_active);

-- RLS policies (disable for service role access)
ALTER TABLE social_accounts DISABLE ROW LEVEL SECURITY;

-- Sample data structure (DO NOT INSERT - just for reference)
-- INSERT INTO social_accounts (platform, access_token, metadata) VALUES
-- ('twitter', 'YOUR_TWITTER_ACCESS_TOKEN', '{"username": "audico_sa"}'),
-- ('facebook', 'YOUR_FB_PAGE_TOKEN', '{"page_id": "YOUR_PAGE_ID", "page_name": "Audico"}'),
-- ('instagram', 'YOUR_IG_TOKEN', '{"instagram_account_id": "YOUR_IG_ID"}');
```

---

## 🔧 OAuth Setup Required

### Twitter/X Setup (Already Configured)

Your Twitter OAuth 2.0 is already configured with:
- `TWITTER_CLIENT_ID`
- `TWITTER_CLIENT_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_REFRESH_TOKEN`

Just need to add credentials to `social_accounts` table.

---

### Facebook Page Setup

**Step 1: Create Facebook App**
1. Go to https://developers.facebook.com/apps
2. Click "Create App"
3. Choose "Business" type
4. Add "Facebook Login" and "Pages API" products

**Step 2: Get Page Access Token**
1. Go to Graph API Explorer: https://developers.facebook.com/tools/explorer
2. Select your app
3. Click "Get Token" → "Get Page Access Token"
4. Select the page you want to post to
5. Grant permissions: `pages_manage_posts`, `pages_read_engagement`
6. Copy the Page Access Token

**Step 3: Get Long-Lived Page Token**
```bash
# Exchange short-lived token for long-lived token
curl "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN"
```

**Step 4: Store in Database**
```sql
INSERT INTO social_accounts (platform, access_token, metadata)
VALUES (
  'facebook',
  'YOUR_LONG_LIVED_PAGE_TOKEN',
  '{"page_id": "YOUR_PAGE_ID", "page_name": "Audico"}'
);
```

---

### Instagram Business Setup

**Prerequisites:**
- Facebook Page (from above)
- Instagram Business Account
- Instagram account linked to Facebook Page

**Step 1: Link Instagram to Facebook Page**
1. Go to your Facebook Page → Settings → Instagram
2. Click "Connect Account"
3. Log in to your Instagram Business account
4. Authorize the connection

**Step 2: Get Instagram Business Account ID**
```bash
# Get Instagram account ID
curl "https://graph.facebook.com/v18.0/me/accounts?access_token=YOUR_PAGE_TOKEN"

# Then get Instagram account from page
curl "https://graph.facebook.com/v18.0/PAGE_ID?fields=instagram_business_account&access_token=YOUR_PAGE_TOKEN"
```

**Step 3: Store in Database**
```sql
INSERT INTO social_accounts (platform, access_token, metadata)
VALUES (
  'instagram',
  'YOUR_PAGE_TOKEN', -- Same token as Facebook Page
  '{"instagram_account_id": "YOUR_IG_BUSINESS_ID", "page_id": "YOUR_PAGE_ID"}'
);
```

---

## 🧪 Testing Checklist for Phase 3

### Step 1: Setup Credentials

```bash
# 1. Add Facebook/Instagram credentials to Vercel environment variables
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...

# 2. Insert social account credentials in Supabase SQL Editor
# (Run SQL from Task 3.4 above)

# 3. Verify credentials are active
SELECT platform, is_active FROM social_accounts;
```

---

### Step 2: Deploy Phase 3 Code

```bash
# 1. Ensure Phase 1 & 2 are deployed
git push origin main

# 2. Verify task executor is running
# Check Vercel logs for: [TASK EXECUTOR] Polling for executable tasks...

# 3. Verify environment variables set
AGENT_DRY_RUN=true  # Keep true for testing!
```

---

### Step 3: Test Social Publishing (Dry Run)

```bash
# 1. Create a test social post in Supabase
INSERT INTO social_posts (platform, content, status, metadata)
VALUES (
  'twitter',
  'Test post from Mission Control! 🚀 #testing',
  'draft',
  '{}'
);

# 2. Create approval task manually
INSERT INTO squad_tasks (
  title,
  description,
  status,
  assigned_agent,
  priority,
  requires_approval,
  metadata
)
VALUES (
  'Approve Twitter post',
  'Test post for Phase 3 validation',
  'new',
  'Social Media Agent',
  'medium',
  true,
  '{"post_id": "POST_ID_FROM_ABOVE", "platform": "twitter"}'
);

# 3. Approve the task
POST /api/tasks/TASK_ID/approve

# 4. Wait 2 minutes for task executor
# Check logs for: [DRY RUN] Would publish post: ...

# 5. Verify task marked as completed
SELECT status, deliverable_url FROM squad_tasks WHERE id='TASK_ID';
```

---

### Step 4: Test Real Publishing (Twitter First)

```bash
# ONLY after dry-run succeeds:
# 1. Set AGENT_DRY_RUN=false in Vercel

# 2. Create real test post
INSERT INTO social_posts (platform, content, status)
VALUES ('twitter', 'Hello from Audico Mission Control! 🤖', 'draft');

# 3. Create approval task (same as above)

# 4. Approve task

# 5. Check Twitter - post should be published!

# 6. Verify in database
SELECT status, post_url FROM social_posts WHERE id='POST_ID';
# Should show status='published' and post_url with Twitter URL
```

---

### Step 5: Test Facebook Publishing

```bash
# 1. Create Facebook test post
INSERT INTO social_posts (platform, content, status)
VALUES ('facebook', 'Testing Facebook posting from Mission Control! 📱', 'draft');

# 2-4. Same approval flow as Twitter

# 5. Check Facebook Page - post should be visible

# 6. Verify post_url in database
```

---

### Step 6: Test Instagram Publishing

**IMPORTANT:** Instagram requires image URLs

```bash
# 1. Upload test image to cloud storage (or use existing product image)
# Get public URL like: https://yourdomain.com/images/test.jpg

# 2. Create Instagram test post WITH image
INSERT INTO social_posts (
  platform,
  content,
  status,
  media_urls
)
VALUES (
  'instagram',
  'New products available! 🛒 #audico #electronics',
  'draft',
  '["https://yourdomain.com/images/product.jpg"]'
);

# 3-4. Same approval flow

# 5. Check Instagram - post should appear

# 6. Verify in database
```

---

## 📊 Success Metrics for Phase 3

**Week 1:**
- ✅ Social publisher service functional
- ✅ Social handler executes successfully
- ✅ At least 3 test posts published (one per platform)
- ✅ Approval workflow tested and working

**Week 2:**
- ✅ 5+ posts published per week
- ✅ All posts go through approval flow
- ✅ <5% post publication failure rate
- ✅ All post URLs tracked correctly
- ✅ Platform engagement metrics visible

---

## 🚨 Important Notes

### Approval Requirements

**ALL social posts require approval** - Never auto-publish:
- Social media is highly visible
- Mistakes can damage brand reputation
- Need human oversight for tone and content

**Approval Flow:**
1. Social agent creates post → saves as draft
2. Creates approval task with `requires_approval=true`
3. Kenny reviews and approves in dashboard
4. Task executor publishes → marks task complete
5. Post URL captured in deliverable_url

---

### Rate Limits

**Platform Limits:**
- Twitter: 300 posts/3 hours = ~100/hour
- Facebook: No official limit, but ~50/day recommended
- Instagram: 25 posts/day for Business accounts

**Our Limits (configured in rate-limiter.ts):**
```typescript
social_publish: {
  agentName: 'social_publish',
  maxExecutions: 20,
  windowSeconds: 86400  // 20 posts per day
}
```

---

### Media Requirements

**Twitter:**
- Text only: Up to 280 characters
- Images: Optional, up to 4 images
- Video: Supported via separate API

**Facebook:**
- Text: No strict limit
- Images: Optional, up to 10 images
- Video: Supported

**Instagram:**
- Text: Up to 2,200 characters
- Images: **REQUIRED** - at least 1 image
- Image format: JPG or PNG
- Image size: Min 320px, recommended 1080px
- Aspect ratio: 1:1 (square), 4:5 (portrait), or 1.91:1 (landscape)

---

### Error Handling

**Common Errors:**
1. **Invalid access token** → Check token hasn't expired
2. **Instagram: Missing image** → Verify media_urls contains valid URL
3. **Rate limit exceeded** → Wait for window to reset
4. **Platform API down** → Retry with backoff (handled by task executor)

---

## 🎯 Next Steps After Phase 3

Once Phase 3 is complete and stable:

**Phase 4: Marketing & Newsletters**
- Implement Brevo newsletter integration
- Create newsletter sending endpoint
- Implement influencer outreach
- Add newsletter distribution tracking

**Phase 5: SEO & Ads**
- Implement OpenCart SEO updater
- Create SEO fix application endpoint
- Add Google Ads integration (optional)
- Apply SEO recommendations automatically

**Phase 6: Dashboard UI**
- Build approval queue component
- Add execution log display
- Create deliverable gallery
- Real-time updates via Supabase subscriptions

---

## 📞 Questions or Issues?

If you encounter any issues during Phase 3 implementation:

1. Check Phase 1 & 2 are deployed correctly (task executor running)
2. Verify social account credentials are in database
3. Check platform access tokens haven't expired
4. Test in dry-run mode first
5. Review agent_logs table for errors
6. Check platform API status pages

**Handover Complete!** Phase 3 is ready to implement. Good luck! 🚀

---

## 📁 Files to Create/Modify

**New Files (3):**
1. `services/integrations/social-publisher.ts` - Social media publishing service
2. `app/api/agents/social/publish/route.ts` - Publishing endpoint
3. `app/api/agents/social/publish/.gitkeep` - Ensure directory exists

**Modified Files (1):**
4. `services/execution-handlers/social-handler.ts` - Update from stub to full implementation

**Database:**
5. Create `social_accounts` table in Supabase (SQL provided above)

**Total:** 5 changes

---

## 🎁 Ready for New Chat

This document contains everything needed to implement Phase 3:
- ✅ Complete code for all 3 tasks
- ✅ OAuth setup instructions for Facebook & Instagram
- ✅ Database schema for social accounts
- ✅ Comprehensive testing checklist
- ✅ Success metrics and validation steps
- ✅ Error handling and troubleshooting
- ✅ Clear file list (3 new, 1 modified)

**Implementation order:**
1. Create social-publisher.ts service
2. Update social-handler.ts implementation
3. Create social/publish endpoint
4. Setup Facebook/Instagram OAuth
5. Create social_accounts table
6. Test in dry-run mode
7. Test real publishing (Twitter → Facebook → Instagram)
8. Monitor and refine

Good luck with Phase 3! 🎉
