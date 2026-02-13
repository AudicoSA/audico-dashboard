import { NextRequest, NextResponse } from 'next/server'
import { predictiveQuoteAgent } from '@/services/agents/predictive-quote-agent'

export async function POST(request: NextRequest) {
  try {
    const result = await predictiveQuoteAgent.scoreAllCustomers()

    return NextResponse.json({
      success: result.success,
      opportunities_found: result.opportunities_found,
      high_confidence_count: result.high_confidence_count,
      medium_confidence_count: result.medium_confidence_count,
      tasks_created: result.tasks_created,
      quotes_generated: result.quotes_generated,
      error: result.error,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Manual predictive quote trigger error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Predictive quote analysis failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
