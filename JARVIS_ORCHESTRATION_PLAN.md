# Jarvis Full Squad Orchestration Plan

## Goal
Make Jarvis the true orchestrator of ALL agents, not just the email pipeline. Every agent should produce real, visible work autonomously.

---

## Current State (Feb 11, 2026)

### What's ACTUALLY Working Autonomously
| Agent | Status | Cron | Real Output |
|-------|--------|------|-------------|
| **Email Agent** | WORKING | Poll 15m, Classify 20m | Polls Gmail, classifies, creates drafts |
| **Jarvis** | WORKING (email only) | 10m | Processes classified emails, creates tasks |
| **Task Executor** | WORKING | 2m | Executes approved/auto-send tasks |

### What's Built But NOT Running Autonomously
| Agent | Code Status | Why It's Idle |
|-------|------------|---------------|
| **Social Media Agent** | Real Twitter/FB/IG API code in `social-handler.ts` and `social-publisher.ts` | No cron trigger. No content generation. Only executes if Jarvis creates a task, and Jarvis Phase 2 only runs when `order_tracker` has data |
| **SEO Agent** | Full handler with 7+ actions in `seo-handler.ts`, PageSpeed API, Claude AI | No cron trigger. Same Jarvis dependency |
| **Marketing Agent** | Brevo newsletter + influencer outreach in `marketing-handler.ts` | No cron trigger. Same Jarvis dependency |
| **Google Ads Agent** | STUB - `ads-handler.ts` returns "not implemented" | Placeholder only, Phase 5 |

### Why Jarvis Doesn't Create Tasks for Other Agents
Jarvis Phase 2 (the AI orchestration) only runs when `order_tracker` has pending orders:
```typescript
// app/api/agents/jarvis/orchestrate/route.ts line 262
if (pendingOrders > 0) {
  // Only THEN does Claude AI get called to suggest tasks
}
```
If `order_tracker` is empty (likely), Phase 2 never fires = no tasks for Social/SEO/Marketing agents.

---

## The Plan: 3 Phases

### Phase 1: Make Jarvis a Real Orchestrator (Priority: HIGH)

**Goal:** Jarvis should analyze ALL data sources every cycle and create tasks for every agent, not just emails.

#### 1A. Remove the `order_tracker` gate
Jarvis Phase 2 should ALWAYS run, not just when there are pending orders. Replace the gate with a broader data collection:

```typescript
// CURRENT (broken - Phase 2 only runs if orders exist):
if (pendingOrders > 0) { /* call Claude */ }

// NEW (always analyze all data sources):
// Always run Phase 2 - analyze all available data
const situationReport = {
  // Email stats (already processed in Phase 1)
  emails_just_processed: emailResults.processed,
  emails_responded: emailResults.responded,

  // Social media status
  recent_posts: /* query social_posts last 7 days */,
  days_since_last_post: /* calculate */,

  // SEO health
  seo_audit_age: /* days since last full audit */,
  products_without_schema: /* count from seo_schema_audits */,

  // Marketing pipeline
  pending_reseller_apps: /* count from reseller_applications where status='pending' */,
  newsletter_due: /* days since last newsletter_drafts where status='sent' */,

  // Orders (keep existing)
  pending_orders: pendingOrders,

  // Active tasks (prevent duplicates)
  active_tasks: existingTasks.data?.map(t => ({
    title: t.title,
    assigned_to: t.assigned_agent,
    status: t.status,
  })),
}
```

#### 1B. Enhance Jarvis AI prompt
Give Claude better context about what each agent CAN do and WHEN to trigger them:

**Social Media Agent triggers:**
- No post in 2+ days → "Generate and schedule social media posts"
- New product added → "Create product announcement posts"
- Engagement dropping → "Create engagement-boosting content"

**SEO Agent triggers:**
- No full audit in 30+ days → "Run full SEO audit"
- Products without Schema.org → "Generate schema for untagged products"
- Core Web Vitals degraded → "Check and report on Core Web Vitals"

