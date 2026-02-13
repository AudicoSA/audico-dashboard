# Quote Pricing Intelligence Engine

## Overview

The Quote Pricing Intelligence Engine uses Claude AI to analyze historical quote acceptance/rejection data and dynamically optimize pricing strategies. Instead of flat markup rules, it learns patterns from customer behavior to maximize quote acceptance rates while maintaining healthy margins.

## Architecture

### Core Components

1. **`quote-pricing-intelligence.ts`** - Main intelligence engine
   - Analyzes quote history using Claude AI
   - Learns optimal pricing strategies
   - Provides dynamic pricing recommendations
   - Stores insights in database

2. **Database Tables**
   - `pricing_optimization_insights` - Learned pricing strategies
   - `quote_outcomes` - Customer acceptance/rejection tracking
   - Updated `quote_requests` with segment/urgency/order size metadata

3. **Integration Points**
   - `QuoteAgent.generateCustomerQuote()` - Applies intelligent pricing
   - API endpoints for analysis and outcome tracking
   - Automated weekly analysis workflow

## Key Features

### 1. Customer Segmentation Analysis

Automatically segments customers based on historical behavior:
- **Enterprise** - Large orders (>R50k), high value
- **Premium** - Medium-large orders with high acceptance
- **Mid Market** - Medium orders with moderate acceptance
- **Loyal SMB** - Small-medium orders, good acceptance
- **Price Sensitive SMB** - Small-medium orders, price-focused
- **Small Buyer** - Small orders, varied behavior
- **New Customer** - No history, default strategy

### 2. Product Category Intelligence

Identifies price sensitivity by product category:
- Audio equipment pricing patterns
- Visual equipment pricing patterns
- Cables & accessories pricing patterns
- Lighting equipment patterns
- Control systems patterns

Determines if category is:
- **Value-driven** - Customers focus on quality/features (higher markups possible)
- **Price-sensitive** - Customers compare prices (lower markups needed)

### 3. Urgency-Based Pricing Power

Analyzes how urgency affects pricing acceptance:
- **Urgent/ASAP** - Customers prioritize speed, accept higher markups
- **High urgency** - Moderate premium possible
- **Medium urgency** - Standard pricing
- **Low urgency** - May require competitive pricing

Keywords detected: "urgent", "asap", "immediately", "rush", "deadline", etc.

### 4. Order Size Optimization

Learns optimal markup adjustments by order size:
- **Enterprise** (>R100k or >100 items) - Volume discounts expected
- **Large** (>R30k or >30 items) - Moderate volume pricing
- **Medium** (>R10k or >10 items) - Standard pricing
- **Small** (<R10k or <10 items) - May support premium pricing

### 5. Bundling Strategy

Analyzes multi-item vs single-item quote performance:
- Identifies if bundling improves acceptance rates
- Recommends bundle pricing adjustments
- Tracks average items per successful quote

### 6. Customer History Learning

For returning customers:
- Tracks historical markup acceptance patterns
- Identifies preferred price ranges
- Measures price sensitivity
- Adapts to individual customer preferences

## How It Works

### Analysis Workflow

1. **Data Collection**
   ```
   quote_outcomes table tracks:
   - Customer acceptance/rejection
   - Final amounts vs quoted amounts
   - Product categories purchased
   - Customer segments
   - Urgency levels
   - Order sizes
   - Rejection reasons
   ```

2. **Claude AI Analysis**
   ```
   Analyzes patterns in:
   - Which markup percentages work for different segments
   - Product category price sensitivity
   - Urgency impact on pricing power
   - Order size vs discount expectations
   - Bundling effectiveness
   - Seasonal patterns
   ```

3. **Insight Storage**
   ```
   pricing_optimization_insights stores:
   - Optimal markup ranges by segment
   - Acceptance rates
   - Confidence scores
   - Pattern descriptions
   - Recommendations
   ```

4. **Dynamic Pricing Application**
   ```
   QuoteAgent applies insights:
   - Identifies customer segment
   - Detects urgency level
   - Calculates order size
   - Categorizes products
   - Retrieves relevant insights
   - Computes intelligent markup
   - Logs reasoning
   ```

### Pricing Recommendation Algorithm

