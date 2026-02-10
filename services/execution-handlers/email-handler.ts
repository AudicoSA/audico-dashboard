/**
 * Email Agent Execution Handler
 *
 * Handles email sending tasks for the Email Agent.
 * Phase 2: Full implementation with Gmail API integration.
 */

import type { Task } from '@/types/squad'
import { sendDraft } from '@/services/integrations/gmail-sender'
import { getServerSupabase } from '@/lib/supabase'
import { logToSquadMessages } from '@/lib/logger'

const DRY_RUN = process.env.AGENT_DRY_RUN === 'true'

interface ExecutionResult {
  success: boolean
  deliverable_url?: string
  error?: string
}

/**
 * Execute email sending task
 */
export async function emailSendHandler(task: Task): Promise<ExecutionResult> {
  console.log('[EMAIL HANDLER] Executing task:', task.title)

  if (DRY_RUN) {
    console.log('[DRY RUN] Would send email:', task.metadata)
    await logToSquadMessages('Email Agent', `[DRY RUN] Would send email: ${task.title}`, task.metadata)
    return {
      success: true,
      deliverable_url: '/emails/dry-run-preview',
    }
  }

  try {
    const supabase = getServerSupabase()

    // Get email metadata
    const emailId = task.metadata?.email_id
    const draftId = task.metadata?.draft_id

    if (!emailId || !draftId) {
      throw new Error('Missing email_id or draft_id in task metadata')
    }

    // Fetch email details
    const { data: emailLog, error: emailError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('id', emailId)
      .single()

    if (emailError || !emailLog) {
      throw new Error(`Email not found: ${emailId}`)
    }

    console.log('[EMAIL HANDLER] Sending draft:', draftId)

    // Send the draft
    const sentMessage = await sendDraft(draftId)

    // Update email_logs
    const { error: updateError } = await supabase
      .from('email_logs')
      .update({
        status: 'sent',
        metadata: {
          ...emailLog.metadata,
          gmail_message_id: sentMessage.id,
          sent_via: 'auto_execution',
          sent_at: new Date().toISOString()
        }
      })
      .eq('id', emailId)

    if (updateError) {
      console.error('[EMAIL HANDLER] Failed to update email_logs:', updateError)
    }

    // Log success
    await logToSquadMessages(
      'Email Agent',
      `✅ Email sent to ${emailLog.from_email}: "${emailLog.subject}"`,
      {
        email_id: emailId,
        message_id: sentMessage.id,
        category: emailLog.category
      }
    )

    return {
      success: true,
      deliverable_url: `https://mail.google.com/mail/u/0/#sent/${sentMessage.id}`
    }
  } catch (error: any) {
    console.error('[EMAIL HANDLER] Error:', error)

    // Log error to squad messages
    await logToSquadMessages(
      'Email Agent',
      `❌ Failed to send email: ${error.message}`,
      { task_id: task.id, error: error.message }
    )

    return {
      success: false,
      error: error.message
    }
  }
}
