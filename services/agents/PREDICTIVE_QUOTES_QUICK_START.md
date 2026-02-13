# Predictive Quote Agent - Quick Start Guide

## What It Does

Automatically identifies customers who are likely to need quotes soon by analyzing:
- Purchase history patterns
- Email interaction signals  
- Seasonal buying trends
- Competitor mentions

## Key URLs

- **Opportunities List**: `/predictive-quotes`
- **Analytics Dashboard**: `/squad/analytics/predictive-quotes`
- **Manual Trigger**: `POST /api/predictive-quotes/trigger`
- **Cron Job**: Daily at 9 AM UTC

## Quick Actions

### View Opportunities
```
Navigate to: /predictive-quotes
```

### Run Analysis Now
```bash
# Via UI
Click "Run Analysis Now" button on /predictive-quotes page

# Via API
curl -X POST http://localhost:3001/api/predictive-quotes/trigger
```

### View Analytics
```
Navigate to: /squad/analytics/predictive-quotes
```

## How It Works

1. **Daily Analysis** (9 AM)
   - Scans all active customers (last 6 months)
   - Analyzes purchase patterns, interactions, seasonal trends
   - Scores each customer for quote opportunity

2. **High Confidence (>80%)**
   - Auto-generates proactive quote request
   - Contacts suppliers
   - Logs to squad feed

3. **Medium Confidence (60-80%)**
   - Creates review task for Kenny
   - Includes customer intelligence
   - Awaits manual decision

4. **Results Stored**
   - All opportunities saved to `predictive_quote_opportunities` table
   - Tracks status through pipeline
   - Measures conversion rates

## Trigger Reasons

1. **Repeat Purchase Due**: Customer approaching typical repurchase time
2. **Seasonal Opportunity**: Historical pattern shows purchases in current month
3. **Product Interest Detected**: Recent inquiries show buying signals
4. **Competitor Mention**: Urgent - customer mentioned competitors

## Key Metrics

- **Confidence Score**: 0-100% likelihood of conversion
- **Priority**: Low / Medium / High / Urgent
- **Suggested Discount**: 0-25% based on customer value
- **Predicted Products**: List with individual confidence scores

## Status Workflow

```
new → review_pending → quote_generated → contacted → converted
                                                   ↘ dismissed
```

## Configuration

### Database Migration
```bash
# Run this migration to create the table
supabase/migrations/021_predictive_quote_opportunities.sql
```

### Cron Schedule (vercel.json)
```json
{
  "path": "/api/cron/predictive-quotes/analyze",
  "schedule": "0 9 * * *"
}
```

## Monitoring

### Check Activity
```sql
-- View recent opportunities
SELECT * FROM predictive_quote_opportunities 
ORDER BY identified_at DESC 
LIMIT 10;

-- Check conversion rates
SELECT * FROM predictive_quote_opportunities_conversion_analytics;

-- View squad messages
SELECT * FROM squad_messages 
WHERE from_agent = 'PredictiveQuoteAgent' 
ORDER BY created_at DESC 
LIMIT 20;
```

### Check Tasks Created
```sql
-- View review tasks
SELECT * FROM squad_tasks 
WHERE assigned_agent = 'PredictiveQuoteAgent' 
AND mentions_kenny = true 
ORDER BY created_at DESC;
```

## Example Opportunity

```json
{
  "customer_email": "john@example.com",
  "customer_name": "John Smith",
  "confidence_score": 0.87,
  "trigger_reason": "repeat_purchase_due",
  "predicted_products": [
    {
      "product_name": "Projector",
      "category": "visual",
      "confidence": 0.92,
      "reasoning": "Purchased 3 times in recent orders"
    }
  ],
  "suggested_discount": 10,
  "priority": "high",
  "metadata": {
    "last_purchase_date": "2024-01-15",
    "avg_order_value": 15000,
    "purchase_frequency_days": 90,
    "next_expected_purchase": "2024-04-15"
  }
}
```

## Common Tasks

### Review Pending Opportunities
1. Go to `/predictive-quotes`
2. Filter by status: "review_pending"
3. Review customer intelligence
4. Decide to contact or dismiss

### Check Conversion Performance
1. Go to `/squad/analytics/predictive-quotes`
2. View conversion rates by trigger type
3. Analyze revenue impact
4. Identify top products

### Update Opportunity Status
```typescript
// Via Supabase
await supabase
  .from('predictive_quote_opportunities')
  .update({ 
    status: 'contacted',
    actioned_at: new Date().toISOString()
  })
  .eq('customer_email', 'customer@example.com')
```

## Troubleshooting

### No Opportunities Found
- Check customer_interactions table has data
- Verify quote_outcomes table has purchase history
- Ensure customers have activity in last 6 months
- Run manual trigger to test

### Low Confidence Scores
- Need more purchase history (min 2 orders)
- Interactions may lack intent signals
- Seasonal patterns may be weak
- Normal for new customers

### Tasks Not Created
- Check squad_tasks table
- Verify confidence thresholds (medium = 0.6-0.8)
- Check squad_messages for errors
- Ensure agent has permissions

## Best Practices

1. **Review Daily**: Check new opportunities each morning
2. **Act on Urgent**: Prioritize competitor mentions
3. **Track Conversions**: Update status when customers respond
4. **Monitor Analytics**: Weekly review of performance trends
5. **Adjust Thresholds**: Fine-tune confidence levels based on results

## Support

- Full documentation: `services/agents/PREDICTIVE_QUOTES.md`
- Code: `services/agents/predictive-quote-agent.ts`
- Dashboard: `app/squad/analytics/predictive-quotes/page.tsx`
- Opportunities UI: `app/predictive-quotes/page.tsx`
