import { NextRequest, NextResponse } from 'next/server'
import { adsAgent } from '@/services/agents/ads-agent'

export async function POST(request: NextRequest) {
  try {
    await adsAgent.monitorCampaignPerformance()
    
    return NextResponse.json({ 
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Campaign performance monitoring completed'
    })
  } catch (error: any) {
    console.error('Campaign monitoring error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
