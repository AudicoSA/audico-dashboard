/**
 * Analytics Agent
 * AI-powered business intelligence and predictive analytics
 */

import {
  TimeSeriesForecaster,
  InventoryPredictor,
  ChurnPredictor,
  ProductRecommendationEngine,
  AnomalyDetector,
  type ForecastResult,
  type StockoutPrediction,
  type ChurnRiskAnalysis,
  type ProductRecommendation,
  type AnomalyDetection
} from '@/lib/analytics/predictive-models'

import {
  fetchSalesTrendData,
  fetchProductSalesData,
  fetchCustomerInteractionData,
  fetchProductSearchData,
  fetchMetricData
} from '@/lib/analytics/data-fetcher'

export interface ExecutiveReport {
  generated_at: string
  period: string
  summary: {
    total_revenue: number
    total_orders: number
    revenue_trend: 'up' | 'down' | 'stable'
    order_trend: 'up' | 'down' | 'stable'
    average_order_value: number
    active_customers: number
  }
  key_metrics: {
    sales_forecast: ForecastResult[]
    revenue_forecast: ForecastResult[]
    critical_stockouts: StockoutPrediction[]
    high_churn_risk_customers: ChurnRiskAnalysis[]
    top_product_opportunities: ProductRecommendation[]
    recent_anomalies: AnomalyDetection[]
  }
  opportunities: Array<{
    title: string
    description: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    estimated_impact: string
    recommended_actions: string[]
  }>
  risks: Array<{
    title: string
    description: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    potential_impact: string
    mitigation_actions: string[]
  }>
}

export class AnalyticsAgent {
  /**
   * Generate sales forecast for next 7-30 days
   */
  static async generateSalesForecast(forecastDays: number = 7): Promise<ForecastResult[]> {
    const salesData = await fetchSalesTrendData(90)
    
    if (salesData.length < 14) {
      return []
    }
    
    // Use exponential smoothing for better trend capture
    return TimeSeriesForecaster.exponentialSmoothing(salesData, 0.3, forecastDays)
  }
  
