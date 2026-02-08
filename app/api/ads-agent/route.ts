import { NextRequest, NextResponse } from 'next/server'
import { adsAgent } from '@/services/agents/ads-agent'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case 'monitor_performance':
        await adsAgent.monitorCampaignPerformance()
        return NextResponse.json({ success: true })

      case 'get_campaign':
        const { campaignId } = params
        if (!campaignId) {
          return NextResponse.json(
            { error: 'campaignId is required' },
            { status: 400 }
          )
        }
        const campaign = await adsAgent.getCampaignMetrics(campaignId)
        return NextResponse.json({ campaign })

      case 'get_active_campaigns':
        const campaigns = await adsAgent.getAllActiveCampaigns()
        return NextResponse.json({ campaigns, count: campaigns.length })

      case 'generate_report':
        await adsAgent.generatePerformanceReport()
        return NextResponse.json({ success: true })

      case 'pause_campaign':
        const { campaignId: pauseCampaignId, reasons } = params
        if (!pauseCampaignId || !reasons) {
          return NextResponse.json(
            { error: 'campaignId and reasons are required' },
            { status: 400 }
          )
        }
        await adsAgent.pauseCampaign(pauseCampaignId, reasons)
        return NextResponse.json({ success: true })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Ads agent API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const campaigns = await adsAgent.getAllActiveCampaigns()
    return NextResponse.json({ campaigns, count: campaigns.length })
  } catch (error: any) {
    console.error('Ads agent GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
