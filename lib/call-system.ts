import { supabase } from './supabase'
import type { CallTranscript, CustomerInteraction } from './supabase'

export async function getCallTranscriptByCallId(callId: string): Promise<CallTranscript | null> {
  const { data, error } = await supabase
    .from('call_transcripts')
    .select('*')
    .eq('call_id', callId)
    .single()

  if (error) {
    console.error('Error fetching call transcript:', error)
    return null
  }

  return data
}

export async function getCallTranscriptsByCustomer(
  customerPhone?: string,
  customerEmail?: string,
  limit = 50
): Promise<CallTranscript[]> {
  let query = supabase.from('call_transcripts').select('*')

  if (customerPhone) {
    query = query.eq('customer_phone', customerPhone)
  } else if (customerEmail) {
    query = query.eq('customer_email', customerEmail)
  }

  const { data, error } = await query
    .order('call_start_time', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching call transcripts:', error)
    return []
  }

  return data || []
}

export async function getCustomerTimeline(
  customerId?: string,
  customerEmail?: string,
  customerPhone?: string,
  limit = 100
): Promise<CustomerInteraction[]> {
  let query = supabase.from('customer_interactions').select('*')

  if (customerId) {
    query = query.eq('customer_id', customerId)
  } else if (customerEmail) {
    query = query.eq('customer_email', customerEmail)
  } else if (customerPhone) {
    query = query.eq('customer_phone', customerPhone)
  } else {
    return []
  }

  const { data, error } = await query
    .order('interaction_date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching customer timeline:', error)
    return []
  }

  return data || []
}

export async function getCustomerTimelineByType(
  customerId: string,
  interactionType: CustomerInteraction['interaction_type'],
  limit = 50
): Promise<CustomerInteraction[]> {
  const { data, error } = await supabase
    .from('customer_interactions')
    .select('*')
    .eq('customer_id', customerId)
    .eq('interaction_type', interactionType)
    .order('interaction_date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching customer timeline by type:', error)
    return []
  }

  return data || []
}

export async function getRecentCallsByOutcome(
  outcome: CallTranscript['call_outcome'],
  limit = 20
): Promise<CallTranscript[]> {
  const { data, error } = await supabase
    .from('call_transcripts')
    .select('*')
    .eq('call_outcome', outcome)
    .order('call_start_time', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching calls by outcome:', error)
    return []
  }

  return data || []
}

export async function getRecentCallsBySentiment(
  sentiment: CallTranscript['sentiment'],
  limit = 20
): Promise<CallTranscript[]> {
  const { data, error } = await supabase
    .from('call_transcripts')
    .select('*')
    .eq('sentiment', sentiment)
    .order('call_start_time', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching calls by sentiment:', error)
    return []
  }

  return data || []
}

export async function getCustomerInteractionStats(customerId: string): Promise<{
  total_interactions: number
  by_type: Record<string, number>
  by_sentiment: Record<string, number>
  by_status: Record<string, number>
} | null> {
  const interactions = await getCustomerTimeline(customerId)

  if (interactions.length === 0) {
    return null
  }

  const stats = {
    total_interactions: interactions.length,
    by_type: {} as Record<string, number>,
    by_sentiment: {} as Record<string, number>,
    by_status: {} as Record<string, number>,
  }

  interactions.forEach((interaction) => {
    stats.by_type[interaction.interaction_type] = 
      (stats.by_type[interaction.interaction_type] || 0) + 1
    
    if (interaction.sentiment) {
      stats.by_sentiment[interaction.sentiment] = 
        (stats.by_sentiment[interaction.sentiment] || 0) + 1
    }
    
    stats.by_status[interaction.status] = 
      (stats.by_status[interaction.status] || 0) + 1
  })

  return stats
}

export async function searchCallsByKeywords(
  keywords: string[],
  limit = 50
): Promise<CallTranscript[]> {
  const { data, error } = await supabase
    .from('call_transcripts')
    .select('*')
    .contains('key_topics', keywords)
    .order('call_start_time', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error searching calls by keywords:', error)
    return []
  }

  return data || []
}
