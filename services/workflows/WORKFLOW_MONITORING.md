# Quote Workflow Monitoring & Health System

## Overview

The Quote Workflow Monitoring system provides end-to-end tracking, diagnostics, and automated recovery for quote automation workflows. It monitors pipeline health metrics, detects bottlenecks, tracks supplier response patterns, and provides actionable insights for workflow optimization.

## Features

### 1. **Workflow Execution Tracking**
- Step-by-step timing and status tracking
- Detailed duration metrics for each workflow stage
- Success/failure rate monitoring
- Circuit breaker state tracking

### 2. **Bottleneck Detection**
Automatically detects performance bottlenecks with configurable thresholds:
- Detection: 5 minutes
- Supplier Contact: 10 minutes
- Response Wait: 48 hours
- Quote Generation: 30 minutes
- Approval: 4 hours
- Send: 5 minutes

### 3. **Automated Diagnostics**
Analyzes failed workflows and identifies common issues:
- Circuit breaker triggers
- Supplier availability issues
- Timeout problems
- Email service failures
- PDF generation errors
- No supplier responses

### 4. **Automated Recovery**
Attempts to recover from failures automatically:
- Wait for circuit breaker reset
- Retry with extended timeout
- Send supplier follow-ups
- Exponential backoff for email retries

### 5. **Alerting System**
Monitors critical thresholds and triggers alerts:
- **Workflow Stuck**: >24 hours without progress
- **Supplier Non-Response**: Response rate <50%
- **Declining Acceptance Rate**: <30% acceptance
- **High Failure Rate**: >25% failures

### 6. **Health Metrics Dashboard**
Real-time visualization of:
- Success/failure rates
- Step timing analysis
- Supplier response rate trends
- PDF generation success rates
- Customer acceptance patterns
- Bottleneck frequency
- Recovery success rates

## Database Schema

### `quote_workflow_executions` Table

Tracks each workflow execution with comprehensive metrics:

```sql
- workflow_id (unique identifier)
- workflow_type (quote_automation, manual_quote, approval, follow_up)
- status (initializing, detecting, supplier_contacted, awaiting_responses, generating_quote, pending_approval, quote_sent, failed, completed, stuck, recovering)
- steps (JSONB array of step details)
- timing metrics (detection_duration, supplier_contact_duration, etc.)
- supplier metrics (suppliers_contacted, suppliers_responded, response_rate)
- failure tracking (failure_reason, failure_step, error_stack)
- bottleneck detection (bottleneck_detected, bottleneck_step, bottleneck_duration)
- recovery tracking (recovery_attempted, recovery_actions, recovery_successful)
- diagnostics (diagnostic_results, suggested_fixes)
- alerting (alert_triggered, alert_type, alert_sent_at)
```

### Views

**`quote_workflow_health_metrics`**
- Aggregated metrics by workflow type and status
- Success/failure rates
- Average, median, and P95 durations
- Bottleneck and recovery statistics

**`quote_workflow_bottlenecks`**
- Top bottleneck steps
- Occurrence counts and durations
- Associated failure patterns

**`quote_workflow_failure_analysis`**
- Failures grouped by step and reason
- Recovery attempt statistics
- Common suggested fixes

**`quote_workflow_alert_summary`**
- Active and resolved alerts
- Resolution times
- Unresolved workflow IDs

**`quote_workflow_supplier_trends`**
- Daily supplier response rates
- Workflow success correlation
- Contact and response counts

**`quote_workflow_pdf_generation_stats`**
- PDF generation success rates over time
- Average generation duration
- Failure tracking

**`quote_workflow_customer_acceptance_patterns`**
- Weekly acceptance rate trends
- Quote value analysis
- Timing impact on acceptance

## Usage

### Starting Workflow Tracking

```typescript
import { quoteWorkflowMonitor } from '@/services/workflows/quote-workflow-monitor'

// Start tracking a new workflow
await quoteWorkflowMonitor.startWorkflowTracking(
  'wf-12345',
  'quote_automation',
  'email-log-id',
  'quote-request-id'
)
```

### Updating Step Progress

```typescript
// Mark step as in progress
await quoteWorkflowMonitor.updateStepProgress(
  'wf-12345',
  'quote_detection',
  'in_progress'
)

// Mark step as completed
await quoteWorkflowMonitor.updateStepProgress(
  'wf-12345',
  'quote_detection',
  'completed',
  undefined,
  { confidence: 0.95 }
)

// Mark step as failed
await quoteWorkflowMonitor.updateStepProgress(
  'wf-12345',
  'contact_suppliers',
  'failed',
  'No suppliers found for product category'
)
```

### Updating Supplier Metrics

```typescript
await quoteWorkflowMonitor.updateSupplierMetrics(
  'wf-12345',
  5, // suppliers contacted
  3  // suppliers responded
)
```

### Completing Workflow

```typescript
await quoteWorkflowMonitor.completeWorkflow(
  'wf-12345',
  'completed',
  { total_quoted_amount: 15000 }
)
```

### Running Monitoring Checks

