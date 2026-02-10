import { NextRequest, NextResponse } from 'next/server'
import { sendDirectEmail } from '@/services/integrations/gmail-sender'
import { getServerSupabase } from '@/lib/supabase'
import { logToSquadMessages } from '@/lib/logger'

/**
 * Influencer Outreach Endpoint
 *
 * Sends personalized outreach messages to influencers.
 * Currently supports email only (future: Twitter DM, Instagram DM, LinkedIn)
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { influencer_id, message_template } = await request.json()

    if (!influencer_id || !message_template) {
      return NextResponse.json(
        { error: 'Missing influencer_id or message_template' },
        { status: 400 }
      )
    }

    const supabase = getServerSupabase()

    // Get influencer details
    const { data: influencer, error } = await supabase
      .from('influencer_opportunities')
      .select('*')
      .eq('id', influencer_id)
      .single()

    if (error || !influencer) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      )
    }

    // Check if already contacted
    if (influencer.status === 'contacted' || influencer.status === 'replied') {
      return NextResponse.json(
        { error: `Influencer already ${influencer.status}` },
        { status: 400 }
      )
    }

    console.log('[INFLUENCER OUTREACH] Sending to:', influencer.data.name)

    let result
    const channel = influencer.data.preferred_contact || 'email'

    // Send via appropriate channel
    switch (channel) {
      case 'email':
        if (!influencer.data.email) {
          throw new Error('No email address for influencer')
        }

        result = await sendDirectEmail(
          influencer.data.email,
          `Partnership Opportunity with Audico`,
          message_template
        )
        break

      case 'twitter':
        // TODO Phase 5: Twitter DM integration
        throw new Error('Twitter DM not yet supported')

      case 'instagram':
        // TODO Phase 5: Instagram DM integration
        throw new Error('Instagram DM not yet supported')

      case 'linkedin':
        // TODO Phase 5: LinkedIn messaging integration
        throw new Error('LinkedIn messaging not yet supported')

      default:
        throw new Error(`Unsupported contact channel: ${channel}`)
    }

    // Update influencer status
    await supabase.from('influencer_opportunities').update({
      status: 'contacted',
      contacted_at: new Date().toISOString()
    }).eq('id', influencer_id)

    // Log in outreach_tracking table
    await supabase.from('outreach_tracking').insert({
      influencer_id,
      channel,
      message_sent: message_template,
      status: 'sent',
      sent_at: new Date().toISOString(),
      metadata: {
        gmail_message_id: result?.id
      }
    })

    // Mark related task as completed
    const { data: task } = await supabase
      .from('squad_tasks')
      .select('id')
      .eq('metadata->>influencer_id', influencer_id)
      .single()

    if (task) {
      await supabase.from('squad_tasks').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        deliverable_url: `/influencers/${influencer_id}`
      }).eq('id', task.id)
    }

    await logToSquadMessages(
      'Marketing Agent',
      `✅ Outreach sent to ${influencer.data.name} via ${channel}`,
      {
        influencer_id,
        channel,
        influencer_name: influencer.data.name
      }
    )

    return NextResponse.json({
      success: true,
      influencer_id,
      channel,
      message_id: result?.id
    })
  } catch (error: any) {
    console.error('[INFLUENCER OUTREACH] Error:', error)

    await logToSquadMessages(
      'Marketing Agent',
      `❌ Failed to send outreach: ${error.message}`,
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
    endpoint: '/api/agents/marketing/outreach',
    method: 'POST',
    required_fields: ['influencer_id', 'message_template'],
    supported_channels: ['email']  // Future: twitter, instagram, linkedin
  })
}
