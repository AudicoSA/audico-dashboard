# Predictive Quote Opportunity Detection System

## Overview

The Predictive Quote Agent is an AI-powered system that analyzes customer behavior patterns to proactively identify quote opportunities before customers make contact. It uses historical data, interaction patterns, seasonal trends, and competitive signals to predict when customers are likely to need quotes.

## Features

### 1. Multi-Signal Opportunity Detection

The system analyzes four key trigger types:

- **Repeat Purchase Due**: Detects when customers are approaching their typical repurchase cycle
- **Seasonal Opportunity**: Identifies seasonal buying patterns based on historical data
- **Product Interest Detected**: Analyzes recent interactions for purchase intent signals
- **Competitor Mention**: Flags urgent opportunities when customers mention competitors

### 2. Intelligent Scoring

Each opportunity receives:
- **Confidence Score** (0-1): Overall likelihood of conversion
- **Priority Level**: Low, Medium, High, or Urgent based on confidence and value
- **Suggested Discount**: AI-calculated discount percentage (0-25%)
- **Product Predictions**: List of likely products with individual confidence scores

### 3. Automated Actions

**High Confidence (>80%)**:
- Automatically generates proactive quote requests
- Creates entries in quote_requests table
- Triggers supplier contact workflow

**Medium Confidence (60-80%)**:
- Creates review tasks for Kenny
- Includes detailed customer intelligence
- Suggests recommended actions

**Low Confidence (<60%)**:
- Logged but no immediate action
- Available for manual review

### 4. Customer Intelligence

Each opportunity includes:
- Last purchase date and frequency
- Average order value
- Purchase cycle patterns
- Interaction history signals
- Seasonal buying patterns
- Competitor mentions
- Predicted next purchase date

## Database Schema

### predictive_quote_opportunities

```sql
CREATE TABLE predictive_quote_opportunities (
  id UUID PRIMARY KEY,
  customer_email TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  predicted_products JSONB NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL,
  trigger_reason TEXT NOT NULL,
  suggested_discount DECIMAL(5,2) NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata JSONB NOT NULL,
  identified_at TIMESTAMP WITH TIME ZONE NOT NULL,
  actioned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

### Status Values
- `new`: Newly identified opportunity
- `review_pending`: Awaiting Kenny's review
- `quote_generated`: Proactive quote created
- `contacted`: Customer has been reached out to
- `converted`: Successfully converted to order
- `dismissed`: Opportunity dismissed or not pursued

## API Endpoints

### Cron Job (Daily at 9 AM)
```
GET /api/cron/predictive-quotes/analyze
Authorization: Bearer {CRON_SECRET}
```

### Manual Trigger
```
POST /api/predictive-quotes/trigger
```

Response:
```json
{
  "success": true,
  "opportunities_found": 15,
  "high_confidence_count": 5,
  "medium_confidence_count": 7,
  "tasks_created": 7,
  "quotes_generated": 5,
  "timestamp": "2024-02-13T09:00:00Z"
}
```

## Analytics Dashboard

Access at: `/squad/analytics/predictive-quotes`

### Key Metrics
- Total opportunities identified
- High confidence opportunities (>80%)
- Conversion rate
- Average confidence score
- Pipeline by status
- Opportunities by trigger reason
- Revenue impact
- Top predicted products
- Conversion rates by trigger type

### Visualizations
- Opportunity pipeline funnel
- Confidence score distribution
- Conversion timeline
- Trigger reason breakdown
- Product demand analysis
- Revenue projections

## Usage

### View Opportunities
```
/predictive-quotes
```

Lists all identified opportunities with:
- Customer details
- Predicted products
- Confidence scores
- Trigger reasons
- Current status
- Suggested discounts

### Run Manual Analysis
Click "Run Analysis Now" to trigger immediate customer scoring

### Monitor Performance
Visit analytics dashboard to track:
- Conversion rates by trigger type
- Revenue impact
- Opportunity pipeline health
- Prediction accuracy

## Algorithm Details

### Repeat Purchase Detection
```typescript
1. Calculate average purchase frequency from history
2. Measure days since last purchase
3. Calculate "dueness factor" = days_since / avg_frequency
4. Assign confidence based on dueness factor:
   - 0.9-1.2: 85% confidence (due window)
   - 0.8-1.3: 70% confidence (approaching)
   - 0.7+: 55% confidence (soon)
