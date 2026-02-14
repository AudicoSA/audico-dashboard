# Quote Pricing Intelligence Implementation Summary

## Overview

Implemented a comprehensive intelligent quote pricing engine that uses Claude AI to analyze historical quote acceptance/rejection data and dynamically optimize pricing strategies based on customer segments, product categories, order characteristics, and urgency levels.

## Files Created/Modified

### New Files

1. **`supabase/migrations/020_pricing_optimization_insights.sql`**
   - Creates `pricing_optimization_insights` table for storing AI-learned pricing strategies
   - Creates `quote_outcomes` table for tracking customer acceptance/rejection of quotes
   - Adds customer_segment, urgency_level, order_size_category columns to `quote_requests`
   - Includes proper indexes, RLS policies, and constraints

2. **`lib/quote-pricing-intelligence.ts`**
   - Main pricing intelligence engine using Claude AI
   - Analyzes quote history to discover optimal pricing patterns
   - Provides dynamic pricing recommendations
   - Methods:
     - `runPricingAnalysis()` - Weekly comprehensive analysis
     - `getIntelligentPricing()` - Get pricing recommendation for a quote
     - `analyzeWithClaude()` - Uses Claude to extract pricing patterns
     - `prepareAnalysisData()` - Structures data for AI analysis
     - `storeInsights()` - Saves learned strategies to database

3. **`app/api/workflows/pricing-analysis/route.ts`**
   - API endpoint for triggering pricing analysis
   - POST endpoint runs full analysis workflow
   - GET endpoint for health check
   - Secured with CRON_SECRET

4. **`app/api/quote/outcome/route.ts`**
   - API endpoint for recording quote outcomes
   - POST endpoint records customer acceptance/rejection
   - GET endpoint retrieves outcomes for a quote
   - Automatically updates quote_requests status

5. **`lib/QUOTE_PRICING_INTELLIGENCE.md`**
   - Comprehensive documentation
   - Architecture explanation
   - Usage examples and API documentation
   - Troubleshooting guide

### Modified Files

1. **`services/agents/quote-agent.ts`**
   - Integrated intelligent pricing into `formatQuoteDetails()`
   - Added customer segmentation logic (`determineCustomerSegment()`)
   - Added urgency detection (`determineUrgencyLevel()`)
   - Added order size calculation (`determineOrderSize()`)
   - Added product categorization (`categorizeProduct()`)
   - Updates quote metadata with intelligent pricing data
   - Logs pricing decisions with reasoning to squad_messages

## Key Features Implemented

### 1. Customer Segmentation
- **Enterprise** - Large orders (>R50k)
- **Premium** - Medium-large orders with high acceptance
- **Mid Market** - Medium orders with moderate acceptance
- **Loyal SMB** - Small-medium orders, good acceptance rate
- **Price Sensitive SMB** - Small-medium orders, price-focused
- **Small Buyer** - Small orders
- **New Customer** - No history available

### 2. Product Category Intelligence
Automatically categorizes and learns pricing patterns for:
- Audio equipment (speakers, amplifiers, mixers, microphones)
- Visual equipment (projectors, displays, monitors, screens)
- Cables & accessories (cables, connectors, adapters, mounts)
- Lighting equipment
- Control systems (processors, switchers)
- General equipment

### 3. Urgency-Based Pricing
Detects urgency from quote request text:
- **Urgent** - "urgent", "asap", "immediately", "emergency", "rush"
- **High** - "soon", "quickly", "fast", "this week", "deadline"
- **Medium** - "next week", "upcoming", "planning"
- **Low** - Standard timing

### 4. Order Size Optimization
Categorizes by value and quantity:
- **Enterprise** - >R100k or >100 items
- **Large** - >R30k or >30 items
- **Medium** - >R10k or >10 items
- **Small** - <R10k or <10 items

### 5. Bundling Analysis
- Compares single-item vs multi-item quote performance
- Identifies when bundling improves acceptance
- Recommends bundle-specific markup adjustments

### 6. Customer History Learning
- Tracks individual customer preferences
- Learns preferred markup ranges
- Identifies price sensitivity patterns
- Adapts pricing for returning customers

## Claude AI Integration

### Analysis Process

The system uses Claude to analyze structured quote data and extract patterns:

1. **Data Preparation**
   - Aggregates quote outcomes by segment, category, urgency, order size
   - Calculates acceptance rates and average markups
   - Identifies bundling patterns
   - Collects rejection reasons

2. **AI Analysis**
   - Sends structured data to Claude with specific prompts
   - Claude identifies optimal markup ranges per segment
   - Discovers price sensitivity patterns
   - Generates strategic recommendations
   - Provides confidence scores

3. **Insight Storage**
   - Parses Claude's JSON response
   - Stores insights in `pricing_optimization_insights` table
   - Updates existing insights or creates new ones
   - Maintains confidence scores and sample sizes

4. **Dynamic Application**
   - QuoteAgent retrieves relevant insights
   - Applies multiple pricing factors with weights
   - Computes final markup with reasoning
   - Logs decision process for transparency

## Pricing Calculation Logic

```typescript
base_markup = 25% (default)

// Customer segment (highest priority)
if (segment_insight exists && confidence > 0.7) {
  base_markup = segment.optimal_markup_avg
}

// Product category adjustment
if (category_insight exists && confidence > 0.7) {
  base_markup = category.optimal_markup_avg
}

// Urgency premium (50% weight)
if (urgency is 'high' or 'urgent') {
  base_markup += urgency_premium * 0.5
}

// Order size adjustment (30% weight)
if (size_adjustment exists) {
  base_markup += size_adjustment * 0.3
}

// Bundling bonus
if (multiple items && bundling_improves_acceptance) {
  base_markup += 2%
}

// Customer history (40% weight)
if (customer has 3+ accepted quotes) {
  base_markup = weighted_average(base_markup, historical_avg)
}

return {
  base_markup: final_calculated_markup,
  min_markup: base_markup - 5%,
  max_markup: base_markup + 5%,
  confidence: average_confidence_score,
  reasoning: "explanation of adjustments",
  adjustments: [list of factors applied],
  risk_level: 'low' | 'medium' | 'high'
}
```

