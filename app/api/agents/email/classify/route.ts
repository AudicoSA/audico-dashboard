import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, logAgentExecution, AGENT_RATE_LIMITS } from '@/lib/rate-limiter'
import { logAgentActivity } from '@/lib/logger'
import { detectQuoteRequest } from '@/lib/quote-request-detector'
import { processSupplierResponse } from '@/lib/supplier-response-handler'

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

// Known business partners / vendors / service providers - never auto-respond
// These are companies we work with internally (call centers, suppliers, etc.)
const KNOWN_PARTNERS = [
  'thetha',        // Thetha - our call center
  'noreply',       // Automated system emails
  'no-reply',
  'mailer-daemon',
  'postmaster',
]

/**
 * Load senders that Kenny has rejected 2+ times from squad_tasks.
 * This teaches the system to stop emailing people Kenny keeps rejecting.
 */
async function loadBlockedSenders(): Promise<string[]> {
  try {
    // Get rejected tasks that have email metadata
    const { data: rejectedTasks } = await supabase
      .from('squad_tasks')
      .select('metadata')
      .eq('status', 'rejected')
      .not('metadata->email_id', 'is', null)

    if (!rejectedTasks || rejectedTasks.length === 0) return []

    // Get the email IDs from rejected tasks
    const emailIds = rejectedTasks
      .map(t => t.metadata?.email_id)
      .filter(Boolean)

    if (emailIds.length === 0) return []

    // Fetch the senders for those emails
    const { data: emails } = await supabase
      .from('email_logs')
      .select('from_email')
      .in('id', emailIds)

    if (!emails) return []

    // Count rejections per sender - block senders rejected 2+ times
    const senderCounts: Record<string, number> = {}
    for (const email of emails) {
      const sender = email.from_email?.toLowerCase() || ''
      senderCounts[sender] = (senderCounts[sender] || 0) + 1
    }

    return Object.entries(senderCounts)
      .filter(([, count]) => count >= 2)
      .map(([sender]) => sender)
  } catch (error) {
    console.error('Failed to load blocked senders:', error)
    return []
  }
}

function classifyEmail(from: string, subject: string, body: string, blockedSenders: string[] = []): {
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

  // 1b. Known business partners (call centers, vendors) - never auto-respond
  if (KNOWN_PARTNERS.some(partner => lowerFrom.includes(partner))) {
    return { category: 'internal', priority: 'low' }
  }

  // 1c. Learned blocklist - senders Kenny has rejected 2+ times
  if (blockedSenders.some(blocked => lowerFrom.includes(blocked))) {
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

    // Load dynamic blocklist from rejected tasks (learns from Kenny's rejections)
    const blockedSenders = await loadBlockedSenders()

    await logToSquadMessages(
      'Email Agent',
      `📧 Classifying ${unclassifiedEmails.length} emails (${blockedSenders.length} senders on learned blocklist)`,
      { action: 'classify_start', count: unclassifiedEmails.length, blocked_senders: blockedSenders.length }
    )

    const classified = []
    const failed = []

    for (const emailLog of unclassifiedEmails) {
      try {
        const { category, priority } = classifyEmail(
          emailLog.from_email,
          emailLog.subject,
          emailLog.payload?.body || '',
          blockedSenders
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

    // === Quote Detection & Supplier Response Processing (non-fatal) ===
    const classifiedIds = new Set(classified.map(c => c.id))
    for (const emailLog of unclassifiedEmails) {
      if (!classifiedIds.has(emailLog.id)) continue

      try {
        const quoteResult = await detectQuoteRequest({
          id: emailLog.id,
          gmail_message_id: emailLog.gmail_message_id,
          from_email: emailLog.from_email,
          subject: emailLog.subject,
          body: emailLog.payload?.body || '',
        })

        // LOG RESULTS TO SQUAD_MESSAGES (so we can see what's happening!)
        if (quoteResult.isQuoteRequest) {
          await logToSquadMessages(
            'Email Agent',
            `🎯 Quote request detected: "${emailLog.subject}" (${Math.round(quoteResult.confidenceScore * 100)}% confidence)`,
            {
              email_id: emailLog.id,
              quote_request_id: quoteResult.quoteRequestId,
              task_id: quoteResult.taskId,
              confidence: quoteResult.confidenceScore,
            }
          )
        } else {
          // Log even when NOT a quote (so we know the detector ran)
          await logToSquadMessages(
            'Email Agent',
            `📧 Not a quote request: "${emailLog.subject}" (${Math.round(quoteResult.confidenceScore * 100)}% confidence)`,
            {
              email_id: emailLog.id,
              confidence: quoteResult.confidenceScore,
            }
          )
        }
      } catch (err: any) {
        console.error('Quote detection failed (non-fatal):', err)
        // LOG ERRORS TO SQUAD_MESSAGES
        await logToSquadMessages(
          'Email Agent',
          `❌ Quote detection error for "${emailLog.subject}": ${err.message}`,
          {
            email_id: emailLog.id,
            error: err.message,
            stack: err.stack?.substring(0, 500),
          }
        )
      }

      try {
        await processSupplierResponse(emailLog.id)
      } catch (err) {
        console.error('Supplier response check failed (non-fatal):', err)
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
