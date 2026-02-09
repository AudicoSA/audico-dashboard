import { getServerSupabase } from './supabase'
import type { TimelineInteraction, CustomerProfile } from './supabase'

export async function getCustomerTimeline(
  customerId: string,
  filters?: {
    sources?: ('call' | 'email' | 'chat' | 'social' | 'order')[]
    dateFrom?: string
    dateTo?: string
    limit?: number
  }
): Promise<TimelineInteraction[]> {
  const supabase = getServerSupabase()

  let query = supabase
    .from('customer_timeline_unified')
    .select('*')
    .or(`customer_id.eq.${customerId},customer_email.eq.${customerId},customer_phone.eq.${customerId}`)

  if (filters?.sources && filters.sources.length > 0) {
    query = query.in('source', filters.sources)
  }

  if (filters?.dateFrom) {
    query = query.gte('interaction_date', filters.dateFrom)
  }

  if (filters?.dateTo) {
    query = query.lte('interaction_date', filters.dateTo)
  }

  query = query
    .order('interaction_date', { ascending: false })
    .limit(filters?.limit || 100)

  const { data, error } = await query

  if (error) {
    console.error('Error fetching customer timeline:', error)
    return []
  }

  return data || []
}

export async function getCustomerProfile(customerId: string): Promise<CustomerProfile | null> {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('customer_profiles')
    .select('*')
    .or(`customer_id.eq.${customerId},primary_email.eq.${customerId},primary_phone.eq.${customerId}`)
    .single()

  if (error) {
    console.error('Error fetching customer profile:', error)
    return null
  }

  return data
}

export async function updateCustomerProfile(customerId: string): Promise<void> {
  const supabase = getServerSupabase()

  await supabase.rpc('update_customer_profile_stats', { p_customer_id: customerId })
}

export async function searchCustomers(query: string): Promise<CustomerProfile[]> {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('customer_profiles')
    .select('*')
    .or(`full_name.ilike.%${query}%,primary_email.ilike.%${query}%,primary_phone.ilike.%${query}%,company_name.ilike.%${query}%`)
    .order('last_interaction_date', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error searching customers:', error)
    return []
  }

  return data || []
}

export async function getRecentCustomers(limit = 20): Promise<CustomerProfile[]> {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('customer_profiles')
    .select('*')
    .order('last_interaction_date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recent customers:', error)
    return []
  }

  return data || []
}

export async function getTopCustomersByLTV(limit = 10): Promise<CustomerProfile[]> {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('customer_profiles')
    .select('*')
    .order('lifetime_value', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching top customers:', error)
    return []
  }

  return data || []
}

export async function getCustomersNeedingAttention(): Promise<CustomerProfile[]> {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('customer_profiles')
    .select('*')
    .lte('sentiment_score', 0.3)
    .order('sentiment_score', { ascending: true })
    .limit(20)

  if (error) {
    console.error('Error fetching customers needing attention:', error)
    return []
  }

  return data || []
}

export async function getCallTranscripts(customerId: string, limit = 20) {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('call_transcripts')
    .select('*')
    .or(`customer_email.eq.${customerId},customer_phone.eq.${customerId}`)
    .order('call_start_time', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching call transcripts:', error)
    return []
  }

  return data || []
}

export async function getEmailThreads(customerId: string, limit = 50) {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('email_logs')
    .select('*')
    .eq('from_email', customerId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching email threads:', error)
    return []
  }

  return data || []
}

export async function getSocialInteractions(customerId: string, limit = 50) {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('social_interactions')
    .select('*')
    .or(`customer_email.eq.${customerId},customer_handle.eq.${customerId},customer_id.eq.${customerId}`)
    .order('interaction_date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching social interactions:', error)
    return []
  }

  return data || []
}

export async function getCustomerOrders(customerId: string, limit = 50) {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('opencart_orders_cache')
    .select('*')
    .or(`customer_email.eq.${customerId},customer_phone.eq.${customerId}`)
    .order('order_date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching customer orders:', error)
    return []
  }

  return data || []
}

export async function getQuoteChatSessions(customerId: string, limit = 20) {
  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('customer_interactions')
    .select('*')
    .eq('interaction_type', 'chat')
    .or(`customer_email.eq.${customerId},customer_phone.eq.${customerId}`)
    .order('interaction_date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching quote chat sessions:', error)
    return []
  }

  return data || []
}

