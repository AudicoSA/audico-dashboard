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

// Server-side Supabase client with service role key
export function getServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

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

export type ApprovedReseller = {
  id: string
  application_id: string | null
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  website: string | null
  commission_rate: number
  discount_tier: 'standard' | 'premium' | 'platinum'
  total_orders: number
  total_revenue: number
  last_order_date: string | null
  status: 'active' | 'inactive' | 'suspended'
  notes: string | null
  metadata: any
  created_at: string
  updated_at: string
}

export type ResellerOrder = {
  id: string
  reseller_id: string
  order_reference: string
  order_date: string
  total_amount: number
  commission_amount: number
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  items: any[]
  notes: string | null
  metadata: any
  created_at: string
  updated_at: string
}

export type NewsletterDraft = {
  id: string
  title: string
  subject_line: string
  preview_text: string | null
  content: string
  html_content: string | null
  status: 'draft' | 'review' | 'scheduled' | 'sent'
  scheduled_for: string | null
  sent_at: string | null
  recipient_count: number
  open_rate: number | null
  click_rate: number | null
  ai_suggestions: any[]
  created_by: string | null
  metadata: any
  created_at: string
  updated_at: string
}

export type InfluencerOpportunity = {
  id: string
  name: string
  platform: 'instagram' | 'youtube' | 'tiktok' | 'twitter' | 'linkedin' | 'facebook'
  handle: string
  follower_count: number | null
  engagement_rate: number | null
  niche: string | null
  status: 'identified' | 'contacted' | 'negotiating' | 'agreed' | 'active' | 'completed' | 'declined'
  outreach_date: string | null
  response_date: string | null
  campaign_start: string | null
  campaign_end: string | null
  budget_allocated: number | null
  budget_spent: number
  deliverables: any[]
  performance_metrics: {
    reach: number
    impressions: number
    clicks: number
    conversions: number
  }
  notes: string | null
  managed_by: string | null
  metadata: any
  created_at: string
  updated_at: string
}

export type AgentLogEntry = {
  id: string
  agent_name: string
  log_level: 'info' | 'warning' | 'error' | 'critical'
  event_type: string
  message: string
  error_details: any
  context: any
  created_at: string
}

export type SquadAgent = {
  id: string
  name: string
  role: string
  status: 'active' | 'idle' | 'offline'
  last_active: string
  created_at: string
}

export type QuoteChatSession = {
  id: string
  session_id: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  company_name: string | null
  status: 'active' | 'pending_quote' | 'quote_sent' | 'completed' | 'abandoned'
  messages: any[]
  quote_items: any[]
  total_amount: number | null
  currency: string
  metadata: any
  created_at: string
  updated_at: string
  last_activity_at: string
}

export type QuoteChatMessage = {
  id: string
  session_id: string
  sender_type: 'customer' | 'agent' | 'system'
  sender_name: string | null
  message: string
  attachments: string[]
  metadata: any
  created_at: string
}

export type QuoteRequest = {
  id: string
  session_id: string | null
  email_id: string | null
  customer_name: string
  customer_email: string
  customer_phone: string | null
  company_name: string | null
  items: any[]
  notes: string | null
  status: 'pending' | 'processing' | 'sent' | 'accepted' | 'rejected'
  quote_number: string | null
  quote_amount: number | null
  quote_pdf_url: string | null
  valid_until: string | null
  generated_by: string | null
  metadata: any
  created_at: string
  updated_at: string
}

export type SocialInteraction = {
  id: string
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube'
  interaction_type: 'mention' | 'dm' | 'comment' | 'reply' | 'share' | 'reaction'
  customer_name: string | null
  customer_email: string | null
  customer_handle: string | null
  customer_id: string | null
  content: string
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null
  post_url: string | null
  requires_response: boolean
  response_status: 'pending' | 'responded' | 'ignored'
  responded_at: string | null
  responded_by: string | null
  metadata: any
  interaction_date: string
  created_at: string
  updated_at: string
}

export type OpenCartOrder = {
  id: string
  order_id: number
  customer_id: number
  customer_name: string
  customer_email: string
  customer_phone: string | null
  order_status: string
  order_total: number
  currency: string
  payment_method: string | null
  shipping_method: string | null
  items: any[]
  shipping_address: any
  order_date: string
  last_updated: string
  metadata: any
  created_at: string
}

