import { NextRequest, NextResponse } from 'next/server'
import { AnalyticsAgent } from '@/services/agents/analytics-agent'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')
  
  try {
    switch (action) {
      case 'sales-forecast': {
        const days = parseInt(searchParams.get('days') || '7')
        const forecast = await AnalyticsAgent.generateSalesForecast(days)
        return NextResponse.json({ forecast })
      }
      
      case 'stockout-predictions': {
        const predictions = await AnalyticsAgent.predictStockouts()
        return NextResponse.json({ predictions })
      }
      
      case 'churn-analysis': {
        const analyses = await AnalyticsAgent.analyzeChurnRisk()
        return NextResponse.json({ analyses })
      }
      
      case 'product-recommendations': {
        const recommendations = await AnalyticsAgent.generateProductRecommendations()
        return NextResponse.json({ recommendations })
      }
      
      case 'anomaly-detection': {
        const anomalies = await AnalyticsAgent.detectAnomalies()
        return NextResponse.json({ anomalies })
      }
      
      case 'executive-report': {
        const report = await AnalyticsAgent.generateExecutiveReport()
        return NextResponse.json({ report })
      }
      
      default: {
        // Return all analytics
        const [
          salesForecast,
          stockoutPredictions,
          churnAnalyses,
          productRecommendations,
          anomalies
        ] = await Promise.all([
          AnalyticsAgent.generateSalesForecast(7),
          AnalyticsAgent.predictStockouts(),
          AnalyticsAgent.analyzeChurnRisk(),
          AnalyticsAgent.generateProductRecommendations(),
          AnalyticsAgent.detectAnomalies()
        ])
        
        return NextResponse.json({
          sales_forecast: salesForecast,
          stockout_predictions: stockoutPredictions,
          churn_analyses: churnAnalyses,
          product_recommendations: productRecommendations,
          anomalies
        })
      }
    }
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate analytics' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body
    
    switch (action) {
      case 'generate-report': {
        const report = await AnalyticsAgent.generateExecutiveReport()
        return NextResponse.json({ report })
      }
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to process analytics request' },
      { status: 500 }
    )
  }
}
