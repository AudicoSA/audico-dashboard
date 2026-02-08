'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Play,
  Square,
  Activity,
  Calendar,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle2,
  Settings,
  RefreshCw
} from 'lucide-react'

interface TokenBudget {
  total: number
  used: number
  remaining: number
  agentUsage: Record<string, number>
}

interface ConflictDetection {
  customerId?: string
  emailId?: string
  quoteId?: string
  orderId?: string
  timestamp: Date
  agents: string[]
  action: string
}

interface OrchestratorStatus {
  tokenBudget: TokenBudget
  activeOperations: ConflictDetection[]
  timestamp?: string
}

interface AgentConfig {
  id: string
  name: string
  role: string
  color: string
}

interface CronSchedule {
  name: string
  schedule: string
  description: string
  nextRun: string
}

const AGENTS: AgentConfig[] = [
  { id: 'jarvis', name: 'Jarvis', role: 'Orchestrator', color: '#a855f7' },
  { id: 'mpho', name: 'Mpho', role: 'Orders', color: '#3b82f6' },
  { id: 'thandi', name: 'Thandi', role: 'Stock', color: '#22c55e' },
  { id: 'sizwe', name: 'Sizwe', role: 'Customer', color: '#f59e0b' },
  { id: 'naledi', name: 'Naledi', role: 'Comms', color: '#ec4899' },
  { id: 'lerato', name: 'Lerato', role: 'Content', color: '#14b8a6' },
  { id: 'vusi', name: 'Vusi', role: 'SEO', color: '#f43f5e' },
]

const CRON_SCHEDULES: Omit<CronSchedule, 'nextRun'>[] = [
  { name: 'Email Poll', schedule: '*/5 * * * *', description: 'Check for new emails every 5 minutes' },
  { name: 'Email Classify', schedule: '*/10 * * * *', description: 'Classify unread emails every 10 minutes' },
  { name: 'Email Respond', schedule: '*/15 * * * *', description: 'Generate responses every 15 minutes' },
  { name: 'Status Update', schedule: '* * * * *', description: 'Update agent statuses every minute' },
  { name: 'Conflict Check', schedule: '*/2 * * * *', description: 'Check for operation conflicts every 2 minutes' },
  { name: 'Token Monitor', schedule: '*/5 * * * *', description: 'Monitor token usage every 5 minutes' },
]

function parseCronSchedule(cronExpression: string): Date {
  const now = new Date()
  const parts = cronExpression.split(' ')
  
  if (parts.length < 5) return now
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
  
  const nextRun = new Date(now)
  
  if (minute.startsWith('*/')) {
    const interval = parseInt(minute.substring(2))
    const currentMinute = now.getMinutes()
    const nextMinute = Math.ceil((currentMinute + 1) / interval) * interval
    nextRun.setMinutes(nextMinute)
    nextRun.setSeconds(0)
    nextRun.setMilliseconds(0)
  } else if (minute === '*') {
    nextRun.setMinutes(now.getMinutes() + 1)
    nextRun.setSeconds(0)
    nextRun.setMilliseconds(0)
  } else {
    nextRun.setMinutes(parseInt(minute))
    nextRun.setSeconds(0)
    nextRun.setMilliseconds(0)
    if (nextRun <= now) {
      nextRun.setHours(nextRun.getHours() + 1)
    }
  }
  
  return nextRun
}

