import { NextRequest, NextResponse } from 'next/server'
import { quoteWorkflowMonitor } from '@/services/workflows/quote-workflow-monitor'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'run_checks':
        const alerts = await quoteWorkflowMonitor.runMonitoringChecks()
        return NextResponse.json({
          success: true,
          alerts,
          message: `Monitoring checks complete. ${alerts.length} alerts generated.`
        })

      case 'get_health_summary':
        const summary = await quoteWorkflowMonitor.getHealthSummary()
        return NextResponse.json({
          success: true,
          summary
        })

      case 'resolve_alert':
        const { workflowId } = body
        if (!workflowId) {
          return NextResponse.json(
            { success: false, error: 'workflowId is required' },
            { status: 400 }
          )
        }
        await quoteWorkflowMonitor.resolveAlert(workflowId)
        return NextResponse.json({
          success: true,
          message: `Alert resolved for workflow ${workflowId}`
        })

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Monitoring API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const summary = await quoteWorkflowMonitor.getHealthSummary()
    return NextResponse.json({
      success: true,
      summary
    })
  } catch (error: any) {
    console.error('Monitoring API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
