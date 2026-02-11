import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth'
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

async function createTask(title: string, description: string, assignedAgent: string, priority: 'low' | 'medium' | 'high' | 'urgent', mentionsKenny: boolean = false, metadata: Record<string, any> = {}) {
  const { data: task, error } = await supabase
    .from('squad_tasks')
    .insert({
      title,
      description,
      status: 'new',
      assigned_agent: assignedAgent,
      priority,
      mentions_kenny: mentionsKenny,
      metadata,
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

/**
 * Trigger the Email Agent respond endpoint to create a Gmail draft
 * and approval task for a classified email.
 */
async function triggerEmailResponse(emailId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Use production URL to avoid redirect-based auth header stripping
    // VERCEL_URL gives deployment-specific URL which may redirect and strip Authorization header
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000'))

    const url = `${baseUrl}/api/agents/email/respond`
    const authToken = process.env.CRON_SECRET

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ email_id: emailId }),
      redirect: 'follow',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      return { success: false, error: `HTTP ${response.status} at ${url}: ${errorData.error || errorData.message || errorData.details || 'Unknown'}` }
    }

    const data = await response.json()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'jarvis-orchestrator-active',
    message: 'Jarvis orchestrator ready',
    timestamp: new Date().toISOString(),
  })
}

export async function POST(request: NextRequest) {
  // Verify request is from Vercel Cron or has valid auth
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse()
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

    await logToSquadMessages('Jarvis', 'Starting orchestration cycle - analyzing all data sources')

    // ================================================================
    // PHASE 1: Process classified emails by triggering Email Agent
    // This is the core email workflow - deterministic, no AI needed
    // ================================================================

    const { data: classifiedEmails, error: emailFetchError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('status', 'classified')
      .order('created_at', { ascending: true })
      .limit(10)

    const emailResults = {
      processed: 0,
      responded: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    }

    if (classifiedEmails && classifiedEmails.length > 0) {
      await logToSquadMessages(
        'Jarvis',
        `Found ${classifiedEmails.length} classified emails to process`,
        'Email Agent',
        { count: classifiedEmails.length }
      )

      for (const email of classifiedEmails) {
        emailResults.processed++

        // Skip spam - just mark as handled
        if (email.category === 'spam') {
          await supabase
            .from('email_logs')
            .update({
              status: 'handled',
              handled_by: 'Jarvis',
              updated_at: new Date().toISOString(),
            })
            .eq('id', email.id)

          emailResults.skipped++

          await logToSquadMessages(
            'Jarvis',
            `Skipped spam email: "${email.subject}" from ${email.from_email}`,
            null,
            { email_id: email.id, category: 'spam' }
          )
          continue
        }

        // For all actionable categories, trigger Email Agent to create draft + approval task
        const result = await triggerEmailResponse(email.id)

        if (result.success) {
          emailResults.responded++

          await logToSquadMessages(
            'Jarvis',
            `Triggered Email Agent for: "${email.subject}" (${email.category})`,
            'Email Agent',
            { email_id: email.id, category: email.category, priority: email.priority }
          )
        } else {
          emailResults.failed++
          emailResults.errors.push(`${email.subject}: ${result.error}`)

          // Track failure count - only mark as handled after 3 failures to prevent infinite loop
          const failCount = (email.metadata?.fail_count || 0) + 1

          if (failCount >= 3) {
            // Give up after 3 attempts
            await supabase
              .from('email_logs')
              .update({
                status: 'handled',
                handled_by: 'Jarvis',
                metadata: { ...email.metadata, error: result.error, failed_at: new Date().toISOString(), fail_count: failCount },
                updated_at: new Date().toISOString(),
              })
              .eq('id', email.id)

            await logToSquadMessages(
              'Jarvis',
              `❌ PERMANENTLY FAILED (${failCount} attempts): "${email.subject}" - ${result.error}`,
              null,
              { email_id: email.id, error: result.error, fail_count: failCount }
            )
          } else {
            // Keep as classified so it gets retried next cycle
            await supabase
              .from('email_logs')
              .update({
                metadata: { ...email.metadata, last_error: result.error, fail_count: failCount },
                updated_at: new Date().toISOString(),
              })
              .eq('id', email.id)

            await logToSquadMessages(
              'Jarvis',
              `⚠️ Failed to process email (attempt ${failCount}/3, will retry): "${email.subject}" - ${result.error}`,
              null,
              { email_id: email.id, error: result.error, fail_count: failCount }
            )
          }
        }
      }
    }

    // ================================================================
    // PHASE 2: Use Claude AI for non-email orchestration decisions
    // Only runs if there are non-email data sources to analyze
    // ================================================================

    const [recentOrders, existingTasks] = await Promise.all([
      supabase
        .from('order_tracker')
        .select('*')
        .is('flag_done', false)
        .order('order_no', { ascending: false })
        .limit(10),
      supabase.from('squad_tasks').select('*').in('status', ['new', 'in_progress']),
    ])

    let aiTasksCreated: any[] = []
    let aiTasksFailed: any[] = []
    let aiReasoning = ''

    const pendingOrders = recentOrders.data?.length || 0
    const activeTasks = existingTasks.data?.length || 0

    // Only call Claude AI if there are non-email items to analyze
    // This saves tokens when there are only emails to process
    if (pendingOrders > 0) {
      const situationReport = {
        pending_orders: pendingOrders,
        active_tasks: activeTasks,
        emails_just_processed: emailResults.processed,
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

      const prompt = `You are Jarvis, the orchestrator AI for Audico's business operations team. You manage a squad of specialized AI agents.

**Your Squad (excluding Email Agent which handles emails automatically):**
- Social Media Agent: Creates AI-powered social media posts for Facebook, Instagram, Twitter
- Google Ads Agent: Monitors ad campaigns, suggests bid optimizations, alerts on budget issues
- SEO Agent: Audits OpenCart products for SEO improvements, generates optimized content
- Marketing Agent: Processes reseller applications, manages newsletters, tracks influencers

**Current Situation:**
${JSON.stringify(situationReport, null, 2)}

**Your Task:**
Analyze this situation and decide what NON-EMAIL tasks need to be created. Email handling is automatic - do NOT create email tasks.

Respond with JSON:
{
  "tasks": [
    {
      "title": "Brief task title",
      "description": "Detailed description",
      "assigned_agent": "Agent name",
      "priority": "low | medium | high | urgent",
      "mentions_kenny": false
    }
  ],
  "reasoning": "Brief explanation"
}

**Guidelines:**
- Do NOT create any email-related tasks (those are handled automatically)
- Only create tasks that are actionable and specific
- Don't duplicate existing tasks
- If nothing needs attention, return an empty tasks array

Respond ONLY with valid JSON.`

      try {
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        })

        const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

        // Parse JSON, handling potential markdown code blocks
        let cleanJson = responseText.trim()
        if (cleanJson.startsWith('```')) {
          cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
        }

        const jarvisDecision = JSON.parse(cleanJson)
        aiReasoning = jarvisDecision.reasoning || ''

        for (const taskDef of jarvisDecision.tasks || []) {
          // Skip any email tasks that Claude might suggest despite instructions
          if (taskDef.assigned_agent === 'Email Agent') continue

          const { task, error } = await createTask(
            taskDef.title,
            taskDef.description,
            taskDef.assigned_agent,
            taskDef.priority,
            taskDef.mentions_kenny || false,
            {}
          )

          if (error) {
            aiTasksFailed.push({ taskDef, error: error.message })
          } else {
            aiTasksCreated.push(task)
          }
        }
      } catch (aiError: any) {
        console.error('Jarvis AI decision error:', aiError)
        // AI failure is non-fatal - email processing already completed
        await logToSquadMessages(
          'Jarvis',
          `AI analysis failed (non-fatal): ${aiError.message}`,
          null,
          { error: aiError.message }
        )
      }
    }

    // ================================================================
    // PHASE 3: Log results and return
    // ================================================================

    await logAgentExecution('jarvis_orchestrator', {
      emails_processed: emailResults.processed,
      emails_responded: emailResults.responded,
      emails_skipped: emailResults.skipped,
      emails_failed: emailResults.failed,
      ai_tasks_created: aiTasksCreated.length,
      ai_tasks_failed: aiTasksFailed.length,
      reasoning: aiReasoning,
      status: 'completed',
    })

    const summaryParts = []
    if (emailResults.processed > 0) {
      summaryParts.push(`Emails: ${emailResults.responded} responded, ${emailResults.skipped} skipped, ${emailResults.failed} failed`)
    }
    if (aiTasksCreated.length > 0) {
      summaryParts.push(`AI tasks: ${aiTasksCreated.length} created`)
    }
    if (summaryParts.length === 0) {
      summaryParts.push('No new items to process')
    }

    const summary = summaryParts.join(' | ')
    await logToSquadMessages('Jarvis', `Orchestration complete: ${summary}`, null, {
      email_results: emailResults,
      ai_tasks_created: aiTasksCreated.length,
      remaining: rateLimit.remaining,
    })

    await supabase.from('squad_agents').update({
      status: 'active',
      last_active: new Date().toISOString()
    }).eq('name', 'Jarvis')

    return NextResponse.json({
      success: true,
      emailResults,
      aiTasksCreated: aiTasksCreated.length,
      aiTasksFailed: aiTasksFailed.length,
      aiTasks: aiTasksCreated,
      reasoning: aiReasoning,
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

    await logToSquadMessages('Jarvis', `Orchestration failed: ${error.message}`, null, {
      action: 'orchestrate_error',
      error: error.message,
    })

    return NextResponse.json({ error: 'Jarvis orchestration failed', details: error.message }, { status: 500 })
  }
}