## Database Schema

### pricing_optimization_insights
```sql
- insight_type: customer_segment | product_category | order_size | urgency_level | bundling_strategy
- segment_key: identifier (e.g., 'enterprise', 'audio', 'large', 'urgent')
- optimal_markup_min/max/avg: learned optimal markup percentages
- acceptance_rate: success rate for this strategy
- sample_size: number of quotes analyzed
- confidence_score: 0-1 reliability indicator
- insights_data: detailed pattern information
- patterns: supporting data and characteristics
- recommendations: strategic advice
```

### quote_outcomes
```sql
- quote_request_id: links to quote_requests
- quote_number: human-readable quote ID
- outcome: accepted | rejected | negotiation | no_response | pending
- customer_email, customer_name, customer_segment
- total_quoted_amount, final_amount
- items: JSONB array with product details and markups
- urgency_level, order_size_category
- rejection_reason: for learning from failures
- negotiation_details: if price was negotiated
- response_time_hours: customer decision speed
```

## API Usage

### Trigger Pricing Analysis (Weekly)
```bash
curl -X POST https://your-domain.com/api/workflows/pricing-analysis \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

### Record Quote Acceptance
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

### Record Quote Rejection
```bash
curl -X POST https://your-domain.com/api/quote/outcome \
  -H "Content-Type: application/json" \
  -d '{
    "quoteRequestId": "uuid",
    "quoteNumber": "AUD-Q-20240213-1234",
    "outcome": "rejected",
    "rejectionReason": "Price too high - competitor quoted R45k",
    "responseTimeHours": 72
  }'
```

## Integration Flow

### Quote Generation with Intelligent Pricing

1. **QuoteAgent.generateCustomerQuote()** called
2. Fetch quote request and supplier responses
3. Select best supplier pricing
4. **Call `formatQuoteDetails()`:**
   - Determine customer segment from history
   - Detect urgency level from request text
   - Calculate order size from items
   - Categorize each product
   - **Call `quotePricingIntelligence.getIntelligentPricing()`:**
     - Fetch customer profile
     - Retrieve relevant insights (segment, category, urgency, size, bundling)
     - Calculate base markup from segments
     - Apply product category adjustments
     - Add urgency premium if applicable
     - Adjust for order size
     - Factor in customer history
     - Compute confidence and risk level
   - Apply markup to each item
   - Log pricing decision with full reasoning
5. Generate PDF with intelligently priced quote
6. Store metadata including pricing strategy used
7. Create approval task for Kenny

### Learning from Outcomes

1. Customer responds to quote (accept/reject/negotiate)
2. Outcome recorded via `/api/quote/outcome` endpoint
3. Data stored in `quote_outcomes` table
4. Weekly cron triggers `/api/workflows/pricing-analysis`
5. System analyzes last 180 days of outcomes
6. Claude AI extracts patterns and strategies
7. Insights updated in `pricing_optimization_insights` table
8. Future quotes automatically use learned strategies

## Minimum Data Requirements

- **10 quote outcomes** minimum to start analysis
- **5 samples per segment** for segment-specific insights
- **3 samples per category** for category insights
- **20+ samples** recommended for high confidence

System gracefully falls back to defaults when insufficient data available.

## Benefits

### For Sales Team
- Higher quote acceptance rates through optimized pricing
- Data-driven pricing confidence
- Reduced negotiation cycles
- Personalized customer pricing

### For Business
- Margin optimization - balance acceptance and profit
- Customer intelligence - understand segment behaviors
- Market insights - competitive positioning
- Strategic guidance - data-backed pricing decisions

### For Revenue
- Increase average margins on value-driven segments
- Reduce lost deals due to overpricing
- Identify upsell opportunities
- Optimize volume pricing strategies

## Next Steps for Production Use

1. **Set up automated analysis:**
   ```bash
   # Add to cron or Vercel scheduled functions
   # Every Monday at 2 AM
   0 2 * * 1 curl -X POST https://your-domain.com/api/workflows/pricing-analysis \
     -H "Authorization: Bearer ${CRON_SECRET}"
   ```

2. **Start tracking outcomes:**
   - Train team to record quote outcomes
   - Set up email parsing to auto-detect acceptances
   - Create dashboard for outcome tracking

3. **Monitor performance:**
   - Track acceptance rate trends
   - Monitor confidence score improvements
   - Review pricing adjustments in squad_messages
   - Analyze segment performance

4. **Refine segments:**
   - Adjust customer segment thresholds based on your business
   - Add custom segments as patterns emerge
   - Update product categories for your inventory

5. **Tune weights:**
   - Adjust factor weights in `getIntelligentPricing()`
   - Experiment with adjustment multipliers
   - A/B test different strategies

## Technical Notes

- Uses Anthropic's Claude 3.5 Sonnet for analysis
- Requires `@anthropic-ai/sdk` (already in package.json)
- Supabase RLS policies allow authenticated access
- All tables have proper indexes for performance
- Graceful fallbacks when AI or data unavailable
- Comprehensive error handling and logging
- Transaction safety for critical operations

## Documentation

Complete documentation available in:
- `lib/QUOTE_PRICING_INTELLIGENCE.md` - Full system guide
- `AGENTS.md` - Updated with pricing intelligence info
- Code comments throughout implementation
