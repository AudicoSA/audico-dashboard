# Google Ads Agent (Marcus)

The Google Ads Agent is an autonomous service that monitors Google Ads campaign performance, automatically pauses underperforming ads, suggests bid adjustments, and alerts the team when manual review is needed.

## Features

### 1. Campaign Performance Monitoring
- Real-time tracking of campaign metrics (CTR, CPA, ROAS)
- Automatic sync with Google Ads API
- Historical performance data stored in `ad_campaigns` table
- Monitors last 30 days of campaign data

### 2. Performance Metrics Tracked
- **CTR (Click-Through Rate)**: Clicks / Impressions × 100
- **CPC (Cost Per Click)**: Total Spend / Clicks
- **CPA (Cost Per Acquisition)**: Total Spend / Conversions
- **ROAS (Return on Ad Spend)**: Revenue / Spend

### 3. Auto-Pause Underperforming Campaigns
Campaigns are automatically paused when they meet critical thresholds:
- CTR < 0.5% (50% below threshold)
- CPA > R225 (150% above threshold)
- ROAS < 1.0x (50% below threshold)
- Requires minimum 10 conversions for statistical significance

### 4. Bid Adjustment Suggestions
The agent analyzes performance and suggests bid adjustments based on:
- **Increase bids (+15%)**: High ROAS (>3.0x) and low CPA (<R105)
- **Increase bids (+10%)**: High CTR (>2%) and good ROAS (>2.0x)
- **Decrease bids (-15%)**: Low ROAS (<2.0x) and high CPA (>R150)
- **Decrease bids (-10%)**: Low CTR (<1%) with sufficient data

### 5. Alert System via Squad Tasks
- **Critical Alerts** (urgent priority): Campaign auto-paused, Kenny notified
- **High Priority Alerts**: Performance issues requiring review
- **Bid Adjustment Tasks**: Suggested optimizations for campaigns

## Configuration

### Environment Variables
Add to `.env.local`:

```env
# Google Ads API Configuration
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_ADS_CUSTOMER_ID=1234567890
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
```

### Default Thresholds
```typescript
{
  ctrThreshold: 1.0,        // 1% CTR minimum
  cpaThreshold: 150,        // R150 CPA maximum
  roasThreshold: 2.0,       // 2.0x ROAS minimum
  minConversions: 10,       // Minimum conversions for analysis
  autoPauseEnabled: true    // Enable automatic campaign pausing
}
```

### Custom Configuration
```typescript
import { GoogleAdsAgent } from '@/services/agents/ads-agent'

const customAgent = new GoogleAdsAgent({
  ctrThreshold: 1.5,
  cpaThreshold: 100,
  roasThreshold: 3.0,
  minConversions: 20,
  autoPauseEnabled: false
})
```

## API Endpoints

### Monitor Campaign Performance
```bash
POST /api/ads-agent/monitor
```
Triggers immediate performance monitoring of all active campaigns.

### Get All Active Campaigns
```bash
GET /api/ads-agent
# or
POST /api/ads-agent
{
  "action": "get_active_campaigns"
}
```

### Get Specific Campaign
```bash
POST /api/ads-agent
{
  "action": "get_campaign",
  "campaignId": "uuid"
}
```

### Generate Performance Report
```bash
POST /api/ads-agent
{
  "action": "generate_report"
}
```

### Manually Pause Campaign
```bash
POST /api/ads-agent
{
  "action": "pause_campaign",
  "campaignId": "google_campaign_id",
  "reasons": ["low_ctr", "high_cpa"]
}
```

## Database Schema

### ad_campaigns Table
```sql
CREATE TABLE ad_campaigns (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,  -- 'google_ads'
    status TEXT NOT NULL,    -- 'draft', 'active', 'paused', 'completed', 'cancelled'
    budget_total DECIMAL(10, 2),
    budget_spent DECIMAL(10, 2),
    currency TEXT DEFAULT 'ZAR',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    performance_metrics JSONB,
    managed_by TEXT,         -- 'Marcus'
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
```

### performance_metrics Structure
```json
{
  "impressions": 50000,
  "clicks": 1250,
  "conversions": 45,
  "ctr": 2.5,
  "cpc": 3.20,
  "cpa": 88.89,
  "roas": 3.5,
  "spend": 4000.00,
  "revenue": 14000.00
}
```

### metadata Structure
```json
{
  "google_campaign_id": "1234567890",
  "last_sync": "2024-01-15T10:30:00Z",
  "paused_at": "2024-01-15T12:00:00Z",
  "pause_reasons": ["low_ctr", "high_cpa"],
  "auto_paused": true
}
```

