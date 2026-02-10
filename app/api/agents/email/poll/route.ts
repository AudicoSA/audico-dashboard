import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { checkRateLimit, logAgentExecution, AGENT_RATE_LIMITS } from '@/lib/rate-limiter'
import { logAgentActivity } from '@/lib/logger'
import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  )

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  })

  return google.gmail({ version: 'v1', auth: oauth2Client })
}

async function logToSquadMessages(fromAgent: string, message: string, data: any = null) {
  const { error } = await supabase
    .from('squad_messages')
    .insert({
      from_agent: fromAgent,
      to_agent: null,
      message,
      task_id: null,
      data,
    })

  if (error) {
    console.error('❌ Failed to log to squad_messages:', error)
    console.error('Attempted insert:', { fromAgent, message, data })
  } else {
    console.log('✅ Successfully logged to squad_messages:', message)
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'email-poll-route-active',
    message: 'Use POST with Authorization: Bearer CRON_SECRET',
    method: 'This route only accepts POST requests from Vercel Cron',
    timestamp: new Date().toISOString()
  })
}

export async function POST(request: NextRequest) {
  // Verify request is from Vercel Cron or has valid auth
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse()
  }

  try {
    const rateLimit = await checkRateLimit(AGENT_RATE_LIMITS.email_poll)
    
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
      eventType: 'poll_start',
      message: 'Starting Gmail poll',
      context: { action: 'poll_start' }
    })

    const gmail = await getGmailClient()

    await logToSquadMessages('email_agent', 'Starting Gmail poll', { action: 'poll_start' })

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 30,
      q: 'is:unread',
    })

    const messages = response.data.messages || []

    await logAgentExecution('email_poll', {
      messages_found: messages.length,
      status: 'completed',
    })

    await logToSquadMessages(
      'email_agent',
      `Found ${messages.length} unread messages`,
      { action: 'poll_complete', count: messages.length, remaining: rateLimit.remaining }
    )

    const processedMessages = []
    let inserted = 0
    let skipped = 0
    let insertErrors = 0
    let lastInsertError = ''

    for (const message of messages) {
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full',
      })

      const headers = fullMessage.data.payload?.headers || []
      const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || 'unknown'
      const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || 'No Subject'
      
      let body = ''
      if (fullMessage.data.payload?.body?.data) {
        body = Buffer.from(fullMessage.data.payload.body.data, 'base64').toString('utf-8')
      } else if (fullMessage.data.payload?.parts) {
        const textPart = fullMessage.data.payload.parts.find((part) => part.mimeType === 'text/plain')
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8')
        }
      }

      // Check if email already exists (use maybeSingle to avoid error on 0 rows)
      const { data: existingEmail } = await supabase
        .from('email_logs')
        .select('id')
        .eq('gmail_message_id', message.id!)
        .maybeSingle()

      if (existingEmail) {
        skipped++
      } else {
        const { data: emailLog, error: insertError } = await supabase
          .from('email_logs')
          .insert({
            gmail_message_id: message.id!,
            from_email: from,
            subject,
            category: 'unclassified',
            status: 'unread',
            handled_by: null,
            payload: {
              body: body.substring(0, 1000),
              snippet: fullMessage.data.snippet,
              labels: fullMessage.data.labelIds,
            },
          })
          .select()
          .single()

        if (insertError) {
          insertErrors++
          lastInsertError = `${insertError.message} (code: ${insertError.code}, details: ${insertError.details}, hint: ${insertError.hint})`
          console.error(`❌ Failed to insert email "${subject}":`, lastInsertError)
          await logToSquadMessages(
            'email_agent',
            `❌ INSERT FAILED for "${subject}" from ${from}: ${insertError.message}`,
            { action: 'email_insert_error', gmail_message_id: message.id, error: insertError.message }
          )
        } else {
          inserted++
          await logToSquadMessages(
            'email_agent',
            `New email logged: ${subject} from ${from}`,
            { action: 'email_logged', email_id: emailLog?.id, gmail_message_id: message.id }
          )
        }
      }

      processedMessages.push({
        id: message.id,
        from,
        subject,
        snippet: fullMessage.data.snippet,
      })
    }

    if (insertErrors > 0) {
      await logToSquadMessages(
        'email_agent',
        `⚠️ Poll complete: ${inserted} inserted, ${skipped} skipped, ${insertErrors} FAILED`,
        { action: 'poll_summary', inserted, skipped, insertErrors }
      )
    }

    return NextResponse.json({
      success: true,
      messagesFound: messages.length,
      inserted,
      skipped,
      insertErrors,
      lastInsertError: lastInsertError || undefined,
      messages: processedMessages,
      remaining: rateLimit.remaining,
    })
  } catch (error: any) {
    console.error('Gmail poll error:', error)
    
    await logAgentActivity({
      agentName: 'email_agent',
      logLevel: 'error',
      eventType: 'poll_error',
      message: `Gmail poll failed: ${error.message}`,
      errorDetails: {
        error: error.message,
        stack: error.stack
      },
      context: { action: 'poll_error' }
    })

    await logToSquadMessages(
      'email_agent',
      `Poll failed: ${error.message}`,
      { action: 'poll_error', error: error.message }
    )

    return NextResponse.json(
      { error: 'Failed to poll Gmail', details: error.message },
      { status: 500 }
    )
  }
}
