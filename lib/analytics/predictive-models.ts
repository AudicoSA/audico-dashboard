/**
 * Predictive Analytics Models
 * Time-series forecasting, inventory predictions, churn analysis
 */

export interface TimeSeriesDataPoint {
  date: string
  value: number
  metadata?: any
}

export interface ForecastResult {
  date: string
  predicted_value: number
  confidence_lower: number
  confidence_upper: number
  trend: 'up' | 'down' | 'stable'
}

export interface StockoutPrediction {
  product_id: number
  product_name: string
  current_stock: number
  daily_velocity: number
  predicted_stockout_date: string | null
  days_until_stockout: number | null
  recommended_reorder_point: number
  recommended_reorder_quantity: number
  confidence: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
}

export interface ChurnRiskAnalysis {
  customer_id: string
  customer_name: string
  customer_email: string
  churn_probability: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  contributing_factors: Array<{
    factor: string
    weight: number
    description: string
  }>
  last_interaction_days: number
  last_order_days: number | null
  interaction_frequency_trend: 'increasing' | 'stable' | 'decreasing'
  recommended_actions: string[]
}

export interface ProductRecommendation {
  product_id: number
  product_name: string
  search_count: number
  view_count: number
  add_to_cart_count: number
  purchase_count: number
  conversion_rate: number
  search_to_purchase_gap: number
  inventory_status: 'in_stock' | 'low_stock' | 'out_of_stock'
  recommendation_priority: number
  suggested_actions: string[]
}

export interface AnomalyDetection {
  id: string
  type: 'order' | 'support_ticket' | 'ad_spend' | 'revenue' | 'traffic'
  severity: 'info' | 'warning' | 'critical'
  detected_at: string
  metric_name: string
  expected_value: number
  actual_value: number
  deviation_percentage: number
  description: string
  potential_causes: string[]
  recommended_actions: string[]
  time_period: string
}

/**
 * Time-Series Forecasting using simple moving average and exponential smoothing
 */
export class TimeSeriesForecaster {
  /**
   * Simple Moving Average forecast
   */
  static sma(data: TimeSeriesDataPoint[], window: number, forecastDays: number): ForecastResult[] {
    if (data.length < window) return []
    
    const sortedData = [...data].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    const forecast: ForecastResult[] = []
    let lastDate = new Date(sortedData[sortedData.length - 1].date)
    
    for (let i = 0; i < forecastDays; i++) {
      lastDate = new Date(lastDate)
      lastDate.setDate(lastDate.getDate() + 1)
      
      // Calculate moving average from last window points
      const windowData = sortedData.slice(-window)
      const avg = windowData.reduce((sum, d) => sum + d.value, 0) / window
      
      // Calculate standard deviation for confidence interval
      const variance = windowData.reduce((sum, d) => 
        sum + Math.pow(d.value - avg, 2), 0
      ) / window
      const stdDev = Math.sqrt(variance)
      
      // Calculate trend
      const recentAvg = windowData.slice(-3).reduce((sum, d) => sum + d.value, 0) / 3
      const olderAvg = windowData.slice(0, 3).reduce((sum, d) => sum + d.value, 0) / 3
      const trendDiff = recentAvg - olderAvg
      const trend = Math.abs(trendDiff) < avg * 0.05 ? 'stable' : 
                    trendDiff > 0 ? 'up' : 'down'
      
      forecast.push({
        date: lastDate.toISOString().split('T')[0],
        predicted_value: Math.round(avg * 100) / 100,
        confidence_lower: Math.round(Math.max(0, avg - 1.96 * stdDev) * 100) / 100,
        confidence_upper: Math.round((avg + 1.96 * stdDev) * 100) / 100,
        trend
      })
      
      // Add forecast to data for next iteration
      sortedData.push({ date: lastDate.toISOString(), value: avg })
    }
    
    return forecast
  }
  
