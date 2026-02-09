# Agent Intelligence Evolution System

## Overview

The Agent Intelligence Evolution System is a comprehensive continuous learning framework that enables AI agents to improve their decision-making capabilities over time through data-driven insights, A/B testing, and human oversight.

## Key Features

### 1. Decision Logging & Tracking
- **Complete Context Capture**: Every agent decision is logged with full context, rationale, and confidence scores
- **Outcome Tracking**: System tracks actual outcomes (accuracy, engagement, ROI) for each decision
- **Performance Attribution**: Links outcomes back to specific prompts and decision logic

### 2. AI-Powered Analysis
- **Weekly Performance Reviews**: Claude analyzes agent decisions to identify patterns and optimization opportunities
- **Pattern Recognition**: Identifies what works well and what needs improvement
- **Automated Suggestions**: Generates specific optimization recommendations and prompt variants

### 3. A/B Testing Framework
- **Controlled Experiments**: Test new prompt variants against current versions
- **Traffic Splitting**: Gradually roll out changes with configurable traffic allocation
- **Statistical Significance**: Automatic calculation of experiment results and winner determination

### 4. Human-in-the-Loop Approval
- **Critical Decision Review**: Kenny-mention decisions require human approval
- **Risk Assessment**: System categorizes changes by risk level
- **Approval Workflow**: Tasks created for human review of significant changes

### 5. Gradual Rollout System
- **Percentage-based Deployment**: Roll out prompt changes gradually (e.g., 10%, 25%, 50%, 100%)
- **Performance Monitoring**: Track metrics during rollout
- **Automatic Rollback**: Can revert if performance degrades

### 6. Performance Dashboard
- **Learning Progress**: Track improvement over time
- **Optimization History**: See all successful optimizations
- **ROI Gains**: Measure business impact of agent improvements
- **Experiment Status**: Monitor running A/B tests

## Database Schema

### Core Tables

#### `agent_decisions`
Logs every agent decision with full context:
- `agent_name`: Which agent made the decision
- `decision_type`: Type of decision (email_classification, social_post_generation, etc.)
- `decision_context`: Full context of the decision
- `decision_made`: What decision was made
- `rationale`: Why this decision was made
- `confidence_score`: Agent's confidence (0-1)
- `prompt_version`: Which prompt version was used
- `input_data` & `output_data`: Full I/O capture

#### `decision_outcomes`
Tracks actual results of decisions:
- `decision_id`: Links to agent_decisions
- `outcome_type`: Type of outcome (email_accuracy, social_engagement, ad_roi, etc.)
- `outcome_value`: Numeric performance score (0-100)
- `feedback_source`: automated, human, or system
- `outcome_data`: Detailed outcome metrics

#### `prompt_versions`
Version control for agent prompts:
- `agent_name` & `decision_type`: What this prompt is for
- `version` & `variant`: Version identification
- `prompt_template`: The actual prompt
- `status`: testing, active, archived, rejected
- `rollout_percentage`: Gradual deployment control
- `performance_score`: Measured effectiveness
- `total_uses` & `success_rate`: Performance tracking

#### `prompt_experiments`
A/B testing experiments:
- `name` & `description`: Experiment details
- `control_version_id` & `test_version_id`: Versions being tested
- `traffic_split`: Percentage of traffic to test version
- `status`: running, completed, paused, cancelled
- `control_metrics` & `test_metrics`: Performance comparison
- `statistical_significance`: Confidence in results
- `winner`: control, test, or inconclusive

#### `agent_learning_insights`
Weekly AI analysis results:
- `agent_name` & `decision_type`: What was analyzed
- `analysis_period_start` & `analysis_period_end`: Time range
- `performance_metrics`: Calculated metrics
- `identified_patterns`: What patterns were found
- `optimization_suggestions`: Recommended improvements
- `generated_variants`: AI-generated prompt variants
- `analysis_summary`: Executive summary

#### `prompt_approval_queue`
Human approval workflow:
- `prompt_version_id`: What needs approval
- `request_type`: new_variant, kenny_mention_change, major_optimization, experiment_approval
- `priority`: low, medium, high, critical
- `change_summary`: What's changing
- `impact_analysis`: Expected impact
- `risk_assessment`: Risk evaluation
- `status`: pending, approved, rejected, needs_revision

