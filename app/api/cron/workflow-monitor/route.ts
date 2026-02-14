import { NextRequest, NextResponse } from 'next/server'
import { quoteWorkflowMonitor } from '@/services/workflows/quote-workflow-monitor'
import { verifyCronRequest } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authValid = verifyCronRequest(request)
  
  if (!authValid) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    console.log('Running scheduled workflow monitoring checks...')
    
    const alerts = await quoteWorkflowMonitor.runMonitoringChecks()
    
    const summary = {
      timestamp: new Date().toISOString(),
      alerts_generated: alerts.length,
      alerts_by_type: alerts.reduce((acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      alerts_by_severity: alerts.reduce((acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }

    console.log('Monitoring checks complete:', summary)

    return NextResponse.json({
      success: true,
      message: `Workflow monitoring checks complete. ${alerts.length} alerts generated.`,
      summary,
      alerts: alerts.map(a => ({
        type: a.type,
        severity: a.severity,
        message: a.message,
        workflow_id: a.workflow_id
      }))
    })

  } catch (error: any) {
    console.error('Workflow monitoring cron error:', error)
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
