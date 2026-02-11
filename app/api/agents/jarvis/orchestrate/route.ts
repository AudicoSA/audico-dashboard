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
    // PHASE 2: AI orchestration — analyze ALL data sources every cycle
    // Always runs — Jarvis is the brain that sees everything
    // ================================================================

    const [
      recentOrders,
      existingTasks,
      recentSocialPosts,
      recentSeoAudits,
      schemaAuditGaps,
      pendingResellerApps,
      recentNewsletters,
      uncontactedInfluencers,
    ] = await Promise.all([
      supabase
        .from('order_tracker')
        .select('*')
        .is('flag_done', false)
        .order('order_no', { ascending: false })
        .limit(10),
      supabase.from('squad_tasks').select('*').in('status', ['new', 'in_progress']),
      supabase
        .from('social_posts')
        .select('id, platform, status, created_at, published_at')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('seo_audits')
        .select('id, url, score, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('seo_schema_audits')
        .select('id, has_product_schema')
        .eq('has_product_schema', false)
        .limit(100),
      supabase
        .from('reseller_applications')
        .select('id, company_name, status')
        .eq('status', 'pending'),
      supabase
        .from('newsletter_drafts')
        .select('id, status, created_at')
        .eq('status', 'sent')
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('influencer_opportunities')
        .select('id, status')
        .neq('status', 'contacted')
        .limit(20),
    ])

    let aiTasksCreated: any[] = []
    let aiTasksFailed: any[] = []
    let aiReasoning = ''

    const pendingOrders = recentOrders.data?.length || 0
    const activeTasks = existingTasks.data?.length || 0

    // Calculate days since last social post
    const lastPostDate = recentSocialPosts.data
      ?.filter((p: any) => p.status === 'published' && p.published_at)
      ?.map((p: any) => new Date(p.published_at).getTime())
      ?.sort((a: number, b: number) => b - a)?.[0]
    const daysSinceLastPost = lastPostDate
      ? Math.floor((Date.now() - lastPostDate) / (1000 * 60 * 60 * 24))
      : 999

    // Calculate days since last SEO audit
    const lastAuditDate = recentSeoAudits.data?.[0]?.created_at
    const daysSinceLastAudit = lastAuditDate
      ? Math.floor((Date.now() - new Date(lastAuditDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999

    // Calculate days since last newsletter
    const lastNewsletterDate = recentNewsletters.data?.[0]?.created_at
    const daysSinceLastNewsletter = lastNewsletterDate
      ? Math.floor((Date.now() - new Date(lastNewsletterDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999

    const situationReport = {
      // Email stats (already processed in Phase 1)
      emails_just_processed: emailResults.processed,
      emails_responded: emailResults.responded,

      // Social media status
      recent_posts_count: recentSocialPosts.data?.length || 0,
      days_since_last_post: daysSinceLastPost,
      posts_last_7_days: recentSocialPosts.data?.filter((p: any) => {
        const d = new Date(p.created_at)
        return d.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
      }).length || 0,

      // SEO health
      days_since_last_seo_audit: daysSinceLastAudit,
      last_seo_score: recentSeoAudits.data?.[0]?.score ?? null,
      products_without_schema: schemaAuditGaps.data?.length || 0,

      // Marketing pipeline
      pending_reseller_applications: pendingResellerApps.data?.length || 0,
      pending_reseller_names: pendingResellerApps.data?.map((r: any) => r.company_name) || [],
      days_since_last_newsletter: daysSinceLastNewsletter,
      uncontacted_influencers: uncontactedInfluencers.data?.length || 0,

      // Orders (existing)
      pending_orders: pendingOrders,

      // Active tasks (prevent duplicates)
      active_tasks: existingTasks.data?.map((t: any) => ({
        title: t.title,
        assigned_to: t.assigned_agent,
        status: t.status,
      })) || [],
    }

    // Always run Phase 2 — analyze all data sources
    const prompt = `You are Jarvis, the orchestrator AI for Audico's business operations team. You manage a squad of specialized AI agents.

**Your Squad (excluding Email Agent which handles emails automatically):**

**Social Media Agent** — Creates AI-powered social media posts for Facebook, Instagram, Twitter
  TRIGGER CONDITIONS:
  • No post in 2+ days → Create task: "Generate and schedule social media posts"
  • 0 posts in last 7 days → Create URGENT task: "Social media has gone silent — generate content immediately"

**SEO Agent** — Comprehensive SEO optimization for OpenCart products
  CAPABILITIES: audit_products, audit_schema, generate_schema, check_vitals, analyze_geo, apply_fixes, full_audit
  TRIGGER CONDITIONS:
  • No audit in 30+ days → Create task: "Run full SEO audit"
  • Products without Schema.org (>0) → Create task: "Generate schema for untagged products"
  • SEO score below 60 → Create HIGH priority task: "SEO score critically low — run audit and apply fixes"

**Marketing Agent** — Processes reseller applications, manages newsletters, tracks influencers
  TRIGGER CONDITIONS:
  • Pending reseller applications (>0) → Create task for EACH: "Process reseller application for [company]"
  • No newsletter in 14+ days → Create task: "Generate newsletter draft"
  • Un-contacted influencers (>0) → Create task: "Send influencer outreach"

**Google Ads Agent** — NOT YET IMPLEMENTED — do NOT create tasks for this agent.

**Current Situation:**
${JSON.stringify(situationReport, null, 2)}

**Your Task:**
Analyze this situation and decide what NON-EMAIL tasks need to be created. Email handling is automatic — do NOT create email tasks.

Respond with JSON:
{
  "tasks": [
    {
      "title": "Brief task title",
      "description": "Detailed description including what action to take",
      "assigned_agent": "Social Media Agent" | "SEO Agent" | "Marketing Agent",
      "priority": "low" | "medium" | "high" | "urgent",
      "mentions_kenny": false,
      "metadata": { "action": "relevant_action_name" }
    }
  ],
  "reasoning": "Brief explanation of why you created (or didn't create) each task"
}

**Guidelines:**
- Do NOT create any email-related tasks (those are handled automatically)
- Do NOT create tasks for Google Ads Agent (not implemented)
- Only create tasks that are actionable and specific
- Don't duplicate active tasks listed above
- If nothing needs attention, return an empty tasks array
- Include metadata.action so the task executor knows what handler to call

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
        // Skip any email or ads tasks
        if (taskDef.assigned_agent === 'Email Agent') continue
        if (taskDef.assigned_agent === 'Google Ads Agent') continue

        const { task, error } = await createTask(
          taskDef.title,
          taskDef.description,
          taskDef.assigned_agent,
          taskDef.priority,
          taskDef.mentions_kenny || false,
          taskDef.metadata || {}
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
