import { NextRequest, NextResponse } from 'next/server'
import { intelligenceEvolution } from '@/services/agents/intelligence-evolution'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentName, periodStart, periodEnd, decisionType } = body

    if (!agentName || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'Missing required parameters: agentName, periodStart, periodEnd' },
        { status: 400 }
      )
    }

    const insight = await intelligenceEvolution.analyzeAgentPerformance(
      agentName,
      new Date(periodStart),
      new Date(periodEnd),
      decisionType
    )

    return NextResponse.json({
      success: true,
      insight
    })
  } catch (error: any) {
    console.error('Error in analyze endpoint:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze agent performance' },
      { status: 500 }
    )
  }
}
