# Analytics Agent - AI-Powered Business Intelligence

The Analytics Agent provides advanced business intelligence and predictive analytics capabilities using historical data from OpenCart and Supabase.

## Features

### 1. Time-Series Sales Forecasting
- **Exponential smoothing** algorithm for accurate trend prediction
- 7-30 day forecasts with confidence intervals
- Automatic trend detection (up/down/stable)
- Visual forecast charts with upper/lower bounds

**API Endpoint:**
```
GET /api/analytics?action=sales-forecast&days=7
```

### 2. Inventory Stockout Predictions
- **Velocity-based analysis** using 30-day sales history
- Predicts exact stockout dates
- Calculates optimal reorder points and quantities
- Risk categorization (low/medium/high/critical)
- Considers lead time and safety stock

**API Endpoint:**
```
GET /api/analytics?action=stockout-predictions
```

**Key Metrics:**
- Daily velocity (units/day)
- Days until stockout
- Recommended reorder point
- Recommended reorder quantity
- Confidence score

### 3. Customer Churn Risk Analysis
- Multi-factor churn probability calculation
- Analyzes interaction patterns and order frequency
- Identifies declining engagement trends
- Provides actionable retention recommendations

**API Endpoint:**
```
GET /api/analytics?action=churn-analysis
```

**Contributing Factors:**
- Days since last interaction
- Days since last order vs. customer average
- Interaction frequency trends (30-day comparison)
- Purchase behavior patterns

**Risk Levels:**
- **Low**: < 25% churn probability
- **Medium**: 25-50% churn probability
- **High**: 50-75% churn probability
- **Critical**: > 75% churn probability

### 4. Product Recommendation Engine
- Identifies high-opportunity products
- Analyzes search-to-purchase conversion gaps
- Detects cart abandonment patterns
- Prioritizes inventory decisions

**API Endpoint:**
```
GET /api/analytics?action=product-recommendations
```

**Analysis Metrics:**
- Search count
- View count
- Add-to-cart count
- Purchase count
- Conversion rate
- Search-to-purchase gap (opportunity indicator)

**Suggested Actions:**
- High interest + low conversion → Review pricing/description
- Out of stock + high demand → Emergency reorder
- High cart abandonment → Price/checkout optimization
- Low conversion + high views → Improve product media

### 5. Anomaly Detection
- Statistical anomaly detection using z-scores
- Monitors multiple business metrics
- Automatic severity classification
- Context-aware recommendations

**API Endpoint:**
```
GET /api/analytics?action=anomaly-detection
```

**Monitored Metrics:**
- Daily orders
- Daily revenue
- Support tickets
- Ad spend
- Website traffic

**Detection Method:**
- Calculates mean and standard deviation from 30-day history
- Flags deviations > 2 standard deviations
- Severity: info (2-2.5σ), warning (2.5-3σ), critical (>3σ)

**Alerts Include:**
- Expected vs. actual values
- Deviation percentage
- Potential causes
- Recommended actions

### 6. Executive Report Generation
- Comprehensive business intelligence summary
- Combines all analytics modules
- Identifies opportunities and risks
- Provides actionable insights

**API Endpoint:**
```
GET /api/analytics?action=executive-report
POST /api/analytics { action: 'generate-report' }
```

**Report Sections:**
- **Summary**: Revenue, orders, trends, active customers
- **Key Metrics**: Forecasts, predictions, risks, opportunities
- **Opportunities**: Revenue growth potential, market expansion
- **Risks**: Stockouts, churn, anomalies with mitigation strategies

## UI Components

### Mission Control Integration
The Analytics Agent appears as a new tab in Mission Control (`/squad`):
- Click "Analytics" in the agent tabs
- View real-time analytics dashboard
- Switch between different analysis views

### Dashboard Views
1. **Overview**: High-level metrics and quick actions
2. **Forecast**: 7-day sales predictions with confidence intervals
3. **Inventory**: Stockout predictions and reorder recommendations
4. **Churn**: At-risk customers with retention actions
5. **Products**: Product opportunities ranked by priority
6. **Report**: Executive summary with opportunities and risks

### Features
- Real-time data refresh
- One-click report generation
- Visual charts and graphs
- Color-coded risk indicators
- Actionable recommendations

## Data Sources

### OpenCart Integration
- Historical order data from `opencart_orders_cache`
- Product sales by date and quantity
- Customer purchase patterns
- Order totals and currency

### Supabase Integration
- Customer interaction history
- Customer profiles and metrics
- Support ticket tracking
- Social media interactions

