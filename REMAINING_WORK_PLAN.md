# Remaining Work Plan - Post Phase 4

**Date:** February 10, 2026
**Status:** Phase 4 Complete ✅ | Phases 5-7 Remaining
**Estimated Timeline:** 2-3 weeks

---

## ✅ What's Already Complete

### Phase 1: Core Infrastructure ✅
- Task executor service (`services/task-executor.ts`)
- Approval workflow system
- Task execution cron job (every 2 minutes)
- Database execution tracking
- Alert service for failures

### Phase 2: Email Execution ✅
- Gmail sender service (`services/integrations/gmail-sender.ts`)
- Email sending endpoint (`app/api/agents/email/send/route.ts`)
- Email handler with auto-send logic
- Auto-send for FAQ/spam emails (1 hour delay)
- Approval workflow for customer emails

### Phase 3: Social Media Execution ✅
- Social media publisher service (`services/integrations/social-publisher.ts`)
- Social publishing endpoint (`app/api/agents/social/publish/route.ts`)
- OAuth credentials in database
- Twitter, Facebook, Instagram support
- Instagram 2-step container workflow

### Phase 4: Marketing & Newsletters ✅ (JUST COMPLETED)
- Brevo newsletter service (`services/integrations/brevo-service.ts`)
- Newsletter sending endpoint (`app/api/agents/marketing/send-newsletter/route.ts`)
- Influencer outreach endpoint (`app/api/agents/marketing/outreach/route.ts`)
- Marketing handler implementation
- Database tables: `newsletter_drafts`, `influencer_opportunities`, `outreach_tracking`
- Rate limiter updated

---

## 🎯 Remaining Work

### Phase 5: SEO & Ads Execution (Week 1-2)

**Priority:** HIGH
**Estimated Time:** 5-7 days
**Value:** Medium (SEO optimization, ad monitoring)

#### 5.1 OpenCart SEO Updater
**New File:** `services/integrations/opencart-updater.ts`

**What It Does:**
- Applies SEO fixes directly to OpenCart MySQL database
- Updates product meta descriptions, titles, keywords
- Adds image alt tags
- Handles bulk operations with approval for >10 products

**Key Functions:**
```typescript
- updateProductMeta(productId, meta)
- addImageAltTags(productId)
- bulkApplySEOFixes(auditId)
```

**Safety Rules:**
- Auto-apply if ≤10 products affected
- Require approval if >10 products
- Database snapshot before bulk operations
- Rollback mechanism on failure

**Database Required:**
- OpenCart MySQL connection (already configured)
- Tables: `oc_product_description`, `oc_product_image`

---

#### 5.2 SEO Fix Applicator Endpoint
**New File:** `app/api/agents/seo/apply-fixes/route.ts`

**What It Does:**
- Executes SEO fix application from audits
- Checks if approval required (>10 products)
- Creates approval task or auto-applies
- Marks related tasks as completed

**Flow:**
1. Fetch SEO audit from `seo_audits` table
2. Count recommendations
3. If >10: Create approval task
4. If ≤10: Apply fixes immediately
5. Update audit status to 'applied'
6. Mark task complete

---

#### 5.3 Google Ads Integration (OPTIONAL)
**New File:** `services/integrations/google-ads-service.ts`

**What It Does:**
- Monitors campaign performance
- Applies bid adjustments
- Auto-decreases bids (always safe)
- Requires approval for increases >10%

**Key Functions:**
```typescript
- getCampaignPerformance()
- applyBidAdjustment(campaignId, adjustment)
```

**Setup Required:**
1. Google Ads Manager account
2. OAuth credentials from Google Cloud Console
3. Refresh token via OAuth Playground
4. Environment variables:
   - `GOOGLE_ADS_CLIENT_ID`
   - `GOOGLE_ADS_CLIENT_SECRET`
   - `GOOGLE_ADS_DEVELOPER_TOKEN`
   - `GOOGLE_ADS_CUSTOMER_ID`
   - `GOOGLE_ADS_REFRESH_TOKEN`

**Safety Rules:**
- Bid decreases: Always auto-apply
- Bid increases <10%: Auto-apply
- Bid increases ≥10%: Require approval
- Budget changes: Always require approval
- Campaign pause: Always require approval