**Marketing Agent triggers:**
- Pending reseller applications → "Process reseller application for [company]"
- No newsletter in 14+ days → "Generate newsletter draft"
- Influencer opportunities not contacted → "Send influencer outreach"

**Google Ads Agent triggers:**
- Skip for now (handler not implemented)

#### 1C. Add data source queries to Jarvis
The orchestrator needs to query these tables each cycle:
- `social_posts` - last post date, post frequency
- `seo_audits` - last audit date, avg score
- `seo_schema_audits` - products without schema
- `reseller_applications` - pending count
- `newsletter_drafts` - last sent date
- `influencer_opportunities` - un-contacted count

#### Files to modify:
- `app/api/agents/jarvis/orchestrate/route.ts` - Main orchestrator logic

---

### Phase 2: Social Media Agent Autonomy (Priority: HIGH)

**Goal:** Social Media Agent generates and publishes content automatically.

#### 2A. Create a Social Media content generation cron route
**New file:** `app/api/agents/social/generate/route.ts`

This route should:
1. Query recent products from OpenCart (or `order_tracker` for trending items)
2. Use Claude AI to generate platform-appropriate posts
3. Insert drafts into `social_posts` table with status='scheduled'
4. Optionally auto-publish to connected platforms

**Cron schedule:** Daily at 9 AM SAST (`0 7 * * *` UTC)

#### 2B. Ensure social_accounts table is populated
The social publisher needs OAuth tokens stored in `social_accounts`:
```sql
-- Check what exists
SELECT * FROM social_accounts;

-- If empty, insert connected accounts:
INSERT INTO social_accounts (platform, account_name, access_token, refresh_token, metadata, status)
VALUES
  ('twitter', 'AudicoSA', '<TWITTER_BEARER_TOKEN>', null, '{"user_id": "..."}', 'active');
```

#### 2C. Environment variables needed
Already have `TWITTER_*` credentials in Vercel. Need to verify:
- `TWITTER_API_KEY`, `TWITTER_API_SECRET`
- `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`
- Facebook Page token (if using FB)
- Instagram Business Account token (if using IG)

#### Files to create/modify:
- `app/api/agents/social/generate/route.ts` (NEW - content generation cron)
- `vercel.json` - Add social generate cron
- Verify `social_accounts` table has data

---

### Phase 3: SEO Agent Autonomy (Priority: MEDIUM)

**Goal:** SEO Agent runs scheduled audits and applies fixes automatically.

#### 3A. Create SEO audit cron route
**New file:** `app/api/agents/seo/audit/route.ts`

This route should:
1. Run a full product audit on a rotating batch (e.g., 10 products per run)
2. Check Core Web Vitals for the main site
3. Generate Schema.org markup for products missing it
4. Store results in `seo_audits`, `seo_vitals`, `seo_schema_audits`
5. Create tasks for fixes that need approval

**Cron schedule:** Weekly on Monday at 6 AM SAST (`0 4 * * 1` UTC)

#### 3B. Verify OpenCart database connection
SEO agent needs to read product data. Check:
- `OPENCART_DB_HOST`, `OPENCART_DB_USER`, `OPENCART_DB_PASSWORD`, `OPENCART_DB_NAME`
- These are already in Vercel env vars per MEMORY.md

#### 3C. Verify PageSpeed API key
For Core Web Vitals monitoring:
- `PAGESPEED_API_KEY` or uses default (limited) quota

#### Files to create/modify:
- `app/api/agents/seo/audit/route.ts` (NEW - scheduled audit cron)
- `vercel.json` - Add SEO audit cron

---

### Phase 4: Marketing Agent Autonomy (Priority: MEDIUM)

**Goal:** Marketing Agent processes reseller apps and sends newsletters on schedule.

