import { NextRequest, NextResponse } from 'next/server'
import { runCompleteAgentLearningWorkflow } from '@/services/workflows/agent-learning-workflow'

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const results = await runCompleteAgentLearningWorkflow()

    return NextResponse.json({
      success: true,
      results
    })
  } catch (error: any) {
    console.error('Error in agent learning cron:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to run agent learning workflow' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
