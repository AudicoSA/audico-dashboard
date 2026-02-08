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

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

    const body = await request.json()
    const { email_id, gmail_message_id } = body

    if (!email_id && !gmail_message_id) {
      return NextResponse.json(
        { error: 'email_id or gmail_message_id is required' },
        { status: 400 }
      )
    }

    await logToSquadMessages(
      'email_agent',
      `Classifying email: ${email_id || gmail_message_id}`,
      { action: 'classify_start', email_id, gmail_message_id }
    )

    let query = supabase.from('email_logs').select('*')
    
    if (email_id) {
      query = query.eq('id', email_id)
    } else {
      query = query.eq('gmail_message_id', gmail_message_id)
    }

    const { data: emailLog, error: fetchError } = await query.single()

    if (fetchError || !emailLog) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      )
    }

    const { category, priority } = classifyEmail(
      emailLog.from_email,
      emailLog.subject,
      emailLog.payload?.body || ''
    )

    const { data: updated, error: updateError } = await supabase
      .from('email_logs')
      .update({
        category,
        status: 'classified',
        updated_at: new Date().toISOString(),
      })
      .eq('id', emailLog.id)
      .select()
      .single()

    if (updateError) {
      await logToSquadMessages(
        'email_agent',
        `Classification failed: ${updateError.message}`,
        { action: 'classify_error', error: updateError.message }
      )
      throw updateError
    }

    const { data: classification, error: classificationError } = await supabase
      .from('email_classifications')
      .insert({
        email_id: emailLog.gmail_message_id,
        sender: emailLog.from_email,
        subject: emailLog.subject,
        body: emailLog.payload?.body || null,
        classification: category,
        priority,
        assigned_agent: 'email_agent',
        status: 'read',
        metadata: {
          classified_at: new Date().toISOString(),
          snippet: emailLog.payload?.snippet,
        },
      })
      .select()
      .single()

    await logAgentExecution('email_classify', {
      email_id: emailLog.id,
      category,
      priority,
      status: 'completed',
    })

    await logToSquadMessages(
      'email_agent',
      `Email classified as ${category} with ${priority} priority`,
      {
        action: 'classify_complete',
        email_id: emailLog.id,
        category,
        priority,
        classification_id: classification?.id,
        remaining: rateLimit.remaining,
      }
    )

    return NextResponse.json({
      success: true,
      email: updated,
      classification,
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
      'email_agent',
      `Classification failed: ${error.message}`,
      { action: 'classify_error', error: error.message }
    )

    return NextResponse.json(
      { error: 'Failed to classify email', details: error.message },
      { status: 500 }
    )
  }
}
