import { getServerSupabase } from './supabase'
import type { EmailLog } from './supabase'

export async function syncEmailToTimeline(emailLog: EmailLog): Promise<void> {
  const supabase = getServerSupabase()

  const emailBody = emailLog.payload?.body || ''
  const sentiment = emailLog.payload?.sentiment || null
  const classification = emailLog.category || 'unclassified'

  const priority =
    emailLog.payload?.mentions_kenny
      ? 'urgent'
      : classification === 'complaint'
      ? 'high'
      : classification === 'inquiry'
      ? 'medium'
      : 'low'

  const status =
    emailLog.status === 'sent'
      ? 'completed'
      : emailLog.status === 'draft_created'
      ? 'in_progress'
      : 'pending'

  const { error } = await supabase.from('customer_interactions').upsert(
    {
      customer_id: emailLog.from_email,
      customer_name: emailLog.payload?.from_name || null,
      customer_email: emailLog.from_email,
      customer_phone: emailLog.payload?.phone || null,
      interaction_type: 'email',
      interaction_source: 'gmail',
      interaction_date: emailLog.created_at,
      subject: emailLog.subject,
      summary: emailBody.substring(0, 500),
      sentiment,
      outcome: emailLog.status,
      priority,
      status,
      assigned_agent: emailLog.handled_by,
      reference_id: emailLog.id,
      reference_type: 'email_log',
      details: {
        gmail_message_id: emailLog.gmail_message_id,
        category: emailLog.category,
        mentions_kenny: emailLog.payload?.mentions_kenny || false,
      },
    },
    { onConflict: 'reference_id,reference_type' }
  )

  if (error) {
    console.error('Error syncing email to timeline:', error)
  } else {
    await supabase.rpc('update_customer_profile_stats', {
      p_customer_id: emailLog.from_email,
    })
  }
}

export async function syncQuoteChatToTimeline(
  sessionId: string,
  sessionData: any
): Promise<void> {
  const supabase = getServerSupabase()

  const customerId =
    sessionData.customer_email || sessionData.customer_phone || sessionId

  const { error } = await supabase.from('customer_interactions').upsert(
    {
      customer_id: customerId,
      customer_name: sessionData.customer_name || null,
      customer_email: sessionData.customer_email || null,
      customer_phone: sessionData.customer_phone || null,
      interaction_type: 'chat',
      interaction_source: 'audico-quote-chat',
      interaction_date: sessionData.last_activity_at || sessionData.created_at,
      subject: sessionData.company_name
        ? `Quote request - ${sessionData.company_name}`
        : 'Quote request',
      summary: `Quote chat session with ${sessionData.messages?.length || 0} messages`,
      sentiment: null,
      outcome: sessionData.status,
      priority:
        sessionData.status === 'pending_quote' ? 'high' : 'medium',
      status:
        sessionData.status === 'completed'
          ? 'completed'
          : sessionData.status === 'abandoned'
          ? 'completed'
          : 'pending',
      assigned_agent: 'Naledi',
      reference_id: sessionId,
      reference_type: 'quote_chat_session',
      details: {
        session_id: sessionId,
        total_amount: sessionData.total_amount,
        currency: sessionData.currency,
        quote_items: sessionData.quote_items,
        messages_count: sessionData.messages?.length || 0,
      },
    },
    { onConflict: 'reference_id,reference_type' }
  )

  if (error) {
    console.error('Error syncing quote chat to timeline:', error)
  } else if (sessionData.customer_email) {
    await supabase.rpc('update_customer_profile_stats', {
      p_customer_id: sessionData.customer_email,
    })
  }
}

export async function ensureCustomerProfile(
  customerId: string,
  data: {
    email?: string
    phone?: string
    name?: string
    company?: string
  }
): Promise<void> {
  const supabase = getServerSupabase()

  const { data: existing } = await supabase
    .from('customer_profiles')
    .select('id')
    .eq('customer_id', customerId)
    .single()

  if (!existing) {
    await supabase.from('customer_profiles').insert({
      customer_id: customerId,
      primary_email: data.email || null,
      primary_phone: data.phone || null,
      full_name: data.name || null,
      company_name: data.company || null,
      contact_emails: data.email ? [data.email] : [],
      contact_phones: data.phone ? [data.phone] : [],
    })
  }

  await supabase.rpc('update_customer_profile_stats', {
    p_customer_id: customerId,
  })
}
