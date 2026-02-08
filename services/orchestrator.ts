import cron from 'node-cron'
import { createClient } from '@supabase/supabase-js'
import type { AgentStatus, TokenBudget, ConflictDetection, SquadMessage } from './types'
import { 
  ORCHESTRATOR_CONFIG, 
  AGENT_SCHEDULES, 
  TOKEN_WARNING_THRESHOLDS,
  AGENT_TIMEOUT_MINUTES 
} from './config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

class AgentOrchestrator {
  private isRunning = false
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map()
  private tokenBudget: TokenBudget = {
    total: ORCHESTRATOR_CONFIG.tokenBudget,
    used: 0,
    remaining: ORCHESTRATOR_CONFIG.tokenBudget,
    agentUsage: {}
  }
  private activeOperations: Map<string, ConflictDetection> = new Map()
  private readonly TOKEN_RESET_HOUR = ORCHESTRATOR_CONFIG.tokenResetHour

  async initialize() {
    if (this.isRunning) {
      console.log('Orchestrator already running')
      return
    }

    this.isRunning = true
    await this.logMessage('orchestrator', 'Agent Orchestrator starting up', { action: 'startup' })
    
    await this.initializeAgents()
    await this.setupScheduledJobs()
    await this.setupTokenBudgetReset()
    
    console.log('Agent Orchestrator initialized')
  }

  async shutdown() {
    this.isRunning = false
    
    for (const [name, job] of this.scheduledJobs) {
      job.stop()
      console.log(`Stopped scheduled job: ${name}`)
    }
    
    this.scheduledJobs.clear()
    await this.logMessage('orchestrator', 'Agent Orchestrator shutting down', { action: 'shutdown' })
  }

  private async initializeAgents() {
    const { data: agents, error } = await supabase
      .from('squad_agents')
      .select('*')
    
    if (error) {
      console.error('Failed to fetch agents:', error)
      return
    }

    for (const agent of agents || []) {
      this.tokenBudget.agentUsage[agent.name] = 0
    }

    await this.logMessage('orchestrator', `Initialized ${agents?.length || 0} agents`, {
      agents: agents?.map(a => a.name) || []
    })
  }

  private async setupScheduledJobs() {
    this.scheduledJobs.set('email_poll', cron.schedule(AGENT_SCHEDULES.EMAIL_POLL, async () => {
      await this.executeAgentTask('email_agent', 'poll', '/api/agents/email/poll')
    }))

    this.scheduledJobs.set('email_classify', cron.schedule(AGENT_SCHEDULES.EMAIL_CLASSIFY, async () => {
      await this.processUnclassifiedEmails()
    }))

    this.scheduledJobs.set('email_respond', cron.schedule(AGENT_SCHEDULES.EMAIL_RESPOND, async () => {
      await this.processClassifiedEmails()
    }))

    this.scheduledJobs.set('status_update', cron.schedule(AGENT_SCHEDULES.STATUS_UPDATE, async () => {
      await this.updateAgentStatuses()
    }))

    this.scheduledJobs.set('conflict_check', cron.schedule(AGENT_SCHEDULES.CONFLICT_CHECK, async () => {
      await this.checkForConflicts()
    }))

    this.scheduledJobs.set('token_monitor', cron.schedule(AGENT_SCHEDULES.TOKEN_MONITOR, async () => {
      await this.monitorTokenUsage()
    }))

    await this.logMessage('orchestrator', 'Scheduled jobs configured', {
      jobs: Array.from(this.scheduledJobs.keys())
    })
  }

  private async setupTokenBudgetReset() {
    this.scheduledJobs.set('token_reset', cron.schedule(`0 ${this.TOKEN_RESET_HOUR} * * *`, async () => {
      await this.resetTokenBudget()
    }))
  }