```typescript
// Check for stuck workflows, supplier issues, and declining acceptance rates
const alerts = await quoteWorkflowMonitor.runMonitoringChecks()

console.log(`Generated ${alerts.length} alerts`)
alerts.forEach(alert => {
  console.log(`${alert.severity.toUpperCase()}: ${alert.message}`)
})
```

### Getting Health Summary

```typescript
const summary = await quoteWorkflowMonitor.getHealthSummary()

console.log('Metrics:', summary.metrics)
console.log('Top Bottlenecks:', summary.bottlenecks)
console.log('Failure Analysis:', summary.failures)
console.log('Active Alerts:', summary.alerts)
```

## API Endpoints

### Manual Monitoring Trigger
```
POST /api/workflows/monitoring
{
  "action": "run_checks"
}
```

### Get Health Summary
```
GET /api/workflows/monitoring
```

### Resolve Alert
```
POST /api/workflows/monitoring
{
  "action": "resolve_alert",
  "workflowId": "wf-12345"
}
```

### Scheduled Monitoring (Cron)
```
GET /api/cron/workflow-monitor
Authorization: Bearer <CRON_SECRET>
```

## Dashboard

Access the monitoring dashboard at:
```
/squad/analytics/quote-workflow-health
```

Features:
- Real-time workflow health metrics
- Success/failure rate visualization
- Step timing analysis with P95 percentiles
- Supplier response rate trends
- PDF generation success tracking
- Customer acceptance patterns
- Active alert monitoring
- Bottleneck identification
- Failure analysis by step
- Recovery success statistics
- Automated diagnostic suggestions

## Diagnostic Patterns

The system automatically diagnoses common failure patterns:

1. **Circuit Breaker Triggered**
   - Severity: High
   - Suggestion: Wait for reset (5 minutes)
   - Auto-recovery: Yes

2. **No Suppliers Available**
   - Severity: Critical
   - Suggestion: Add suppliers to database
   - Auto-recovery: No

3. **Timeout Exceeded**
   - Severity: Medium
   - Suggestion: Retry with extended timeout
   - Auto-recovery: Yes

4. **Email Service Failure**
   - Severity: High
   - Suggestion: Retry with exponential backoff
   - Auto-recovery: Yes

5. **PDF Generation Failure**
   - Severity: High
   - Suggestion: Review template configuration
   - Auto-recovery: No

6. **No Supplier Responses**
   - Severity: High
   - Suggestion: Send automated follow-ups
   - Auto-recovery: Yes

## Alert Configuration

### Thresholds

| Alert Type | Threshold | Action |
|-----------|-----------|--------|
| Workflow Stuck | >24 hours | Mark as stuck, notify Kenny |
| Supplier Non-Response | <50% response rate | Monitor trend, suggest action |
| Declining Acceptance | <30% acceptance rate | Analyze pricing/timing |
| High Failure Rate | >25% failures | Investigate root causes |
| Bottleneck Detected | Exceeds step threshold | Log and alert if critical |

### Alert Severity Levels

- **Warning**: Requires attention but not urgent
- **Error**: Needs action to prevent workflow failures
- **Critical**: Immediate action required

## Scheduled Monitoring

Set up a cron job to run monitoring checks regularly:

```bash
# Every 2 hours
0 */2 * * * curl -X GET https://your-domain.com/api/cron/workflow-monitor \
  -H "Authorization: Bearer $CRON_SECRET"
```

Or use a service like Vercel Cron:

```json
{
  "crons": [
    {
      "path": "/api/cron/workflow-monitor",
      "schedule": "0 */2 * * *"
    }
  ]
}
```

## Best Practices

1. **Always start workflow tracking** at the beginning of each workflow execution
2. **Update step progress** at key transitions to enable accurate timing
3. **Update supplier metrics** when contacting suppliers and receiving responses
4. **Complete workflows** with final metadata for analytics
5. **Review dashboard regularly** to identify trends and optimize workflows
6. **Act on alerts promptly** to maintain workflow health
7. **Monitor bottlenecks** and adjust thresholds as needed
8. **Analyze failure patterns** to improve automation logic

## Troubleshooting

### High Failure Rate
- Check `quote_workflow_failure_analysis` view for common failure reasons
- Review diagnostic suggestions
- Verify external service availability (email, suppliers)

### Stuck Workflows
- Check `quote_workflow_executions` table for workflows in stuck status
- Review current_step to identify where workflow stopped
- Check for pending supplier responses or manual approval

### Declining Supplier Response Rates
- Review `quote_workflow_supplier_trends` for patterns
- Consider follow-up strategy adjustments
- Evaluate supplier selection criteria

### Low Acceptance Rates
- Analyze `quote_workflow_customer_acceptance_patterns`
- Review pricing and timing correlation
- Check PDF quality and quote presentation

## Future Enhancements

- Machine learning-based bottleneck prediction
- Automated threshold tuning
- Advanced recovery strategies
- Integration with external monitoring tools
- Predictive maintenance alerts
- Performance optimization recommendations