```typescript
baseMarkup = 25% (default)

// Apply customer segment adjustment
if (segment insights available && confidence > 0.7) {
  baseMarkup = segment.optimal_markup_avg
}

// Apply product category adjustment
if (category insights available && confidence > 0.7) {
  baseMarkup = category.optimal_markup_avg
}

// Apply urgency boost
if (urgency === 'high' || 'urgent') {
  baseMarkup += urgency_premium * 0.5
}

// Apply order size adjustment
if (order_size insights available) {
  baseMarkup += size_adjustment * 0.3
}

// Apply bundling bonus
if (multi_item && bundling_improves_acceptance) {
  baseMarkup += 2%
}

// Apply customer history
if (customer has 3+ accepted quotes) {
  baseMarkup = weighted_average(baseMarkup, historical_average)
}

// Calculate confidence and risk
confidence = average(all_insight_confidence_scores)
risk_level = confidence > 0.8 ? 'low' : confidence > 0.6 ? 'medium' : 'high'

return {
  base_markup,
  min_markup: baseMarkup - 5%,
  max_markup: baseMarkup + 5%,
  confidence,
  risk_level,
  reasoning,
  adjustments
}
```

## API Endpoints

### 1. Run Pricing Analysis

**POST** `/api/workflows/pricing-analysis`

Triggers comprehensive analysis of quote history. Should be run weekly.

```bash
curl -X POST https://your-domain.com/api/workflows/pricing-analysis \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

**Response:**
```json
{
  "success": true,
  "result": {
    "insights_generated": 15,
    "customer_segments_analyzed": 6,
    "product_categories_analyzed": 5,
    "patterns_identified": [
      "Enterprise customers accept 22-28% markups on audio equipment",
      "Urgent requests support 5-8% premium pricing",
      "Multi-item quotes have 12% higher acceptance rate"
    ],
    "recommendations": [
      "Increase markup for urgent enterprise audio orders to 30%",
      "Offer 3-5% bundle discount to encourage multi-item purchases"
    ]
  }
}
```

### 2. Record Quote Outcome

**POST** `/api/quote/outcome`

Records customer acceptance or rejection of a quote.

```bash
curl -X POST https://your-domain.com/api/quote/outcome \
  -H "Content-Type: application/json" \
  -d '{
    "quoteRequestId": "uuid",
    "quoteNumber": "AUD-Q-20240213-1234",
    "outcome": "accepted",
    "responseTimeHours": 24
  }'
```

**Outcomes:**
- `accepted` - Customer accepted the quote
- `rejected` - Customer rejected the quote
- `negotiation` - Customer wants to negotiate
- `no_response` - Customer didn't respond
- `pending` - Awaiting customer response

**Optional Fields:**
- `rejectionReason` - Why customer rejected (for learning)
- `negotiationDetails` - Negotiation history and final amount
- `responseTimeHours` - How long customer took to respond

### 3. Get Quote Outcomes

**GET** `/api/quote/outcome?quoteRequestId=uuid`

Retrieves all outcomes for a specific quote request.

## Integration with QuoteAgent

### Before (Flat Markup Rules)

```typescript
// Old approach - static rules
const markup = 25% // or category-based flat rate
const sellingPrice = costPrice * (1 + markup / 100)
```

### After (Intelligent Pricing)

```typescript
// New approach - dynamic, learned pricing
const intelligentPricing = await quotePricingIntelligence.getIntelligentPricing({
  customerEmail: 'customer@example.com',
  customerSegment: 'enterprise',
  products: [
    { name: 'Speaker System', category: 'audio', quantity: 5, costPrice: 10000 }
  ],
  urgencyLevel: 'high',
  orderSizeCategory: 'large'
})

// Results in:
{
  base_markup: 27.5,
  confidence: 0.85,
  reasoning: "Based on enterprise segment (45 samples, 78% acceptance) + high urgency allows 5% premium",
  adjustments: [
    { factor: 'customer_segment', adjustment: +2.5, reason: '...' },
    { factor: 'urgency', adjustment: +2.5, reason: '...' },
    { factor: 'order_size', adjustment: -2.0, reason: '...' }
  ],
  risk_level: 'low'
}
```

## Tracking Quote Outcomes

### Manual Tracking

When you learn a customer's decision:

```typescript
// Customer accepted
await fetch('/api/quote/outcome', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quoteRequestId: 'uuid',
    quoteNumber: 'AUD-Q-20240213-1234',
    outcome: 'accepted',
    responseTimeHours: 48
  })
})