#### `agent_performance_snapshots`
Daily performance tracking:
- `agent_name` & `snapshot_date`: What and when
- `overall_accuracy`: Daily accuracy percentage
- `total_decisions` & `successful_decisions`: Volume tracking
- `decision_types`: Breakdown by decision type
- `roi_metrics`, `engagement_metrics`, `efficiency_metrics`: Various performance measures

## Usage Guide

### For Agents: Logging Decisions

```typescript
import { DecisionLogger } from '@/services/agents/decision-logger'

const logger = new DecisionLogger('agent_name')

// Log a decision
const decisionId = await logger.log({
  decisionType: 'email_classification',
  decisionMade: 'Classified as order, priority high',
  rationale: 'Email contains order number and urgent keywords',
  confidenceScore: 0.92,
  context: { emailId: '123', classification: 'order', priority: 'high' },
  inputData: { sender: 'customer@example.com', subject: 'Urgent order issue' },
  outputData: { classification: 'order', priority: 'high' }
})

// Record outcome later
await logger.recordOutcome({
  decisionId,
  outcomeType: 'email_accuracy',
  outcomeValue: 100, // Was correct
  feedbackSource: 'human',
  notes: 'Human verified classification was correct'
})
```

### Email Classification Example
```typescript
const decisionId = await logger.logEmailClassification({
  emailId: email.id,
  classification: 'order',
  priority: 'high',
  assignedAgent: 'Jarvis',
  rationale: 'Contains order reference and customer name',
  confidenceScore: 0.95,
  emailContent: {
    sender: email.from,
    subject: email.subject,
    body: email.body
  }
})
```

### Social Post Generation Example
```typescript
const decisionId = await logger.logSocialPostGeneration({
  postId: post.id,
  platform: 'instagram',
  content: post.content,
  targetKeywords: ['smart home', 'automation'],
  rationale: 'Generated engaging content with trending keywords',
  confidenceScore: 0.88,
  productContext: { products: [product1, product2] }
})

// Record engagement later
await logger.recordSocialEngagement({
  decisionId,
  likes: 150,
  comments: 23,
  shares: 12,
  platform: 'instagram'
})
```

### Kenny-Mention Decision Example
```typescript
const decisionId = await logger.logKennyMentionDecision({
  entityType: 'task',
  entityId: task.id,
  shouldMentionKenny: true,
  rationale: 'Task involves major business decision requiring executive input',
  confidenceScore: 0.75,
  context: {
    taskType: 'reseller_approval',
    businessImpact: 'high',
    requiresExecutiveReview: true
  }
})
```

## API Endpoints

### Analysis
- `POST /api/agent-intelligence/analyze` - Trigger manual analysis
  ```json
  {
    "agentName": "Lerato",
    "periodStart": "2024-01-01T00:00:00Z",
    "periodEnd": "2024-01-07T23:59:59Z",
    "decisionType": "social_post_generation"
  }
  ```

### Experiments
- `GET /api/agent-intelligence/experiments` - List experiments
- `POST /api/agent-intelligence/experiments` - Create experiment
- `GET /api/agent-intelligence/experiments/{id}` - Get experiment details
- `PATCH /api/agent-intelligence/experiments/{id}` - Update experiment (pause, resume, cancel)

### Approvals
- `GET /api/agent-intelligence/approvals` - List pending approvals
- `GET /api/agent-intelligence/approvals/{id}` - Get approval details
- `PATCH /api/agent-intelligence/approvals/{id}` - Approve/reject/request revision
  ```json
  {
    "action": "approve",
    "reviewedBy": "Kenny",
    "reviewerNotes": "Approved - looks good",
    "rolloutPercentage": 50
  }
  ```

### Versions
- `GET /api/agent-intelligence/versions` - List prompt versions
- `POST /api/agent-intelligence/versions` - Create new version

### Dashboard
- `GET /api/agent-intelligence/dashboard` - Get dashboard data

