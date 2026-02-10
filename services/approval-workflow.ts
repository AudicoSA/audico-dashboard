/**
 * Approval Workflow System
 *
 * Defines safety rules for auto-execute vs require-approval.
 * Ensures critical operations get human oversight while safe operations auto-execute.
 */

import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/squad'

interface ApprovalRule {
  name: string
  matches: (task: Task) => boolean
  severity: 'low' | 'medium' | 'high' | 'urgent'
}

/**
 * Approval rules by agent
 */
const APPROVAL_RULES: Record<string, ApprovalRule[]> = {
  'Email Agent': [
    {
      name: 'Customer order emails',
      matches: (task) => task.metadata?.email_category === 'order',
      severity: 'high'
    },
    {
      name: 'Customer support emails',
      matches: (task) => task.metadata?.email_category === 'support',
      severity: 'high'
    },
    {
      name: 'Customer complaints',
      matches: (task) => task.metadata?.email_category === 'complaint',
      severity: 'urgent'
    },
    {
      name: 'Refund requests',
      matches: (task) => task.title?.toLowerCase().includes('refund'),
      severity: 'urgent'
    }
  ],

  'Social Media Agent': [
    {
      name: 'All social posts',
      matches: (task) => task.title?.toLowerCase().includes('post') || task.metadata?.post_id,
      severity: 'high'
    }
  ],

  'Marketing Agent': [
    {
      name: 'Newsletter distribution',
      matches: (task) => task.title?.toLowerCase().includes('newsletter'),
      severity: 'high'
    },
    {
      name: 'Influencer outreach',
      matches: (task) => task.title?.toLowerCase().includes('influencer') || task.title?.toLowerCase().includes('outreach'),
      severity: 'medium'
    },
    {
      name: 'Bulk email campaigns',
      matches: (task) => task.metadata?.recipient_count && task.metadata.recipient_count > 10,
      severity: 'high'
    }
  ],

  'SEO Agent': [
    {
      name: 'Bulk SEO changes',
      matches: (task) => task.metadata?.affected_products && task.metadata.affected_products > 10,
      severity: 'high'
    },
    {
      name: 'URL rewrites',
      matches: (task) => task.title?.toLowerCase().includes('url') || task.metadata?.change_type === 'url_rewrite',
      severity: 'high'
    },
    {
      name: 'Category moves',
      matches: (task) => task.metadata?.change_type === 'category_move',
      severity: 'medium'
    }
  ],

  'Google Ads Agent': [
    {
      name: 'Budget changes',
      matches: (task) => task.title?.toLowerCase().includes('budget'),
      severity: 'high'
    },
    {
      name: 'Large bid increases',
      matches: (task) => {
        const bidChange = task.metadata?.bid_change_percent
        return bidChange && bidChange > 10
      },
      severity: 'high'
    },
    {
      name: 'Campaign pause/resume',
      matches: (task) => task.title?.toLowerCase().includes('pause') || task.title?.toLowerCase().includes('resume'),
      severity: 'high'
    }
  ]
}

/**
 * Auto-execute rules (operations that are safe to run automatically)
 */
const AUTO_EXECUTE_RULES: Record<string, ApprovalRule[]> = {
  'Email Agent': [
    {
      name: 'FAQ/Inquiry responses',
      matches: (task) => task.metadata?.email_category === 'inquiry',
      severity: 'low'
    },
    {
      name: 'Spam classification',
      matches: (task) => task.metadata?.email_category === 'spam',
      severity: 'low'
    }
  ],

  'SEO Agent': [
    {
      name: 'Minor SEO fixes',
      matches: (task) => {
        const affected = task.metadata?.affected_products
        return affected && affected <= 10
      },
      severity: 'low'
    },
    {
      name: 'Meta description updates',
      matches: (task) => task.metadata?.change_type === 'meta_description' && task.metadata?.affected_products <= 10,
      severity: 'low'
    },
    {
      name: 'Image alt tag additions',
      matches: (task) => task.metadata?.change_type === 'image_alt' && task.metadata?.affected_products <= 10,
      severity: 'low'
    }
  ],

  'Google Ads Agent': [
    {
      name: 'Bid decreases',
      matches: (task) => {
        const bidChange = task.metadata?.bid_change_percent
        return bidChange && bidChange < 0
      },
      severity: 'low'
    },
    {
      name: 'Small bid increases',
      matches: (task) => {
        const bidChange = task.metadata?.bid_change_percent
        return bidChange && bidChange > 0 && bidChange <= 10
      },
      severity: 'low'
    }
  ]
}