### Mock Data Fallback
When database data is unavailable, the system generates realistic mock data for:
- Sales trends (90 days)
- Product inventory and sales
- Customer interactions
- Product search/view patterns
- Metric histories

## Predictive Models

### Time-Series Forecasting
**Algorithm**: Exponential Smoothing with Trend
- Alpha (smoothing factor): 0.3 (default)
- Captures both level and trend components
- Generates confidence intervals using historical error

**Use Cases**:
- Revenue forecasting
- Order volume prediction
- Seasonal trend analysis

### Inventory Prediction
**Algorithm**: Velocity Analysis
- 30-day rolling average calculation
- Lead time consideration (default: 7 days)
- Safety stock buffer (default: 3 days)
- Confidence scoring based on consistency

**Formula**:
```
Daily Velocity = Total Sold (30 days) / Days with Data
Days Until Stockout = Current Stock / Daily Velocity
Reorder Point = Daily Velocity × (Lead Time + Safety Days)
Reorder Quantity = Daily Velocity × 30
```

### Churn Prediction
**Algorithm**: Multi-Factor Scoring
- Interaction recency score (0-0.4)
- Order frequency score (0-0.35)
- Engagement trend score (0-0.25)
- Total probability: Sum of factors (max 1.0)

**Thresholds**:
- > 90 days no interaction: 0.4 weight
- > 60 days no interaction: 0.25 weight
- Order gap > 2× average: 0.35 weight
- Engagement drop > 50%: 0.25 weight

### Anomaly Detection
**Algorithm**: Z-Score Statistical Analysis
- Calculates 30-day mean and standard deviation
- Z-score = (Current - Mean) / StdDev
- Flags |Z| > 2.0 as anomalous

**Context-Aware Recommendations**:
Each metric type has specialized cause/action recommendations based on whether the anomaly is higher or lower than expected.

## API Usage Examples

### Get All Analytics
```typescript
const response = await fetch('/api/analytics')
const data = await response.json()
// Returns: sales_forecast, stockout_predictions, churn_analyses, 
//          product_recommendations, anomalies
```

### Generate Executive Report
```typescript
const response = await fetch('/api/analytics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'generate-report' })
})
const { report } = await response.json()
```

### Custom Forecast Period
```typescript
const response = await fetch('/api/analytics?action=sales-forecast&days=14')
const { forecast } = await response.json()
```

## Performance Considerations

- All analytics are computed on-demand (no pre-caching)
- Typical response time: 500-2000ms depending on data volume
- Parallel execution of independent analyses
- Efficient database queries with date filtering
- Mock data generation for missing/insufficient data

## Future Enhancements

### Planned Features
- [ ] ML-based churn prediction with TensorFlow.js
- [ ] Seasonal decomposition for sales forecasting
- [ ] Multi-variate anomaly detection
- [ ] Predictive ad spend optimization
- [ ] Customer lifetime value prediction
- [ ] Real-time alert notifications
- [ ] Custom report scheduling
- [ ] Export to PDF/Excel
- [ ] Historical report comparison
- [ ] A/B test analysis

### Data Integration Roadmap
- [ ] Google Analytics integration
- [ ] Facebook/Instagram Ads data
- [ ] Email campaign metrics
- [ ] WhatsApp conversation analytics
- [ ] Product review sentiment analysis

## Troubleshooting

### No forecast data
- Requires at least 14 days of historical sales data
- Check `opencart_orders_cache` table has recent orders
- Verify date fields are properly formatted

### Inaccurate predictions
- More data = better predictions (minimum 30 days recommended)
- Seasonal businesses may need seasonal decomposition
- Check for data quality issues (missing dates, outliers)

### Slow API responses
- Large datasets (>1000 records) may take longer
- Consider implementing caching for frequently accessed reports
- Use specific action endpoints instead of fetching all analytics

## Architecture

```
┌─────────────────────────────────────────┐
│      Analytics Agent UI                 │
│  (AnalyticsAgentPanel Component)        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      Analytics API Route                │
│      /api/analytics                     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      AnalyticsAgent Service             │
│  (services/agents/analytics-agent.ts)   │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
┌──────────────┐ ┌────────────────┐
│  Predictive  │ │  Data Fetcher  │
│    Models    │ │                │
└──────────────┘ └────────┬───────┘
                          │
                          ▼
                 ┌────────────────┐
                 │   Supabase     │
                 │   OpenCart     │
                 └────────────────┘
```

## License

Part of the Audico Dashboard system.
