# Google Ads Agent - Quick Start Guide

## Setup (5 minutes)

### 1. Install Dependencies
Already installed via npm:
```bash
npm install google-ads-api
```

### 2. Configure Environment Variables
Copy `.env.local.example` to `.env.local` and add your Google Ads credentials:

```env
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_ADS_CUSTOMER_ID=1234567890
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
```

**Get Google Ads API Credentials:**
1. Go to [Google Ads API Center](https://ads.google.com/aw/apicenter)
2. Create OAuth 2.0 credentials
3. Generate a developer token
4. Use OAuth playground to get refresh token

### 3. Test the Agent

```bash
# Start the dev server
npm run dev

# Test the monitoring endpoint
curl -X POST http://localhost:3001/api/ads-agent/monitor

# Get active campaigns
curl http://localhost:3001/api/ads-agent
```

## Key Features at a Glance

✅ **Auto-monitors** campaign performance every 4 hours  
✅ **Auto-pauses** campaigns with CTR < 0.5%, CPA > R225, or ROAS < 1.0x  
✅ **Suggests bid adjustments** based on performance data  
✅ **Creates squad tasks** for manual review when needed  
✅ **Stores metrics** in `ad_campaigns` table automatically  

## Default Thresholds

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| CTR | > 1% | 0.5-1% | < 0.5% |
| CPA | < R150 | R150-R225 | > R225 |
| ROAS | > 2.0x | 1.0-2.0x | < 1.0x |

## API Endpoints

### Monitor Performance (Scheduled)
```bash
POST /api/ads-agent/monitor
```

### Get All Campaigns
```bash
GET /api/ads-agent
```

### Generate Report
```bash
POST /api/ads-agent
{
  "action": "generate_report"
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

## Integration with Orchestrator

Add to `services/orchestrator.ts` in `setupScheduledJobs()`:

```typescript
// Monitor ads every 4 hours
this.scheduledJobs.set('ads_monitor', cron.schedule('0 */4 * * *', async () => {
  await this.executeAgentTask('ads_agent', 'monitor', '/api/ads-agent/monitor')
}))

// Daily report at 9 AM
this.scheduledJobs.set('ads_report', cron.schedule('0 9 * * *', async () => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ads-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'generate_report' })
  })
}))
```

## How It Works

1. **Every 4 hours** (or on-demand), the agent:
   - Fetches last 30 days of campaign data from Google Ads
   - Calculates CTR, CPC, CPA, ROAS for each campaign
   - Updates the `ad_campaigns` table

2. **Performance Analysis**:
   - Compares metrics against thresholds
   - Calculates severity score (low/medium/high/critical)
   - Identifies campaigns needing attention

3. **Automated Actions**:
   - **Critical issues**: Pauses campaign + creates urgent task + notifies Kenny
   - **High priority**: Creates high-priority task for review
   - **Bid suggestions**: Generates optimization recommendations

4. **Alerts**:
   - All actions logged to `squad_messages`
   - Tasks created in `squad_tasks`
   - Team notified via task assignment

## Example: What Happens When Performance Drops

Campaign "Summer Sale" has been running for 2 weeks:
- 50,000 impressions
- 200 clicks (0.4% CTR) ⚠️ Below 1% threshold
- 5 conversions
- R5,000 spent (R1,000 CPA) ⚠️ Above R150 threshold
- R3,000 revenue (0.6x ROAS) ⚠️ Below 2.0x threshold

**Agent Action:**
1. Calculates severity score: 8 (CRITICAL)
2. Pauses campaign in Google Ads
3. Updates campaign status to 'paused' in database
4. Creates urgent task: "🚨 CRITICAL Ad Performance Alert: Summer Sale"
5. Sends message to Kenny via `squad_messages`
6. Logs all actions for audit trail

**Task Created:**
```
Title: 🚨 CRITICAL Ad Performance Alert: Summer Sale
Priority: urgent
Assigned: Marcus
Mentions Kenny: Yes

Description:
Campaign: Summer Sale

Performance Issues:
- CTR is 0.40% (threshold: 1.00%)
- CPA is R1,000.00 (threshold: R150)
- ROAS is 0.60x (threshold: 2.0x)

Current Metrics:
- Impressions: 50,000
- Clicks: 200
- Conversions: 5
- Spend: R5,000.00
- Revenue: R3,000.00

⚠️ CAMPAIGN HAS BEEN AUTO-PAUSED

Immediate review and action required.
```

## Customization

Override default thresholds:

```typescript
import { GoogleAdsAgent } from '@/services/agents/ads-agent'

const customAgent = new GoogleAdsAgent({
  ctrThreshold: 1.5,      // Require 1.5% CTR
  cpaThreshold: 100,      // Max R100 CPA
  roasThreshold: 3.0,     // Need 3x ROAS
  minConversions: 20,     // Wait for 20 conversions
  autoPauseEnabled: false // Manual pausing only
})

await customAgent.monitorCampaignPerformance()
```

## Troubleshooting

**"Google Ads credentials not configured"**
- Check `.env.local` has all 5 `GOOGLE_ADS_*` variables
- Verify no typos in variable names

**"Campaign not found in database"**
- Normal for first run - campaign auto-created on sync
- Check `ad_campaigns` table after first monitoring run

**No alerts generated**
- Campaign needs ≥10 conversions for analysis
- Check if metrics meet threshold criteria
- Review logs in `squad_messages`

## Next Steps

1. ✅ Install and configure (you're here!)
2. Add to orchestrator for automated monitoring
3. Review and adjust thresholds for your business
4. Set up Google Ads API credentials
5. Test with real campaign data
6. Monitor `squad_tasks` for alerts

## Support

For detailed documentation, see `ADS_AGENT.md`

Questions? Check:
- Google Ads API docs: https://developers.google.com/google-ads/api
- Supabase setup: `CHECK_SUPABASE.md`
- Agent architecture: `services/agents/README.md`