  private async executeAgentTask(agentName: string, taskType: string, endpoint: string) {
    if (!this.isRunning) return

    const canExecute = await this.checkTokenBudget(agentName, 1000)
    if (!canExecute) {
      await this.logMessage('orchestrator', `Task blocked: insufficient tokens for ${agentName}`, {
        agent: agentName,
        task: taskType,
        action: 'token_limit_reached'
      })
      return
    }

    await this.updateAgentStatus(agentName, 'active')
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      if (response.ok) {
        const result = await response.json()
        await this.logMessage(agentName, `Completed ${taskType} task`, {
          action: taskType,
          result
        })
        
        await this.trackTokenUsage(agentName, 500)
      } else {
        await this.logMessage(agentName, `Failed ${taskType} task`, {
          action: taskType,
          error: response.statusText
        })
      }
    } catch (error: any) {
      await this.logMessage(agentName, `Error executing ${taskType}`, {
        action: taskType,
        error: error.message
      })
    } finally {
      await this.updateAgentStatus(agentName, 'idle')
    }
  }

  private async processUnclassifiedEmails() {
    const { data: emails } = await supabase
      .from('email_logs')
      .select('*')
      .eq('category', 'unclassified')
      .limit(10)
    
    if (!emails || emails.length === 0) return

    for (const email of emails) {
      const canExecute = await this.checkTokenBudget('email_agent', 500)
      if (!canExecute) break

      await this.registerOperation({
        emailId: email.id,
        timestamp: new Date(),
        agents: ['email_agent'],
        action: 'classify'
      })

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/agents/email/classify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email_id: email.id })
        })

        if (response.ok) {
          await this.trackTokenUsage('email_agent', 300)
        }
      } catch (error) {
        console.error('Error classifying email:', error)
      } finally {
        this.clearOperation(email.id)
      }
    }
  }

  private async processClassifiedEmails() {
    const { data: emails } = await supabase
      .from('email_logs')
      .select('*')
      .eq('status', 'classified')
      .limit(5)
    
    if (!emails || emails.length === 0) return

    for (const email of emails) {
      const conflict = await this.detectConflict({
        emailId: email.id,
        timestamp: new Date(),
        agents: ['email_agent'],
        action: 'respond'
      })

      if (conflict) {
        await this.logMessage('orchestrator', `Conflict detected for email ${email.id}`, {
          action: 'conflict_detected',
          email_id: email.id,
          conflicting_agents: conflict.agents
        })
        continue
      }

      const canExecute = await this.checkTokenBudget('email_agent', 800)
      if (!canExecute) break

      await this.registerOperation({
        emailId: email.id,
        timestamp: new Date(),
        agents: ['email_agent'],
        action: 'respond'
      })

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/agents/email/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email_id: email.id })
        })

        if (response.ok) {
          await this.trackTokenUsage('email_agent', 600)
        }
      } catch (error) {
        console.error('Error responding to email:', error)
      } finally {
        this.clearOperation(email.id)
      }
    }
  }

  private async registerOperation(operation: ConflictDetection) {
    const key = operation.emailId || operation.customerId || Math.random().toString()
    this.activeOperations.set(key, operation)
  }

  private clearOperation(identifier: string) {
    this.activeOperations.delete(identifier)
  }

  private async detectConflict(newOperation: ConflictDetection): Promise<ConflictDetection | null> {
    const key = newOperation.emailId || newOperation.customerId
    if (!key) return null

    const existing = this.activeOperations.get(key)
    if (!existing) return null

    const timeDiff = newOperation.timestamp.getTime() - existing.timestamp.getTime()
    if (timeDiff < ORCHESTRATOR_CONFIG.conflictWindowSeconds * 1000) {
      return existing
    }

    return null
  }

  private async checkForConflicts() {
    const cutoffTime = new Date(Date.now() - (ORCHESTRATOR_CONFIG.operationTimeoutSeconds * 1000))
    
    for (const [key, operation] of this.activeOperations) {
      if (operation.timestamp < cutoffTime) {
        this.activeOperations.delete(key)
      }
    }

    if (this.activeOperations.size > 0) {
      await this.logMessage('orchestrator', `Active operations: ${this.activeOperations.size}`, {
        action: 'conflict_check',
        operations: Array.from(this.activeOperations.values())
      })
    }
  }

  private async checkTokenBudget(agentName: string, tokensNeeded: number): Promise<boolean> {
    if (this.tokenBudget.remaining < tokensNeeded) {
      return false
    }
    return true
  }

  private async trackTokenUsage(agentName: string, tokensUsed: number) {
    this.tokenBudget.used += tokensUsed
    this.tokenBudget.remaining = this.tokenBudget.total - this.tokenBudget.used
    this.tokenBudget.agentUsage[agentName] = (this.tokenBudget.agentUsage[agentName] || 0) + tokensUsed

    await supabase
      .from('squad_agents')
      .update({
        last_active: new Date().toISOString()
      })
      .eq('name', agentName)
  }

  private async resetTokenBudget() {
    const previousUsage = { ...this.tokenBudget }
    
    this.tokenBudget.used = 0
    this.tokenBudget.remaining = this.tokenBudget.total
    this.tokenBudget.agentUsage = {}

    const { data: agents } = await supabase
      .from('squad_agents')
      .select('name')
    
    for (const agent of agents || []) {
      this.tokenBudget.agentUsage[agent.name] = 0
    }

    await this.logMessage('orchestrator', 'Token budget reset', {
      action: 'token_reset',
      previous_usage: previousUsage,
      new_budget: this.tokenBudget
    })
  }

  private async monitorTokenUsage() {
    const usagePercent = this.tokenBudget.used / this.tokenBudget.total

    if (usagePercent >= TOKEN_WARNING_THRESHOLDS.CRITICAL) {
      await this.logMessage('orchestrator', `CRITICAL: Token budget ${Math.round(usagePercent * 100)}% depleted`, {
        action: 'token_critical',
        usage: this.tokenBudget
      })
    } else if (usagePercent >= TOKEN_WARNING_THRESHOLDS.WARNING) {
      await this.logMessage('orchestrator', `WARNING: Token budget ${Math.round(usagePercent * 100)}% depleted`, {
        action: 'token_warning',
        usage: this.tokenBudget
      })
    } else if (usagePercent >= TOKEN_WARNING_THRESHOLDS.INFO) {
      await this.logMessage('orchestrator', `INFO: Token budget ${Math.round(usagePercent * 100)}% depleted`, {
        action: 'token_info',
        usage: this.tokenBudget
      })
    }
  }

  private async updateAgentStatuses() {
    const { data: agents } = await supabase
      .from('squad_agents')
      .select('*')
    
    if (!agents) return

    for (const agent of agents) {
      const lastActive = new Date(agent.last_active)
      const minutesSinceActive = (Date.now() - lastActive.getTime()) / 1000 / 60

      let newStatus = agent.status
      if (minutesSinceActive > AGENT_TIMEOUT_MINUTES.IDLE_TO_OFFLINE) {
        newStatus = 'offline'
      } else if (minutesSinceActive > AGENT_TIMEOUT_MINUTES.ACTIVE_TO_IDLE) {
        newStatus = 'idle'
      }

      if (newStatus !== agent.status) {
        await this.updateAgentStatus(agent.name, newStatus)
      }
    }
  }

  private async updateAgentStatus(agentName: string, status: 'active' | 'idle' | 'offline') {
    const { error } = await supabase
      .from('squad_agents')
      .update({
        status,
        last_active: new Date().toISOString()
      })
      .eq('name', agentName)
    
    if (error) {
      console.error(`Failed to update agent status for ${agentName}:`, error)
    }
  }

  private async logMessage(fromAgent: string, message: string, data?: any) {
    await supabase
      .from('squad_messages')
      .insert({
        from_agent: fromAgent,
        to_agent: null,
        message,
        task_id: null,
        data: data || {}
      })
  }

  async sendMessage(fromAgent: string, toAgent: string | null, message: string, taskId?: string, data?: any) {
    await supabase
      .from('squad_messages')
      .insert({
        from_agent: fromAgent,
        to_agent: toAgent,
        message,
        task_id: taskId || null,
        data: data || {}
      })
  }

  async getMessages(limit: number = 50) {
    const { data, error } = await supabase
      .from('squad_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('Failed to fetch messages:', error)
      return []
    }
    
    return data || []
  }

  getTokenBudget(): TokenBudget {
    return { ...this.tokenBudget }
  }

  getActiveOperations(): ConflictDetection[] {
    return Array.from(this.activeOperations.values())
  }

  async getAgentStatuses(): Promise<AgentStatus[]> {
    const { data, error } = await supabase
      .from('squad_agents')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Failed to fetch agent statuses:', error)
      return []
    }
    
    return data || []
  }
}

export const orchestrator = new AgentOrchestrator()

export default orchestrator
