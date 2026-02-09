# Analytics Agent - Quick Start Guide

## Overview

The Analytics Agent provides AI-powered business intelligence with predictive analytics, including:
- 📈 Sales forecasting
- 📦 Inventory stockout predictions
- 👥 Customer churn risk analysis
- 🛍️ Product recommendation engine
- ⚠️ Anomaly detection and alerting
- 📊 Automated executive reports

## Setup

### 1. Database Tables

Run the migration to create required tables:

```bash
# Apply the migration in Supabase Dashboard > SQL Editor
# Or using Supabase CLI
supabase db push
```

Tables created:
- `analytics_reports` - Stores generated reports
- `product_analytics` - Product interaction tracking
- `anomaly_alerts` - Detected anomalies
- `churn_risk_history` - Customer churn assessments
- `stockout_predictions` - Inventory predictions

### 2. Environment Variables

Add to `.env.local`:

```bash
# Required for cron jobs
CRON_SECRET=your-secret-key-here

# Existing Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Cron Job (Optional)

For automated daily reports, add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/analytics-report",
      "schedule": "0 8 * * *"
    }
  ]
}
```

## Usage

### Access the Dashboard

1. Navigate to **Mission Control**: `/squad`
2. Click the **Analytics** tab
3. View real-time analytics and insights

### Dashboard Features

#### Overview Tab
- Key metrics at a glance
- Top opportunities
- Critical alerts
- Quick action items

#### Forecast Tab
- 7-day sales forecast
- Confidence intervals
- Trend indicators
- Visual charts

#### Inventory Tab
- Products at risk of stockout
- Days until stockout
- Recommended reorder points
- Reorder quantities

#### Churn Tab
- At-risk customers
- Churn probability scores
- Contributing factors
- Retention recommendations

#### Products Tab
- High-opportunity products
- Search-to-purchase gaps
- Conversion rates
- Inventory status

#### Report Tab
- Executive summary
- Opportunities and risks
- Actionable insights
- Period comparisons

### API Endpoints

#### Get All Analytics
```typescript
const response = await fetch('/api/analytics')
const data = await response.json()
```

Response:
```json
{
  "sales_forecast": [...],
  "stockout_predictions": [...],
  "churn_analyses": [...],
  "product_recommendations": [...],
  "anomalies": [...]
}
```

#### Sales Forecast
```typescript
const response = await fetch('/api/analytics?action=sales-forecast&days=14')
const { forecast } = await response.json()
```

#### Stockout Predictions
```typescript
const response = await fetch('/api/analytics?action=stockout-predictions')
const { predictions } = await response.json()
```

#### Churn Analysis
```typescript
const response = await fetch('/api/analytics?action=churn-analysis')
const { analyses } = await response.json()
```

#### Product Recommendations
```typescript
const response = await fetch('/api/analytics?action=product-recommendations')
const { recommendations } = await response.json()
```

#### Anomaly Detection
```typescript
const response = await fetch('/api/analytics?action=anomaly-detection')
const { anomalies } = await response.json()
```

#### Executive Report
```typescript
const response = await fetch('/api/analytics?action=executive-report')
const { report } = await response.json()
```

Or via POST:
```typescript
const response = await fetch('/api/analytics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'generate-report' })
})
const { report } = await response.json()
```

## Data Requirements

### Minimum Data for Accurate Predictions

#### Sales Forecasting
- **Minimum**: 14 days of order history
- **Recommended**: 90+ days
- **Source**: `opencart_orders_cache` table

#### Inventory Predictions
- **Minimum**: 7 days of sales data per product
- **Recommended**: 30+ days
- **Source**: Order items from `opencart_orders_cache`

#### Churn Analysis
- **Minimum**: 30 days of interaction history
- **Recommended**: 90+ days
- **Source**: `customer_interactions` and `opencart_orders_cache`

#### Product Recommendations
- **Source**: `product_analytics` table (requires event tracking)
- Falls back to mock data if tracking not implemented

#### Anomaly Detection
- **Minimum**: 7 days of historical data
- **Recommended**: 30+ days
- **Source**: Various tables depending on metric

### Mock Data Fallback

If insufficient real data is available, the system automatically generates realistic mock data for:
- Sales trends (90 days)
- Product sales (5 products, 30 days each)
- Customer interactions (10 customers)
- Product search data (5 products)
- Metric histories (30 days)

## Integration with Mission Control

### Squad Tasks

Critical alerts automatically create tasks in Mission Control:

