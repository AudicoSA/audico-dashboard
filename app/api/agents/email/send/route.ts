import { NextRequest, NextResponse } from 'next/server'
import { sendDraft } from '@/services/integrations/gmail-sender'
import { getServerSupabase } from '@/lib/supabase'
import { logToSquadMessages } from '@/lib/logger'

/**
 * Email Sending Endpoint
 *
 * Handles sending email drafts via Gmail API.
 * Can be called manually or by the task executor.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email_id, draft_id } = await request.json()

    if (!email_id || !draft_id) {
      return NextResponse.json(
        { error: 'Missing email_id or draft_id' },
        { status: 400 }
      )
    }

    const supabase = getServerSupabase()

    // Get email details
    const { data: emailLog, error } = await supabase
      .from('email_logs')
      .select('*')
      .eq('id', email_id)
      .single()

    if (error || !emailLog) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      )
    }

    console.log('[EMAIL SEND] Sending draft:', draft_id)

    // Send the draft
    const sentMessage = await sendDraft(draft_id)

    // Update email_logs
    const { error: updateError } = await supabase
      .from('email_logs')
      .update({
        status: 'sent',
        metadata: {
          ...emailLog.metadata,
          gmail_message_id: sentMessage.id,
          sent_at: new Date().toISOString()
        }
      })
      .eq('id', email_id)

    if (updateError) {
      console.error('[EMAIL SEND] Failed to update email_logs:', updateError)
    }

    // Mark related task as completed
    const { data: task } = await supabase
      .from('squad_tasks')
      .select('id')
      .eq('metadata->>email_id', email_id)
      .single()

    if (task) {
      await supabase.from('squad_tasks').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        deliverable_url: `https://mail.google.com/mail/u/0/#sent/${sentMessage.id}`
      }).eq('id', task.id)
    }

    await logToSquadMessages(
      'email_agent',
      `✅ Email sent to ${emailLog.from_email}: "${emailLog.subject}"`,
      { email_id, sent_message_id: sentMessage.id }
    )

    return NextResponse.json({
      success: true,
      message_id: sentMessage.id,
      email_id
    })
  } catch (error: any) {
    console.error('[EMAIL SEND] Error:', error)

    await logToSquadMessages(
      'email_agent',
      `❌ Failed to send email: ${error.message}`,
      { error: error.message }
    )

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'operational',
    endpoint: '/api/agents/email/send',
    method: 'POST',
    required_fields: ['email_id', 'draft_id']
  })
}
