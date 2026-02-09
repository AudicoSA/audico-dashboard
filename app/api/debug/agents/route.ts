import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Get recent agent activity
    const [messages, tasks, emailLogs, agentLogs] = await Promise.all([
      supabase
        .from('squad_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('squad_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('agent_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    // Count unread emails
    const unreadEmails = await supabase
      .from('email_logs')
      .select('count')
      .eq('status', 'unread')

    // Get agent statuses
    const agents = await supabase
      .from('squad_agents')
      .select('*')
      .order('last_active', { ascending: false })

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary: {
        recent_messages: messages.data?.length || 0,
        total_tasks: tasks.data?.length || 0,
        tasks_by_status: {
          new: tasks.data?.filter((t) => t.status === 'new').length || 0,
          in_progress: tasks.data?.filter((t) => t.status === 'in_progress').length || 0,
          completed: tasks.data?.filter((t) => t.status === 'completed').length || 0,
        },
        unread_emails: unreadEmails.data?.[0]?.count || 0,
        recent_email_logs: emailLogs.data?.length || 0,
        recent_agent_logs: agentLogs.data?.length || 0,
      },
      agents: agents.data,
      latest_messages: messages.data?.slice(0, 10).map((m) => ({
        from: m.from_agent,
        message: m.message,
        time: m.created_at,
      })),
      latest_tasks: tasks.data?.slice(0, 10).map((t) => ({
        title: t.title,
        status: t.status,
        assigned_to: t.assigned_agent,
        created: t.created_at,
      })),
      latest_email_logs: emailLogs.data?.slice(0, 10).map((e) => ({
        from: e.from_email,
        subject: e.subject,
        status: e.status,
        created: e.created_at,
      })),
      latest_agent_logs: agentLogs.data?.slice(0, 20).map((l) => ({
        agent: l.agent_name,
        level: l.log_level,
        event: l.event_type,
        message: l.message,
        time: l.created_at,
      })),
      environment: {
        has_gmail_token: !!process.env.GMAIL_REFRESH_TOKEN,
        has_anthropic_key: !!process.env.ANTHROPIC_API_KEY,
        has_cron_secret: !!process.env.CRON_SECRET,
        has_redis: !!process.env.REDIS_URL,
        app_url: process.env.NEXT_PUBLIC_APP_URL,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Debug failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