// Customer rejected - capture reason
await fetch('/api/quote/outcome', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quoteRequestId: 'uuid',
    quoteNumber: 'AUD-Q-20240213-1234',
    outcome: 'rejected',
    rejectionReason: 'Price too high - found competitor at R45,000',
    responseTimeHours: 72
  })
})
```

### Email Integration (Future)

Can be automated by:
- Tracking customer responses to quote emails
- Detecting acceptance language ("we accept", "let's proceed")
- Detecting rejection language ("too expensive", "going with another vendor")
- Monitoring for order confirmations

## Automated Workflow Schedule

### Weekly Analysis (Recommended)

```typescript
// Cron: Every Monday at 2 AM
0 2 * * 1

// Analyzes:
- Last 180 days of quote outcomes
- Identifies new patterns
- Updates pricing insights
- Logs findings to squad_messages
```

### Monthly Deep Analysis (Optional)

```typescript
// Cron: First day of month at 3 AM
0 3 1 * *

// Performs:
- Full historical analysis
- Seasonal pattern detection
- Long-term trend identification
- Strategy recommendations
```

## Minimum Data Requirements

For reliable insights:
- **Minimum 10 quote outcomes** to start analysis
- **Minimum 5 samples per segment** for segment-specific insights
- **Minimum 3 samples per category** for category insights
- **Higher confidence with 20+ samples** per insight type

The system gracefully falls back to defaults when insufficient data is available.

## Confidence Scoring

Each insight includes a confidence score (0-1):

- **0.9-1.0** - Very High Confidence (30+ samples, clear patterns)
- **0.8-0.9** - High Confidence (20+ samples, consistent patterns)
- **0.7-0.8** - Good Confidence (10+ samples, reliable patterns)
- **0.6-0.7** - Moderate Confidence (5+ samples, emerging patterns)
- **0.0-0.6** - Low Confidence (few samples, inconsistent data)

Risk levels:
- **Low Risk** - Confidence > 0.8, well-established patterns
- **Medium Risk** - Confidence 0.6-0.8, reasonable patterns
- **High Risk** - Confidence < 0.6, insufficient data

## Benefits

### For Sales

- **Higher acceptance rates** - Pricing aligned with customer expectations
- **Better margins** - Identify where premium pricing works
- **Faster conversions** - Confident pricing reduces negotiation
- **Personalized pricing** - Each customer gets optimal pricing

### For Business Intelligence

- **Customer insights** - Understand segment behavior
- **Product insights** - Identify value vs price-sensitive products
- **Market intelligence** - Learn competitive positioning
- **Trend detection** - Spot seasonal and market changes

### For Revenue Optimization

- **Margin optimization** - Balance acceptance and profit
- **Strategic pricing** - Data-driven pricing decisions
- **Reduced discounting** - Know when premium pricing works
- **Volume strategies** - Optimize large order pricing

## Example Scenarios

### Scenario 1: Enterprise Customer, Urgent Audio Equipment

```
Input:
- Customer: previous orders R75k avg, 85% acceptance
- Products: R50k audio equipment order
- Urgency: "needed by Friday" (urgent)
- Order Size: Large

Analysis:
- Segment: Enterprise (optimal 24-28% markup, 82% acceptance)
- Category: Audio (optimal 26-30% markup, high value perception)
- Urgency: +5% premium allowed for urgent orders
- Order Size: -2% volume discount expected

Result:
- Base Markup: 28% (from enterprise + audio patterns)
- Urgency Adjustment: +2.5% (50% of 5% premium)
- Volume Adjustment: -0.6% (30% of 2% discount)
- Final Markup: 29.9%
- Confidence: 87% (high confidence)
- Risk: Low
```

### Scenario 2: New Customer, Standard Cables Order

```
Input:
- Customer: No history (new customer)
- Products: R3k cables order
- Urgency: None specified (low)
- Order Size: Small

Analysis:
- Segment: New Customer (use conservative default)
- Category: Cables (optimal 35-42% markup, price-driven)
- Urgency: Standard pricing
- Order Size: Small orders support standard markup