export type CustomerProfile = {
  id: string
  customer_id: string
  primary_email: string | null
  primary_phone: string | null
  full_name: string | null
  company_name: string | null
  contact_emails: string[]
  contact_phones: string[]
  social_handles: any
  total_orders: number
  total_spent: number
  average_order_value: number
  lifetime_value: number
  first_interaction_date: string | null
  last_interaction_date: string | null
  last_order_date: string | null
  customer_status: 'active' | 'inactive' | 'vip' | 'blocked'
  sentiment_score: number
  sentiment_trend: 'improving' | 'stable' | 'declining' | null
  interaction_count: number
  tags: string[]
  notes: string | null
  metadata: any
  created_at: string
  updated_at: string
}

export type TimelineInteraction = {
  source: 'call' | 'email' | 'chat' | 'social' | 'order'
  id: string
  customer_id: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  interaction_date: string
  interaction_type: string
  subject: string | null
  summary: string | null
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null
  outcome: string | null
  metadata: any
  created_at: string
}

// Customer Portal Types
export type PortalUser = {
  id: string
  auth_user_id: string | null
  customer_profile_id: string | null
  email: string
  full_name: string | null
  company_name: string | null
  phone: string | null
  email_verified: boolean
  phone_verified: boolean
  status: 'active' | 'suspended' | 'deleted'
  last_login_at: string | null
  preferences: any
  metadata: any
  created_at: string
  updated_at: string
}

export type SupportTicket = {
  id: string
  ticket_number: string
  portal_user_id: string
  customer_email: string
  customer_name: string | null
  subject: string
  description: string
  category: 'technical' | 'billing' | 'product' | 'shipping' | 'general' | 'other' | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'waiting_customer' | 'waiting_internal' | 'resolved' | 'closed'
  assigned_agent: string | null
  resolution: string | null
  ai_generated_status: string | null
  ai_generated_at: string | null
  first_response_at: string | null
  resolved_at: string | null
  closed_at: string | null
  tags: string[]
  metadata: any
  created_at: string
  updated_at: string
}

export type TicketMessage = {
  id: string
  ticket_id: string
  sender_type: 'customer' | 'agent' | 'system'
  sender_id: string | null
  sender_name: string
  message: string
  is_internal: boolean
  attachments: any[]
  metadata: any
  created_at: string
}

export type TicketAttachment = {
  id: string
  ticket_id: string
  message_id: string | null
  uploaded_by: string
  file_name: string
  file_size: number
  file_type: string
  file_url: string
  storage_path: string
  scan_status: 'pending' | 'clean' | 'infected' | 'failed'
  scanned_at: string | null
  metadata: any
  created_at: string
}

export type ScheduledCall = {
  id: string
  portal_user_id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  scheduled_for: string
  duration_minutes: number
  purpose: string | null
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  call_transcript_id: string | null
  assigned_agent: string | null
  notes: string | null
  reminder_sent: boolean
  metadata: any
  created_at: string
  updated_at: string
}

export type PortalAuditLog = {
  id: string
  portal_user_id: string | null
  action_type: string
  resource_type: string | null
  resource_id: string | null
  ip_address: string | null
  user_agent: string | null
  action_details: any
  data_accessed: string[]
  purpose: string | null
  success: boolean
  error_message: string | null
  created_at: string
}

export type ChatbotSession = {
  id: string
  session_id: string
  portal_user_id: string | null
  customer_email: string | null
  status: 'active' | 'resolved' | 'escalated' | 'abandoned'
  escalated_to_ticket_id: string | null
  context: any
  metadata: any
  created_at: string
  updated_at: string
  last_activity_at: string
}

export type ChatbotMessage = {
  id: string
  session_id: string
  sender_type: 'customer' | 'bot' | 'system'
  message: string
  intent: string | null
  confidence: number | null
  sources: string[]
  metadata: any
  created_at: string
}

export type KnowledgeBase = {
  id: string
  category: 'product' | 'faq' | 'policy' | 'troubleshooting' | 'other'
  title: string
  content: string
  keywords: string[]
  source_type: string | null
  source_id: string | null
  status: 'active' | 'draft' | 'archived'
  view_count: number
  helpful_count: number
  unhelpful_count: number
  last_updated_by: string | null
  metadata: any
  created_at: string
  updated_at: string
}