#### 4A. Create Marketing check cron route
**New file:** `app/api/agents/marketing/check/route.ts`

This route should:
1. Check for pending reseller applications → create processing tasks
2. Check if newsletter is overdue (14+ days) → generate draft
3. Check for un-contacted influencers → create outreach tasks

**Cron schedule:** Daily at 10 AM SAST (`0 8 * * *` UTC)

#### 4B. Verify Brevo setup
- `BREVO_API_KEY` env var in Vercel
- `BREVO_LIST_ID` for subscriber list
- Test connection via `/api/agents/marketing?action=test_brevo`

#### Files to create/modify:
- `app/api/agents/marketing/check/route.ts` (NEW - daily marketing check)
- `vercel.json` - Add marketing check cron

---

## Updated vercel.json Cron Schedule

```json
{
  "crons": [
    { "path": "/api/cron/tasks/execute", "schedule": "*/2 * * * *" },
    { "path": "/api/agents/jarvis/orchestrate", "schedule": "*/10 * * * *" },
    { "path": "/api/agents/email/poll", "schedule": "*/15 * * * *" },
    { "path": "/api/agents/email/classify", "schedule": "*/20 * * * *" },
    { "path": "/api/agents/social/generate", "schedule": "0 7 * * *" },
    { "path": "/api/agents/seo/audit", "schedule": "0 4 * * 1" },
    { "path": "/api/agents/marketing/check", "schedule": "0 8 * * *" },
    { "path": "/api/cron/stock/check", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/analytics/update", "schedule": "0 0 * * *" },
    { "path": "/api/cron/maintenance/cleanup", "schedule": "0 2 * * *" }
  ]
}
```

---

## Implementation Order

### Sprint 1: Jarvis Brain Upgrade (1 session)
1. Remove `order_tracker` gate from Jarvis Phase 2
2. Add data source queries (social_posts, seo_audits, reseller_applications, newsletter_drafts, influencer_opportunities)
3. Enhance Claude AI prompt with trigger conditions for each agent
4. Test by hitting Jarvis orchestrate endpoint manually
5. Verify tasks appear on dashboard for each agent

### Sprint 2: Social Media Autonomy (1 session)
1. Create `social/generate` cron route with Claude AI content generation
2. Verify `social_accounts` table populated with Twitter credentials
3. Add cron to vercel.json
4. Test: trigger generate → verify draft appears → approve → verify published to Twitter
5. Set up Facebook/Instagram if credentials available

### Sprint 3: SEO + Marketing Autonomy (1 session)
1. Create `seo/audit` cron route
2. Create `marketing/check` cron route
3. Add both crons to vercel.json
4. Verify OpenCart DB connection for SEO product data
5. Verify Brevo API for newsletters
6. Test both pipelines end-to-end

### Sprint 4: Dashboard Polish (1 session)
1. Add Jarvis activity summary card to dashboard (shows what Jarvis decided and why)
2. Add agent-specific work views (deliverable previews for each agent type)
3. Add "Jarvis reasoning" display for AI-created tasks
4. Clean up seed tasks from migration 006

---

## Database Tables to Verify Exist

Run in Supabase SQL Editor to check:
```sql
-- Tables required for full orchestration
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'email_logs', 'squad_tasks', 'squad_agents', 'squad_messages',
  'social_posts', 'social_accounts',
  'seo_audits', 'seo_vitals', 'seo_schema_audits', 'seo_geo_analysis',
  'reseller_applications', 'approved_resellers',
  'newsletter_drafts', 'influencer_opportunities', 'outreach_tracking',
  'order_tracker', 'agent_logs', 'agent_configs',
  'alerts', 'dashboard_notifications', 'execution_snapshots'
)
ORDER BY table_name;
```

---

## Environment Variables Checklist

