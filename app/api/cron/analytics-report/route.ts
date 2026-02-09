import { NextRequest, NextResponse } from 'next/server'
import { AnalyticsAgent } from '@/services/agents/analytics-agent'
import { getServerSupabase } from '@/lib/supabase'

/**
 * Cron job to generate daily analytics reports
 * Schedule: Daily at 8:00 AM
 * Vercel Cron: 0 8 * * *
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('🤖 Analytics Agent: Generating daily executive report...')
    
    // Generate comprehensive executive report
    const report = await AnalyticsAgent.generateExecutiveReport()
    
    // Save report to database
    const supabase = getServerSupabase()
    const { error: saveError } = await supabase
      .from('analytics_reports')
      .insert({
        report_type: 'executive_daily',
        report_date: new Date().toISOString().split('T')[0],
        report_data: report,
        created_at: new Date().toISOString()
      })
    
    if (saveError) {
      console.error('Failed to save report:', saveError)
    }
    
    // Log critical alerts if any
    const criticalAnomalies = report.key_metrics.recent_anomalies.filter(
      a => a.severity === 'critical'
    )
    
    const criticalStockouts = report.key_metrics.critical_stockouts.filter(
      s => s.risk_level === 'critical'
    )
    
    const highChurnRisk = report.key_metrics.high_churn_risk_customers.filter(
      c => c.risk_level === 'critical' || c.risk_level === 'high'
    )
    
    // Log to agent logs
    await supabase.from('agent_logs').insert({
      agent_name: 'Analytics',
      log_level: criticalAnomalies.length > 0 || criticalStockouts.length > 0 ? 'warning' : 'info',
      event_type: 'daily_report_generated',
      message: `Daily analytics report generated. Critical alerts: ${criticalAnomalies.length} anomalies, ${criticalStockouts.length} stockouts, ${highChurnRisk.length} churn risks`,
      context: {
        report_summary: {
          total_revenue: report.summary.total_revenue,
          total_orders: report.summary.total_orders,
          revenue_trend: report.summary.revenue_trend,
          opportunities_count: report.opportunities.length,
          risks_count: report.risks.length,
          critical_anomalies: criticalAnomalies.length,
          critical_stockouts: criticalStockouts.length,
          high_churn_risk: highChurnRisk.length
        }
      }
    })
    
    // Send notifications for critical issues (if configured)
    if (criticalAnomalies.length > 0 || criticalStockouts.length > 0) {
      console.warn('⚠️ Critical issues detected:', {
        anomalies: criticalAnomalies.length,
        stockouts: criticalStockouts.length
      })
      
      // Create squad tasks for urgent items
      const tasks = []
      
      if (criticalStockouts.length > 0) {
        tasks.push({
          title: `Urgent: ${criticalStockouts.length} Products at Critical Stockout Risk`,
          description: `${criticalStockouts[0].product_name} will stock out in ${criticalStockouts[0].days_until_stockout} days. Immediate action required.`,
          status: 'new',
          assigned_agent: 'Thandi',
          priority: 'urgent',
          mentions_kenny: true,
          metadata: {
            type: 'analytics_alert',
            products: criticalStockouts.map(s => ({
              id: s.product_id,
              name: s.product_name,
              days_until_stockout: s.days_until_stockout
            }))
          }
        })
      }
      
      if (criticalAnomalies.length > 0) {
        const anomaly = criticalAnomalies[0]
        tasks.push({
          title: `Critical Anomaly: ${anomaly.metric_name}`,
          description: anomaly.description,
          status: 'new',
          assigned_agent: 'Jarvis',
          priority: 'urgent',
          mentions_kenny: true,
          metadata: {
            type: 'analytics_alert',
            anomaly: anomaly
          }
        })
      }
      
      if (tasks.length > 0) {
        await supabase.from('squad_tasks').insert(tasks)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Analytics report generated successfully',
      summary: {
        total_revenue: report.summary.total_revenue,
        total_orders: report.summary.total_orders,
        opportunities: report.opportunities.length,
        risks: report.risks.length,
        critical_alerts: {
          anomalies: criticalAnomalies.length,
          stockouts: criticalStockouts.length,
          churn_risks: highChurnRisk.length
        }
      }
    })
  } catch (error) {
    console.error('Analytics cron job error:', error)
    return NextResponse.json(
      { error: 'Failed to generate analytics report' },
      { status: 500 }
    )
  }
}
