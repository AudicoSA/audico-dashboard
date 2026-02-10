/**
 * Alert Service
 *
 * Notify Kenny of critical events via database, email, and dashboard notifications.
 */

import { supabase } from '@/lib/supabase'
import { logToSquadMessages } from '@/lib/logger'

export type AlertType = 'approval_needed' | 'agent_error' | 'rate_limit' | 'customer_complaint' | 'system_error'
export type AlertSeverity = 'low' | 'medium' | 'high' | 'urgent'

interface Alert {
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  metadata?: Record<string, any>
}

/**
 * Send an alert
 */
export async function sendAlert(alert: Alert): Promise<void> {
  console.log(`[ALERT ${alert.severity.toUpperCase()}] ${alert.title}`)

  // 1. Log to alerts table
  await supabase.from('alerts').insert({
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    metadata: alert.metadata,
    created_at: new Date().toISOString()
  })

  // 2. Log to squad messages
  const emoji = getAlertEmoji(alert.severity)
  await logToSquadMessages(
    'System',
    `${emoji} ${alert.title}`,
    {
      alert_type: alert.type,
      severity: alert.severity,
      ...alert.metadata
    }
  )

  // 3. Create dashboard notification
  await supabase.from('dashboard_notifications').insert({
    type: alert.type,
    message: alert.title,
    severity: alert.severity,
    read: false,
    created_at: new Date().toISOString(),
    metadata: alert.metadata
  })

  // 4. Send email if urgent
  if (alert.severity === 'urgent') {
    await sendUrgentEmailAlert(alert)
  }
}

/**
 * Send urgent email alert to Kenny
 */
async function sendUrgentEmailAlert(alert: Alert): Promise<void> {
  try {
    // Import Gmail sender dynamically to avoid circular dependencies
    const { sendDirectEmail } = await import('@/services/integrations/gmail-sender')

    const alertEmail = process.env.ALERT_EMAIL || 'kenny@audico.co.za'

    await sendDirectEmail(
      alertEmail,
      `🚨 URGENT: ${alert.title}`,
      `
        <h2>🚨 Urgent Alert from Audico Mission Control</h2>
        <p><strong>Type:</strong> ${alert.type}</p>
        <p><strong>Title:</strong> ${alert.title}</p>
        <p><strong>Message:</strong></p>
        <p>${alert.message}</p>
        ${alert.metadata ? `<p><strong>Details:</strong> <pre>${JSON.stringify(alert.metadata, null, 2)}</pre></p>` : ''}
        <p><a href="https://audico-dashboard.vercel.app/squad">View Dashboard</a></p>
      `
    )

    console.log(`[ALERT EMAIL] Sent urgent alert to ${alertEmail}`)
  } catch (error) {
    console.error('[ALERT EMAIL] Failed to send urgent email:', error)
    // Don't throw - alerting failure shouldn't break the system
  }
}

/**
 * Get emoji for alert severity
 */
function getAlertEmoji(severity: AlertSeverity): string {
  const emojiMap: Record<AlertSeverity, string> = {
    low: 'ℹ️',
    medium: '⚠️',
    high: '🔴',
    urgent: '🚨'
  }
  return emojiMap[severity] || 'ℹ️'
}

/**
 * Check if alert should be sent based on throttling
 * Prevents spam from repeated alerts of the same type
 */
async function shouldSendAlert(alertType: AlertType, throttleMinutes: number = 60): Promise<boolean> {
  const { data } = await supabase
    .from('alerts')
    .select('created_at')
    .eq('type', alertType)
    .gte('created_at', new Date(Date.now() - throttleMinutes * 60 * 1000).toISOString())
    .limit(1)

  return !data || data.length === 0
}

/**
 * Send throttled alert (won't send if same type was sent recently)
 */
export async function sendThrottledAlert(alert: Alert, throttleMinutes: number = 60): Promise<void> {
  const shouldSend = await shouldSendAlert(alert.type, throttleMinutes)

  if (shouldSend) {
    await sendAlert(alert)
  } else {
    console.log(`[ALERT THROTTLED] Skipped ${alert.type} alert (sent recently)`)
  }
}

/**
 * Mark dashboard notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  await supabase
    .from('dashboard_notifications')
    .update({ read: true })
    .eq('id', notificationId)
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const { count } = await supabase
    .from('dashboard_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('read', false)

  return count || 0
}

/**
 * Alert triggers (for common scenarios)
 */
export const alertTriggers = {
  /**
   * Task failed after multiple attempts
   */
  async taskFailed(taskId: string, taskTitle: string, error: string): Promise<void> {
    await sendAlert({
      type: 'agent_error',
      severity: 'urgent',
      title: 'Task Failed After 3 Attempts',
      message: `Task "${taskTitle}" failed after 3 execution attempts: ${error}`,
      metadata: { task_id: taskId, error }
    })
  },

  /**
   * Rate limit approaching or exceeded
   */
  async rateLimitWarning(agentName: string, remaining: number, max: number): Promise<void> {
    const percentRemaining = (remaining / max) * 100

    if (percentRemaining < 10) {
      await sendThrottledAlert({
        type: 'rate_limit',
        severity: 'high',
        title: `Rate Limit Warning: ${agentName}`,
        message: `Only ${remaining}/${max} API calls remaining for ${agentName}`,
        metadata: { agent: agentName, remaining, max }
      }, 30) // Throttle to once per 30 minutes
    }
  },

  /**
   * Customer complaint received
   */
  async customerComplaint(emailId: string, fromEmail: string, subject: string): Promise<void> {
    await sendAlert({
      type: 'customer_complaint',
      severity: 'urgent',
      title: 'Customer Complaint Received',
      message: `Complaint from ${fromEmail}: "${subject}"`,
      metadata: { email_id: emailId, from_email: fromEmail, subject }
    })
  },

  /**
   * Approval needed for high-priority task
   */
  async approvalNeeded(taskId: string, taskTitle: string, agent: string): Promise<void> {
    await sendAlert({
      type: 'approval_needed',
      severity: 'high',
      title: 'Approval Required',
      message: `${agent} needs approval for: "${taskTitle}"`,
      metadata: { task_id: taskId, agent }
    })
  },

  /**
   * System error occurred
   */
  async systemError(component: string, error: string): Promise<void> {
    await sendThrottledAlert({
      type: 'system_error',
      severity: 'urgent',
      title: `System Error in ${component}`,
      message: error,
      metadata: { component, error }
    }, 15) // Throttle to once per 15 minutes
  }
}

// Export all functions
export const alertService = {
  sendAlert,
  sendThrottledAlert,
  markNotificationRead,
  getUnreadNotificationCount,
  alertTriggers
}
