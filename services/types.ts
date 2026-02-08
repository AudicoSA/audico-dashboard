export interface AgentStatus {
  id: string
  name: string
  role: string
  status: 'active' | 'idle' | 'offline'
  last_active: string
  created_at?: string
}

export interface TokenBudget {
  total: number
  used: number
  remaining: number
  agentUsage: Record<string, number>
}

export interface ConflictDetection {
  customerId?: string
  emailId?: string
  quoteId?: string
  orderId?: string
  timestamp: Date
  agents: string[]
  action: string
}

export interface SquadMessage {
  id: string
  from_agent: string
  to_agent: string | null
  message: string
  task_id: string | null
  data: Record<string, any>
  created_at: string
}

export interface ScheduledJob {
  name: string
  schedule: string
  handler: () => Promise<void>
  enabled: boolean
}

export interface OrchestratorConfig {
  tokenBudget: number
  tokenResetHour: number
  conflictWindowSeconds: number
  operationTimeoutSeconds: number
  statusCheckIntervalMinutes: number
}

export interface AgentTask {
  agentName: string
  taskType: string
  endpoint: string
  tokensEstimated: number
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

export interface OrchestratorStatus {
  agents: AgentStatus[]
  tokenBudget: TokenBudget
  activeOperations: ConflictDetection[]
  scheduledJobs: string[]
  isRunning: boolean
  timestamp: string
}
