'use client'

import { useEffect, useState } from 'react'
import { Activity, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'

interface HealthData {
  summary: {
    totalAgents: number
    activeAgents: number
    idleAgents: number
    offlineAgents: number
    uptime: string
    errorCount24h: number
    errorRate: string
  }
  agents: Array<{
    name: string
    role: string
    status: string
    healthStatus: string
    errorCount24h: number
  }>
  recentErrors: Array<{
    agentName: string
    level: string
    message: string
    timestamp: string
  }>
}

export default function SystemHealthWidget() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [endpointAvailable, setEndpointAvailable] = useState(true)

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(() => {
      if (endpointAvailable) {
        fetchHealth()
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [endpointAvailable])

  async function fetchHealth() {
    try {
      const response = await fetch('/api/agents/health')
      if (response.ok) {
        const data = await response.json()
        setHealth(data)
      } else if (response.status === 404) {
        // Endpoint not implemented yet - stop polling and hide widget
        setEndpointAvailable(false)
        setLoading(false)
        return
      }
    } catch (error) {
      // Silently handle network errors - health endpoint is optional
      setEndpointAvailable(false)
    } finally {
      setLoading(false)
    }
  }

  // Don't render if endpoint is not available
  if (!endpointAvailable && !loading) {
    return null
  }

  if (loading) {
    return (
      <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-white/10 rounded w-1/2 mb-4"></div>
          <div className="h-20 bg-white/10 rounded"></div>
        </div>
      </div>
    )
  }

  if (!health) {
    return null
  }

  const uptimeValue = parseFloat(health.summary.uptime)
  const errorRateValue = parseFloat(health.summary.errorRate)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-[#1c1c1c] to-[#252525] border border-lime-500/20 rounded-2xl p-6"
    >
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-white">System Health</h3>
        <Activity size={18} className="text-lime-400" />
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">24h Uptime</span>
            <span className="text-xl font-bold text-white">{health.summary.uptime}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${uptimeValue}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className={`h-full ${
                uptimeValue >= 95 
                  ? 'bg-gradient-to-r from-lime-400 to-emerald-400'
                  : uptimeValue >= 80
                  ? 'bg-gradient-to-r from-yellow-400 to-orange-400'
                  : 'bg-gradient-to-r from-red-400 to-red-600'
              }`}
            ></motion.div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={16} className="text-lime-400" />
              <span className="text-xs text-gray-400">Active</span>
            </div>
            <span className="text-2xl font-bold text-white">{health.summary.activeAgents}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <XCircle size={16} className="text-gray-400" />
              <span className="text-xs text-gray-400">Idle</span>
            </div>
            <span className="text-2xl font-bold text-white">{health.summary.idleAgents}</span>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">Error Rate (24h)</span>
            <span className={`text-sm font-semibold ${
              errorRateValue < 5 ? 'text-lime-400' : errorRateValue < 15 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {health.summary.errorRate}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {health.summary.errorCount24h} errors / {health.summary.errorCount24h + health.summary.activeAgents} events
          </div>
        </div>

        {health.recentErrors.length > 0 && (
          <div className="pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={14} className="text-red-400" />
              <span className="text-xs font-semibold text-gray-400">Recent Errors</span>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {health.recentErrors.slice(0, 3).map((error, idx) => (
                <div key={idx} className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-medium text-red-400">{error.agentName}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(error.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 truncate">{error.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
