# Quote Workflow Monitoring System - Implementation Summary

## Overview

A comprehensive end-to-end monitoring and diagnostics system for quote automation workflows, providing real-time health metrics, bottleneck detection, automated recovery, and actionable insights.

## Files Created

### 1. Database Schema
**`supabase/migrations/022_quote_workflow_monitoring.sql`**
- `quote_workflow_executions` table with comprehensive tracking fields
- 8 analytical views for health metrics, bottlenecks, failures, alerts, and trends
- Automated triggers for duration calculation and response rate tracking
- Row-level security policies

### 2. Core Monitoring Service
**`services/workflows/quote-workflow-monitor.ts`**
- `QuoteWorkflowMonitor` class with full monitoring capabilities
- Workflow execution tracking (start, step updates, completion)
- Bottleneck detection with configurable thresholds
- Automated diagnostics for common failure patterns
- Recovery system with automated fix attempts
- Alert system for stuck workflows, supplier issues, and declining rates
- Health summary aggregation

### 3. Monitoring Dashboard
**`app/squad/analytics/quote-workflow-health/page.tsx`**
- Real-time health metrics visualization
- Step timing analysis with average and P95 percentiles
- Workflow status distribution
- Supplier response rate trends
- PDF generation success tracking
- Customer acceptance patterns
- Active alert monitoring
- Bottleneck identification
- Failure analysis by step
- Recovery statistics
- Automated diagnostic suggestions

### 4. API Endpoints
**`app/api/workflows/monitoring/route.ts`**
- POST endpoint for manual monitoring actions
- GET endpoint for health summary
- Alert resolution endpoint

**`app/api/cron/workflow-monitor/route.ts`**
- Scheduled monitoring checks (cron job)
- Automated alert generation
- Health status reporting

### 5. Documentation
**`services/workflows/WORKFLOW_MONITORING.md`**
- Complete system documentation
- Usage examples and API reference
- Configuration guide
- Troubleshooting tips
- Best practices

**`services/workflows/quote-workflow-monitor-integration-example.ts`**
- Example integration with existing quote automation workflow
- Step-by-step tracking implementation
- Recovery handling examples
- Scheduled monitoring examples

**`services/workflows/__tests__/quote-workflow-monitor.test.example.ts`**
- Comprehensive test scenarios
- Example test data generation
- Validation examples

### 6. Type Definitions
**`lib/supabase.ts` (updated)**
- Added `QuoteWorkflowExecution` type
- Complete TypeScript definitions for all fields

## Key Features Implemented

### 1. Workflow Execution Tracking
- **Start tracking**: Initialize new workflow with type and metadata
- **Step progress**: Track each workflow step with timing and status
- **Duration metrics**: Automatically calculate step and total durations
- **Completion**: Record final status and metadata

### 2. Bottleneck Detection
Automatically detects performance bottlenecks with thresholds:
- Detection: 5 minutes
- Supplier Contact: 10 minutes
- Response Wait: 48 hours
- Quote Generation: 30 minutes
- Approval: 4 hours
- Send: 5 minutes

### 3. Automated Diagnostics
Identifies and diagnoses common issues:
- Circuit breaker triggers
- Supplier availability problems
- Timeout issues
- Email service failures
- PDF generation errors
- No supplier responses

For each issue, provides:
- Severity level (low, medium, high, critical)
- Description
- Suggested fixes
- Automated fix availability

### 4. Automated Recovery
Attempts to recover from failures:
- Wait for circuit breaker reset (5 minutes)
- Retry with extended timeout (2x multiplier)
- Send supplier follow-up emails
- Exponential backoff for email retries

### 5. Alerting System
Monitors and alerts on:
- **Workflow Stuck**: >24 hours without progress
- **Supplier Non-Response**: Response rate <50%
- **Declining Acceptance Rate**: <30% customer acceptance
- **High Failure Rate**: >25% workflow failures
- **Bottleneck Detected**: Step exceeds threshold

Alert severities:
- Warning: Requires attention
- Error: Needs action
- Critical: Immediate action required

### 6. Health Metrics Dashboard
Provides comprehensive visualization:
- Success/failure rate charts
- Step timing analysis (avg, median, P95)
- Supplier response rate trends over time
- PDF generation success rates
- Customer acceptance patterns (weekly)
- Bottleneck frequency and impact
- Recovery success statistics
- Active alert monitoring
- Failure analysis by step with common reasons
- Automated diagnostic suggestions

### 7. Analytics Views
Database views provide pre-aggregated metrics:
- `quote_workflow_health_metrics`: Overall health by type/status
- `quote_workflow_bottlenecks`: Top bottlenecks with occurrence data
- `quote_workflow_failure_analysis`: Failures grouped by step/reason
- `quote_workflow_alert_summary`: Active and resolved alerts
- `quote_workflow_supplier_trends`: Daily supplier response patterns
- `quote_workflow_pdf_generation_stats`: PDF success tracking
- `quote_workflow_customer_acceptance_patterns`: Weekly acceptance analysis

## Usage Examples

