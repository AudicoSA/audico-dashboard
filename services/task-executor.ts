/**
 * Task Executor Service
 *
 * Core service that polls for executable tasks and dispatches them to appropriate agents.
 * Implements retry logic, error handling, and task status management.
 */

import { supabase } from '@/lib/supabase'
import { logToSquadMessages } from '@/lib/logger'
import type { Task } from '@/types/squad'

const DRY_RUN = process.env.AGENT_DRY_RUN === 'true'

interface ExecutionResult {
  success: boolean
  deliverable_url?: string
  error?: string
}

interface AgentHandler {
  execute: (task: Task) => Promise<ExecutionResult>
}

/**
 * Registry of agent handlers
 * Maps agent names to their execution handlers
 */
const agentHandlers: Record<string, AgentHandler> = {
  'Email Agent': {
    async execute(task: Task): Promise<ExecutionResult> {
      const { emailSendHandler } = await import('@/services/execution-handlers/email-handler')
      return emailSendHandler(task)
    }
  },
  'Social Media Agent': {
    async execute(task: Task): Promise<ExecutionResult> {
      const { socialPublishHandler } = await import('@/services/execution-handlers/social-handler')
      return socialPublishHandler(task)
    }
  },
  'Marketing Agent': {
    async execute(task: Task): Promise<ExecutionResult> {
      const { marketingHandler } = await import('@/services/execution-handlers/marketing-handler')
      return marketingHandler(task)
    }
  },
  'SEO Agent': {
    async execute(task: Task): Promise<ExecutionResult> {
      const { seoHandler } = await import('@/services/execution-handlers/seo-handler')
      return seoHandler(task)
    }
  },
  'Google Ads Agent': {
    async execute(task: Task): Promise<ExecutionResult> {
      const { adsHandler } = await import('@/services/execution-handlers/ads-handler')
      return adsHandler(task)
    }
  }
}

/**
 * Fetch tasks that are ready for execution
 * - Status must be 'new'
 * - Either requires_approval=false OR already approved
 * - Execution attempts < 3
 */
export async function fetchExecutableTasks(limit: number = 10): Promise<Task[]> {
  const { data, error } = await supabase
    .from('squad_tasks')
    .select('*')
    .eq('status', 'new')
    .or('requires_approval.eq.false,and(requires_approval.eq.true,approved_at.not.is.null)')
    .lt('execution_attempts', 3)
    .order('priority', { ascending: false }) // urgent > high > medium > low
    .order('created_at', { ascending: true }) // oldest first
    .limit(limit)

  if (error) {
    console.error('Error fetching executable tasks:', error)
    return []
  }

  return data || []
}

/**
 * Execute a single task
 */
export async function executeTask(task: Task): Promise<ExecutionResult> {

  console.log(`[EXECUTING] Task ${task.id}: ${task.title}`)

  // Update task to in_progress
  await updateTaskStatus(task.id, 'in_progress', {
    last_execution_attempt: new Date().toISOString()
  })

  try {
    // Get handler for agent
    const handler = agentHandlers[task.assigned_agent]
    if (!handler) {
      throw new Error(`No handler found for agent: ${task.assigned_agent}`)
    }

    // Execute task
    const result = await handler.execute(task)

    if (result.success) {
      // Mark task as completed
      await markTaskComplete(task.id, result.deliverable_url)

      await logToSquadMessages(
        'Task Executor',
        `✅ Task completed: ${task.title}`,
        { task_id: task.id, agent: task.assigned_agent }
      )

      return result
    } else {
      throw new Error(result.error || 'Execution failed')
    }
  } catch (error: any) {
    console.error(`[ERROR] Task ${task.id} failed:`, error)

    // Increment execution attempts
    const newAttempts = (task.execution_attempts || 0) + 1

    await supabase
      .from('squad_tasks')
      .update({
        execution_attempts: newAttempts,
        execution_error: error.message,
        last_execution_attempt: new Date().toISOString()
      })
      .eq('id', task.id)

    // Escalate after 3 failures
    if (newAttempts >= 3) {
      await escalateTask(task, error.message)
    }

    return { success: false, error: error.message }
  }
}