export async function calculateCustomerLTV(
  totalSpent: number,
  totalOrders: number,
  firstOrderDate?: string | null
): Promise<number> {
  if (!totalSpent || totalSpent === 0) return 0

  const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : totalSpent

  let customerLifetimeMonths = 12
  if (firstOrderDate) {
    const firstDate = new Date(firstOrderDate)
    const now = new Date()
    const monthsDiff = (now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    customerLifetimeMonths = Math.max(1, monthsDiff)
  }

  const ordersPerMonth = totalOrders > 0 ? totalOrders / customerLifetimeMonths : 0
  const projectedYearlyOrders = ordersPerMonth * 12
  const projectedYearlyValue = projectedYearlyOrders * avgOrderValue

  const ltv = totalSpent + projectedYearlyValue * 2

  return Math.round(ltv)
}

export function formatCurrency(amount: number, currency = 'ZAR'): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function getSentimentColor(sentiment: string | null): string {
  switch (sentiment) {
    case 'positive':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'negative':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'mixed':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}

export function getSentimentEmoji(sentiment: string | null): string {
  switch (sentiment) {
    case 'positive':
      return '😊'
    case 'negative':
      return '😞'
    case 'mixed':
      return '😐'
    default:
      return '🙂'
  }
}

export function getInteractionIcon(source: string): string {
  switch (source) {
    case 'call':
      return '📞'
    case 'email':
      return '📧'
    case 'chat':
      return '💬'
    case 'social':
      return '📱'
    case 'order':
      return '🛒'
    default:
      return '📄'
  }
}

export function calculateSentimentTrend(
  interactions: TimelineInteraction[]
): 'improving' | 'stable' | 'declining' | null {
  if (interactions.length < 3) return null

  const sentimentValues = interactions
    .filter(i => i.sentiment)
    .slice(0, 10)
    .map(i => {
      switch (i.sentiment) {
        case 'positive':
          return 1
        case 'negative':
          return -1
        case 'mixed':
          return 0
        default:
          return 0
      }
    })

  if (sentimentValues.length < 3) return null

  const recent = sentimentValues.slice(0, 3).reduce((a: number, b: number) => a + b, 0) / 3
  const older = sentimentValues.slice(3, 6).reduce((a: number, b: number) => a + b, 0) / 3

  const diff = recent - older

  if (diff > 0.2) return 'improving'
  if (diff < -0.2) return 'declining'
  return 'stable'
}

export function calculateSentimentScore(
  interactions: TimelineInteraction[]
): number {
  if (interactions.length === 0) return 0.5

  const sentimentValues = interactions
    .filter(i => i.sentiment)
    .map(i => {
      switch (i.sentiment) {
        case 'positive':
          return 1.0
        case 'negative':
          return 0.0
        case 'mixed':
          return 0.5
        default:
          return 0.5
      }
    })

  if (sentimentValues.length === 0) return 0.5

  const sum = sentimentValues.reduce((a: number, b: number) => a + b, 0)
  return sum / sentimentValues.length
}

export function groupInteractionsByDate(
  interactions: TimelineInteraction[]
): Record<string, TimelineInteraction[]> {
  const grouped: Record<string, TimelineInteraction[]> = {}

  interactions.forEach(interaction => {
    const date = new Date(interaction.interaction_date).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    if (!grouped[date]) {
      grouped[date] = []
    }

    grouped[date].push(interaction)
  })

  return grouped
}

export function getInteractionStats(interactions: TimelineInteraction[]) {
  const stats = {
    total: interactions.length,
    bySource: {} as Record<string, number>,
    bySentiment: {} as Record<string, number>,
    avgPerDay: 0,
  }

  interactions.forEach(i => {
    stats.bySource[i.source] = (stats.bySource[i.source] || 0) + 1
    if (i.sentiment) {
      stats.bySentiment[i.sentiment] = (stats.bySentiment[i.sentiment] || 0) + 1
    }
  })

  if (interactions.length > 0) {
    const firstDate = new Date(interactions[interactions.length - 1].interaction_date)
    const lastDate = new Date(interactions[0].interaction_date)
    const daysDiff = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
    stats.avgPerDay = Math.round((interactions.length / daysDiff) * 10) / 10
  }

  return stats
}