/**
 * Check if a task requires approval
 */
export function requiresApproval(task: Task): boolean {
  // If already marked as requiring approval, respect that
  if (task.requires_approval === true) {
    return true
  }

  // Check auto-execute rules first (whitelist approach)
  const autoRules = AUTO_EXECUTE_RULES[task.assigned_agent] || []
  const matchesAutoRule = autoRules.some(rule => rule.matches(task))

  if (matchesAutoRule) {
    return false // Safe to auto-execute
  }

  // Check approval rules
  const approvalRules = APPROVAL_RULES[task.assigned_agent] || []
  const matchesApprovalRule = approvalRules.some(rule => rule.matches(task))

  if (matchesApprovalRule) {
    return true // Requires approval
  }

  // Default: require approval for safety (conservative approach)
  return true
}

/**
 * Get the severity level for a task that requires approval
 */
export function getApprovalSeverity(task: Task): 'low' | 'medium' | 'high' | 'urgent' {
  const approvalRules = APPROVAL_RULES[task.assigned_agent] || []
  const matchedRule = approvalRules.find(rule => rule.matches(task))

  return matchedRule?.severity || 'medium'
}

/**
 * Create an approval task for Kenny
 */
export async function createApprovalTask(originalTask: Task): Promise<void> {
  const severity = getApprovalSeverity(originalTask)

  // Update original task to require approval
  await supabase
    .from('squad_tasks')
    .update({ requires_approval: true })
    .eq('id', originalTask.id)

  // Create notification in squad messages
  await supabase.from('squad_messages').insert({
    from_agent: 'Task Executor',
    to_agent: 'Jarvis',
    message: `⏸️ Task requires approval: "${originalTask.title}"`,
    task_id: originalTask.id,
    data: {
      severity,
      task_id: originalTask.id,
      agent: originalTask.assigned_agent,
      preview_url: originalTask.deliverable_url
    }
  })

  console.log(`[APPROVAL REQUIRED] Task ${originalTask.id} marked for approval (severity: ${severity})`)
}

/**
 * Mark task as approved
 */
export async function approveTask(taskId: string, approvedBy: string = 'Kenny'): Promise<void> {
  await supabase
    .from('squad_tasks')
    .update({
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      requires_approval: false // Allow execution
    })
    .eq('id', taskId)

  console.log(`[APPROVED] Task ${taskId} approved by ${approvedBy}`)
}

/**
 * Mark task as rejected
 */
export async function rejectTask(taskId: string, rejectedBy: string = 'Kenny', reason?: string): Promise<void> {
  await supabase
    .from('squad_tasks')
    .update({
      status: 'rejected',
      rejected_by: rejectedBy,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason
    })
    .eq('id', taskId)

  console.log(`[REJECTED] Task ${taskId} rejected by ${rejectedBy}: ${reason}`)
}

/**
 * Check if agent execution is globally paused
 */
export async function isExecutionPaused(): Promise<boolean> {
  const { data } = await supabase
    .from('agent_configs')
    .select('value')
    .eq('key', 'global_pause')
    .single()

  return data?.value === true
}

// Export all functions
export const approvalWorkflow = {
  requiresApproval,
  getApprovalSeverity,
  createApprovalTask,
  approveTask,
  rejectTask,
  isExecutionPaused
}