  /**
   * Predict inventory stockouts
   */
  static async predictStockouts(): Promise<StockoutPrediction[]> {
    const productsData = await fetchProductSalesData()
    
    const predictions = productsData.map(product => 
      InventoryPredictor.predictStockout(
        product.product_id,
        product.product_name,
        product.current_stock,
        product.sales_history,
        7
      )
    )
    
    // Sort by risk level and days until stockout
    return predictions.sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      const aRisk = riskOrder[a.risk_level]
      const bRisk = riskOrder[b.risk_level]
      
      if (aRisk !== bRisk) return aRisk - bRisk
      
      if (a.days_until_stockout === null) return 1
      if (b.days_until_stockout === null) return -1
      
      return a.days_until_stockout - b.days_until_stockout
    })
  }
  
  /**
   * Analyze customer churn risk
   */
  static async analyzeChurnRisk(): Promise<ChurnRiskAnalysis[]> {
    const customersData = await fetchCustomerInteractionData()
    
    // Calculate average metrics across all customers
    const avgInteractionFrequency = customersData.reduce((sum, c) => 
      sum + c.interactions.length, 0
    ) / customersData.length
    
    const avgDaysBetweenOrders = 30
    
    const analyses = customersData.map(customer => 
      ChurnPredictor.analyzeChurnRisk(
        customer.customer_id,
        customer.customer_name,
        customer.customer_email,
        customer.interactions,
        customer.orders,
        { avgInteractionFrequency, avgDaysBetweenOrders }
      )
    )
    
    // Return only medium+ risk customers
    return analyses
      .filter(a => a.risk_level !== 'low')
      .sort((a, b) => b.churn_probability - a.churn_probability)
  }
  
  /**
   * Generate product recommendations based on search patterns
   */
  static async generateProductRecommendations(): Promise<ProductRecommendation[]> {
    const searchData = await fetchProductSearchData()
    return ProductRecommendationEngine.analyzeProductOpportunities(searchData)
  }
  
  /**
   * Detect anomalies in business metrics
   */
  static async detectAnomalies(): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = []
    
    const metrics: Array<{
      name: string
      type: 'order' | 'support_ticket' | 'ad_spend' | 'revenue' | 'traffic'
    }> = [
      { name: 'Daily Orders', type: 'order' },
      { name: 'Daily Revenue', type: 'revenue' },
      { name: 'Support Tickets', type: 'support_ticket' },
      { name: 'Ad Spend', type: 'ad_spend' },
      { name: 'Website Traffic', type: 'traffic' }
    ]
    
    for (const metric of metrics) {
      const { current, historical } = await fetchMetricData(metric.type, 30)
      
      const anomaly = AnomalyDetector.detectAnomalies(
        metric.name,
        metric.type,
        current,
        historical,
        2
      )
      
      if (anomaly) {
        anomalies.push(anomaly)
      }
    }
    
    return anomalies.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
  }
  
  /**
   * Generate comprehensive executive report
   */
  static async generateExecutiveReport(): Promise<ExecutiveReport> {
    const now = new Date()
    const periodStart = new Date()
    periodStart.setDate(periodStart.getDate() - 30)
    
    // Fetch all analytics in parallel
    const [
      salesForecast,
      stockoutPredictions,
      churnAnalyses,
      productRecommendations,
      anomalies,
      salesData,
      revenueMetric
    ] = await Promise.all([
      this.generateSalesForecast(14),
      this.predictStockouts(),
      this.analyzeChurnRisk(),
      this.generateProductRecommendations(),
      this.detectAnomalies(),
      fetchSalesTrendData(30),
      fetchMetricData('revenue', 30)
    ])
    
    // Calculate summary metrics
    const totalRevenue = salesData.reduce((sum, d) => sum + d.value, 0)
    const totalOrders = salesData.length * 15
    const avgOrderValue = totalRevenue / totalOrders
    
    const last7Days = salesData.slice(-7)
    const previous7Days = salesData.slice(-14, -7)
    const last7Revenue = last7Days.reduce((sum, d) => sum + d.value, 0)
    const prev7Revenue = previous7Days.reduce((sum, d) => sum + d.value, 0)
    const revenueTrend = Math.abs(last7Revenue - prev7Revenue) < prev7Revenue * 0.05 
      ? 'stable' 
      : last7Revenue > prev7Revenue ? 'up' : 'down'
    
    // Identify opportunities
    const opportunities: ExecutiveReport['opportunities'] = []
    
    // High-potential products
    const topProducts = productRecommendations.slice(0, 3)
    topProducts.forEach(product => {
      if (product.search_to_purchase_gap > 5) {
        opportunities.push({
          title: `High Interest in ${product.product_name}`,
          description: `${product.search_count} searches but only ${product.purchase_count} purchases. High conversion opportunity.`,
          priority: product.inventory_status === 'out_of_stock' ? 'critical' : 'high',
          estimated_impact: `Potential ${Math.round(product.search_to_purchase_gap * product.purchase_count * avgOrderValue)} revenue increase`,
          recommended_actions: product.suggested_actions
        })
      }
    })
    
    // Sales forecast opportunities
    if (salesForecast.length > 0 && salesForecast[0].trend === 'up') {
      opportunities.push({
        title: 'Positive Sales Trend Detected',
        description: `Sales forecast shows ${salesForecast[0].trend} trend. Expected ${salesForecast[0].predicted_value.toFixed(0)} daily revenue.`,
        priority: 'medium',
        estimated_impact: `Projected 7-day revenue: ${salesForecast.reduce((sum, f) => sum + f.predicted_value, 0).toFixed(0)}`,
        recommended_actions: [
          'Increase marketing spend to capitalize on momentum',
          'Ensure inventory levels meet demand',
          'Prepare customer support for increased volume'
        ]
      })
    }
    
    // Identify risks
    const risks: ExecutiveReport['risks'] = []
    
    // Critical stockouts
    const criticalStockouts = stockoutPredictions.filter(p => 
      p.risk_level === 'critical' || p.risk_level === 'high'
    )
    if (criticalStockouts.length > 0) {
      risks.push({
        title: `${criticalStockouts.length} Products at Risk of Stockout`,
        description: `Critical inventory levels detected. ${criticalStockouts[0].product_name} may stock out in ${criticalStockouts[0].days_until_stockout} days.`,
        severity: 'critical',
        potential_impact: `Lost sales and customer dissatisfaction`,
        mitigation_actions: [
          'Place emergency orders for critical items',
          'Enable backorder notifications',
          'Consider alternative products for recommendations'
        ]
      })
    }
    
    // High churn risk
    const highChurnCustomers = churnAnalyses.filter(c => 
      c.risk_level === 'high' || c.risk_level === 'critical'
    )
    if (highChurnCustomers.length > 0) {
      const potentialRevenueLoss = highChurnCustomers.length * avgOrderValue * 12
      risks.push({
        title: `${highChurnCustomers.length} Customers at High Churn Risk`,
        description: `Customers showing declining engagement and order frequency.`,
        severity: 'high',
        potential_impact: `Estimated annual revenue at risk: ${potentialRevenueLoss.toFixed(0)}`,
        mitigation_actions: [
          'Launch targeted re-engagement campaign',
          'Offer personalized promotions to at-risk customers',
          'Schedule proactive customer success calls'
        ]
      })
    }
    
    // Critical anomalies
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical')
    criticalAnomalies.forEach(anomaly => {
      risks.push({
        title: `Anomaly Detected: ${anomaly.metric_name}`,
        description: anomaly.description,
        severity: 'critical',
        potential_impact: `${Math.abs(anomaly.deviation_percentage)}% deviation from normal`,
        mitigation_actions: anomaly.recommended_actions
      })
    })
    
    return {
      generated_at: now.toISOString(),
      period: `${periodStart.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`,
      summary: {
        total_revenue: Math.round(totalRevenue),
        total_orders: totalOrders,
        revenue_trend: revenueTrend,
        order_trend: revenueTrend,
        average_order_value: Math.round(avgOrderValue),
        active_customers: churnAnalyses.filter(c => c.risk_level === 'low').length
      },
      key_metrics: {
        sales_forecast: salesForecast.slice(0, 7),
        revenue_forecast: salesForecast.slice(0, 7),
        critical_stockouts: stockoutPredictions.filter(p => 
          p.risk_level === 'critical' || p.risk_level === 'high'
        ).slice(0, 10),
        high_churn_risk_customers: highChurnCustomers.slice(0, 10),
        top_product_opportunities: productRecommendations.slice(0, 10),
        recent_anomalies: anomalies
      },
      opportunities: opportunities.slice(0, 10),
      risks: risks.slice(0, 10)
    }
  }
}
