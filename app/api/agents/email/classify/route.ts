import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, logAgentExecution, AGENT_RATE_LIMITS } from '@/lib/rate-limiter'
import { logAgentActivity } from '@/lib/logger'

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

type EmailCategory = 'order' | 'support' | 'inquiry' | 'complaint' | 'spam' | 'other'
type EmailPriority = 'low' | 'medium' | 'high' | 'urgent'

function classifyEmail(from: string, subject: string, body: string): {
  category: EmailCategory
  priority: EmailPriority
} {
  const lowerSubject = subject.toLowerCase()
  const lowerBody = body.toLowerCase()
  const combined = lowerSubject + ' ' + lowerBody

  let category: EmailCategory = 'other'
  let priority: EmailPriority = 'medium'

  if (
    combined.includes('order') ||
    combined.includes('purchase') ||
    combined.includes('invoice') ||
    combined.includes('receipt')
  ) {
    category = 'order'
    priority = 'high'
  } else if (
    combined.includes('help') ||
    combined.includes('support') ||
    combined.includes('issue') ||
    combined.includes('problem')
  ) {
    category = 'support'
    priority = 'high'
  } else if (
    combined.includes('question') ||
    combined.includes('inquiry') ||
    combined.includes('ask') ||
    combined.includes('wondering')
  ) {
    category = 'inquiry'
    priority = 'medium'
  } else if (
    combined.includes('complaint') ||
    combined.includes('unhappy') ||
    combined.includes('disappointed') ||
    combined.includes('refund')
  ) {
    category = 'complaint'
    priority = 'urgent'
  } else if (
    combined.includes('unsubscribe') ||
    combined.includes('spam') ||
    combined.includes('promotional')
  ) {
    category = 'spam'
    priority = 'low'
  }

  if (combined.includes('urgent') || combined.includes('asap') || combined.includes('immediately')) {
    priority = 'urgent'
  }

  return { category, priority }
}

/**
 * Core classification logic - shared between GET (Vercel Cron) and POST (manual trigger)
 */
async function handleClassify() {
  try {
    const rateLimit = await checkRateLimit(AGENT_RATE_LIMITS.email_classify)

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
      agentName: 'email_agent',
      logLevel: 'info',
      eventType: 'classify_start',
      message: 'Starting email classification',
      context: { action: 'classify_start' }
    })

    // Fetch ALL unclassified emails
    const { data: unclassifiedEmails, error: fetchError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('category', 'unclassified')
      .limit(20)

    if (fetchError) {
      throw new Error(`Failed to fetch unclassified emails: ${fetchError.message}`)
    }

    if (!unclassifiedEmails || unclassifiedEmails.length === 0) {
      await logToSquadMessages(
        'Email Agent',
        'No unclassified emails to process',
        { action: 'classify_complete', count: 0 }
      )
      return NextResponse.json({
        success: true,
        classified: 0,
        message: 'No emails to classify',
        remaining: rateLimit.remaining
      })
    }

    await logToSquadMessages(
      'Email Agent',
      `📧 Classifying ${unclassifiedEmails.length} emails`,
      { action: 'classify_start', count: unclassifiedEmails.length }
    )

    const classified = []
    const failed = []

    for (const emailLog of unclassifiedEmails) {
      try {
        const { category, priority } = classifyEmail(
          emailLog.from_email,
          emailLog.subject,
          emailLog.payload?.body || ''
        )

        const { data: updated, error: updateError } = await supabase
          .from('email_logs')
          .update({
            category,
            priority,
            status: 'classified',
            updated_at: new Date().toISOString(),
          })
          .eq('id', emailLog.id)
          .select()
          .single()

        if (updateError) {
          console.error(`❌ Failed to classify email "${emailLog.subject}":`, updateError.message)
          failed.push({ id: emailLog.id, subject: emailLog.subject, error: updateError.message })
          await logToSquadMessages(
            'Email Agent',
            `❌ CLASSIFY FAILED for "${emailLog.subject}": ${updateError.message}`,
            { action: 'classify_update_error', email_id: emailLog.id, error: updateError.message }
          )
          continue
        }

        classified.push({
          id: emailLog.id,
          subject: emailLog.subject,
          category,
          priority
        })

        await logToSquadMessages(
          'Email Agent',
          `📬 ${category.toUpperCase()}: "${emailLog.subject}" (${priority} priority)`,
          {
            action: 'email_classified',
            email_id: emailLog.id,
            category,
            priority,
          }
        )
      } catch (error: any) {
        failed.push({ id: emailLog.id, error: error.message })
      }
    }

    await logAgentExecution('email_classify', {
      classified: classified.length,
      failed: failed.length,
      status: 'completed',
    })

    await logToSquadMessages(
      'Email Agent',
      `✅ Classification complete: ${classified.length} classified, ${failed.length} failed`,
      {
        action: 'classify_complete',
        classified: classified.length,
        failed: failed.length,
        remaining: rateLimit.remaining,
      }
    )

    // Update agent status
    await supabase.from('squad_agents').update({
      status: 'active',
      last_active: new Date().toISOString()
    }).eq('name', 'Email Agent')

    return NextResponse.json({
      success: true,
      classified: classified.length,
      failed: failed.length,
      emails: classified,
      remaining: rateLimit.remaining,
    })
  } catch (error: any) {
    console.error('Email classification error:', error)

    await logAgentActivity({
      agentName: 'email_agent',
      logLevel: 'error',
      eventType: 'classify_error',
      message: `Email classification failed: ${error.message}`,
      errorDetails: {
        error: error.message,
        stack: error.stack
      },
      context: { action: 'classify_error' }
    })

    await logToSquadMessages(
      'Email Agent',
      `❌ Classification failed: ${error.message}`,
      { action: 'classify_error', error: error.message }
    )

    return NextResponse.json(
      { error: 'Failed to classify emails', details: error.message },
      { status: 500 }
    )
  }
}

// Vercel Cron sends GET requests - do the actual work
export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({
      status: 'email-classify-route-active',
      message: 'Use Authorization: Bearer CRON_SECRET to trigger',
      timestamp: new Date().toISOString()
    })
  }
  return handleClassify()
}

// Manual trigger via POST
export async function POST(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse()
  }
  return handleClassify()
}