```

### Seasonal Pattern Detection
```typescript
1. Group purchases by month
2. Compare current month to historical average
3. Identify products purchased in current month
4. Confidence = min(current_month_purchases / avg, 1) * 0.75
```

### Product Interest Detection
```typescript
1. Analyze recent interactions (3 months)
2. Look for intent keywords: quote, price, cost, buy, etc.
3. Extract product mentions from conversations
4. Calculate recency and frequency factors
5. Confidence = (recency * 0.6 + frequency * 0.4) * 0.9
```

### Competitor Mention Detection
```typescript
1. Scan for competitor keywords
2. Identify products mentioned with competitors
3. Calculate urgency based on recency
4. High confidence (0.95) for recent mentions
5. Mark as URGENT priority
```

### Discount Calculation
```typescript
base_discount = 0
if purchases >= 10: base_discount = 15%
else if purchases >= 5: base_discount = 10%
else if purchases >= 3: base_discount = 5%
else: base_discount = 3%

if avg_order_value > 50k: base_discount += 5%
else if avg_order_value > 20k: base_discount += 3%

if confidence > 0.9: base_discount += 2%

return min(base_discount, 25%)
```

## Integration Points

### Triggered By
- Daily cron job at 9 AM
- Manual trigger via UI or API

### Integrates With
- `customer_interactions`: Source of interaction data
- `quote_outcomes`: Source of purchase history
- `quote_requests`: Creates proactive quote requests
- `squad_tasks`: Creates review tasks for Kenny
- `squad_messages`: Logs activity to squad feed

### Triggers
- Quote generation workflow
- Task creation for review
- Squad notifications

## Performance Considerations

### Optimization
- Analyzes only active customers (last 6 months)
- Limits interaction lookback to 3 months
- Purchase history limited to 1 year
- Batch processes customer analysis
- Upserts to prevent duplicates

### Scalability
- Processes ~50-100 customers per minute
- Suitable for customer bases up to 10,000
- Indexed on key lookup fields
- Efficient JSONB queries

## Monitoring

### Key Logs
```typescript
'🔮 Starting predictive quote opportunity analysis'
'📊 Analyzed X customers, found Y opportunities'
'🎯 Generating proactive quote for {customer}'
'✅ Analysis complete: X quotes generated, Y tasks created'
```

### Squad Messages
All activity logged to `squad_messages` table with:
- Agent name: PredictiveQuoteAgent
- Opportunity details
- Action taken
- Timestamps

## Future Enhancements

### Planned Features
1. Machine learning model training from conversion data
2. Integration with OpenCart order history
3. Email engagement scoring
4. Product affinity analysis
5. Customer lifetime value prediction
6. A/B testing of discount strategies
7. Automatic email generation for high-confidence opportunities
8. SMS/WhatsApp notifications for urgent opportunities

### Analytics Improvements
1. Prediction accuracy tracking
2. False positive/negative analysis
3. ROI calculations
4. Customer segment performance
5. Seasonal trend forecasting
6. Competitive intelligence dashboard

## Configuration

### Environment Variables
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CRON_SECRET=your_cron_secret
```

### Cron Schedule
```json
{
  "path": "/api/cron/predictive-quotes/analyze",
  "schedule": "0 9 * * *"
}
```

Runs daily at 9:00 AM UTC

## Testing

### Manual Test
1. Navigate to `/predictive-quotes`
2. Click "Run Analysis Now"
3. Check results in opportunities list
4. Verify tasks created in squad dashboard
5. Check quote_requests for auto-generated quotes

### API Test
```bash
curl -X POST http://localhost:3001/api/predictive-quotes/trigger
```

## Support

For issues or questions:
1. Check squad_messages for agent activity
2. Review opportunities in `/predictive-quotes`
3. Check analytics dashboard for trends
4. Examine database logs in agent_logs table