### Cron
- `GET /api/cron/agent-learning` - Weekly analysis workflow (requires CRON_SECRET)

## Automated Workflows

### Weekly Learning Analysis
Runs every Sunday at 2 AM:
1. Analyzes all agents' decisions from past week
2. Identifies patterns and optimization opportunities
3. Generates prompt variants using Claude
4. Creates approval requests for significant changes
5. Updates performance snapshots

Configure in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/agent-learning",
      "schedule": "0 2 * * 0"
    }
  ]
}
```

### Experiment Monitoring
Runs daily to update experiment metrics and check for completion.

### Approval Notifications
Creates squad tasks for pending approvals requiring human review.

## Decision Types

### Email Classification
- **Tracks**: Classification accuracy, priority assignment, agent routing
- **Outcomes**: Human verification of correct classification
- **Metrics**: Accuracy percentage, average confidence

### Social Post Generation
- **Tracks**: Content generation, keyword usage, platform optimization
- **Outcomes**: Engagement rates (likes, comments, shares)
- **Metrics**: Engagement score, viral coefficient

### Ad Campaign Optimization
- **Tracks**: Budget adjustments, targeting changes, creative variations
- **Outcomes**: ROI, conversion rates, cost per acquisition
- **Metrics**: ROI percentage, cost efficiency

### SEO Recommendation
- **Tracks**: Audit findings, optimization suggestions, priority ranking
- **Outcomes**: Score improvements over time
- **Metrics**: Score delta, implementation rate

### Kenny-Mention Decision
- **Tracks**: When agents decide to mention Kenny in tasks
- **Outcomes**: Human approval/rejection rate
- **Metrics**: Accuracy of mention necessity
- **Special**: Requires human approval for prompt changes

## Best Practices

### 1. Always Log Decisions
- Log every significant decision an agent makes
- Include full context for future analysis
- Set appropriate confidence scores

### 2. Record Outcomes
- Track actual results when available
- Link outcomes back to decisions
- Use consistent outcome value scales (0-100)

### 3. Review Approvals Regularly
- Check approval queue daily
- Prioritize Kenny-mention changes
- Provide detailed feedback for rejected changes

### 4. Monitor Experiments
- Let experiments reach target sample size
- Check statistical significance before declaring winners
- Roll out winners gradually

### 5. Gradual Rollouts
- Start with 10-25% traffic for new prompts
- Monitor performance closely
- Increase gradually if metrics are good
- Full rollout only after proven success

## Performance Metrics

### Email Agent
- **Accuracy**: % of classifications verified as correct
- **Response Time**: Time to classify and route
- **Escalation Rate**: % requiring human review

### Social Agent
- **Engagement Rate**: Avg engagement per post
- **Content Quality**: Human approval rate
- **Posting Consistency**: Posts per week/month

### Ads Agent
- **ROI**: Return on ad spend
- **CPA**: Cost per acquisition
- **Click-through Rate**: CTR improvement

### SEO Agent
- **Score Improvement**: Before/after audit scores
- **Implementation Rate**: % of recommendations applied
- **Traffic Impact**: Organic traffic changes

## Troubleshooting

### No Insights Generated
- Check if agents are logging decisions
- Verify ANTHROPIC_API_KEY is set
- Ensure sufficient decision volume (>10 per week)

### Experiments Not Updating
- Verify cron job is running
- Check experiment status is 'running'
- Ensure decisions are using prompt versions

### Approvals Not Creating Tasks
- Check prompt_approval_queue table
- Verify squad_tasks permissions
- Check workflow logs in squad_messages

## Security Considerations

1. **Cron Protection**: CRON_SECRET required for automated workflows
2. **Human Review**: Kenny-mention changes always require approval
3. **Gradual Rollout**: Prevents bad prompts from affecting all decisions
4. **Audit Trail**: Complete history of all changes and approvals
5. **Rollback Capability**: Can revert to previous prompt versions

## Future Enhancements

- Real-time performance monitoring dashboards
- Automatic rollback on performance degradation
- Multi-armed bandit algorithms for dynamic traffic allocation
- Cross-agent learning (share insights between agents)
- Predictive analytics for decision outcomes
- Integration with business KPIs
