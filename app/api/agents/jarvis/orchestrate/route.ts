import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit, logAgentExecution, AGENT_RATE_LIMITS } from '@/lib/rate-limiter'
import { logAgentActivity } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

async function logToSquadMessages(fromAgent: string, message: string, toAgent: string | null = null, data: any = null) {
  await supabase.from('squad_messages').insert({
    from_agent: fromAgent,
    to_agent: toAgent,
    message,
    task_id: null,
    data,
  })
}

async function createTask(title: string, description: string, assignedAgent: string, priority: 'low' | 'medium' | 'high' | 'urgent', mentionsKenny: boolean = false) {
  const { data: task, error } = await supabase
    .from('squad_tasks')
    .insert({
      title,
      description,
      status: 'new',
      assigned_agent: assignedAgent,
      priority,
      mentions_kenny: mentionsKenny,
    })
    .select()
    .single()

  if (!error && task) {
    await logToSquadMessages(
      'Jarvis',
      `New task created: "${title}" assigned to ${assignedAgent}`,
      assignedAgent,
      { task_id: task.id, priority }
    )
  }

  return { task, error }
}

export async function GET() {
  return NextResponse.json({
    status: 'jarvis-orchestrator-active',
    message: 'Jarvis orchestrator ready',
    timestamp: new Date().toISOString(),
  })
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rateLimit = await checkRateLimit({
      agentName: 'jarvis_orchestrator',
      maxExecutions: 48,
      windowSeconds: 86400,
    })

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

    await logAgentActivity({
      agentName: 'jarvis',
      logLevel: 'info',
      eventType: 'orchestration_start',
      message: 'Jarvis orchestration cycle started',
      context: { action: 'orchestrate_start' },
    })

    await logToSquadMessages('Jarvis', '🧠 Starting orchestration cycle - analyzing all data sources')

    // Gather all data sources
    const [unreadEmails, recentOrders, existingTasks] = await Promise.all([
      supabase
        .from('email_logs')
        .select('*')
        .eq('status', 'unread')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('order_tracker')
        .select('*')
        .is('flag_done', false)
        .order('order_no', { ascending: false })
        .limit(10),
      supabase.from('squad_tasks').select('*').in('status', ['new', 'in_progress']),
    ])

    const situationReport = {
      unread_emails: unreadEmails.data?.length || 0,
      pending_orders: recentOrders.data?.length || 0,
      active_tasks: existingTasks.data?.length || 0,
      emails_sample: unreadEmails.data?.slice(0, 5).map((e) => ({
        from: e.from_email,
        subject: e.subject,
        snippet: e.payload?.snippet,
      })),
      orders_sample: recentOrders.data?.slice(0, 5).map((o) => ({
        order_no: o.order_no,
        order_name: o.order_name,
        supplier: o.supplier,
        notes: o.notes,
      })),
      existing_tasks: existingTasks.data?.map((t) => ({
        title: t.title,
        assigned_to: t.assigned_agent,
        status: t.status,
      })),
    }

    // Use Claude to analyze and create tasks
    const prompt = `You are Jarvis, the orchestrator AI for Audico's business operations team. You manage a squad of specialized AI agents.

**Your Squad:**
- Mpho: Orders processing and fulfillment
- Thandi: Stock management and inventory
- Sizwe: Customer service and support
- Naledi: Communications and newsletters
- Lerato: Content creation and marketing
- Vusi: SEO and website optimization

**Current Situation:**
${JSON.stringify(situationReport, null, 2)}

**Your Task:**
Analyze this situation and decide what tasks need to be created for your squad. For each task you want to create, respond with a JSON object like this:

{
  "tasks": [
    {
      "title": "Brief task title",
      "description": "Detailed description of what needs to be done",
      "assigned_agent": "Agent name (Mpho, Thandi, Sizwe, Naledi, Lerato, or Vusi)",
      "priority": "low | medium | high | urgent",
      "mentions_kenny": false
    }
  ],
  "reasoning": "Brief explanation of your decisions"
}

**Guidelines:**
- Only create tasks that are actionable and specific
- Don't duplicate existing tasks
- Set mentions_kenny to true only for urgent customer complaints or critical issues
- Prioritize: urgent (immediate attention), high (today), medium (this week), low (when possible)
- Be concise but clear in titles and descriptions
- If nothing needs attention, return an empty tasks array

Respond ONLY with valid JSON.`

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const jarvisDecision = JSON.parse(responseText)

    const tasksCreated = []
    const tasksFailed = []

    for (const taskDef of jarvisDecision.tasks || []) {
      const { task, error } = await createTask(
        taskDef.title,
        taskDef.description,
        taskDef.assigned_agent,
        taskDef.priority,
        taskDef.mentions_kenny || false
      )

      if (error) {
        tasksFailed.push({ taskDef, error: error.message })
      } else {
        tasksCreated.push(task)
      }
    }

    await logAgentExecution('jarvis_orchestrator', {
      tasks_created: tasksCreated.length,
      tasks_failed: tasksFailed.length,
      reasoning: jarvisDecision.reasoning,
      status: 'completed',
    })

    const summary = jarvisDecision.reasoning || `Created ${tasksCreated.length} new tasks for the squad`
    await logToSquadMessages('Jarvis', `✅ Orchestration complete: ${summary}`, null, {
      tasks_created: tasksCreated.length,
      remaining: rateLimit.remaining,
    })

    await supabase.from('squad_agents').update({
      status: 'active',
      last_active: new Date().toISOString()
    }).eq('name', 'Jarvis')

    return NextResponse.json({
      success: true,
      tasksCreated: tasksCreated.length,
      tasksFailed: tasksFailed.length,
      tasks: tasksCreated,
      reasoning: jarvisDecision.reasoning,
      remaining: rateLimit.remaining,
    })
  } catch (error: any) {
    console.error('Jarvis orchestration error:', error)

    await logAgentActivity({
      agentName: 'jarvis',
      logLevel: 'error',
      eventType: 'orchestration_error',
      message: `Jarvis orchestration failed: ${error.message}`,
      errorDetails: {
        error: error.message,
        stack: error.stack,
      },
      context: { action: 'orchestrate_error' },
    })

    await logToSquadMessages('Jarvis', `❌ Orchestration failed: ${error.message}`, null, {
      action: 'orchestrate_error',
      error: error.message,
    })

    return NextResponse.json({ error: 'Jarvis orchestration failed', details: error.message }, { status: 500 })
  }
}
