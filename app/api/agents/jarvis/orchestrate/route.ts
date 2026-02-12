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

async function logJarvisDecision(
  decisionType: string,
  situationContext: any,
  decisionMade: any,
  reasoning: string,
  confidenceScore: number,
  relatedQuoteRequestId?: string,
  relatedTaskId?: string
) {
  try {
    await supabase.from('jarvis_decisions').insert({
      decision_type: decisionType,
      situation_context: situationContext,
      decision_made: decisionMade,
      reasoning,
      confidence_score: confidenceScore,
      outcome: 'pending',
      related_quote_request_id: relatedQuoteRequestId,
      related_task_id: relatedTaskId,
    })
  } catch (error) {
    console.error('Error logging Jarvis decision:', error)
  }
}

async function gatherQuoteWorkflowData() {
  const now = new Date()
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)

  const [
    pendingQuotes,
    suppliersApproachingDeadline,
    quotesAwaitingApproval,
    stuckWorkflows,
    supplierPatterns,
    customerHistory,
    recentApprovalFeedback,
  ] = await Promise.all([
    supabase
      .from('quote_requests')
      .select('*, source_email_id')
      .in('status', ['detected', 'suppliers_contacted'])
      .order('created_at', { ascending: true })
      .limit(20),
    supabase
      .from('email_supplier_interactions')
      .select('*, suppliers(name, company), quote_requests(id, customer_email, requested_products)')
      .eq('interaction_type', 'quote_request')
      .lt('created_at', new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString())
      .limit(50),
    supabase
      .from('squad_tasks')
      .select('*, metadata')
      .eq('status', 'new')
      .eq('assigned_agent', 'Kenny')
      .eq('metadata->>action_required', 'approve_quote')
      .order('created_at', { ascending: true })
      .limit(20),
    supabase
      .from('email_supplier_interactions')
      .select('*, suppliers(name, company, reliability_score), quote_requests(id, customer_email, requested_products, status)')
      .eq('interaction_type', 'quote_request')
      .lt('created_at', fortyEightHoursAgo.toISOString())
      .limit(30),
    supabase
      .from('supplier_patterns')
      .select('*, suppliers(name, company)')
      .in('confidence_level', ['high', 'verified'])
      .order('last_observed', { ascending: false })
      .limit(50),
    supabase
      .from('email_logs')
      .select('from_email, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('quote_approval_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const stuckSupplierRequests = stuckWorkflows.data?.filter((interaction: any) => {
    const hasResponse = stuckWorkflows.data?.some(
      (resp: any) =>
        resp.interaction_type === 'quote_response' &&
        resp.supplier_id === interaction.supplier_id &&
        resp.quote_request_id === interaction.quote_request_id
    )
    return !hasResponse
  }) || []

  const approachingDeadlineNoResponse = suppliersApproachingDeadline.data?.filter((interaction: any) => {
    const hasResponse = suppliersApproachingDeadline.data?.some(
      (resp: any) =>
        resp.interaction_type === 'quote_response' &&
        resp.supplier_id === interaction.supplier_id &&
        resp.quote_request_id === interaction.quote_request_id
    )
    return !hasResponse
  }) || []

  const customerEmailCounts: Record<string, number> = {}
  customerHistory.data?.forEach((email: any) => {
    customerEmailCounts[email.from_email] = (customerEmailCounts[email.from_email] || 0) + 1
  })

  const approvalStats = {
    total: recentApprovalFeedback.data?.length || 0,
    approved: recentApprovalFeedback.data?.filter((f: any) => f.action === 'approved').length || 0,
    edited: recentApprovalFeedback.data?.filter((f: any) => f.action === 'edited').length || 0,
    rejected: recentApprovalFeedback.data?.filter((f: any) => f.action === 'rejected').length || 0,
    avgApprovalTime: 0,
  }

  const approvalTimes = recentApprovalFeedback.data
    ?.filter((f: any) => f.approval_time_seconds)
    .map((f: any) => f.approval_time_seconds) || []

  if (approvalTimes.length > 0) {
    approvalStats.avgApprovalTime = Math.round(
      approvalTimes.reduce((sum: number, time: number) => sum + time, 0) / approvalTimes.length
    )
  }

  return {
    pending_quotes: pendingQuotes.data || [],
    suppliers_approaching_deadline: approachingDeadlineNoResponse,
    quotes_awaiting_approval: quotesAwaitingApproval.data || [],
    stuck_workflows: stuckSupplierRequests,
    supplier_patterns: supplierPatterns.data || [],
    customer_email_counts: customerEmailCounts,
    approval_stats: approvalStats,
  }
}

/**
 * Core orchestration logic - shared between GET (Vercel Cron) and POST (manual trigger)
 */
async function handleOrchestrate() {
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

        // Skip categories that don't need AI responses
        const skipCategories = ['spam', 'internal', 'order', 'other']
        if (skipCategories.includes(email.category)) {
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
            `Skipped ${email.category} email: "${email.subject}" from ${email.from_email}`,
            null,
            { email_id: email.id, category: email.category }
          )
          continue
        }

        // Only respond to: complaint, support, inquiry (AI adds value here)
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

    const [recentOrders, existingTasks, quoteWorkflowData] = await Promise.all([
      supabase
        .from('order_tracker')
        .select('*')
        .is('flag_done', false)
        .order('order_no', { ascending: false })
        .limit(10),
      supabase.from('squad_tasks').select('*').in('status', ['new', 'in_progress']),
      gatherQuoteWorkflowData(),
    ])

    let aiTasksCreated: any[] = []
    let aiTasksFailed: any[] = []
    let aiReasoning = ''

    const pendingOrders = recentOrders.data?.length || 0
    const activeTasks = existingTasks.data?.length || 0

    // Enrich quote workflow data for the AI prompt
    const enrichedQuoteData = {
      pending_quotes_count: quoteWorkflowData.pending_quotes.length,
      pending_quotes_sample: quoteWorkflowData.pending_quotes.slice(0, 5).map((q: any) => ({
        id: q.id,
        customer_email: q.customer_email,
        status: q.status,
        age_hours: Math.round((Date.now() - new Date(q.created_at).getTime()) / (60 * 60 * 1000)),
        confidence_score: q.confidence_score,
      })),
      suppliers_approaching_deadline: quoteWorkflowData.suppliers_approaching_deadline.slice(0, 5).map((s: any) => ({
        supplier_name: s.suppliers?.name || 'Unknown',
        quote_request_id: s.quote_request_id,
        customer_email: s.quote_requests?.customer_email,
        hours_waiting: Math.round((Date.now() - new Date(s.created_at).getTime()) / (60 * 60 * 1000)),
      })),
      quotes_awaiting_approval: quoteWorkflowData.quotes_awaiting_approval.slice(0, 5).map((t: any) => ({
        task_id: t.id,
        title: t.title,
        age_hours: Math.round((Date.now() - new Date(t.created_at).getTime()) / (60 * 60 * 1000)),
        priority: t.priority,
        quote_request_id: t.metadata?.quote_request_id,
      })),
      stuck_workflows: quoteWorkflowData.stuck_workflows.slice(0, 5).map((s: any) => ({
        supplier_name: s.suppliers?.name || 'Unknown',
        supplier_reliability_score: s.suppliers?.reliability_score || 0,
        quote_request_id: s.quote_request_id,
        customer_email: s.quote_requests?.customer_email,
        hours_stuck: Math.round((Date.now() - new Date(s.created_at).getTime()) / (60 * 60 * 1000)),
      })),
      supplier_patterns: quoteWorkflowData.supplier_patterns.slice(0, 10).map((p: any) => ({
        supplier_name: p.suppliers?.name || 'Unknown',
        pattern_type: p.pattern_type,
        description: p.pattern_description,
        confidence: p.confidence_level,
        actionable_insight: p.actionable_insight,
      })),
      approval_stats: quoteWorkflowData.approval_stats,
    }

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
      quote_workflow: enrichedQuoteData,
    }

    // Always run AI analysis - not gated behind pendingOrders
    const prompt = `You are Jarvis, the orchestrator AI for Audico's business operations team. You manage a squad of specialized AI agents.

**Your Squad (excluding Email Agent which handles emails automatically):**
- Social Media Agent: Creates AI-powered social media posts for Facebook, Instagram, Twitter
- Google Ads Agent: Monitors ad campaigns, suggests bid optimizations, alerts on budget issues
- SEO Agent: Comprehensive SEO optimization for OpenCart products
  CAPABILITIES:
  • audit_products: Analyze product descriptions, meta tags, images
  • audit_schema: Check Schema.org JSON-LD markup for Google rich snippets
  • generate_schema: Create Product schema for missing products
  • check_vitals: Monitor Core Web Vitals (LCP, INP, CLS) via PageSpeed API
  • analyze_geo: Optimize content for AI search (ChatGPT, Perplexity, Google AI)
  • apply_fixes: Apply AI-generated SEO improvements
  • full_audit: Complete SEO health check (products + schema + vitals)
  PRIORITY TRIGGERS:
  • Low product views → audit_products + apply_fixes
  • No rich snippets → audit_schema + generate_schema
  • High bounce rate → check_vitals
  • New product batch → full_audit
- Marketing Agent: Processes reseller applications, manages newsletters, tracks influencers
- Supplier Intel Agent: Manages supplier relationships, tracks response patterns, intelligence gathering

**Quote Workflow Intelligence:**
${JSON.stringify(enrichedQuoteData, null, 2)}

Use this data to make intelligent decisions:
1. Prioritize quote requests based on customer profile and age
2. Escalate if suppliers haven't responded in >48h
3. Consider auto-approval for repeat buyers with simple quotes from reliable suppliers
4. Use supplier patterns to optimize supplier selection

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
  "decisions": [
    {
      "decision_type": "task_priority | supplier_escalation | auto_approval | supplier_pattern | workflow_optimization",
      "reasoning": "Why you made this decision",
      "confidence_score": 0.85,
      "situation_context": {},
      "decision_made": {}
    }
  ],
  "reasoning": "Brief explanation"
}

**Guidelines:**
- Do NOT create any email-related tasks (those are handled automatically)
- Only create tasks that are actionable and specific
- Don't duplicate existing tasks
- If nothing needs attention, return empty arrays
- Log significant decisions (prioritization, escalations, auto-approval recommendations)

Respond ONLY with valid JSON.`

    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
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
          `[Jarvis] ${taskDef.title}`,
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

      // Log Jarvis decisions
      for (const decision of jarvisDecision.decisions || []) {
        await logJarvisDecision(
          decision.decision_type,
          decision.situation_context,
          decision.decision_made,
          decision.reasoning,
          decision.confidence_score || 0.7,
          decision.situation_context?.quote_request_id,
          decision.situation_context?.task_id
        )
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

// Vercel Cron sends GET requests - do the actual work
export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({
      status: 'jarvis-orchestrator-active',
      message: 'Jarvis orchestrator ready',
      timestamp: new Date().toISOString(),
    })
  }
  return handleOrchestrate()
}

// Manual trigger via POST
export async function POST(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse()
  }
  return handleOrchestrate()
}
