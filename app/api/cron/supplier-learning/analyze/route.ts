import { NextRequest, NextResponse } from 'next/server'
import { supplierLearningEngine } from '@/lib/supplier-learning-engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Weekly Supplier Learning Analysis Cron Job
 * 
 * Schedule: Weekly on Mondays at 6 AM UTC
 * 
 * Analyzes email_supplier_interactions to:
 * - Identify response time patterns and preferred contact methods
 * - Track pricing trends from successful quotes
 * - Measure stock reliability accuracy
 * - Calculate supplier response quality scores
 * - Identify emerging supplier relationships
 * - Generate category-specific supplier insights
 * - Update supplier_products.avg_markup_percentage from successful quotes
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('Starting weekly supplier learning analysis cron job')

    const result = await supplierLearningEngine.runWeeklyAnalysis()

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false,
          error: result.error,
          details: 'Supplier learning analysis failed'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Supplier learning analysis completed',
      timestamp: result.timestamp,
      response_patterns_analyzed: result.response_patterns_analyzed,
      pricing_trends_identified: result.pricing_trends_identified,
      stock_reliability_updated: result.stock_reliability_updated,
      quality_scores_updated: result.quality_scores_updated,
      emerging_relationships: result.emerging_relationships,
      category_insights_generated: result.category_insights_generated,
      supplier_products_updated: result.supplier_products_updated
    })

  } catch (error: any) {
    console.error('Cron supplier learning error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Supplier learning analysis failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
