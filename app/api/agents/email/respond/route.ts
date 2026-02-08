import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

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

function generateResponse(category: string, subject: string, senderName: string): string {
  const responses: Record<string, string> = {
    order: `Thank you for your order inquiry. We're looking into your request regarding "${subject}" and will get back to you shortly with an update.

Best regards,
Support Team`,
    support: `Thank you for reaching out to our support team. We've received your message regarding "${subject}" and are working on resolving your issue.

We'll get back to you as soon as possible with a solution.

Best regards,
Support Team`,
    inquiry: `Thank you for your inquiry about "${subject}". We appreciate your interest and will provide you with the information you need shortly.

Best regards,
Support Team`,
    complaint: `We sincerely apologize for any inconvenience you've experienced. Your feedback regarding "${subject}" is very important to us.

We're taking immediate action to address your concerns and will follow up with you shortly.

Best regards,
Support Team`,
    other: `Thank you for your email regarding "${subject}". We've received your message and will review it carefully.

We'll get back to you soon.

Best regards,
Support Team`,
  }

  return responses[category] || responses.other
}

function createEmailMessage(to: string, subject: string, body: string, inReplyTo?: string, references?: string) {
  const messageParts = [
    `To: ${to}`,
    `Subject: Re: ${subject}`,
  ]

  if (inReplyTo) {
    messageParts.push(`In-Reply-To: ${inReplyTo}`)
  }

  if (references) {
    messageParts.push(`References: ${references}`)
  }

  messageParts.push('Content-Type: text/plain; charset=utf-8')
  messageParts.push('')
  messageParts.push(body)

  const message = messageParts.join('\n')
  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email_id, gmail_message_id, response_text } = body

    if (!email_id && !gmail_message_id) {
      return NextResponse.json(
        { error: 'email_id or gmail_message_id is required' },
        { status: 400 }
      )
    }

    await logToSquadMessages(
      'email_agent',
      `Creating response for email: ${email_id || gmail_message_id}`,
      { action: 'respond_start', email_id, gmail_message_id }
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

    const gmail = await getGmailClient()

    const originalMessage = await gmail.users.messages.get({
      userId: 'me',
      id: emailLog.gmail_message_id,
      format: 'full',
    })

    const headers = originalMessage.data.payload?.headers || []
    const messageId = headers.find((h) => h.name?.toLowerCase() === 'message-id')?.value || undefined
    const references = headers.find((h) => h.name?.toLowerCase() === 'references')?.value || undefined

    const responseBody = response_text || generateResponse(
      emailLog.category || 'other',
      emailLog.subject,
      emailLog.from_email.split('<')[0].trim()
    )

    const encodedMessage = createEmailMessage(
      emailLog.from_email,
      emailLog.subject,
      responseBody,
      messageId,
      references
    )

    const draftResponse = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: encodedMessage,
          threadId: originalMessage.data.threadId,
        },
      },
    })

    const { error: updateError } = await supabase
      .from('email_logs')
      .update({
        status: 'draft_created',
        handled_by: 'email_agent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', emailLog.id)

    if (updateError) {
      console.error('Failed to update email log:', updateError)
    }

    await logToSquadMessages(
      'email_agent',
      `Draft created for: ${emailLog.subject}`,
      {
        action: 'respond_complete',
        email_id: emailLog.id,
        draft_id: draftResponse.data.id,
        to: emailLog.from_email,
      }
    )

    return NextResponse.json({
      success: true,
      draft: {
        id: draftResponse.data.id,
        message: draftResponse.data.message,
      },
      email: emailLog,
      response_preview: responseBody,
    })
  } catch (error: any) {
    console.error('Email response error:', error)
    await logToSquadMessages(
      'email_agent',
      `Response creation failed: ${error.message}`,
      { action: 'respond_error', error: error.message }
    )

    return NextResponse.json(
      { error: 'Failed to create response draft', details: error.message },
      { status: 500 }
    )
  }
}
