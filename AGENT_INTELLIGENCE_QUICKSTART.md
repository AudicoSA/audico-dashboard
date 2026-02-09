# Agent Intelligence Evolution - Quick Start Guide

## Setup (5 minutes)

### 1. Run Database Migration
```bash
# Apply the intelligence evolution schema
psql -U postgres -d your_database -f supabase/migrations/007_agent_intelligence_evolution.sql
```

Or if using Supabase CLI:
```bash
supabase db push
```

### 2. Set Environment Variables
Add to `.env.local`:
```bash
# Required for AI analysis
ANTHROPIC_API_KEY=your_key_here

# Required for cron job security
CRON_SECRET=your_secret_here
```

### 3. Deploy Cron Job
The weekly analysis runs automatically via Vercel Cron (configured in `vercel.json`):
```json
{
  "path": "/api/cron/agent-learning",
  "schedule": "0 2 * * 0"  // Every Sunday at 2 AM
}
```

## Basic Usage (10 minutes)

### Step 1: Add Decision Logging to Your Agent

```typescript
import { DecisionLogger } from '@/services/agents/decision-logger'

export class MyAgent {
  private logger = new DecisionLogger('my_agent')

  async makeDecision(input: any) {
    // Your existing decision logic
    const result = await this.processInput(input)

    // Log the decision
    const decisionId = await this.logger.log({
      decisionType: 'my_decision_type',
      decisionMade: result.decision,
      rationale: result.reasoning,
      confidenceScore: result.confidence,
      inputData: input,
      outputData: result
    })

    // Store decision ID for later outcome tracking
    return { ...result, decisionId }
  }
}
```

### Step 2: Record Outcomes

```typescript
// When you have outcome data (e.g., user feedback, metrics)
await logger.recordOutcome({
  decisionId: previousDecisionId,
  outcomeType: 'performance_metric',
  outcomeValue: 85, // 0-100 score
  feedbackSource: 'automated',
  notes: 'Measured performance after 24 hours'
})
```

### Step 3: View Dashboard

Access the dashboard at `/agent-intelligence` to see:
- Decision volume and accuracy
- Learning insights
- Running experiments
- Pending approvals

## Quick Examples

### Email Classification
```typescript
const decisionId = await logger.logEmailClassification({
  emailId: email.id,
  classification: 'order',
  priority: 'high',
  rationale: 'Contains order number and urgent keywords',
  confidenceScore: 0.92,
  emailContent: { sender: email.from, subject: email.subject }
})

// Later, when human verifies
await logger.recordEmailAccuracy({
  decisionId,
  wasCorrect: true,
  humanFeedback: 'Classification was correct'
})
```

### Social Media Post
```typescript
const decisionId = await logger.logSocialPostGeneration({
  postId: post.id,
  platform: 'instagram',
  content: post.content,
  targetKeywords: ['smart home', 'automation'],
  rationale: 'Generated engaging content',
  confidenceScore: 0.88
})

// After post is published and has engagement
await logger.recordSocialEngagement({
  decisionId,
  likes: 150,
  comments: 23,
  shares: 12,
  platform: 'instagram'
})
```

### Kenny-Mention Decision
```typescript
const decisionId = await logger.logKennyMentionDecision({
  entityType: 'task',
  entityId: task.id,
  shouldMentionKenny: true,
  rationale: 'Requires executive decision',
  confidenceScore: 0.75,
  context: { taskType: 'reseller_approval', businessImpact: 'high' }
})

// When human reviews
await logger.recordHumanFeedback({
  decisionId,
  approved: true,
  reviewedBy: 'Kenny',
  feedback: 'Correct to involve me in this decision'
})
```

## Automated Learning (No Code Required)

Once you've added decision logging, the system automatically:

1. **Weekly Analysis** (Sundays 2 AM)
   - Analyzes all agent decisions from past week
   - Identifies patterns and improvements
   - Generates optimized prompt variants
   - Creates approval requests for significant changes

2. **A/B Testing**
   - System automatically tests approved variants
   - Measures performance difference
   - Declares winners when statistically significant
   - Creates approval for winning variants

3. **Human Review**
   - Creates tasks for pending approvals
   - Prioritizes Kenny-mention changes
   - Sends notifications for high-priority changes

## API Usage

### Trigger Manual Analysis
```bash
curl -X POST https://your-app.vercel.app/api/agent-intelligence/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "Lerato",
    "periodStart": "2024-01-01T00:00:00Z",
    "periodEnd": "2024-01-07T23:59:59Z",
    "decisionType": "social_post_generation"
  }'
```

### List Pending Approvals
```bash
curl https://your-app.vercel.app/api/agent-intelligence/approvals?status=pending
```

### Approve a Prompt Change
```bash
curl -X PATCH https://your-app.vercel.app/api/agent-intelligence/approvals/APPROVAL_ID \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "reviewedBy": "Kenny",
    "reviewerNotes": "Looks good, approved",
    "rolloutPercentage": 50
  }'
```

### Get Dashboard Data
```bash
curl https://your-app.vercel.app/api/agent-intelligence/dashboard?agentName=Lerato&days=30
```

## Testing the System

