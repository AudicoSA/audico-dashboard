import type { OrchestratorConfig } from './types'

export const ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  tokenBudget: 100000,
  tokenResetHour: 0,
  conflictWindowSeconds: 30,
  operationTimeoutSeconds: 60,
  statusCheckIntervalMinutes: 1
}

export const AGENT_SCHEDULES = {
  EMAIL_POLL: '*/5 * * * *',
  EMAIL_CLASSIFY: '*/10 * * * *',
  EMAIL_RESPOND: '*/15 * * * *',
  STATUS_UPDATE: '* * * * *',
  CONFLICT_CHECK: '*/2 * * * *',
  TOKEN_MONITOR: '*/5 * * * *'
}

export const AGENT_TOKEN_ESTIMATES = {
  email_poll: 500,
  email_classify: 300,
  email_respond: 600,
  quote_chat: 800,
  seo_audit: 1000,
  content_generation: 1500
}

export const AGENT_PRIORITIES = {
  email_agent: 'high',
  quote_agent: 'high',
  customer_agent: 'high',
  orders_agent: 'medium',
  stock_agent: 'medium',
  seo_agent: 'low',
  content_agent: 'low'
} as const

export const CONFLICT_RESOLUTION_PRIORITY = [
  'email_agent',
  'quote_agent',
  'customer_agent',
  'orders_agent',
  'stock_agent',
  'comms_agent',
  'content_agent',
  'seo_agent'
]

export const TOKEN_WARNING_THRESHOLDS = {
  CRITICAL: 0.9,
  WARNING: 0.75,
  INFO: 0.5
}

export const AGENT_TIMEOUT_MINUTES = {
  ACTIVE_TO_IDLE: 10,
  IDLE_TO_OFFLINE: 60
}

export function getAgentPriority(agentName: string): string {
  return AGENT_PRIORITIES[agentName as keyof typeof AGENT_PRIORITIES] || 'medium'
}

export function getTokenEstimate(taskType: string): number {
  return AGENT_TOKEN_ESTIMATES[taskType as keyof typeof AGENT_TOKEN_ESTIMATES] || 500
}

export function shouldBlockOperation(remainingTokens: number, estimatedCost: number): boolean {
  return remainingTokens < estimatedCost
}

export function getConflictResolutionPriority(agents: string[]): string {
  for (const priority of CONFLICT_RESOLUTION_PRIORITY) {
    if (agents.includes(priority)) {
      return priority
    }
  }
  return agents[0] || 'unknown'
}