### Already configured (Vercel):
- [x] `REDIS_URL`
- [x] `CRON_SECRET`
- [x] `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_REDIRECT_URI`
- [x] `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] `NEXT_PUBLIC_SITE_URL`
- [x] `ANTHROPIC_API_KEY`
- [x] `OPENCART_DB_*` credentials
- [x] `TWITTER_*` credentials

### Need to verify/add:
- [ ] `BREVO_API_KEY` - For newsletter sending
- [ ] `BREVO_LIST_ID` - Subscriber list ID
- [ ] `PAGESPEED_API_KEY` - For Core Web Vitals (optional, has free tier)
- [ ] `FACEBOOK_PAGE_TOKEN` - For Facebook posting (if desired)
- [ ] `INSTAGRAM_BUSINESS_TOKEN` - For Instagram posting (if desired)

---

## SQL Migrations Pending

### CRITICAL - Run BEFORE starting implementation:
```sql
-- 1. Add 'internal' to email category constraint
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_category_check;
UPDATE email_logs SET category = 'other'
WHERE category IS NULL
   OR category NOT IN ('unclassified', 'order', 'support', 'inquiry', 'complaint', 'spam', 'internal', 'other');
ALTER TABLE email_logs ADD CONSTRAINT email_logs_category_check
  CHECK (category IN ('unclassified', 'order', 'support', 'inquiry', 'complaint', 'spam', 'internal', 'other'));
NOTIFY pgrst, 'reload schema';
```

### Verify these tables exist (from migration 003):
- `social_posts` - Social media content
- `seo_audits` - SEO audit results
- `reseller_applications` - Reseller program
- `newsletter_drafts` - Newsletter queue
- `influencer_opportunities` - Influencer tracking

### May need to create:
- `social_accounts` - Connected social platform credentials
- `outreach_tracking` - Influencer outreach history
- `seo_vitals` - Core Web Vitals data
- `seo_schema_audits` - Schema.org audit results
- `seo_geo_analysis` - AI search visibility

---

## Architecture Summary

```
                    ┌─────────────────┐
                    │   Vercel Cron    │
                    │   (GET requests) │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
        │Email Poll  │ │  Jarvis   │ │  Agent    │
        │  (15m)     │ │ Orchestr. │ │  Crons    │
        │Email Class │ │  (10m)    │ │(Social/   │
        │  (20m)     │ │           │ │ SEO/Mktg) │
        └─────┬──────┘ └─────┬─────┘ └─────┬─────┘
              │              │              │
              │    ┌─────────▼─────────┐    │
              └───►│  squad_tasks      │◄───┘
                   │  (task queue)     │
                   └─────────┬─────────┘
                             │
                   ┌─────────▼─────────┐
                   │  Task Executor    │
                   │  (every 2 min)    │
                   └─────────┬─────────┘
                             │
              ┌──────┬───────┼───────┬──────┐
              │      │       │       │      │
           ┌──▼──┐┌──▼──┐┌──▼──┐┌──▼──┐┌──▼──┐
           │Email││Social││ SEO ││Mktg ││ Ads │
           │Send ││Pub.  ││Fix  ││News ││(TBD)│
           └─────┘└─────┘└─────┘└─────┘└─────┘
```

**Two paths to task creation:**
1. **Jarvis AI** - Analyzes all data sources, uses Claude to decide what tasks to create
2. **Agent Crons** - Each agent has its own scheduled check that creates tasks directly

Both paths feed into `squad_tasks` → Task Executor dispatches → Agent handlers execute.

---

## Key Principles
1. **Jarvis is the brain** - analyzes cross-agent data, makes strategic decisions
2. **Agent crons are the heartbeat** - ensure routine work happens even if Jarvis is rate-limited
3. **Task Executor is the muscle** - executes tasks every 2 minutes, handles retries
4. **squad_tasks is the single source of truth** - all work flows through the task queue
5. **Approval workflow** - sensitive tasks (complaints, newsletters, large actions) require Kenny's approval
6. **Learning from feedback** - rejected tasks teach the system what to skip
