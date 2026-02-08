import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Debug logging
if (typeof window !== 'undefined') {
  console.log('🔧 Supabase Config:', {
    url: supabaseUrl,
    hasKey: !!supabaseAnonKey,
    keyPrefix: supabaseAnonKey?.substring(0, 20) + '...'
  })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type EmailLog = {
  id: string
  gmail_message_id: string
  from_email: string
  subject: string
  category: string
  status: string
  handled_by: string | null
  payload: any
  created_at: string
  updated_at: string
}

export interface Supplier {
  id: string
  name: string
  company: string
  street_address: string
  local_area: string
  city: string
  code: string
  country_code: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  created_at?: string
}

export interface OrderTracker {
  order_no: string
  order_name: string | null
  supplier: string | null
  notes: string | null
  cost: number | null
  invoice_no: string | null
  order_paid: boolean | null
  supplier_amount: number | null
  supplier_invoice_no: string | null
  supplier_quote_no: string | null
  supplier_status: string | null
  supplier_invoice_url: string | null
  shipping: number | null
  profit: number | null
  updates: string | null
  owner_wade: boolean | null
  owner_lucky: boolean | null
  owner_kenny: boolean | null
  owner_accounts: boolean | null
  flag_done: boolean | null
  flag_urgent: boolean | null
  source: string | null
}

export type AgentLog = {
  id: string
  created_at: string
  agent: string
  level: string
  event_type: string
  context: any
}

export type EmailClassification = {
  id: string
  email_id: string
  sender: string
  subject: string
  body: string | null
  classification: 'order' | 'support' | 'inquiry' | 'complaint' | 'spam' | 'other'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigned_agent: string | null
  status: 'unread' | 'read' | 'replied' | 'archived'
  metadata: any
  created_at: string
  updated_at: string
}

export type SocialPost = {
  id: string
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube'
  content: string
  media_urls: string[]
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  scheduled_for: string | null
  published_at: string | null
  post_url: string | null
  engagement: {
    likes: number
    comments: number
    shares: number
  }
  created_by: string | null
  metadata: any
  created_at: string
  updated_at: string
}

export type AdCampaign = {
  id: string
  name: string
  platform: 'google_ads' | 'facebook_ads' | 'instagram_ads' | 'linkedin_ads' | 'tiktok_ads'
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
  budget_total: number | null
  budget_spent: number
  currency: string
  start_date: string | null
  end_date: string | null
  target_audience: any
  ad_content: any
  performance_metrics: {
    impressions: number
    clicks: number
    conversions: number
    ctr: number
    cpc: number
    roas: number
  }
  managed_by: string | null
  metadata: any
  created_at: string
  updated_at: string
}

export type SeoAudit = {
  id: string
  url: string
  audit_type: 'full_site' | 'page' | 'technical' | 'content' | 'backlinks'
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  score: number | null
  issues_found: any[]
  recommendations: any[]
  metrics: any
  performed_by: string | null
  completed_at: string | null
  metadata: any
  created_at: string
  updated_at: string
}

export type ResellerApplication = {
  id: string
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  business_type: string | null
  website: string | null
  annual_revenue: string | null
  target_market: string | null
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'on_hold'
  reviewed_by: string | null
  reviewed_at: string | null
  approval_notes: string | null
  business_details: any
  documents: any[]
  metadata: any
  created_at: string
  updated_at: string
}

export type SquadMessage = {
  id: string
  from_agent: string
  to_agent: string | null
  message: string
  task_id: string | null
  data: any
  created_at: string
}

export type CallTranscript = {
  id: string
  call_id: string
  customer_phone: string
  customer_name: string | null
  customer_email: string | null
  call_duration: number | null
  call_start_time: string
  call_end_time: string | null
  transcript: string
  summary: string | null
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null
  call_outcome: 'resolved' | 'follow_up_needed' | 'escalation' | 'inquiry' | 'order' | 'complaint' | 'other' | null
  customer_intent: string | null
  key_topics: string[]
  metadata: any
  created_at: string
  updated_at: string
}

export type CustomerInteraction = {
  id: string
  customer_id: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  interaction_type: 'call' | 'email' | 'chat' | 'social' | 'order' | 'support_ticket' | 'other'
  interaction_source: string
  interaction_date: string
  subject: string | null
  summary: string | null
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null
  outcome: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'in_progress' | 'completed' | 'follow_up_required'
  assigned_agent: string | null
  reference_id: string | null
  reference_type: string | null
  details: any
  created_at: string
  updated_at: string
}

export type AgentConfig = {
  id: string
  name: string
  enabled: boolean
  schedule: {
    enabled: boolean
    intervals: string[]
    timezone: string
  }
  token_budget: {
    daily_limit: number
    per_request_max: number
    current_usage: number
  }
  behavior_settings: {
    auto_approve: boolean
    require_review: boolean
    max_retries: number
    timeout_seconds: number
  }
  created_at: string
  updated_at: string
}

export type APICredential = {
  id: string
  service: string
  key_name: string
  key_value: string
  expires_at: string | null
  created_at: string
  updated_at: string
}

export type NotificationPreference = {
  id: string
  event_type: string
  enabled: boolean
  channels: string[]
  kenny_mentions_only: boolean
  created_at: string
  updated_at: string
}