### Basic Workflow Tracking
```typescript
import { quoteWorkflowMonitor } from '@/services/workflows/quote-workflow-monitor'

// Start tracking
await quoteWorkflowMonitor.startWorkflowTracking(
  'wf-12345',
  'quote_automation',
  'email-log-id',
  'quote-request-id'
)

// Update step
await quoteWorkflowMonitor.updateStepProgress(
  'wf-12345',
  'quote_detection',
  'completed',
  undefined,
  { confidence: 0.95 }
)

// Update supplier metrics
await quoteWorkflowMonitor.updateSupplierMetrics('wf-12345', 5, 3)

// Complete workflow
await quoteWorkflowMonitor.completeWorkflow('wf-12345', 'completed')
```

### Run Monitoring Checks
```typescript
const alerts = await quoteWorkflowMonitor.runMonitoringChecks()
console.log(`Generated ${alerts.length} alerts`)
```

### Get Health Summary
```typescript
const summary = await quoteWorkflowMonitor.getHealthSummary()
console.log('Metrics:', summary.metrics)
console.log('Bottlenecks:', summary.bottlenecks)
console.log('Failures:', summary.failures)
console.log('Alerts:', summary.alerts)
```

## API Endpoints

### Manual Monitoring
```bash
# Run monitoring checks
curl -X POST https://your-domain.com/api/workflows/monitoring \
  -H "Content-Type: application/json" \
  -d '{"action": "run_checks"}'

# Get health summary
curl https://your-domain.com/api/workflows/monitoring

# Resolve alert
curl -X POST https://your-domain.com/api/workflows/monitoring \
  -H "Content-Type: application/json" \
  -d '{"action": "resolve_alert", "workflowId": "wf-12345"}'
```

### Scheduled Monitoring
```bash
# Cron endpoint (requires CRON_SECRET)
curl -X GET https://your-domain.com/api/cron/workflow-monitor \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Dashboard Access

View the monitoring dashboard at:
```
/squad/analytics/quote-workflow-health
```

Features:
- Real-time metrics with date range filters (24h, 7d, 30d)
- Interactive charts and visualizations
- Active alert display
- Bottleneck analysis
- Failure breakdown
- Recovery statistics
- Diagnostic suggestions

## Configuration

### Bottleneck Thresholds
Adjust in `services/workflows/quote-workflow-monitor.ts`:
```typescript
private readonly BOTTLENECK_THRESHOLDS = {
  detection: 300,           // 5 minutes
  supplier_contact: 600,    // 10 minutes
  response_wait: 172800,    // 48 hours
  quote_generation: 1800,   // 30 minutes
  approval: 14400,          // 4 hours
  send: 300                 // 5 minutes
}
```

### Alert Thresholds
```typescript
private readonly STUCK_THRESHOLD_HOURS = 24
private readonly RESPONSE_RATE_WARNING_THRESHOLD = 0.5
private readonly ACCEPTANCE_RATE_WARNING_THRESHOLD = 0.3
private readonly FAILURE_RATE_WARNING_THRESHOLD = 0.25
```

## Database Tables

### quote_workflow_executions
Primary tracking table with:
- Workflow identification (workflow_id, type, status)
- Step tracking (steps JSONB array)
- Timing metrics (per-step durations)
- Supplier metrics (contacted, responded, rate)
- Failure tracking (reason, step, error stack)
- Bottleneck detection (step, duration, threshold)
- Recovery tracking (attempted, actions, successful)
- Diagnostics (results, suggested fixes)
- Alerting (triggered, type, timestamps)

## Next Steps

1. **Run Database Migration**
   ```bash
   # Apply the migration to create tables and views
   supabase db push
   ```

2. **Integrate with Existing Workflows**
   - Update `services/workflows/quote-automation-workflow.ts`
   - Add monitoring calls at each workflow step
   - See `quote-workflow-monitor-integration-example.ts`

3. **Setup Scheduled Monitoring**
   - Configure cron job or Vercel Cron
   - Run `/api/cron/workflow-monitor` every 2 hours
   - Monitor alerts and take action

4. **Review Dashboard**
   - Access `/squad/analytics/quote-workflow-health`
   - Set up regular review schedule
   - Act on bottlenecks and failures

5. **Customize Thresholds**
   - Adjust based on actual performance data
   - Fine-tune alert sensitivity
   - Configure recovery actions

## Benefits

1. **Visibility**: Complete visibility into workflow health and performance
2. **Proactive**: Detect and alert on issues before they impact customers
3. **Automated**: Automatic diagnostics and recovery reduce manual intervention
4. **Insights**: Data-driven insights for workflow optimization
5. **Reliability**: Improved workflow reliability through monitoring and recovery
6. **Scalability**: Handles high-volume workflows with efficient tracking

## Maintenance

- Review dashboard weekly for trends
- Act on alerts promptly
- Adjust thresholds based on patterns
- Analyze failure diagnostics for improvements
- Monitor recovery success rates
- Track supplier response patterns
- Review customer acceptance trends

## Support

For questions or issues with the monitoring system:
1. Check `WORKFLOW_MONITORING.md` for detailed documentation
2. Review test examples in `__tests__/quote-workflow-monitor.test.example.ts`
3. Examine integration example in `quote-workflow-monitor-integration-example.ts`
4. Check database views for pre-aggregated metrics
5. Review alert history in `quote_workflow_alert_summary` view
