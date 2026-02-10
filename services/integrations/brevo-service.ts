/**
 * Brevo Newsletter Service
 *
 * Handles newsletter distribution via Brevo.com (formerly Sendinblue)
 * - Send newsletters to subscriber lists
 * - Track campaign statistics
 * - Manage subscriber lists
 */

import { getServerSupabase } from '@/lib/supabase'

interface NewsletterResult {
  campaign_id: string
  recipients_count: number
  sent_at: string
}

interface CampaignStats {
  sent: number
  delivered: number
  opened: number
  clicked: number
  unsubscribed: number
  bounced: number
  open_rate: number
  click_rate: number
}

/**
 * Get Brevo API client
 */
function getBrevoHeaders() {
  if (!process.env.BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY not configured')
  }

  return {
    'api-key': process.env.BREVO_API_KEY,
    'Content-Type': 'application/json'
  }
}

/**
 * Fetch newsletter draft from database
 */
async function fetchNewsletterDraft(draftId: string) {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('newsletter_drafts')
    .select('*')
    .eq('id', draftId)
    .single()

  if (error || !data) {
    throw new Error(`Newsletter draft not found: ${draftId}`)
  }

  return data
}

/**
 * Send newsletter to subscriber list via Brevo
 */
export async function sendNewsletter(draftId: string): Promise<NewsletterResult> {
  console.log('[BREVO SERVICE] Sending newsletter:', draftId)

  try {
    const draft = await fetchNewsletterDraft(draftId)

    // Brevo Email Campaigns API
    const response = await fetch('https://api.brevo.com/v3/emailCampaigns', {
      method: 'POST',
      headers: getBrevoHeaders(),
      body: JSON.stringify({
        name: draft.data.subject_line,
        subject: draft.data.subject_line,
        sender: {
          name: 'Audico Team',
          email: 'newsletter@audico.co.za'
        },
        htmlContent: draft.data.content,
        recipients: {
          listIds: [parseInt(process.env.BREVO_LIST_ID || '1')]  // Default subscriber list
        },
        inlineImageActivation: true,
        mirrorActive: true,
        footer: `
          <p style="text-align: center; color: #666; font-size: 12px;">
            You're receiving this because you subscribed to Audico updates.
            <a href="{{unsubscribe}}">Unsubscribe</a>
          </p>
        `
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Brevo API error: ${JSON.stringify(error)}`)
    }

    const data = await response.json()

    // Send the campaign immediately
    const sendResponse = await fetch(`https://api.brevo.com/v3/emailCampaigns/${data.id}/sendNow`, {
      method: 'POST',
      headers: getBrevoHeaders()
    })

    if (!sendResponse.ok) {
      const error = await sendResponse.json()
      throw new Error(`Brevo send error: ${JSON.stringify(error)}`)
    }

    // Get campaign stats for recipient count
    const statsResponse = await fetch(`https://api.brevo.com/v3/emailCampaigns/${data.id}`, {
      headers: getBrevoHeaders()
    })

    const statsData = await statsResponse.json()
    const recipientsCount = statsData.statistics?.globalStats?.sent || 0

    // Update newsletter_drafts status
    const supabase = getServerSupabase()
    await supabase.from('newsletter_drafts').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      metadata: {
        ...draft.metadata,
        brevo_campaign_id: data.id,
        recipients_count: recipientsCount
      }
    }).eq('id', draftId)

    console.log('[BREVO SERVICE] Newsletter sent:', data.id)

    return {
      campaign_id: data.id,
      recipients_count: recipientsCount,
      sent_at: new Date().toISOString()
    }
  } catch (error: any) {
    console.error('[BREVO SERVICE] Error:', error)
    throw new Error(`Failed to send newsletter: ${error.message}`)
  }
}

/**
 * Get newsletter campaign statistics
 */
export async function getNewsletterStats(campaignId: string): Promise<CampaignStats> {
  console.log('[BREVO SERVICE] Fetching campaign stats:', campaignId)

  try {
    const response = await fetch(
      `https://api.brevo.com/v3/emailCampaigns/${campaignId}`,
      { headers: getBrevoHeaders() }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Brevo API error: ${JSON.stringify(error)}`)
    }

    const data = await response.json()
    const stats = data.statistics?.globalStats || {}

    return {
      sent: stats.sent || 0,
      delivered: stats.delivered || 0,
      opened: stats.uniqueOpens || 0,
      clicked: stats.uniqueClicks || 0,
      unsubscribed: stats.unsubscriptions || 0,
      bounced: stats.hardBounces + stats.softBounces || 0,
      open_rate: stats.sent > 0 ? (stats.uniqueOpens / stats.sent) * 100 : 0,
      click_rate: stats.sent > 0 ? (stats.uniqueClicks / stats.sent) * 100 : 0
    }
  } catch (error: any) {
    console.error('[BREVO SERVICE] Error fetching stats:', error)
    throw new Error(`Failed to fetch stats: ${error.message}`)
  }
}

/**
 * Test Brevo connection and API key
 */
export async function testBrevoConnection(): Promise<boolean> {
  console.log('[BREVO SERVICE] Testing connection...')

  try {
    const response = await fetch('https://api.brevo.com/v3/account', {
      headers: getBrevoHeaders()
    })

    if (!response.ok) {
      throw new Error('Invalid API key or connection failed')
    }

    const data = await response.json()
    console.log('[BREVO SERVICE] Connection successful. Account:', data.email)
    return true
  } catch (error: any) {
    console.error('[BREVO SERVICE] Connection test failed:', error)
    return false
  }
}