**Stockout Alerts**: Assigned to Thandi (Stock Agent)
```json
{
  "title": "Urgent: 3 Products at Critical Stockout Risk",
  "assigned_agent": "Thandi",
  "priority": "urgent",
  "mentions_kenny": true
}
```

**Anomaly Alerts**: Assigned to Jarvis (Orchestrator)
```json
{
  "title": "Critical Anomaly: Daily Revenue",
  "assigned_agent": "Jarvis",
  "priority": "urgent",
  "mentions_kenny": true
}
```

### Agent Logs

All analytics activities are logged to `agent_logs`:
- Report generation
- Critical alert detection
- Analysis completion
- Errors and warnings

## Common Use Cases

### Daily Morning Routine
1. Check Overview tab for critical alerts
2. Review overnight anomalies
3. Verify inventory predictions
4. Check sales forecast for the week

### Weekly Planning
1. Generate executive report
2. Review opportunities section
3. Prioritize actions based on estimated impact
4. Address top 3 risks

### Customer Retention
1. Open Churn tab
2. Export high-risk customers
3. Launch targeted campaigns
4. Monitor changes in churn probability

### Inventory Management
1. Check Inventory tab daily
2. Sort by risk level
3. Place orders for critical items
4. Adjust reorder points based on recommendations

### Product Strategy
1. Review Products tab
2. Identify high search, low conversion items
3. Improve product pages
4. Monitor inventory for popular items

## Troubleshooting

### No data displayed
**Cause**: Insufficient historical data
**Solution**: 
- Wait for more data to accumulate
- System will use mock data if needed
- Check database tables for records

### Inaccurate forecasts
**Cause**: Limited or irregular data patterns
**Solution**:
- Need at least 30 days for better accuracy
- Seasonal businesses may show variations
- Check for data quality issues

### Slow API responses
**Cause**: Large dataset processing
**Solution**:
- First load may take 2-3 seconds
- Use specific action endpoints
- Consider implementing caching

### Cron job not running
**Cause**: Missing CRON_SECRET or incorrect schedule
**Solution**:
- Verify environment variable is set
- Check Vercel cron logs
- Test endpoint manually with auth header

### Reports not saving
**Cause**: Missing database table or permissions
**Solution**:
- Run migration script
- Check RLS policies
- Verify service role key is correct

## Advanced Configuration

### Custom Forecast Period
Adjust forecast length in API call:
```typescript
// 14-day forecast instead of default 7
fetch('/api/analytics?action=sales-forecast&days=14')
```

### Adjust Anomaly Sensitivity
Edit `lib/analytics/predictive-models.ts`:
```typescript
// Default threshold is 2 standard deviations
// Increase for fewer alerts, decrease for more
AnomalyDetector.detectAnomalies(
  metricName,
  type,
  currentValue,
  historicalData,
  2.5 // Increase sensitivity threshold
)
```

### Custom Reorder Parameters
Edit `lib/analytics/predictive-models.ts`:
```typescript
InventoryPredictor.predictStockout(
  productId,
  productName,
  currentStock,
  salesHistory,
  14 // Increase lead time from 7 to 14 days
)
```

## Performance Tips

1. **Parallel Requests**: Fetch multiple analytics simultaneously
```typescript
const [forecast, predictions, churn] = await Promise.all([
  fetch('/api/analytics?action=sales-forecast'),
  fetch('/api/analytics?action=stockout-predictions'),
  fetch('/api/analytics?action=churn-analysis')
])
```

2. **Caching**: Cache reports for repeated access
```typescript
// Cache executive report for 1 hour
const cacheKey = `analytics-report-${date}`
const cached = await cache.get(cacheKey)
if (cached) return cached
```

3. **Background Processing**: Generate reports via cron instead of on-demand

## Next Steps

1. **Enable Product Tracking**: Implement tracking for product searches, views, cart adds
2. **Custom Reports**: Extend `AnalyticsAgent` with business-specific metrics
3. **Email Alerts**: Add email notifications for critical alerts
4. **Dashboard Widgets**: Add analytics widgets to home page
5. **Historical Comparison**: Compare current period to previous periods

## Support

For issues or questions:
- Check `services/agents/ANALYTICS_AGENT.md` for detailed documentation
- Review agent logs in Supabase: `agent_logs` table
- Check browser console for client-side errors
- Verify API responses in Network tab

## Related Documentation

- `services/agents/ANALYTICS_AGENT.md` - Complete technical documentation
- `lib/analytics/predictive-models.ts` - Algorithm implementations
- `lib/analytics/data-fetcher.ts` - Data source integration
- `app/squad/components/AnalyticsAgentPanel.tsx` - UI components
