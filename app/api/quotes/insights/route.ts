import { NextRequest, NextResponse } from 'next/server'
import { quoteApprovalWorkflow } from '../../../../services/workflows/quote-approval-workflow'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const quoteRequestId = searchParams.get('quoteRequestId')

    if (action === 'learning') {
      const insights = await quoteApprovalWorkflow.getLearningInsights()
      return NextResponse.json({
        success: true,
        insights
      })
    }

    if (action === 'stats') {
      const stats = await quoteApprovalWorkflow.getApprovalStats()
      return NextResponse.json({
        success: true,
        stats
      })
    }

    if (action === 'patterns') {
      const patterns = await quoteApprovalWorkflow.getEditPatterns()
      return NextResponse.json({
        success: true,
        patterns
      })
    }

    if (action === 'pending') {
      const pendingApprovals = await quoteApprovalWorkflow.getPendingApprovals()
      return NextResponse.json({
        success: true,
        count: pendingApprovals.length,
        tasks: pendingApprovals
      })
    }

    if (action === 'history' && quoteRequestId) {
      const history = await quoteApprovalWorkflow.getQuoteHistory(quoteRequestId)
      return NextResponse.json({
        success: true,
        history
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Quote Insights API',
      endpoints: {
        'GET ?action=learning': 'Get AI learning insights from approval patterns',
        'GET ?action=stats': 'Get approval statistics',
        'GET ?action=patterns': 'Get edit patterns and trends',
        'GET ?action=pending': 'Get pending approval tasks',
        'GET ?action=history&quoteRequestId=UUID': 'Get quote approval history'
      }
    })

  } catch (error: any) {
    console.error('Quote Insights API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
