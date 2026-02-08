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
    const rateLimit = await checkRateLimit(AGENT_RATE_LIMITS.maintenance_cleanup)
    
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

    await logToSquadMessages('maintenance_agent', 'Starting cleanup', { 
      action: 'cleanup_start',
      remaining_executions: rateLimit.remaining,
    })

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { count: logsCount } = await supabase
      .from('agent_logs')
      .delete({ count: 'exact' })
      .lt('created_at', thirtyDaysAgo.toISOString())

    const { count: messagesCount } = await supabase
      .from('squad_messages')
      .delete({ count: 'exact' })
      .lt('created_at', thirtyDaysAgo.toISOString())

    const { count: emailsCount } = await supabase
      .from('email_logs')
      .update({ status: 'archived' }, { count: 'exact' })
      .eq('status', 'draft_created')
      .lt('updated_at', thirtyDaysAgo.toISOString())

    await logAgentExecution('maintenance_cleanup', {
      logs_cleaned: logsCount || 0,
      messages_cleaned: messagesCount || 0,
      emails_archived: emailsCount || 0,
      status: 'completed',
    })

    await logToSquadMessages('maintenance_agent', 'Cleanup completed', {
      action: 'cleanup_complete',
      stats: {
        logs: logsCount || 0,
        messages: messagesCount || 0,
        emails: emailsCount || 0,
      },
    })

    return NextResponse.json({
      success: true,
      cleaned: {
        logs: logsCount || 0,
        messages: messagesCount || 0,
        emails: emailsCount || 0,
      },
      remaining: rateLimit.remaining,
    })
  } catch (error: any) {
    console.error('Maintenance cleanup error:', error)
    await logToSquadMessages('maintenance_agent', `Cleanup failed: ${error.message}`, {
      action: 'cleanup_error',
      error: error.message,
    })

    return NextResponse.json(
      { error: 'Maintenance cleanup failed', details: error.message },
      { status: 500 }
    )
  }
}
