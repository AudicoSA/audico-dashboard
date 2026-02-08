import { createClient } from '@supabase/supabase-js'
import type { QuoteChatSession, QuoteChatMessage, QuoteRequest, CustomerInteraction } from './supabase'

const quoteChatSupabaseUrl = process.env.AUDICO_CHAT_QUOTE_SUPABASE_URL!
const quoteChatSupabaseKey = process.env.AUDICO_CHAT_QUOTE_SUPABASE_KEY!

export function getQuoteChatSupabase() {
  if (!quoteChatSupabaseUrl || !quoteChatSupabaseKey) {
    throw new Error('Quote chat Supabase credentials not configured')
  }
  
  return createClient(quoteChatSupabaseUrl, quoteChatSupabaseKey)
}

export async function getActiveQuoteSessions(limit = 50): Promise<QuoteChatSession[]> {
  const supabase = getQuoteChatSupabase()
  
  const { data, error } = await supabase
    .from('quote_sessions')
    .select('*')
    .in('status', ['active', 'pending_quote'])
    .order('last_activity_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching active quote sessions:', error)
    return []
  }

  return data || []
}

export async function getQuoteSessionById(sessionId: string): Promise<QuoteChatSession | null> {
  const supabase = getQuoteChatSupabase()
  
  const { data, error } = await supabase
    .from('quote_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single()

  if (error) {
    console.error('Error fetching quote session:', error)
    return null
  }

  return data
}

export async function getQuoteSessionMessages(sessionId: string): Promise<QuoteChatMessage[]> {
  const supabase = getQuoteChatSupabase()
  
  const { data, error } = await supabase
    .from('quote_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching quote session messages:', error)
    return []
  }

  return data || []
}

export async function updateQuoteSessionStatus(
  sessionId: string,
  status: QuoteChatSession['status'],
  metadata?: Record<string, any>
): Promise<QuoteChatSession | null> {
  const supabase = getQuoteChatSupabase()
  
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (metadata) {
    updateData.metadata = metadata
  }

  const { data, error } = await supabase
    .from('quote_sessions')
    .update(updateData)
    .eq('session_id', sessionId)
    .select()
    .single()

  if (error) {
    console.error('Error updating quote session status:', error)
    return null
  }

  return data
}

export async function createQuoteSessionMessage(
  sessionId: string,
  senderType: 'customer' | 'agent' | 'system',
  message: string,
  senderName?: string,
  attachments: string[] = [],
  metadata: Record<string, any> = {}
): Promise<QuoteChatMessage | null> {
  const supabase = getQuoteChatSupabase()
  
  const { data, error } = await supabase
    .from('quote_messages')
    .insert({
      session_id: sessionId,
      sender_type: senderType,
      sender_name: senderName || null,
      message,
      attachments,
      metadata,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating quote message:', error)
    return null
  }

  await supabase
    .from('quote_sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('session_id', sessionId)

  return data
}

export async function searchQuoteSessionsByCustomer(
  email?: string,
  phone?: string,
  name?: string,
  limit = 20
): Promise<QuoteChatSession[]> {
  const supabase = getQuoteChatSupabase()
  
  let query = supabase.from('quote_sessions').select('*')

  if (email) {
    query = query.eq('customer_email', email)
  } else if (phone) {
    query = query.eq('customer_phone', phone)
  } else if (name) {
    query = query.ilike('customer_name', `%${name}%`)
  } else {
    return []
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error searching quote sessions:', error)
    return []
  }

  return data || []
}

export async function getQuoteSessionStats(sessionId: string): Promise<{
  total_messages: number
  customer_messages: number
  agent_messages: number
  avg_response_time_seconds: number | null
  duration_minutes: number
} | null> {
  const supabase = getQuoteChatSupabase()
  
  const session = await getQuoteSessionById(sessionId)
  if (!session) return null

  const messages = await getQuoteSessionMessages(sessionId)
  
  const stats = {
    total_messages: messages.length,
    customer_messages: messages.filter(m => m.sender_type === 'customer').length,
    agent_messages: messages.filter(m => m.sender_type === 'agent').length,
    avg_response_time_seconds: null as number | null,
    duration_minutes: 0,
  }

  const createdAt = new Date(session.created_at).getTime()
  const lastActivityAt = new Date(session.last_activity_at).getTime()
  stats.duration_minutes = Math.round((lastActivityAt - createdAt) / 1000 / 60)

  return stats
}

export function generateQuoteNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  
  return `Q-${year}${month}${day}-${random}`
}

export async function linkEmailToQuoteSession(
  emailId: string,
  sessionId: string,
  emailSender: string
): Promise<boolean> {
  const supabase = getQuoteChatSupabase()
  
  const session = await getQuoteSessionById(sessionId)
  if (!session) return false

  const metadata = session.metadata || {}
  metadata.linked_emails = metadata.linked_emails || []
  
  if (!metadata.linked_emails.includes(emailId)) {
    metadata.linked_emails.push(emailId)
    metadata.last_email_sender = emailSender
    metadata.last_email_linked_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('quote_sessions')
    .update({
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)

  if (error) {
    console.error('Error linking email to quote session:', error)
    return false
  }

  return true
}

export function extractQuoteRequestFromEmail(
  subject: string,
  body: string,
  sender: string
): {
  isQuoteRequest: boolean
  items: string[]
  notes: string
} {
  const quoteKeywords = [
    'quote', 'quotation', 'price', 'pricing', 'cost', 'estimate',
    'how much', 'what would it cost', 'can you provide', 'need a quote'
  ]

  const lowerSubject = subject.toLowerCase()
  const lowerBody = body.toLowerCase()
  const combined = lowerSubject + ' ' + lowerBody

  const isQuoteRequest = quoteKeywords.some(keyword => combined.includes(keyword))

  const items: string[] = []
  const lines = body.split('\n')
  
  lines.forEach(line => {
    const trimmed = line.trim()
    if (trimmed.length > 10 && trimmed.length < 200) {
      const hasQuantity = /\d+\s*(x|pcs|pieces|units|qty)/i.test(trimmed)
      const hasProduct = /product|item|part|model|sku/i.test(trimmed)
      
      if (hasQuantity || hasProduct) {
        items.push(trimmed)
      }
    }
  })

  return {
    isQuoteRequest,
    items,
    notes: isQuoteRequest ? body : '',
  }
}
