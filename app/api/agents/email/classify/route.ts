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

type EmailCategory = 'order' | 'support' | 'inquiry' | 'complaint' | 'spam' | 'internal' | 'other'
type EmailPriority = 'low' | 'medium' | 'high' | 'urgent'

// Internal/known domains - never auto-respond to these
const INTERNAL_DOMAINS = [
  'audico.co.za',
  'audicoonline.co.za',
]

function classifyEmail(from: string, subject: string, body: string): {
  category: EmailCategory
  priority: EmailPriority
} {
  const lowerFrom = from.toLowerCase()
  const lowerSubject = subject.toLowerCase()
  const lowerBody = body.toLowerCase()
  const combined = lowerSubject + ' ' + lowerBody

  // 1. Internal emails - staff, own domains (never auto-respond)
  if (INTERNAL_DOMAINS.some(domain => lowerFrom.includes(domain))) {
    return { category: 'internal', priority: 'low' }
  }

  // 2. Spam / marketing noise
  if (
    combined.includes('unsubscribe') ||
    combined.includes('spam') ||
    combined.includes('promotional') ||
    combined.includes('opt out') ||
    combined.includes('marketing email')
  ) {
    return { category: 'spam', priority: 'low' }
  }

  let category: EmailCategory = 'other'
  let priority: EmailPriority = 'medium'

  // 3. Complaints / disgruntled customers (URGENT - always draft response)
  if (
    combined.includes('complaint') ||
    combined.includes('unhappy') ||
    combined.includes('disappointed') ||
    combined.includes('disgusted') ||
    combined.includes('terrible') ||
    combined.includes('worst') ||
    combined.includes('refund') ||
    combined.includes('broken') ||
    combined.includes('damaged') ||
    combined.includes('not working') ||
    combined.includes('never received') ||
    combined.includes('wrong item') ||
    combined.includes('faulty')
  ) {
    category = 'complaint'
    priority = 'urgent'
  }
  // 4. Tech support / product help (AI can assist well)
  else if (
    combined.includes('how do i') ||
    combined.includes('how to') ||
    combined.includes('setup') ||
    combined.includes('set up') ||
    combined.includes('install') ||
    combined.includes('connect') ||
    combined.includes('pair') ||
    combined.includes('bluetooth') ||
    combined.includes('wifi') ||
    combined.includes('firmware') ||
    combined.includes('not connecting') ||
    combined.includes('troubleshoot') ||
    combined.includes('manual') ||
    combined.includes('specs') ||
    combined.includes('specification') ||
    combined.includes('compatible') ||
    combined.includes('help') ||
    combined.includes('support') ||
    combined.includes('issue') ||
    combined.includes('problem')
  ) {
    category = 'support'
    priority = 'high'
  }
  // 5. Product inquiries / pricing (AI can auto-assist)
  else if (
    combined.includes('price') ||
    combined.includes('cost') ||
    combined.includes('stock') ||
    combined.includes('available') ||
    combined.includes('availability') ||
    combined.includes('do you have') ||
    combined.includes('looking for') ||
    combined.includes('interested in') ||
    combined.includes('catalogue') ||
    combined.includes('catalog') ||
    combined.includes('quote') ||
    combined.includes('question') ||
    combined.includes('inquiry') ||
    combined.includes('wondering')
  ) {
    category = 'inquiry'
    priority = 'medium'
  }
  // 6. Orders / invoices / supplier stuff - just log, your team handles these
  else if (
    combined.includes('order') ||
    combined.includes('purchase') ||
    combined.includes('invoice') ||
    combined.includes('receipt') ||
    combined.includes('statement') ||
    combined.includes('payment received') ||
    combined.includes('proof of payment') ||
    combined.includes('remittance') ||
    combined.includes('credit note')
  ) {
    category = 'order'
    priority = 'low'
  }

  // Urgency override
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