export type DataAccessRequest = {
  id: string
  portal_user_id: string
  request_type: 'access' | 'export' | 'correction' | 'deletion' | 'restriction'
  status: 'pending' | 'processing' | 'completed' | 'rejected'
  reason: string | null
  processed_by: string | null
  processed_at: string | null
  completion_notes: string | null
  data_export_url: string | null
  metadata: any
  created_at: string
  updated_at: string
}

export type ResellerTenant = {
  id: string
  reseller_id: string
  tenant_slug: string
  company_name: string
  subdomain: string
  custom_domain: string | null
  custom_domain_verified: boolean
  branding_config: {
    logo_url: string | null
    favicon_url: string | null
    primary_color: string
    secondary_color: string
    accent_color: string
    font_family: string
  }
  features_enabled: {
    dashboard: boolean
    products: boolean
    customers: boolean
    orders: boolean
    analytics: boolean
    support: boolean
    agents: boolean
    social_media: boolean
    email_automation: boolean
    marketing: boolean
  }
  assigned_territories: any[]
  assigned_product_categories: any[]
  product_markup_percentage: number
  plan_tier: 'basic' | 'professional' | 'enterprise'
  monthly_fee: number
  billing_status: 'active' | 'suspended' | 'cancelled' | 'trial'
  trial_ends_at: string | null
  status: 'active' | 'inactive' | 'suspended' | 'pending_setup'
  onboarding_completed: boolean
  settings: any
  metadata: any
  created_at: string
  updated_at: string
}

export type TenantApiKey = {
  id: string
  tenant_id: string
  key_name: string
  key_prefix: string
  key_hash: string
  permissions: {
    read_products: boolean
    write_products: boolean
    read_customers: boolean
    write_customers: boolean
    read_orders: boolean
    write_orders: boolean
    manage_agents: boolean
  }
  last_used_at: string | null
  usage_count: number
  rate_limit_per_minute: number
  is_active: boolean
  expires_at: string | null
  metadata: any
  created_at: string
  updated_at: string
}

export type TenantCustomer = {
  id: string
  tenant_id: string
  customer_id: string
  full_name: string | null
  email: string | null
  phone: string | null
  company_name: string | null
  territory: string | null
  assigned_territory: any
  customer_data: any
  tags: string[]
  status: 'active' | 'inactive' | 'blocked'
  total_orders: number
  total_spent: number
  last_order_date: string | null
  metadata: any
  created_at: string
  updated_at: string
}

export type TenantProduct = {
  id: string
  tenant_id: string
  product_id: string
  base_price: number
  markup_percentage: number | null
  custom_price: number | null
  final_price: number
  is_visible: boolean
  is_available: boolean
  stock_override: number | null
  custom_name: string | null
  custom_description: string | null
  custom_images: any[]
  metadata: any
  created_at: string
  updated_at: string
}

export type TenantOrder = {
  id: string
  tenant_id: string
  order_number: string
  customer_id: string | null
  order_date: string
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded'
  subtotal: number
  tax: number
  shipping: number
  total: number
  currency: string
  items: any[]
  shipping_address: any
  billing_address: any
  fulfillment_status: 'unfulfilled' | 'partial' | 'fulfilled'
  tracking_number: string | null
  shipped_at: string | null
  delivered_at: string | null
  notes: string | null
  metadata: any
  created_at: string
  updated_at: string
}

export type TenantAgent = {
  id: string
  tenant_id: string
  agent_name: string
  agent_type: 'email' | 'social' | 'marketing' | 'support' | 'sales'
  config: any
  is_enabled: boolean
  total_actions: number
  last_active_at: string | null
  performance_metrics: any
  metadata: any
  created_at: string
  updated_at: string
}

export type TenantUsageMetrics = {
  id: string
  tenant_id: string
  metric_date: string
  api_calls: number
  agent_actions: number
  customers_managed: number
  orders_processed: number
  storage_used_mb: number
  email_agent_actions: number
  social_agent_actions: number
  marketing_agent_actions: number
  support_agent_actions: number
  estimated_cost: number
  metadata: any
  created_at: string
}

export type TenantAuditLog = {
  id: string
  tenant_id: string
  user_id: string | null
  action_type: string
  resource_type: string | null
  resource_id: string | null
  action_details: any
  ip_address: string | null
  user_agent: string | null
  success: boolean
  error_message: string | null
  created_at: string
}