Result:
- Base Markup: 38% (from cables category pattern)
- No customer history adjustments
- No urgency/size adjustments
- Final Markup: 38%
- Confidence: 72% (moderate confidence, category data only)
- Risk: Medium
```

## Monitoring and Improvement

### Key Metrics to Track

1. **Acceptance Rate Trends**
   - Overall quote acceptance rate
   - Acceptance rate by customer segment
   - Acceptance rate by product category

2. **Margin Performance**
   - Average markup percentage achieved
   - Margin variance by segment/category
   - Revenue vs margin trade-offs

3. **Pricing Accuracy**
   - Percentage of quotes using intelligent pricing
   - Confidence score distribution
   - Actual vs predicted acceptance rates

4. **Learning Progress**
   - Number of insights generated over time
   - Confidence score improvements
   - Pattern discovery rate

### Dashboard Queries

```sql
-- Overall acceptance rate with intelligent pricing
SELECT 
  COUNT(*) as total_quotes,
  SUM(CASE WHEN outcome = 'accepted' THEN 1 ELSE 0 END) as accepted,
  AVG(CASE WHEN outcome = 'accepted' THEN 1.0 ELSE 0.0 END) as acceptance_rate
FROM quote_outcomes
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Acceptance rate by customer segment
SELECT 
  customer_segment,
  COUNT(*) as quotes,
  AVG(CASE WHEN outcome = 'accepted' THEN 1.0 ELSE 0.0 END) as acceptance_rate,
  AVG(total_quoted_amount) as avg_order_value
FROM quote_outcomes
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY customer_segment
ORDER BY acceptance_rate DESC;

-- Current pricing insights
SELECT 
  insight_type,
  segment_key,
  optimal_markup_avg,
  acceptance_rate,
  sample_size,
  confidence_score
FROM pricing_optimization_insights
ORDER BY confidence_score DESC, acceptance_rate DESC;
```

## Troubleshooting

### Low Confidence Scores

**Problem:** Insights show low confidence (<0.6)

**Solutions:**
1. Collect more quote outcome data (target 20+ per segment)
2. Ensure quote outcomes are being recorded consistently
3. Review data quality - ensure all fields are populated
4. Consider broader segments if data is too sparse

### Inconsistent Recommendations

**Problem:** Similar quotes getting very different markups

**Solutions:**
1. Check if customer segmentation is working correctly
2. Review product categorization logic
3. Verify urgency detection keywords
4. Ensure order size thresholds are appropriate

### Analysis Failures

**Problem:** Weekly analysis endpoint returns errors

**Solutions:**
1. Check Anthropic API key is configured
2. Verify sufficient quote outcome data (minimum 10)
3. Review API rate limits and quotas
4. Check Supabase connectivity and permissions

## Future Enhancements

### Planned Features

1. **Competitor Price Intelligence**
   - Track competitor pricing when customers mention it
   - Adjust pricing based on competitive landscape
   - Alert when losing quotes to specific competitors

2. **Seasonal Pattern Detection**
   - Identify busy/slow seasons
   - Adjust pricing based on demand cycles
   - Optimize inventory and supplier relationships

3. **Product Combination Analysis**
   - Learn which product bundles sell well together
   - Recommend complementary products
   - Optimize cross-selling strategies

4. **Real-time Pricing API**
   - Instant pricing recommendations during quote creation
   - Live confidence scoring
   - Alternative pricing strategies

5. **A/B Testing Framework**
   - Test different pricing strategies
   - Measure impact on acceptance rates
   - Gradually roll out changes

6. **Predictive Quote Success Scoring**
   - Score likelihood of acceptance before sending
   - Suggest adjustments to improve success probability
   - Flag risky quotes for manual review

## Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...        # Claude API key
NEXT_PUBLIC_SUPABASE_URL=...        # Supabase URL
SUPABASE_SERVICE_ROLE_KEY=...       # Supabase service key

# Optional
CRON_SECRET=...                     # For securing cron endpoints
```

### Tuning Parameters

You can adjust these in `quote-pricing-intelligence.ts`:

```typescript
// Data lookback period
const ANALYSIS_DAYS_BACK = 180  // Default: 6 months

// Minimum samples for reliable insights
const MIN_SAMPLES_PER_SEGMENT = 5
const MIN_TOTAL_SAMPLES = 10

// Confidence thresholds
const HIGH_CONFIDENCE = 0.8
const MEDIUM_CONFIDENCE = 0.6

// Adjustment weights
const SEGMENT_WEIGHT = 1.0
const CATEGORY_WEIGHT = 0.5
const URGENCY_WEIGHT = 0.5
const SIZE_WEIGHT = 0.3
const HISTORY_WEIGHT = 0.4
```

## Support

For issues or questions:
1. Check logs in `squad_messages` table
2. Review quote outcomes data quality
3. Verify API connectivity (Anthropic, Supabase)
4. Check this documentation for troubleshooting steps
