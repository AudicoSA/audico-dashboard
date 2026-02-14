import { NextRequest, NextResponse } from 'next/server'
import { quotePricingIntelligence } from '@/lib/quote-pricing-intelligence'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const result = await quotePricingIntelligence.runPricingAnalysis()

    return NextResponse.json({
      success: result.success,
      result,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Error in pricing analysis workflow:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      status: 'ready',
      message: 'Pricing analysis endpoint is operational',
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Error in pricing analysis health check:', error)
    return NextResponse.json(
      {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