  /**
   * Exponential Smoothing forecast
   */
  static exponentialSmoothing(
    data: TimeSeriesDataPoint[], 
    alpha: number = 0.3, 
    forecastDays: number = 7
  ): ForecastResult[] {
    if (data.length === 0) return []
    
    const sortedData = [...data].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    // Initialize with first value
    let smoothedValue = sortedData[0].value
    
    // Smooth historical data
    for (let i = 1; i < sortedData.length; i++) {
      smoothedValue = alpha * sortedData[i].value + (1 - alpha) * smoothedValue
    }
    
    // Calculate error for confidence intervals
    const errors = sortedData.map((d, i) => {
      if (i === 0) return 0
      const predicted = alpha * sortedData[i - 1].value + (1 - alpha) * smoothedValue
      return Math.abs(d.value - predicted)
    })
    const avgError = errors.reduce((sum, e) => sum + e, 0) / errors.length
    
    const forecast: ForecastResult[] = []
    let lastDate = new Date(sortedData[sortedData.length - 1].date)
    
    // Calculate trend from last 7 days
    const last7Days = sortedData.slice(-7)
    const avgLast3 = last7Days.slice(-3).reduce((sum, d) => sum + d.value, 0) / 3
    const avgFirst3 = last7Days.slice(0, 3).reduce((sum, d) => sum + d.value, 0) / 3
    const trendSlope = (avgLast3 - avgFirst3) / 7
    
    for (let i = 0; i < forecastDays; i++) {
      lastDate = new Date(lastDate)
      lastDate.setDate(lastDate.getDate() + 1)
      
      // Apply trend
      const trendAdjusted = smoothedValue + (trendSlope * (i + 1))
      const predicted = Math.max(0, trendAdjusted)
      
      const trendDiff = avgLast3 - avgFirst3
      const trend = Math.abs(trendDiff) < smoothedValue * 0.05 ? 'stable' : 
                    trendDiff > 0 ? 'up' : 'down'
      
      forecast.push({
        date: lastDate.toISOString().split('T')[0],
        predicted_value: Math.round(predicted * 100) / 100,
        confidence_lower: Math.round(Math.max(0, predicted - 1.96 * avgError) * 100) / 100,
        confidence_upper: Math.round((predicted + 1.96 * avgError) * 100) / 100,
        trend
      })
    }
    
    return forecast
  }
}

/**
 * Inventory Prediction using velocity analysis
 */
