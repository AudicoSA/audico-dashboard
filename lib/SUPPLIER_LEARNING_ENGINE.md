# Supplier Learning Engine

Comprehensive pattern learning system that analyzes supplier interactions to continuously improve supplier selection and relationship management.

## Overview

The Supplier Learning Engine analyzes `email_supplier_interactions` data to extract actionable insights about supplier behavior, pricing trends, response patterns, and reliability. It runs as a weekly cron job and integrates findings into the SupplierAgent's ranking algorithm.

## Features

### 1. Response Time Pattern Analysis
- **What it does**: Analyzes email response times to identify when suppliers typically respond
- **Extracts**:
  - Average, min, and max response times
  - Preferred day of week for responses
  - Preferred hour of day for responses
- **Updates**: `suppliers.avg_response_time_hours` and `suppliers.metadata.preferred_contact_time`

### 2. Pricing Trend Analysis
- **What it does**: Tracks markup percentages over time to identify pricing trends
- **Identifies**:
  - Increasing, stable, or decreasing markup trends
  - Price volatility (standard deviation)
  - Category-level pricing patterns
- **Updates**: `supplier_products.metadata.pricing_trend` and `price_volatility`

### 3. Stock Reliability Accuracy Tracking
- **What it does**: Compares quoted stock availability with actual delivery outcomes
- **Calculates**:
  - Stock accuracy rate (correct vs incorrect predictions)
  - Automatic reliability rating adjustments
  - Product-level accuracy scores
- **Updates**: `supplier_products.stock_reliability` and `metadata.stock_accuracy_rate`

### 4. Supplier Response Quality Scores
- **What it does**: Calculates comprehensive quality metrics based on response completeness
- **Components**:
  - Response completeness (40%): Has price, lead time, and stock info
  - Pricing accuracy (30%): Actual prices vs quoted prices
  - Stock accuracy (30%): Stock predictions vs outcomes
- **Updates**: `suppliers.metadata.response_quality_score`

### 5. Emerging Relationship Detection
- **What it does**: Identifies suppliers with increasing interaction frequency
- **Detects**:
  - Growth rate comparing recent vs older interactions
  - Interaction frequency trends
  - Relationship momentum
- **Triggers**: Squad messages for relationships showing >50% growth
- **Updates**: `suppliers.metadata.interaction_frequency_trend`

### 6. Category-Specific Insights
- **What it does**: Generates ranked supplier recommendations per product category
- **Provides**:
  - Top 5 suppliers per category with composite scores
  - Category-level metrics (avg response time, markup, stock accuracy)
  - Reasoning for supplier rankings
- **Outputs**: Squad messages with category insights

### 7. Markup Percentage Updates
- **What it does**: Updates average markup from successful completed quotes
- **Tracks**:
  - Rolling history of last 20 markups per product
  - Weighted average markup calculation
  - Markup trend analysis
- **Updates**: `supplier_products.avg_markup_percentage` and `metadata.markup_history`

## Integration with SupplierAgent

The learning engine enhances the SupplierAgent's ranking algorithm with:

### Enhanced Scoring Components

**Before Learning Engine:**
- Reliability score: 40%
- Relationship strength: 30%
- Stock reliability: 30%

**After Learning Engine Integration:**
- Base reliability score: 30%
- Relationship strength: 20%
- Stock reliability: 20%
- **Response quality score: 15%** (NEW)
- **Stock accuracy rate: 10%** (NEW)
- **Emerging relationship bonus: +5%** (NEW)
- **Pricing trend penalty: -3%** (NEW)

### Usage in SupplierAgent

```typescript
const enhancedData = await supplierLearningEngine.getEnhancedSupplierRanking(supplierId)

if (enhancedData) {
  // Apply enhanced scoring
  score += enhancedData.response_quality_score * 0.15
  score += enhancedData.stock_accuracy_rate * 0.10
  
  // Bonus for emerging relationships
  if (enhancedData.interaction_trend === 'increasing') {
    score += 5
  }
  
  // Penalty for increasing prices
  if (enhancedData.pricing_trend === 'increasing') {
    score -= 3
  }
}
```

## Weekly Cron Job

**Endpoint**: `/api/cron/supplier-learning/analyze`  
**Schedule**: `0 6 * * 1` (Mondays at 6:00 AM UTC)  
**Max Duration**: 300 seconds (5 minutes)

### What It Does

1. Analyzes response time patterns for all suppliers (last 90 days)
2. Identifies pricing trends by product category (last 60 days)
3. Updates stock reliability accuracy from completed quotes (last 90 days)
4. Calculates supplier response quality scores (last 90 days)
5. Detects emerging relationships (comparing 30-60 days vs 0-30 days)
6. Generates category-specific insights with top supplier rankings
7. Updates supplier_products with successful quote markup data (last 30 days)

### Response Format

```json
{
  "success": true,
  "timestamp": "2024-01-15T06:00:00Z",
  "response_patterns_analyzed": 45,
  "pricing_trends_identified": 12,
  "stock_reliability_updated": 78,
  "quality_scores_updated": 45,
  "emerging_relationships": 3,
  "category_insights_generated": 8,
  "supplier_products_updated": 56
}
```

## Database Schema Updates

### suppliers.metadata Fields

