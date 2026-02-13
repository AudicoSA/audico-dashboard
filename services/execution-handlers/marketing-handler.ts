/**
 * Marketing Agent Execution Handler
 *
 * Handles marketing tasks for the Marketing Agent.
 * Phase 4: Newsletter distribution and influencer outreach.
 */

import type { Task } from '@/types/squad'
import { sendNewsletter } from '@/services/integrations/brevo-service'
import { sendDirectEmail } from '@/services/integrations/gmail-sender'
import { getServerSupabase } from '@/lib/supabase'
import { logToSquadMessages } from '@/lib/logger'

const DRY_RUN = process.env.AGENT_DRY_RUN === 'true'

interface ExecutionResult {
  success: boolean
  deliverable_url?: string
  error?: string
}

/**
 * Execute marketing task
 */
export async function marketingHandler(task: Task): Promise<ExecutionResult> {
  console.log('[MARKETING HANDLER] Executing task:', task.title)

  if (DRY_RUN) {
    console.log('[DRY RUN] Would execute marketing task:', task.metadata)
    await logToSquadMessages(
      'Marketing Agent',
      `[DRY RUN] Would execute: ${task.title}`,
      task.metadata
    )
    return {
      success: true,
      deliverable_url: '/marketing/dry-run-preview',
    }
  }

  try {
    const supabase = getServerSupabase()
    // Support both metadata.task_type and metadata.action
    const taskType = task.metadata?.task_type || task.metadata?.action

    console.log(`[MARKETING HANDLER] Task type: ${taskType || 'inferred from title'}`)

    let result

    if (taskType === 'send_newsletter') {
      result = await handleNewsletterSend(task)
    } else if (taskType === 'influencer_outreach') {
      result = await handleInfluencerOutreach(task)
    } else {
      // Infer from task title
      const title = task.title.toLowerCase()
      if (title.includes('newsletter')) {
        result = await handleNewsletterSend(task)
      } else if (title.includes('influencer') || title.includes('outreach')) {
        result = await handleInfluencerOutreach(task)
      } else {
        throw new Error(`Unknown marketing task type: ${taskType}. Title: ${task.title}`)
      }
    }

    return result
  } catch (error: any) {
    console.error('[MARKETING HANDLER] Error:', error)

    await logToSquadMessages(
      'Marketing Agent',
      `❌ Failed to execute task: ${error.message}`,
      { task_id: task.id, error: error.message }
    )

    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Handle newsletter sending
 */
async function handleNewsletterSend(task: Task): Promise<ExecutionResult> {
  const draftId = task.metadata?.draft_id

  if (!draftId) {
    throw new Error('Missing draft_id in task metadata')
  }

  console.log('[MARKETING HANDLER] Sending newsletter:', draftId)

  const result = await sendNewsletter(draftId)

  await logToSquadMessages(
    'Marketing Agent',
    `✅ Newsletter sent to ${result.recipients_count} subscribers`,
    {
      draft_id: draftId,
      campaign_id: result.campaign_id,
      recipients_count: result.recipients_count
    }
  )

  return {
    success: true,
    deliverable_url: `/newsletters/${draftId}/stats`
  }
}

/**
 * Handle influencer outreach
 */
async function handleInfluencerOutreach(task: Task): Promise<ExecutionResult> {
  const influencerId = task.metadata?.influencer_id
  const messageTemplate = task.metadata?.message_template

  if (!influencerId || !messageTemplate) {
    throw new Error('Missing influencer_id or message_template in task metadata')
  }

  const supabase = getServerSupabase()

  // Get influencer details
  const { data: influencer, error } = await supabase
    .from('influencer_opportunities')
    .select('*')
    .eq('id', influencerId)
    .single()

  if (error || !influencer) {
    throw new Error(`Influencer not found: ${influencerId}`)
  }

  console.log('[MARKETING HANDLER] Sending outreach to:', influencer.data.name)

  // Send email
  if (!influencer.data.email) {
    throw new Error('No email address for influencer')
  }

  const result = await sendDirectEmail(
    influencer.data.email,
    `Partnership Opportunity with Audico`,
    messageTemplate
  )

  // Update influencer status
  await supabase.from('influencer_opportunities').update({
    status: 'contacted',
    contacted_at: new Date().toISOString()
  }).eq('id', influencerId)

  // Log outreach
  await supabase.from('outreach_tracking').insert({
    influencer_id: influencerId,
    channel: 'email',
    message_sent: messageTemplate,
    status: 'sent',
    sent_at: new Date().toISOString(),
    metadata: { gmail_message_id: result.id }
  })

  await logToSquadMessages(
    'Marketing Agent',
    `✅ Outreach sent to ${influencer.data.name} via email`,
    {
      influencer_id: influencerId,
      influencer_name: influencer.data.name,
      gmail_message_id: result.id
    }
  )

  return {
    success: true,
    deliverable_url: `/influencers/${influencerId}`
  }
}