### 1. Generate Test Decisions
```typescript
// Generate 50 test decisions
for (let i = 0; i < 50; i++) {
  await logger.log({
    decisionType: 'test_decision',
    decisionMade: `Decision ${i}`,
    rationale: `Test rationale ${i}`,
    confidenceScore: Math.random(),
    inputData: { test: i },
    outputData: { result: i }
  })

  // Record random outcomes
  await logger.recordOutcome({
    decisionId: decisionId,
    outcomeType: 'performance_metric',
    outcomeValue: Math.random() * 100,
    feedbackSource: 'automated'
  })
}
```

### 2. Trigger Manual Analysis
```typescript
import { intelligenceEvolution } from '@/services/agents/intelligence-evolution'

const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
const now = new Date()

const insight = await intelligenceEvolution.analyzeAgentPerformance(
  'test_agent',
  weekAgo,
  now
)

console.log('Insights:', insight)
```

### 3. Check Generated Variants
```sql
-- See generated prompt variants
SELECT * FROM prompt_versions 
WHERE agent_name = 'test_agent' 
ORDER BY created_at DESC;

-- See optimization suggestions
SELECT * FROM agent_learning_insights 
ORDER BY created_at DESC 
LIMIT 5;
```

## Common Workflows

### Workflow 1: Deploy New Prompt Variant
1. Create new prompt version via API or database
2. Create A/B experiment comparing to current version
3. Let experiment run until target sample size
4. System auto-creates approval request for winner
5. Human reviews and approves
6. Gradual rollout: 10% → 25% → 50% → 100%

### Workflow 2: Review Weekly Insights
1. Check email/tasks for new approval requests
2. Review in dashboard at `/agent-intelligence`
3. For each insight:
   - Read analysis summary
   - Review generated variants
   - Approve, reject, or request revision
4. Approved variants enter A/B testing automatically

### Workflow 3: Handle Kenny-Mention Changes
1. System detects prompt change affects Kenny decisions
2. Creates high-priority approval request
3. Sends task notification to Kenny
4. Kenny reviews impact analysis and risk assessment
5. Kenny approves/rejects with notes
6. If approved, gradual rollout with monitoring

## Monitoring

### Check System Health
```sql
-- Recent decisions
SELECT agent_name, decision_type, COUNT(*) as count, AVG(confidence_score) as avg_confidence
FROM agent_decisions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY agent_name, decision_type;

-- Decisions with outcomes
SELECT 
  ad.agent_name,
  ad.decision_type,
  COUNT(DISTINCT ad.id) as total_decisions,
  COUNT(DISTINCT do.id) as decisions_with_outcomes,
  AVG(do.outcome_value) as avg_outcome
FROM agent_decisions ad
LEFT JOIN decision_outcomes do ON ad.id = do.decision_id
WHERE ad.created_at > NOW() - INTERVAL '7 days'
GROUP BY ad.agent_name, ad.decision_type;

-- Active experiments
SELECT name, agent_name, status, current_sample_size, target_sample_size
FROM prompt_experiments
WHERE status = 'running'
ORDER BY created_at DESC;

-- Pending approvals by priority
SELECT priority, request_type, COUNT(*) as count
FROM prompt_approval_queue
WHERE status = 'pending'
GROUP BY priority, request_type
ORDER BY 
  CASE priority 
    WHEN 'critical' THEN 1 
    WHEN 'high' THEN 2 
    WHEN 'medium' THEN 3 
    WHEN 'low' THEN 4 
  END;
```

### Performance Metrics
```sql
-- Agent performance over time
SELECT 
  agent_name,
  snapshot_date,
  overall_accuracy,
  total_decisions,
  successful_decisions
FROM agent_performance_snapshots
WHERE snapshot_date > CURRENT_DATE - INTERVAL '30 days'
ORDER BY agent_name, snapshot_date;
```

## Troubleshooting

### No insights generated?
- Check agents are logging decisions: `SELECT COUNT(*) FROM agent_decisions`
- Verify ANTHROPIC_API_KEY is set
- Ensure at least 10 decisions in past week
- Check cron job ran: `SELECT * FROM squad_messages WHERE from_agent = 'intelligence_evolution'`

### Experiments not updating?
- Verify decisions use prompt_version field
- Check experiment status is 'running'
- Manually trigger update: `POST /api/agent-intelligence/experiments/{id}` with `{"action": "update_metrics"}`

### Approvals not creating tasks?
- Check `prompt_approval_queue` table
- Verify `processPendingApprovals()` is running
- Check logs in `squad_messages`

## Next Steps

1. **Integrate with All Agents**: Add decision logging to remaining agents
2. **Set Up Monitoring**: Create alerts for low accuracy or high rejection rates
3. **Review Weekly**: Schedule time to review insights and approvals
4. **Optimize Gradually**: Approve and test improvements incrementally
5. **Measure Impact**: Track ROI of agent improvements over time

## Support

- Full documentation: `AGENT_INTELLIGENCE_EVOLUTION.md`
- Example integrations: `services/agents/example-integration.ts`
- Dashboard: `/agent-intelligence` (once implemented)
- API reference: See API endpoints section in main docs
