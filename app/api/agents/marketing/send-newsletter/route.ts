import { NextRequest, NextResponse } from 'next/server'
import { sendNewsletter, getNewsletterStats } from '@/services/integrations/brevo-service'
import { getServerSupabase } from '@/lib/supabase'
import { logToSquadMessages } from '@/lib/logger'

/**
 * Newsletter Sending Endpoint
 *
 * Handles newsletter distribution via Brevo.
 * Requires approval for all sends.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { draft_id } = await request.json()

    if (!draft_id) {
      return NextResponse.json(
        { error: 'Missing draft_id' },
        { status: 400 }
      )
    }

    const supabase = getServerSupabase()

    // Get draft details
    const { data: draft, error } = await supabase
      .from('newsletter_drafts')
      .select('*')
      .eq('id', draft_id)
      .single()

    if (error || !draft) {
      return NextResponse.json(
        { error: 'Newsletter draft not found' },
        { status: 404 }
      )
    }

    // Check if already sent
    if (draft.status === 'sent') {
      return NextResponse.json(
        { error: 'Newsletter already sent' },
        { status: 400 }
      )
    }

    console.log('[NEWSLETTER SEND] Sending newsletter:', draft_id)

    // Send via Brevo
    const result = await sendNewsletter(draft_id)

    // Mark related task as completed
    const { data: task } = await supabase
      .from('squad_tasks')
      .select('id')
      .eq('metadata->>draft_id', draft_id)
      .single()

    if (task) {
      await supabase.from('squad_tasks').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        deliverable_url: `/newsletters/${draft_id}/stats`
      }).eq('id', task.id)
    }

    await logToSquadMessages(
      'Marketing Agent',
      `✅ Newsletter sent to ${result.recipients_count} subscribers`,
      {
        draft_id,
        campaign_id: result.campaign_id,
        recipients_count: result.recipients_count
      }
    )

    return NextResponse.json({
      success: true,
      campaign_id: result.campaign_id,
      recipients_count: result.recipients_count,
      draft_id
    })
  } catch (error: any) {
    console.error('[NEWSLETTER SEND] Error:', error)

    await logToSquadMessages(
      'Marketing Agent',
      `❌ Failed to send newsletter: ${error.message}`,
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
    endpoint: '/api/agents/marketing/send-newsletter',
    method: 'POST',
    required_fields: ['draft_id'],
    description: 'Send newsletter via Brevo'
  })
}