/**
 * Execute multiple tasks in batch
 */
export async function executeBatch(tasks: Task[]): Promise<{
  success: ExecutionResult[]
  failed: ExecutionResult[]
}> {
  const results = await Promise.allSettled(tasks.map(executeTask))

  const success: ExecutionResult[] = []
  const failed: ExecutionResult[] = []

  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value.success) {
      success.push(result.value)
    } else if (result.status === 'fulfilled') {
      failed.push(result.value)
    } else {
      failed.push({ success: false, error: result.reason })
    }
  })

  return { success, failed }
}

/**
 * Update task status
 */
async function updateTaskStatus(taskId: string, status: string, additionalFields: any = {}) {
  await supabase
    .from('squad_tasks')
    .update({
      status,
      ...additionalFields
    })
    .eq('id', taskId)
}

/**
 * Mark task as completed
 */
async function markTaskComplete(taskId: string, deliverableUrl?: string) {
  await supabase
    .from('squad_tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      deliverable_url: deliverableUrl
    })
    .eq('id', taskId)
}

/**
 * Escalate task after multiple failures
 */
async function escalateTask(task: Task, errorMessage: string) {
  console.error(`[ESCALATION] Task ${task.id} failed 3 times:`, errorMessage)

  // Create escalation task for Jarvis/Kenny
  await supabase.from('squad_tasks').insert({
    title: `🚨 ESCALATION: ${task.title}`,
    description: `Original task failed after 3 attempts.\n\nError: ${errorMessage}\n\nOriginal task: ${task.description}`,
    status: 'new',
    assigned_agent: 'Jarvis',
    priority: 'urgent',
    mentions_kenny: true,
    requires_approval: false,
    metadata: {
      escalated_from: task.id,
      original_agent: task.assigned_agent,
      error: errorMessage
    }
  })

  // Update original task to failed
  await supabase
    .from('squad_tasks')
    .update({ status: 'failed' })
    .eq('id', task.id)

  // Send alert
  const { sendAlert } = await import('@/services/alert-service')
  await sendAlert({
    type: 'agent_error',
    severity: 'urgent',
    title: `Task Failed After 3 Attempts`,
    message: `Task "${task.title}" (${task.assigned_agent}) failed 3 times: ${errorMessage}`,
    metadata: { task_id: task.id }
  })

  await logToSquadMessages(
    'Task Executor',
    `🚨 ESCALATION: Task "${task.title}" failed after 3 attempts`,
    { task_id: task.id, error: errorMessage }
  )
}

/**
 * Get handler for specific agent
 */
function getHandlerForAgent(agentName: string): AgentHandler | null {
  return agentHandlers[agentName] || null
}

/**
 * Poll for tasks and execute them
 * Called by cron job every 2 minutes
 */
export async function pollAndExecute(): Promise<{
  executed: number
  failed: number
  skipped: number
}> {
  console.log('[TASK EXECUTOR] Polling for executable tasks...')

  const tasks = await fetchExecutableTasks(10)

  if (tasks.length === 0) {
    console.log('[TASK EXECUTOR] No tasks to execute')
    return { executed: 0, failed: 0, skipped: 0 }
  }

  console.log(`[TASK EXECUTOR] Found ${tasks.length} tasks to execute`)

  const results = await executeBatch(tasks)

  const stats = {
    executed: results.success.length,
    failed: results.failed.length,
    skipped: tasks.length - results.success.length - results.failed.length
  }

  console.log('[TASK EXECUTOR] Execution complete:', stats)

  return stats
}

// Export all functions
export const taskExecutor = {
  fetchExecutableTasks,
  executeTask,
  executeBatch,
  pollAndExecute,
  getHandlerForAgent
}
