import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const { data: agents, error: agentsError } = await supabase
      .from('squad_agents')
      .select('*')

    if (agentsError) throw agentsError

    const { data: recentLogs, error: logsError } = await supabase
      .from('agent_logs')
      .select('*')
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .order('created_at', { ascending: false })

    if (logsError) throw logsError

    const errorLogs = recentLogs?.filter(log => 
      log.log_level === 'error' || log.log_level === 'critical'
    ) || []

    const errorRate = recentLogs && recentLogs.length > 0
      ? (errorLogs.length / recentLogs.length) * 100
      : 0

    const agentStatuses = agents?.map(agent => {
      const agentErrors = errorLogs.filter(log => log.agent_name === agent.name)
      const lastActive = new Date(agent.last_active)
      const minutesSinceActive = (now.getTime() - lastActive.getTime()) / 1000 / 60
      
      let healthStatus = 'healthy'
      if (agent.status === 'offline') {
        healthStatus = 'offline'
      } else if (agentErrors.length > 5) {
        healthStatus = 'critical'
      } else if (agentErrors.length > 0 || minutesSinceActive > 60) {
        healthStatus = 'degraded'
      }

      return {
        name: agent.name,
        role: agent.role,
        status: agent.status,
        healthStatus,
        lastActive: agent.last_active,
        errorCount24h: agentErrors.length
      }
    }) || []

    const uptime = agents?.length > 0
      ? ((agents.filter(a => a.status !== 'offline').length / agents.length) * 100).toFixed(2)
      : '0.00'

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: {
        totalAgents: agents?.length || 0,
        activeAgents: agents?.filter(a => a.status === 'active').length || 0,
        idleAgents: agents?.filter(a => a.status === 'idle').length || 0,
        offlineAgents: agents?.filter(a => a.status === 'offline').length || 0,
        uptime: `${uptime}%`,
        totalLogs24h: recentLogs?.length || 0,
        errorCount24h: errorLogs.length,
        errorRate: errorRate.toFixed(2) + '%'
      },
      agents: agentStatuses,
      recentErrors: errorLogs.slice(0, 10).map(log => ({
        id: log.id,
        agentName: log.agent_name,
        level: log.log_level,
        eventType: log.event_type,
        message: log.message,
        timestamp: log.created_at
      }))
    })
  } catch (error: any) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Health check failed', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