**Note:** This is OPTIONAL and can be deferred to Phase 8 if Google Ads Manager setup is complex.

---

### Phase 6: Dashboard & Monitoring (Week 2-3)

**Priority:** HIGH
**Estimated Time:** 5-7 days
**Value:** HIGH (Critical for Kenny's oversight)

#### 6.1 Approval Queue Component
**New Component:** `app/squad/components/ApprovalQueue.tsx`

**What It Does:**
- Displays all tasks requiring approval
- One-click approve/reject buttons
- Preview link to see draft/deliverable
- Real-time updates via Supabase subscriptions
- Shows count badge (e.g., "3 pending")

**Features:**
- Filter by agent (Email, Social, Marketing, etc.)
- Sort by priority (urgent first)
- Inline preview of email drafts, social posts, newsletters
- Bulk approve (select multiple, approve all)
- Rejection with reason field

**UI Example:**
```
┌─────────────────────────────────────────────┐
│ Pending Approvals (3)                       │
├─────────────────────────────────────────────┤
│ 🔴 URGENT: Approve complaint response       │
│ Customer: john@example.com                  │
│ [✅ Approve] [❌ Reject] [👁️ Preview]       │
├─────────────────────────────────────────────┤
│ 🟡 Approve social post to Twitter           │
│ Content: "New product launch... 🚀"         │
│ [✅ Approve] [❌ Reject] [👁️ Preview]       │
├─────────────────────────────────────────────┤
│ 🟢 Approve newsletter distribution          │
│ Subject: "February Newsletter"              │
│ [✅ Approve] [❌ Reject] [👁️ Preview]       │
└─────────────────────────────────────────────┘
```

---

#### 6.2 Execution Log Component
**New Component:** `app/squad/components/ExecutionLog.tsx`

**What It Does:**
- Shows recent agent activity in real-time
- Auto-refreshes every 5 seconds
- Color-coded by log level (info, warning, error)
- Filterable by agent
- Expandable details for errors

**Features:**
- Live tail of last 50 agent actions
- Timestamp with relative time ("2 mins ago")
- Agent avatar/icon
- Event type badge (email_sent, post_published, etc.)
- Error stack traces when expanded

**UI Example:**
```
┌─────────────────────────────────────────────┐
│ Recent Activity                              │
├─────────────────────────────────────────────┤
│ 2 mins ago  📧 Email Agent                   │
│ ✅ Email sent to customer@example.com        │
├─────────────────────────────────────────────┤
│ 5 mins ago  📱 Social Agent                  │
│ ✅ Post published to Twitter (id: 12345)     │
├─────────────────────────────────────────────┤
│ 10 mins ago 📊 SEO Agent                     │
│ ✅ Applied 5 SEO fixes to OpenCart           │
├─────────────────────────────────────────────┤
│ 15 mins ago 📧 Email Agent                   │
│ ❌ Failed to send email: Rate limit exceeded │
│    [View Details]                            │
└─────────────────────────────────────────────┘
```

---

#### 6.3 Deliverable Gallery Component
**New Component:** `app/squad/components/DeliverableGallery.tsx`

**What It Does:**
- Shows completed tasks with their deliverables
- Grid/list view toggle
- Preview thumbnails for social posts (with image)
- Links to Gmail sent messages, Twitter posts, etc.
- Filter by date, agent, task type

**Features:**
- Card view with preview image/text
- Click to open deliverable URL
- Copy link button
- Share button (copy to clipboard)
- Stats overlay (opens, clicks for emails/newsletters)

---

#### 6.4 Manual Control Endpoints

**Task Approval API:**
**New File:** `app/api/tasks/[id]/approve/route.ts`

```typescript
POST /api/tasks/123/approve
→ Sets approved_by='Kenny', approved_at=now
→ Allows task executor to execute
→ Logs approval to squad_messages
```

**Task Rejection API:**
**New File:** `app/api/tasks/[id]/reject/route.ts`

```typescript
POST /api/tasks/123/reject
Body: { reason: "Content needs revision" }
→ Sets status='rejected', rejected_by='Kenny'
→ Logs rejection reason
→ Notifies agent (via squad_messages)
```

**Agent Pause/Resume:**
**New File:** `app/api/agents/pause/route.ts`

```typescript
POST /api/agents/pause
→ Sets global_pause=true in agent_configs
→ Stops all agent execution immediately
→ Used for emergencies

POST /api/agents/resume
→ Sets global_pause=false
→ Resumes normal operations
```

**Rate Limit Reset:**
**New File:** `app/api/agents/rate-limit/reset/route.ts`

```typescript
POST /api/agents/rate-limit/reset
Body: { agent_name: "email_send" }
→ Resets rate limit counter for specific agent
→ Used when legitimate spike occurs
```

---

#### 6.5 Dashboard Stats Cards

**Add to `app/squad/page.tsx`:**

```typescript
<StatsOverview>
  <StatCard>
    <Label>Tasks Completed Today</Label>
    <Value>127</Value>
    <Change>+15% vs yesterday</Change>
  </StatCard>

  <StatCard>
    <Label>Pending Approvals</Label>
    <Value>3</Value>
    <Badge color="yellow">Needs attention</Badge>
  </StatCard>

  <StatCard>
    <Label>Success Rate</Label>
    <Value>98.3%</Value>
    <Change>+0.5% this week</Change>
  </StatCard>

  <StatCard>
    <Label>Agent Status</Label>
    <Value>5/5 Active</Value>
    <Badge color="green">All operational</Badge>
  </StatCard>
</StatsOverview>
```

---

### Phase 7: Safety & Testing (Week 3)

**Priority:** CRITICAL
**Estimated Time:** 3-5 days
**Value:** CRITICAL (Prevents disasters)

#### 7.1 Comprehensive Testing Checklist

**Email Auto-Send Test:**
- [ ] Send FAQ email to support@audicoonline.co.za
- [ ] Wait for poll (15min) + classify (20min) + respond
- [ ] Verify draft created in Gmail
- [ ] Wait 1 hour, verify auto-send occurred
- [ ] Check `email_logs.status='sent'` and task completed

**Email Approval Test:**
- [ ] Send complaint email
- [ ] Verify approval task created with `mentions_kenny=true`
- [ ] Approve via dashboard
- [ ] Verify email sent immediately
- [ ] Check deliverable URL links to Gmail

**Social Post Publishing Test:**
- [ ] Create social post draft
- [ ] Verify approval task created
- [ ] Approve in dashboard
- [ ] Verify post published to Twitter
- [ ] Check `social_posts.status='published'`
- [ ] Verify platform_url links to live tweet

**Newsletter Distribution Test:**
- [ ] Create newsletter draft
- [ ] Verify approval task created
- [ ] Approve in dashboard
- [ ] Verify sent via Brevo (check campaign stats)
- [ ] Check recipient count matches subscriber list

**SEO Minor Fixes Test:**
- [ ] Run SEO audit with <10 recommendations
- [ ] Verify fixes auto-applied to OpenCart
- [ ] Check `oc_product_description` table for updates
- [ ] Verify task completed with deliverable URL

**SEO Bulk Fixes Test:**
- [ ] Run SEO audit with >10 recommendations
- [ ] Verify approval task created
- [ ] Approve in dashboard
- [ ] Verify fixes applied
- [ ] Check audit status changed to 'applied'

**Task Completion Flow Test:**
- [ ] Verify tasks move: new → in_progress → completed
- [ ] Check task completion counter increases
- [ ] Verify `deliverable_url` populated
- [ ] Click deliverable URL, verify it works

**Dry-Run Mode Test:**
- [ ] Set `AGENT_DRY_RUN=true` in Vercel
- [ ] Create test tasks
- [ ] Verify logs show "[DRY RUN]" messages
- [ ] Verify NO actual emails/posts sent
- [ ] Check squad_messages for dry-run logs

**Rate Limiting Test:**
- [ ] Attempt to exceed email send limit (50/day)
- [ ] Verify rate limit error returned
- [ ] Check Redis keys for rate limit tracking
- [ ] Verify error logged to agent_logs

**Error Handling Test:**
- [ ] Simulate API failure (invalid token)
- [ ] Verify task retries 3 times
- [ ] Verify escalation after 3 failures
- [ ] Check alert created for Kenny

**Rollback Test:**
- [ ] Capture pre-execution snapshot
- [ ] Force execution error
- [ ] Verify rollback restores previous state
- [ ] Check execution_snapshots table

---

#### 7.2 Automated Test Suite

**New File:** `__tests__/task-executor.test.ts`

**Test Cases:**
1. `should execute approved email tasks`
2. `should create approval task for customer-facing emails`
3. `should retry failed tasks with backoff`
4. `should escalate after 3 failures`
5. `should respect rate limits`
6. `should handle dry-run mode correctly`
7. `should rollback on execution failure`
8. `should log all execution attempts`

**New File:** `__tests__/approval-workflow.test.ts`

**Test Cases:**
1. `should require approval for customer emails`
2. `should auto-approve FAQ responses`
3. `should require approval for all social posts`
4. `should require approval for newsletters`
5. `should require approval for bulk SEO (>10 products)`
6. `should create urgent escalation for complaints`

---

#### 7.3 Performance Testing

**Load Test:**
- Simulate 100+ tasks created simultaneously
- Verify task executor handles queue correctly
- Check for memory leaks
- Monitor Vercel function execution time

**Rate Limit Stress Test:**
- Create 60 email send tasks (exceeds 50/day limit)
- Verify first 50 execute, remaining 10 fail gracefully
- Check rate limiter returns correct remaining count

**Database Performance:**
- Query `squad_tasks` with 10,000+ records
- Verify indexes work (should return in <100ms)
- Test Supabase concurrent connections

---

#### 7.4 Security Audit

**Environment Variable Check:**
- [ ] All secrets in Vercel (not committed to git)
- [ ] `.env.example` has placeholders only
- [ ] CRON_SECRET is strong and unique

**API Endpoint Security:**
- [ ] All cron endpoints check `Authorization: Bearer ${CRON_SECRET}`
- [ ] Task approval endpoints require authentication
- [ ] Rate limiting applied to all execution endpoints

**Database Security:**
- [ ] RLS disabled on squad tables (service role access)
- [ ] Anon role has correct grants
- [ ] No SQL injection vulnerabilities

**OAuth Token Security:**
- [ ] Refresh tokens stored securely in database
- [ ] Access tokens rotated properly
- [ ] No tokens in logs

---

## 📁 File Summary

### Phase 5 Files (3 new)
1. ✅ `services/integrations/opencart-updater.ts` - SEO fix application
2. ✅ `app/api/agents/seo/apply-fixes/route.ts` - SEO fix endpoint
3. ⚠️ `services/integrations/google-ads-service.ts` - OPTIONAL (defer to Phase 8)

### Phase 6 Files (8 new)
1. ✅ `app/squad/components/ApprovalQueue.tsx` - Approval UI
2. ✅ `app/squad/components/ExecutionLog.tsx` - Activity log UI
3. ✅ `app/squad/components/DeliverableGallery.tsx` - Completed work gallery
4. ✅ `app/api/tasks/[id]/approve/route.ts` - Task approval
5. ✅ `app/api/tasks/[id]/reject/route.ts` - Task rejection
6. ✅ `app/api/agents/pause/route.ts` - Emergency stop
7. ✅ `app/api/agents/rate-limit/reset/route.ts` - Rate limit reset
8. ✅ `app/squad/page.tsx` - Enhanced with stats cards (MODIFY existing)

### Phase 7 Files (2 new)
1. ✅ `__tests__/task-executor.test.ts` - Core tests
2. ✅ `__tests__/approval-workflow.test.ts` - Approval tests

**Total Remaining:** 13 files (2-3 optional)

---

## 🚀 Implementation Order

### Week 1: Phase 5 (SEO & Ads)
**Days 1-3:** OpenCart SEO Updater
- Create `opencart-updater.ts` service
- Add `updateProductMeta`, `addImageAltTags`, `bulkApplySEOFixes`
- Test on staging OpenCart database

**Days 4-5:** SEO Fix Applicator
- Create `apply-fixes` endpoint
- Implement approval threshold (>10 products)
- Test with real SEO audit data

**Days 6-7:** Google Ads (OPTIONAL)
- Create `google-ads-service.ts` if Manager account ready
- Otherwise, defer to Phase 8

### Week 2: Phase 6 (Dashboard)
**Days 1-2:** Approval Queue Component
- Create `ApprovalQueue.tsx` with real-time subscriptions
- Add approve/reject buttons
- Connect to approval/reject endpoints

**Days 3-4:** Execution Log Component
- Create `ExecutionLog.tsx` with auto-refresh
- Query `agent_logs` table
- Add filtering and expandable details

**Days 5-7:** Manual Control Endpoints
- Create all 4 manual control endpoints
- Add emergency pause/resume
- Test each endpoint thoroughly

### Week 3: Phase 7 (Testing)
**Days 1-2:** Manual Testing
- Run complete testing checklist
- Fix any issues found
- Verify all flows work end-to-end

**Days 3-4:** Automated Tests
- Write Jest tests for task executor
- Write Jest tests for approval workflow
- Aim for >80% coverage

**Day 5:** Security & Performance
- Run security audit
- Load test with 100+ tasks
- Fix performance bottlenecks

---

## 🎯 Success Criteria

### Phase 5 Complete When:
- ✅ SEO fixes apply successfully to OpenCart
- ✅ Bulk operations (>10 products) require approval
- ✅ Minor fixes (<10 products) auto-apply
- ✅ Database rollback works if errors occur

### Phase 6 Complete When:
- ✅ Approval queue shows pending tasks in dashboard
- ✅ Execution log shows real-time agent activity
- ✅ Kenny can approve/reject tasks with one click
- ✅ Emergency pause stops all agents immediately
- ✅ Dashboard stats cards show accurate metrics

### Phase 7 Complete When:
- ✅ All manual tests pass
- ✅ Automated tests achieve >80% coverage
- ✅ Security audit passes
- ✅ Load test handles 100+ tasks without errors
- ✅ Ready for production rollout

---

## 🚨 Deployment Plan

### Pre-Deployment (Before Phase 5)
1. **Commit Phase 4 changes:**
   ```bash
   git add .
   git commit -m "Phase 4: Marketing & newsletters implementation"
   git push origin main
   ```

2. **Verify Phase 4 deployed:**
   - Check Vercel build logs
   - Test Brevo newsletter endpoint
   - Test influencer outreach endpoint
   - Run database migration 008

3. **Set up Brevo account:**
   - Get API key
   - Create subscriber list
   - Verify sender email
   - Add env vars to Vercel

### Deployment (Phases 5-7)
1. **Deploy incrementally:**
   - Push Phase 5 after testing in dry-run
   - Push Phase 6 components one at a time
   - Test each deployment before moving forward

2. **Monitor closely:**
   - Watch Vercel function logs
   - Check Supabase queries
   - Review agent_logs table
   - Monitor error rates

3. **Rollback plan:**
   - Keep previous deployment ready
   - Set `ENABLE_AUTO_EXECUTION=false` if needed
   - Use emergency pause endpoint

---

## 📊 Current Status

### ✅ Completed Phases (1-4)
- Core infrastructure: Task executor, approval workflow ✅
- Email execution: Gmail sender, auto-send logic ✅
- Social execution: Twitter, Facebook, Instagram ✅
- Marketing execution: Brevo newsletters, influencer outreach ✅

### 🔄 In Progress
- **Phase 4 deployment:** Needs git commit + push

### ⏳ Remaining Phases (5-7)
- Phase 5: SEO & Ads (5-7 days)
- Phase 6: Dashboard & Monitoring (5-7 days)
- Phase 7: Safety & Testing (3-5 days)

**Total Remaining Time:** 2-3 weeks

---

## 💡 Optional Future Enhancements (Phase 8+)

### Phase 8: Advanced Features
- Google Ads integration (if deferred from Phase 5)
- SMS alerts via Twilio
- Slack notifications
- Mobile app dashboard
- Voice alerts (Amazon Polly)

### Phase 9: Intelligence Upgrades
- AI-powered task prioritization
- Sentiment analysis for email classification
- Predictive SEO recommendations
- Automated A/B testing for social posts

### Phase 10: Scaling
- Multi-agent collaboration (agents work together)
- Agent learning (improve over time)
- Custom agent creation (user-defined agents)

---

## 📞 Next Steps

1. **Commit and push Phase 4 to git**
2. **Deploy Phase 4 to Vercel**
3. **Set up Brevo account** (API key, list, sender verification)
4. **Test Phase 4** (newsletter + outreach in dry-run mode)
5. **Begin Phase 5 implementation** (OpenCart SEO updater)

Ready to proceed with Phase 5 or deploy Phase 4 first? 🚀
