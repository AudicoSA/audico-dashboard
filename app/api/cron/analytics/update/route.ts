import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, logAgentExecution, AGENT_RATE_LIMITS } from '@/lib/rate-limiter'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function logToSquadMessages(fromAgent: string, message: string, data: any = null) {
  await supabase
    .from('squad_messages')
    .insert({
      from_agent: fromAgent,
      to_agent: null,
      message,
      task_id: null,
      data,
    })
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rateLimit = await checkRateLimit(AGENT_RATE_LIMITS.analytics_update)
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          remaining: rateLimit.remaining,
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
        { status: 429 }
      )
    }

    await logToSquadMessages('analytics_agent', 'Starting analytics update', { 
      action: 'analytics_update_start',
      remaining_executions: rateLimit.remaining,
    })

    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const { count: emailCount } = await supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString())

    const { count: classifiedCount } = await supabase
      .from('email_classifications')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString())

    const { count: agentLogCount } = await supabase
      .from('agent_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString())

    await logAgentExecution('analytics_update', {
      email_count: emailCount || 0,
      classified_count: classifiedCount || 0,
      agent_log_count: agentLogCount || 0,
      status: 'completed',
    })

    await logToSquadMessages('analytics_agent', 'Analytics updated', {
      action: 'analytics_update_complete',
      metrics: {
        emails: emailCount || 0,
        classifications: classifiedCount || 0,
        agent_logs: agentLogCount || 0,
      },
    })

    return NextResponse.json({
      success: true,
      metrics: {
        emails: emailCount || 0,
        classifications: classifiedCount || 0,
        agentLogs: agentLogCount || 0,
      },
      remaining: rateLimit.remaining,
    })
  } catch (error: any) {
    console.error('Analytics update error:', error)
    await logToSquadMessages('analytics_agent', `Analytics update failed: ${error.message}`, {
      action: 'analytics_update_error',
      error: error.message,
    })

    return NextResponse.json(
      { error: 'Analytics update failed', details: error.message },
      { status: 500 }
    )
  }
}