export class InventoryPredictor {
  static predictStockout(
    productId: number,
    productName: string,
    currentStock: number,
    salesHistory: Array<{ date: string; quantity: number }>,
    leadTimeDays: number = 7
  ): StockoutPrediction {
    // Calculate daily velocity from last 30 days
    const last30Days = salesHistory
      .filter(s => {
        const diff = Date.now() - new Date(s.date).getTime()
        return diff <= 30 * 24 * 60 * 60 * 1000
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    const totalSold = last30Days.reduce((sum, s) => sum + s.quantity, 0)
    const daysWithData = Math.max(last30Days.length, 1)
    const dailyVelocity = totalSold / daysWithData
    
    // Calculate stockout prediction
    let daysUntilStockout: number | null = null
    let predictedStockoutDate: string | null = null
    
    if (dailyVelocity > 0) {
      daysUntilStockout = Math.floor(currentStock / dailyVelocity)
      const stockoutDate = new Date()
      stockoutDate.setDate(stockoutDate.getDate() + daysUntilStockout)
      predictedStockoutDate = stockoutDate.toISOString()
    }
    
    // Calculate recommended reorder point (lead time + safety stock)
    const safetyStockDays = 3
    const recommendedReorderPoint = Math.ceil(dailyVelocity * (leadTimeDays + safetyStockDays))
    
    // Calculate recommended reorder quantity (30 days supply)
    const recommendedReorderQuantity = Math.ceil(dailyVelocity * 30)
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical'
    if (!daysUntilStockout || daysUntilStockout > 30) {
      riskLevel = 'low'
    } else if (daysUntilStockout > 14) {
      riskLevel = 'medium'
    } else if (daysUntilStockout > 7) {
      riskLevel = 'high'
    } else {
      riskLevel = 'critical'
    }
    
    // Calculate confidence based on data consistency
    const velocityVariance = last30Days.length > 1 
      ? this.calculateVariance(last30Days.map(s => s.quantity))
      : 0
    const confidence = Math.max(0.5, 1 - (velocityVariance / (dailyVelocity * dailyVelocity + 1)))
    
    return {
      product_id: productId,
      product_name: productName,
      current_stock: currentStock,
      daily_velocity: Math.round(dailyVelocity * 100) / 100,
      predicted_stockout_date: predictedStockoutDate,
      days_until_stockout: daysUntilStockout,
      recommended_reorder_point: recommendedReorderPoint,
      recommended_reorder_quantity: recommendedReorderQuantity,
      confidence: Math.round(confidence * 100) / 100,
      risk_level: riskLevel
    }
  }
  
  private static calculateVariance(values: number[]): number {
    if (values.length === 0) return 0
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    return variance
  }
}

/**
 * Customer Churn Risk Analysis
 */
export class ChurnPredictor {
  static analyzeChurnRisk(
    customerId: string,
    customerName: string,
    customerEmail: string,
    interactions: Array<{ date: string; type: string }>,
    orders: Array<{ date: string; amount: number }>,
    averageCustomerMetrics: {
      avgInteractionFrequency: number
      avgDaysBetweenOrders: number
    }
  ): ChurnRiskAnalysis {
    const now = Date.now()
    const factors: Array<{ factor: string; weight: number; description: string }> = []
    
    // Factor 1: Days since last interaction
    const lastInteraction = interactions.length > 0 
      ? new Date(interactions[0].date).getTime()
      : 0
    const daysSinceLastInteraction = lastInteraction 
      ? Math.floor((now - lastInteraction) / (24 * 60 * 60 * 1000))
      : 999
    
    let interactionScore = 0
    if (daysSinceLastInteraction > 90) {
      interactionScore = 0.4
      factors.push({
        factor: 'No Recent Interaction',
        weight: 0.4,
        description: `${daysSinceLastInteraction} days since last interaction`
      })
    } else if (daysSinceLastInteraction > 60) {
      interactionScore = 0.25
      factors.push({
        factor: 'Declining Engagement',
        weight: 0.25,
        description: `${daysSinceLastInteraction} days since last interaction`
      })
    }
    
    // Factor 2: Days since last order
    const lastOrder = orders.length > 0 
      ? new Date(orders[0].date).getTime()
      : 0
    const daysSinceLastOrder = lastOrder 
      ? Math.floor((now - lastOrder) / (24 * 60 * 60 * 1000))
      : null
    
    let orderScore = 0
    if (daysSinceLastOrder && daysSinceLastOrder > averageCustomerMetrics.avgDaysBetweenOrders * 2) {
      orderScore = 0.35
      factors.push({
        factor: 'Order Frequency Drop',
        weight: 0.35,
        description: `${daysSinceLastOrder} days since last order (avg: ${averageCustomerMetrics.avgDaysBetweenOrders})`
      })
    }
    
    // Factor 3: Interaction frequency trend
    const last30DaysInteractions = interactions.filter(i => 
      now - new Date(i.date).getTime() <= 30 * 24 * 60 * 60 * 1000
    ).length
    
    const previous30DaysInteractions = interactions.filter(i => {
      const diff = now - new Date(i.date).getTime()
      return diff > 30 * 24 * 60 * 60 * 1000 && diff <= 60 * 24 * 60 * 60 * 1000
    }).length
    
    let frequencyTrend: 'increasing' | 'stable' | 'decreasing' = 'stable'
    let frequencyScore = 0
    
    if (previous30DaysInteractions > 0) {
      const changeRatio = last30DaysInteractions / previous30DaysInteractions
      if (changeRatio < 0.5) {
        frequencyTrend = 'decreasing'
        frequencyScore = 0.25
        factors.push({
          factor: 'Decreasing Engagement',
          weight: 0.25,
          description: `Interaction frequency dropped by ${Math.round((1 - changeRatio) * 100)}%`
        })
      } else if (changeRatio > 1.5) {
        frequencyTrend = 'increasing'
      }
    }
    
    // Calculate total churn probability
    const churnProbability = Math.min(1, interactionScore + orderScore + frequencyScore)
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical'
    if (churnProbability < 0.25) {
      riskLevel = 'low'
    } else if (churnProbability < 0.5) {
      riskLevel = 'medium'
    } else if (churnProbability < 0.75) {
      riskLevel = 'high'
    } else {
      riskLevel = 'critical'
    }
    
    // Generate recommended actions
    const recommendedActions: string[] = []
    if (daysSinceLastInteraction > 60) {
      recommendedActions.push('Send re-engagement email campaign')
      recommendedActions.push('Offer personalized discount or promotion')
    }
    if (daysSinceLastOrder && daysSinceLastOrder > 90) {
      recommendedActions.push('Reach out with new product recommendations')
      recommendedActions.push('Schedule check-in call')
    }
    if (frequencyTrend === 'decreasing') {
      recommendedActions.push('Survey customer satisfaction')
      recommendedActions.push('Review recent interactions for issues')
    }
    
    return {
      customer_id: customerId,
      customer_name: customerName,
      customer_email: customerEmail,
      churn_probability: Math.round(churnProbability * 100) / 100,
      risk_level: riskLevel,
      contributing_factors: factors,
      last_interaction_days: daysSinceLastInteraction,
      last_order_days: daysSinceLastOrder,
      interaction_frequency_trend: frequencyTrend,
      recommended_actions: recommendedActions
    }
  }
}

/**
 * Product Recommendation Engine
 */
export class ProductRecommendationEngine {
  static analyzeProductOpportunities(
    products: Array<{
      product_id: number
      product_name: string
      current_stock: number
      searches: Array<{ date: string }>
      views: Array<{ date: string }>
      cart_adds: Array<{ date: string }>
      purchases: Array<{ date: string }>
    }>
  ): ProductRecommendation[] {
    return products.map(product => {
      const searchCount = product.searches.length
      const viewCount = product.views.length
      const cartAddsCount = product.cart_adds.length
      const purchaseCount = product.purchases.length
      
      // Calculate conversion rate
      const conversionRate = viewCount > 0 
        ? (purchaseCount / viewCount) * 100 
        : 0
      
      // Calculate search-to-purchase gap (opportunity score)
      const searchToPurchaseGap = searchCount > 0 && purchaseCount > 0
        ? searchCount / purchaseCount
        : searchCount > 0 ? searchCount : 0
      
      // Determine inventory status
      let inventoryStatus: 'in_stock' | 'low_stock' | 'out_of_stock'
      if (product.current_stock === 0) {
        inventoryStatus = 'out_of_stock'
      } else if (product.current_stock < 10) {
        inventoryStatus = 'low_stock'
      } else {
        inventoryStatus = 'in_stock'
      }
      
      // Calculate priority score (higher = more opportunity)
      const priorityScore = (
        (searchToPurchaseGap * 0.4) +
        (searchCount * 0.3) +
        ((100 - conversionRate) * 0.3)
      )
      
      // Generate suggested actions
      const suggestedActions: string[] = []
      
      if (searchToPurchaseGap > 5 && conversionRate < 10) {
        suggestedActions.push('High search interest but low conversion - review pricing and product description')
      }
      
      if (inventoryStatus === 'out_of_stock' && searchCount > 10) {
        suggestedActions.push('URGENT: High demand product out of stock - reorder immediately')
      }
      
      if (inventoryStatus === 'low_stock' && searchCount > 5) {
        suggestedActions.push('Low stock with active interest - increase inventory')
      }
      
      if (cartAddsCount > purchaseCount * 2) {
        suggestedActions.push('High cart abandonment - consider price optimization or checkout improvements')
      }
      
      if (conversionRate < 5 && viewCount > 20) {
        suggestedActions.push('Many views but few conversions - improve product images and descriptions')
      }
      
      return {
        product_id: product.product_id,
        product_name: product.product_name,
        search_count: searchCount,
        view_count: viewCount,
        add_to_cart_count: cartAddsCount,
        purchase_count: purchaseCount,
        conversion_rate: Math.round(conversionRate * 100) / 100,
        search_to_purchase_gap: Math.round(searchToPurchaseGap * 100) / 100,
        inventory_status: inventoryStatus,
        recommendation_priority: Math.round(priorityScore * 100) / 100,
        suggested_actions: suggestedActions
      }
    }).sort((a, b) => b.recommendation_priority - a.recommendation_priority)
  }
}

/**
 * Anomaly Detection using statistical methods
 */
export class AnomalyDetector {
  static detectAnomalies(
    metricName: string,
    type: 'order' | 'support_ticket' | 'ad_spend' | 'revenue' | 'traffic',
    currentValue: number,
    historicalData: Array<{ date: string; value: number }>,
    threshold: number = 2
  ): AnomalyDetection | null {
    if (historicalData.length < 7) return null
    
    // Calculate mean and standard deviation
    const values = historicalData.map(d => d.value)
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)
    
    // Calculate z-score
    const zScore = (currentValue - mean) / (stdDev || 1)
    
    // Check if anomaly
    if (Math.abs(zScore) < threshold) return null
    
    const deviationPercentage = Math.round(((currentValue - mean) / mean) * 100)
    
    // Determine severity
    let severity: 'info' | 'warning' | 'critical'
    if (Math.abs(zScore) > 3) {
      severity = 'critical'
    } else if (Math.abs(zScore) > 2.5) {
      severity = 'warning'
    } else {
      severity = 'info'
    }
    
    // Generate description and recommendations
    const isHigher = currentValue > mean
    const description = `${metricName} is ${Math.abs(deviationPercentage)}% ${isHigher ? 'higher' : 'lower'} than expected (${currentValue.toFixed(2)} vs expected ${mean.toFixed(2)})`
    
    const potentialCauses: string[] = []
    const recommendedActions: string[] = []
    
    switch (type) {
      case 'order':
        if (isHigher) {
          potentialCauses.push('Marketing campaign success', 'Seasonal demand spike', 'Competitor issue')
          recommendedActions.push('Verify inventory levels', 'Ensure adequate support staffing', 'Monitor fulfillment capacity')
        } else {
          potentialCauses.push('Website issues', 'Marketing campaign end', 'Competitor promotion', 'Seasonal decline')
          recommendedActions.push('Check website analytics', 'Review recent marketing changes', 'Investigate customer feedback')
        }
        break
      
      case 'support_ticket':
        if (isHigher) {
          potentialCauses.push('Product quality issue', 'Service disruption', 'Recent launch problems')
          recommendedActions.push('Review recent tickets for patterns', 'Check product/service status', 'Increase support capacity')
        } else {
          potentialCauses.push('Improved product quality', 'Better documentation', 'Reduced customer base')
          recommendedActions.push('Document what improved', 'Monitor for delayed issues')
        }
        break
      
      case 'ad_spend':
        if (isHigher) {
          potentialCauses.push('Increased competition', 'Bid strategy change', 'Budget misconfiguration')
          recommendedActions.push('Review ad platform settings', 'Check for unauthorized changes', 'Analyze ROAS')
        } else {
          potentialCauses.push('Campaign pause', 'Budget exhaustion', 'Platform issues')
          recommendedActions.push('Verify campaign status', 'Check budget allocation', 'Review platform alerts')
        }
        break
      
      case 'revenue':
        if (isHigher) {
          potentialCauses.push('Successful promotion', 'Large order', 'Market expansion')
          recommendedActions.push('Analyze source of increase', 'Capitalize on momentum', 'Document winning strategies')
        } else {
          potentialCauses.push('Reduced traffic', 'Increased competition', 'Pricing issues', 'Service problems')
          recommendedActions.push('Emergency review of all channels', 'Check for technical issues', 'Analyze competitor activity')
        }
        break
      
      case 'traffic':
        if (isHigher) {
          potentialCauses.push('SEO improvement', 'Viral content', 'Marketing success')
          recommendedActions.push('Ensure site can handle load', 'Track conversion rate', 'Identify traffic source')
        } else {
          potentialCauses.push('SEO penalty', 'Technical issues', 'Marketing campaign end')
          recommendedActions.push('Check Google Search Console', 'Verify site accessibility', 'Review recent changes')
        }
        break
    }
    
    return {
      id: `anomaly-${type}-${Date.now()}`,
      type,
      severity,
      detected_at: new Date().toISOString(),
      metric_name: metricName,
      expected_value: Math.round(mean * 100) / 100,
      actual_value: currentValue,
      deviation_percentage: deviationPercentage,
      description,
      potential_causes: potentialCauses,
      recommended_actions: recommendedActions,
      time_period: 'current'
    }
  }
}
