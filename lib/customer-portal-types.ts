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