## Automated Workflows

### Campaign Monitoring Flow
1. Agent fetches campaigns from Google Ads API
2. Calculates performance metrics (CTR, CPA, ROAS)
3. Updates `ad_campaigns` table with latest metrics
4. Analyzes performance against thresholds
5. If issues detected:
   - Critical: Auto-pause campaign + create urgent task
   - High: Create high-priority review task
   - Medium: Log performance issue
6. Generates bid adjustment suggestions
7. Creates squad tasks for manual review

### Alert Priority Levels
- **Critical** (Score ≥ 6): Campaign auto-paused, Kenny notified
- **High** (Score 4-5): Immediate review required
- **Medium** (Score 2-3): Review recommended
- **Low** (Score < 2): Monitoring only

## Integration with Orchestrator

Add to `services/orchestrator.ts`:

```typescript
// Schedule ads monitoring every 4 hours
this.scheduledJobs.set('ads_monitor', cron.schedule('0 */4 * * *', async () => {
  await this.executeAgentTask('ads_agent', 'monitor', '/api/ads-agent/monitor')
}))

// Daily performance report at 9 AM
this.scheduledJobs.set('ads_report', cron.schedule('0 9 * * *', async () => {
  await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ads-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'generate_report' })
  })
}))
```

## Squad Messages

The agent communicates via `squad_messages`:

### Activity Logging
```json
{
  "from_agent": "Marcus",
  "message": "Ads Agent monitor_completed",
  "data": {
    "action": "monitor_completed",
    "campaigns_checked": 12,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Performance Alerts
```json
{
  "from_agent": "Marcus",
  "to_agent": "Kenny",
  "message": "🚨 CRITICAL ALERT: Summer Sale Campaign requires immediate attention",
  "task_id": "task-uuid",
  "data": {
    "campaign_id": "1234567890",
    "action": "performance_alert",
    "issues": ["low_ctr", "high_cpa"],
    "priority": "critical",
    "auto_paused": true,
    "metrics": {
      "ctr": 0.45,
      "cpa": 245.50,
      "roas": 0.8
    }
  }
}
```

### Bid Suggestions
```json
{
  "from_agent": "Marcus",
  "to_agent": "Jarvis",
  "message": "Bid adjustment suggested for Winter Campaign",
  "task_id": "task-uuid",
  "data": {
    "campaign_id": "1234567890",
    "action": "bid_adjustment_suggested",
    "suggestion": {
      "currentBid": 3.50,
      "suggestedBid": 4.03,
      "reason": "High ROAS and low CPA indicate room for increased bids (+15.0% adjustment)",
      "expectedImpact": "Increased impressions and conversions while maintaining profitability"
    }
  }
}
```

## Usage Examples

### Basic Monitoring
```typescript
import { adsAgent } from '@/services/agents/ads-agent'

// Run performance monitoring
await adsAgent.monitorCampaignPerformance()
```

### Get Campaign Data
```typescript
// Get specific campaign
const campaign = await adsAgent.getCampaignMetrics('campaign-uuid')

// Get all active campaigns
const campaigns = await adsAgent.getAllActiveCampaigns()
```

### Generate Report
```typescript
await adsAgent.generatePerformanceReport()
```

### Manual Campaign Control
```typescript
// Pause a campaign
await adsAgent.pauseCampaign('google-campaign-id', ['manual_review', 'budget_exceeded'])
```

## Best Practices

1. **Monitor Regularly**: Schedule monitoring every 4 hours during business hours
2. **Review Auto-Pauses**: Check critical alerts promptly
3. **Test Bid Adjustments**: Start with suggested bids and monitor for 48-72 hours
4. **Maintain Min Conversions**: Wait for at least 10 conversions before analyzing
5. **Adjust Thresholds**: Fine-tune based on your business model and profit margins
6. **Track Changes**: Use metadata to log all automated actions

## Troubleshooting

### Common Issues

**"Google Ads credentials not configured"**
- Ensure all `GOOGLE_ADS_*` environment variables are set
- Verify refresh token is valid

**"Campaign not found in database"**
- Campaign will be auto-created on first sync
- Check `metadata.google_campaign_id` matches Google Ads

**"Insufficient data for analysis"**
- Campaign needs minimum 10 conversions
- Agent will skip analysis until threshold met

## Security Notes

- Never commit Google Ads credentials to repository
- Use service role key for Supabase operations
- Refresh tokens expire - monitor and rotate regularly
- Implement rate limiting on API endpoints
- Log all automated actions for audit trail