function formatNextRun(date: Date): string {
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  const minutes = Math.floor(diff / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

export default function OrchestratorPanel() {
  const [status, setStatus] = useState<OrchestratorStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [triggeringAgent, setTriggeringAgent] = useState<string | null>(null)
  const [schedules, setSchedules] = useState<CronSchedule[]>([])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const schedulesWithNextRun = CRON_SCHEDULES.map(schedule => ({
      ...schedule,
      nextRun: formatNextRun(parseCronSchedule(schedule.schedule))
    }))
    setSchedules(schedulesWithNextRun)

    const interval = setInterval(() => {
      const updated = CRON_SCHEDULES.map(schedule => ({
        ...schedule,
        nextRun: formatNextRun(parseCronSchedule(schedule.schedule))
      }))
      setSchedules(updated)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/squad?action=orchestrator-status')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch (err) {
      console.error('Failed to fetch orchestrator status:', err)
    }
  }

  const handleStart = async () => {
    setIsStarting(true)
    try {
      const res = await fetch('/api/squad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'orchestrator-init' })
      })
      if (res.ok) {
        await fetchStatus()
      }
    } catch (err) {
      console.error('Failed to start orchestrator:', err)
    } finally {
      setIsStarting(false)
    }
  }

  const handleStop = async () => {
    setIsStopping(true)
    try {
      const res = await fetch('/api/squad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'orchestrator-shutdown' })
      })
      if (res.ok) {
        await fetchStatus()
      }
    } catch (err) {
      console.error('Failed to stop orchestrator:', err)
    } finally {
      setIsStopping(false)
    }
  }

  const handleTriggerAgent = async (agentId: string) => {
    setTriggeringAgent(agentId)
    try {
      await fetch('/api/squad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'orchestrator-message',
          fromAgent: 'orchestrator',
          toAgent: agentId,
          message: `Manual trigger requested for ${agentId}`,
          data: { trigger: 'manual', timestamp: new Date().toISOString() }
        })
      })
    } catch (err) {
      console.error(`Failed to trigger agent ${agentId}:`, err)
    } finally {
      setTriggeringAgent(null)
    }
  }

  const handleRefresh = async () => {
    setIsLoading(true)
    await fetchStatus()
    setIsLoading(false)
  }

  const tokenUsagePercent = status?.tokenBudget
    ? (status.tokenBudget.used / status.tokenBudget.total) * 100
    : 0

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'from-red-500 to-red-600'
    if (percent >= 75) return 'from-orange-500 to-orange-600'
    if (percent >= 50) return 'from-yellow-500 to-yellow-600'
    return 'from-lime-400 to-green-500'
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Control Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Settings className="text-purple-400" />
              Control Panel
            </h3>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh status"
            >
              <RefreshCw size={18} className={`text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleStart}
              disabled={isStarting}
              className="w-full px-4 py-3 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
            >
              <Play size={18} />
              {isStarting ? 'Starting...' : 'Start Orchestrator'}
            </button>
            
            <button
              onClick={handleStop}
              disabled={isStopping}
              className="w-full px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-red-500/30 disabled:opacity-50"
            >
              <Square size={18} />
              {isStopping ? 'Stopping...' : 'Stop Orchestrator'}
            </button>
          </div>

          {status?.timestamp && (
            <div className="mt-6 pt-6 border-t border-white/5">
              <p className="text-xs text-gray-400">
                Last updated: {new Date(status.timestamp).toLocaleTimeString()}
              </p>
            </div>
          )}
        </motion.div>

        {/* Token Budget */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
        >
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Activity className="text-lime-400" />
            Token Budget
          </h3>

          {status?.tokenBudget ? (
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Usage</span>
                  <span className="text-white font-medium">
                    {status.tokenBudget.used.toLocaleString()} / {status.tokenBudget.total.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${tokenUsagePercent}%` }}
                    transition={{ duration: 0.5 }}
                    className={`h-full bg-gradient-to-r ${getUsageColor(tokenUsagePercent)}`}
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-400">
                    {tokenUsagePercent.toFixed(1)}% used
                  </span>
                  <span className="text-xs text-gray-400">
                    {status.tokenBudget.remaining.toLocaleString()} remaining
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Per-Agent Breakdown</h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                  {Object.entries(status.tokenBudget.agentUsage)
                    .sort(([, a], [, b]) => b - a)
                    .map(([agent, usage]) => {
                      const agentConfig = AGENTS.find(a => a.name.toLowerCase() === agent.toLowerCase())
                      const percent = (usage / status.tokenBudget.total) * 100
                      return (
                        <div key={agent} className="flex items-center gap-3">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: agentConfig?.color || '#666' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline gap-2">
                              <span className="text-sm text-gray-300 truncate">{agent}</span>
                              <span className="text-xs text-gray-400 font-mono shrink-0">
                                {usage.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-1">
                              <div
                                className="h-full bg-gradient-to-r from-lime-400/50 to-green-500/50"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <div className="text-center">
                <Activity className="mx-auto mb-2 opacity-50" size={32} />
                <p className="text-sm">No data available</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Active Operations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
      >
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="text-yellow-400" />
          Active Operations
        </h3>

        {status?.activeOperations && status.activeOperations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-sm font-medium text-gray-400 pb-3 pr-4">Action</th>
                  <th className="text-left text-sm font-medium text-gray-400 pb-3 pr-4">Agents</th>
                  <th className="text-left text-sm font-medium text-gray-400 pb-3 pr-4">Resource</th>
                  <th className="text-left text-sm font-medium text-gray-400 pb-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {status.activeOperations.map((op, idx) => (
                  <tr key={idx} className="border-b border-white/5 last:border-0">
                    <td className="py-3 pr-4">
                      <span className="text-sm text-white font-medium">{op.action}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1">
                        {op.agents.map((agent, i) => {
                          const agentConfig = AGENTS.find(a => a.name.toLowerCase() === agent.toLowerCase())
                          return (
                            <div
                              key={i}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                              style={{ backgroundColor: agentConfig?.color || '#666' }}
                              title={agent}
                            >
                              {agent[0].toUpperCase()}
                            </div>
                          )
                        })}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-xs text-gray-400">
                        {op.emailId ? `Email ${op.emailId.substring(0, 8)}` : 
                         op.customerId ? `Customer ${op.customerId.substring(0, 8)}` :
                         op.orderId ? `Order ${op.orderId.substring(0, 8)}` :
                         op.quoteId ? `Quote ${op.quoteId.substring(0, 8)}` :
                         'Unknown'}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="text-xs text-gray-400">
                        {new Date(op.timestamp).toLocaleTimeString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-2 opacity-50" size={32} />
              <p className="text-sm">No active operations</p>
            </div>
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manual Agent Triggers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
        >
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Play className="text-blue-400" />
            Manual Triggers
          </h3>

          <div className="grid grid-cols-1 gap-2">
            {AGENTS.filter(a => a.id !== 'jarvis').map(agent => (
              <button
                key={agent.id}
                onClick={() => handleTriggerAgent(agent.id)}
                disabled={triggeringAgent === agent.id}
                className="flex items-center justify-between px-4 py-3 bg-[#252525] hover:bg-[#2a2a2a] border border-white/5 hover:border-white/10 rounded-xl transition-all disabled:opacity-50 group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: agent.color }}
                  >
                    {agent.name[0]}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">{agent.name}</p>
                    <p className="text-xs text-gray-400">{agent.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {triggeringAgent === agent.id ? (
                    <RefreshCw size={16} className="text-lime-400 animate-spin" />
                  ) : (
                    <Play size={16} className="text-gray-400 group-hover:text-lime-400 transition-colors" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Cron Schedules */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
        >
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Calendar className="text-indigo-400" />
            Scheduled Jobs
          </h3>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {schedules.map((schedule, idx) => (
              <div
                key={idx}
                className="bg-[#252525] border border-white/5 rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-white mb-1">{schedule.name}</h4>
                    <p className="text-xs text-gray-400">{schedule.description}</p>
                  </div>
                  <div className="flex items-center gap-1 text-lime-400 shrink-0 ml-3">
                    <Clock size={14} />
                    <span className="text-xs font-mono">{schedule.nextRun}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                  <code className="text-[10px] px-2 py-1 bg-white/5 rounded text-gray-400 font-mono">
                    {schedule.schedule}
                  </code>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