```typescript
{
  response_quality_score: number           // 0-100 composite quality score
  preferred_contact_method: string         // Always "email" currently
  preferred_contact_time: string           // e.g., "Monday around 14:00"
  response_completeness_avg: number        // 0-100 completeness percentage
  pricing_accuracy_score: number           // 0-100 pricing accuracy
  stock_accuracy_score: number             // 0-100 stock accuracy
  interaction_frequency_trend: string      // "increasing" | "stable" | "decreasing"
  response_pattern_updated: string         // ISO timestamp
  quality_score_updated: string            // ISO timestamp
  emerging_relationship_detected: string   // ISO timestamp
  min_response_hours: number               // Fastest response time
  max_response_hours: number               // Slowest response time
  growth_rate: number                      // Interaction growth percentage
}
```

### supplier_products.metadata Fields

```typescript
{
  markup_history: Array<{                  // Last 20 markup records
    markup: number
    date: string
    quote_id: string
  }>
  pricing_trend: string                    // "increasing" | "stable" | "decreasing"
  price_volatility: number                 // Standard deviation of markups
  stock_accuracy_count: number             // Successful stock predictions
  stock_inaccuracy_count: number           // Failed stock predictions
  stock_accuracy_rate: number              // 0-100 accuracy percentage
}
```

## Testing the Cron Job

### Manual Trigger (Local)

```bash
curl -X GET http://localhost:3001/api/cron/supplier-learning/analyze \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Manual Trigger (Production)

```bash
curl -X GET https://your-domain.vercel.app/api/cron/supplier-learning/analyze \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Monitoring

### Check Squad Messages

```sql
SELECT * FROM squad_messages
WHERE from_agent = 'SupplierLearningEngine'
ORDER BY created_at DESC
LIMIT 50;
```

### Review Emerging Relationships

```sql
SELECT 
  s.company,
  s.metadata->>'interaction_frequency_trend' as trend,
  s.metadata->>'growth_rate' as growth_rate,
  s.metadata->>'emerging_relationship_detected' as detected_at
FROM suppliers s
WHERE s.metadata->>'interaction_frequency_trend' = 'increasing'
ORDER BY (s.metadata->>'growth_rate')::numeric DESC;
```

### Check Category Insights

```sql
SELECT 
  data->>'category' as category,
  data->'metrics'->>'total_suppliers' as total_suppliers,
  data->'metrics'->>'avg_response_time' as avg_response_time,
  data->'metrics'->>'avg_markup' as avg_markup,
  created_at
FROM squad_messages
WHERE from_agent = 'SupplierLearningEngine'
  AND data->>'type' = 'category_insight'
ORDER BY created_at DESC;
```

### View Updated Markups

```sql
SELECT 
  sp.product_name,
  sp.product_category,
  sp.avg_markup_percentage,
  sp.metadata->>'pricing_trend' as trend,
  sp.metadata->>'price_volatility' as volatility,
  s.company as supplier
FROM supplier_products sp
JOIN suppliers s ON s.id = sp.supplier_id
WHERE sp.metadata ? 'markup_history'
ORDER BY sp.updated_at DESC
LIMIT 50;
```

## Performance Considerations

- **Batch Processing**: Processes suppliers in batches to avoid timeouts
- **90-Day Window**: Most analyses use 90-day rolling window to balance recency with sample size
- **30-Day Updates**: Markup updates use 30-day window for faster processing
- **Indexing**: Relies on existing indexes on `email_supplier_interactions` and `supplier_products`
- **Error Handling**: Individual supplier failures don't stop entire analysis

## Future Enhancements

1. **Machine Learning**: Predict optimal contact times using ML models
2. **Seasonal Patterns**: Detect seasonal trends in pricing and availability
3. **Supplier Clustering**: Group suppliers by behavior patterns
4. **Predictive Alerts**: Proactively alert before relationships deteriorate
5. **Contact Method Analysis**: Analyze effectiveness of different communication channels
6. **Lead Time Accuracy**: Track quoted vs actual delivery times
7. **Volume Discounts**: Learn pricing patterns based on order size
8. **Substitution Patterns**: Identify which suppliers offer good alternatives

## Related Systems

- **SupplierAgent** (`services/agents/supplier-agent.ts`): Uses enhanced rankings
- **SupplierScoringService** (`lib/supplier-scoring.ts`): Weekly relationship scoring
- **ProductSupplierLearner** (`lib/product-supplier-learner.ts`): Quote success learning
- **Email Intelligence Scanner** (`lib/email-intelligence-scanner.ts`): Populates interaction data

## API Methods

### Main Analysis Function

```typescript
await supplierLearningEngine.runWeeklyAnalysis()
```

### Get Enhanced Ranking for SupplierAgent

```typescript
const enhancedData = await supplierLearningEngine.getEnhancedSupplierRanking(supplierId)
```

Returns:
```typescript
{
  response_quality_score: number         // 0-100
  preferred_contact_time?: string        // "Monday around 14:00"
  pricing_trend?: string                 // "increasing" | "stable" | "decreasing"
  stock_accuracy_rate: number            // 0-100
  interaction_trend?: string             // "increasing" | "stable" | "decreasing"
}
```

## Error Handling

- **Graceful Degradation**: If learning engine fails, SupplierAgent uses baseline scores
- **Individual Failures**: One supplier's failure doesn't stop analysis of others
- **Logging**: All errors logged to console and squad_messages
- **Fallback Scores**: Default scores used when data insufficient

## Best Practices

1. **Monitor Weekly**: Check squad messages after each weekly run
2. **Review Emerging Relationships**: Act on high-growth supplier relationships
3. **Track Category Insights**: Use insights to diversify supplier base
4. **Validate Markup Trends**: Confirm pricing trends match market conditions
5. **Update Stock Reliability**: Ensure accuracy ratings reflect reality
6. **Response Quality**: Address low-quality responders proactively
