/**
 * Type definitions for Mission Control Squad system
 * Matches Supabase database schema for squad_* tables
 */

export type TaskStatus = 'new' | 'in_progress' | 'completed' | 'failed' | 'rejected'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * Task - Represents a task in the squad_tasks table
 */
export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  assigned_agent: string
  priority: Priority
  mentions_kenny: boolean
  requires_approval: boolean
  deliverable_url?: string | null
  metadata?: Record<string, any> | null

  // Approval workflow fields
  approved_by?: string | null
  approved_at?: string | null
  rejected_by?: string | null
  rejected_at?: string | null
  rejection_reason?: string | null

  // Execution tracking
  execution_attempts: number
  last_execution_attempt?: string | null
  execution_error?: string | null

  // Timestamps
  created_at: string
  updated_at: string
}

/**
 * Agent - Represents an agent in the squad_agents table
 */
export interface Agent {
  id: string
  name: string
  role: string
  description: string
  capabilities: string[]
  status: 'active' | 'idle' | 'offline'
  last_active?: string | null
  metadata?: Record<string, any> | null
  created_at: string
  updated_at: string
}

/**
 * Message - Represents a message in the squad_messages table
 */
export interface Message {
  id: string
  from_agent: string
  to_agent?: string | null
  message: string
  task_id?: string | null
  data?: Record<string, any> | null
  created_at: string
}

/**
 * Newsletter Draft - Represents a draft in the newsletter_drafts table
 */
export interface NewsletterDraft {
  id: string
  status: 'draft' | 'scheduled' | 'sent' | 'failed'
  sent_at?: string | null
  data: {
    subject_line: string
    content: string
    preview_text?: string
    recipient_count?: number
  }
  metadata?: Record<string, any> | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

/**
 * Influencer Opportunity - Represents an influencer in the influencer_opportunities table
 */
export interface InfluencerOpportunity {
  id: string
  status: 'identified' | 'contacted' | 'replied' | 'partnered' | 'declined'
  contacted_at?: string | null
  replied_at?: string | null
  data: {
    name: string
    email?: string
    platform: string
    follower_count: number
    niche: string
    preferred_contact?: string
  }
  metadata?: Record<string, any> | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

/**
 * Outreach Tracking - Represents outreach in the outreach_tracking table
 */
export interface OutreachTracking {
  id: string
  influencer_id: string
  channel: 'email' | 'twitter' | 'instagram' | 'linkedin'
  message_sent: string
  status: 'sent' | 'opened' | 'replied' | 'bounced'
  sent_at: string
  opened_at?: string | null
  replied_at?: string | null
  metadata?: Record<string, any> | null
  created_at: string
}
