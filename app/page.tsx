'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, Package, TrendingUp, Activity, CheckCircle2, Clock, AlertCircle, ArrowUpRight, Plus, CreditCard, Users, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import ChatWidget from './components/ChatWidget'

interface AgentStatus {
  name: string
  status: 'active' | 'idle' | 'offline'
  role: string
}

interface UrgentTask {
  id: string
  title: string
  priority: string
  assigned_agent: string
}

interface TokenBudget {
  total: number
  used: number
  remaining: number
  usagePercent: number
}

export default function Home() {
  const [metrics, setMetrics] = useState({
    emailsToday: 0,
    ordersActive: 0,
    pendingApprovals: 0,
    aiUptime: 99.9
  })

  const [agentStats, setAgentStats] = useState({
    active: 0,
    idle: 0,
    total: 0
  })

  const [urgentTasks, setUrgentTasks] = useState<UrgentTask[]>([])
  const [tokenBudget, setTokenBudget] = useState<TokenBudget | null>(null)

  useEffect(() => {
    // Animate counters
    const timer = setTimeout(() => {
      setMetrics({
        emailsToday: 24,
        ordersActive: 156,
        pendingApprovals: 7,
        aiUptime: 99.9
      })
    }, 100)

    // Fetch agent status and urgent tasks
    fetchMissionControlData()
    const interval = setInterval(fetchMissionControlData, 10000) // Update every 10s

    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [])

  const fetchMissionControlData = async () => {
    try {
      // Fetch agent statistics and tasks
      const squadRes = await fetch('/api/squad')
      if (squadRes.ok) {
        const data = await squadRes.json()
        
        // Calculate agent stats
        if (data.agents && data.agents.length > 0) {
          const activeCount = data.agents.filter((a: AgentStatus) => a.status === 'active').length
          const idleCount = data.agents.filter((a: AgentStatus) => a.status === 'idle').length
          setAgentStats({
            active: activeCount,
            idle: idleCount,
            total: data.agents.length
          })
        }

        // Get urgent tasks that mention Kenny
        if (data.tasks && data.tasks.length > 0) {
          const urgent = data.tasks
            .filter((t: UrgentTask) => t.priority === 'urgent' || (t as any).mentions_kenny)
            .slice(0, 3) // Top 3 urgent items
          setUrgentTasks(urgent)
        }

        // Get orchestrator health for token budget
        if (data.orchestratorHealth?.tokenBudget) {
          setTokenBudget(data.orchestratorHealth.tokenBudget)
        }
      }

      // Also try to fetch orchestrator status directly
      const orchRes = await fetch('/api/squad?action=orchestrator-status')
      if (orchRes.ok) {
        const orchData = await orchRes.json()
        if (orchData.tokenBudget) {
          const used = orchData.tokenBudget.used
          const total = orchData.tokenBudget.total
          const remaining = orchData.tokenBudget.remaining
          const usagePercent = (used / total) * 100

          setTokenBudget({
            total,
            used,
            remaining,
            usagePercent
          })
        }
      }
    } catch (err) {
      console.log('Mission Control data not available:', err)
    }
  }

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'from-red-500 to-red-600'
    if (percent >= 75) return 'from-orange-500 to-orange-600'
    if (percent >= 50) return 'from-yellow-500 to-yellow-600'
    return 'from-lime-400 to-green-500'
  }

  return (
    <div className="space-y-8">
      {/* Welcome & Credit Card Section (Imitating the reference layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Welcome Content */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between"
          >
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white">Good Afternoon, Admin!</h2>
              <p className="text-gray-400 mt-1">Here is what's happening with your operations today.</p>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-[#1c1c1c] hover:bg-[#2c2c2c] text-white text-sm font-medium rounded-xl border border-white/5 transition-colors">
                Manage Widgets
              </button>
              <button className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black text-sm font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(163,230,53,0.3)]">
                + Add Widget
              </button>
            </div>
          </motion.div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              label="Pending Emails"
              value={metrics.pendingApprovals}
              subtext="+15% from yesterday"
              icon={Mail}
              trend="up"
            />
            <StatCard
              label="Active Orders"
              value={metrics.ordersActive}
              subtext="Processing normally"
              icon={Package}
              trend="neutral"
            />
            <StatCard
              label="System Health"
              value="99.9%"
              subtext="AI Agents Operational"
              icon={Activity}
              trend="up"
              accent
            />
          </div>

          {/* Mission Control CTA Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Link 
              href="/squad" 
              className="group relative block bg-gradient-to-br from-purple-500/10 via-lime-400/10 to-blue-500/10 border border-lime-500/30 rounded-2xl p-6 hover:border-lime-400 transition-all overflow-hidden"
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-lime-400/0 via-lime-400/5 to-lime-400/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-lime-400 flex items-center justify-center shadow-[0_0_20px_rgba(163,230,53,0.3)]">
                      <Users size={24} className="text-black" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        Mission Control
                        <ArrowUpRight size={18} className="text-lime-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                      </h3>
                      <p className="text-sm text-gray-400">Manage your AI agent squad</p>
                    </div>
                  </div>
                </div>

                {/* Live Agent Status Preview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-[#1c1c1c]/50 backdrop-blur-sm border border-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-lime-400 animate-pulse" />
                      <div>
                        <p className="text-2xl font-bold text-white">{agentStats.active}</p>
                        <p className="text-xs text-gray-400">Active Agents</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-[#1c1c1c]/50 backdrop-blur-sm border border-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-gray-500" />
                      <div>
                        <p className="text-2xl font-bold text-white">{agentStats.idle}</p>
                        <p className="text-xs text-gray-400">Idle Agents</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#1c1c1c]/50 backdrop-blur-sm border border-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <Activity size={20} className="text-purple-400" />
                      <div>
                        <p className="text-2xl font-bold text-white">{agentStats.total}</p>
                        <p className="text-xs text-gray-400">Total Agents</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Token Budget Gauge */}
                {tokenBudget && (
                  <div className="bg-[#1c1c1c]/50 backdrop-blur-sm border border-white/5 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-400">Token Budget</span>
                      <span className="text-sm text-white font-medium">
                        {tokenBudget.used.toLocaleString()} / {tokenBudget.total.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${tokenBudget.usagePercent}%` }}
                        transition={{ duration: 0.5 }}
                        className={`h-full bg-gradient-to-r ${getUsageColor(tokenBudget.usagePercent)}`}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-400">
                        {tokenBudget.usagePercent.toFixed(1)}% used
                      </span>
                      <span className="text-xs text-gray-400">
                        {tokenBudget.remaining.toLocaleString()} remaining
                      </span>
                    </div>
                  </div>
                )}

                {/* Urgent Items */}
                {urgentTasks.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="text-red-400 animate-pulse" size={16} />
                      <h4 className="text-sm font-semibold text-red-400">
                        {urgentTasks.length} Urgent Item{urgentTasks.length !== 1 ? 's' : ''} Need Your Attention
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {urgentTasks.map((task) => (
                        <div 
                          key={task.id}
                          className="flex items-center gap-2 text-sm text-white bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                        >
                          <Zap size={14} className="text-red-400 shrink-0" />
                          <span className="flex-1 truncate">{task.title}</span>
                          <span className="text-xs text-gray-400 shrink-0">
                            {task.assigned_agent}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-center">
                  <div className="px-4 py-2 bg-lime-400/20 text-lime-400 text-sm font-semibold rounded-xl border border-lime-400/30 group-hover:bg-lime-400 group-hover:text-black transition-all">
                    Open Mission Control →
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Activity Graph Replaced by Ask Kait Chat */}
          <ChatWidget />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LinkCard
              title="Email Queue"
              desc="Manage customer inquiries"
              href="/emails"
              icon={Mail}
            />
            <LinkCard
              title="Product Catalog"
              desc="Manage stock and prices"
              href="/products"
              icon={Package}
            />
          </div>
        </div>

        {/* Right Column: "Card" Style Widgets */}
        <div className="space-y-6">
          {/* Agent Status Block */}
          <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-white">Agent Status</h3>
              <Activity size={18} className="text-lime-400" />
            </div>
            <div className="space-y-4">
              <AgentRow name="Email Agent" status="active" />
              <AgentRow name="Orders Agent" status="active" />
              <AgentRow name="Stock Agent" status="idle" />
              <AgentRow name="CS Agent" status="idle" />
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-gray-400">Daily Token Limit</span>
                <span className="text-white font-medium">$12.40 / $20.00</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full w-[62%] bg-gradient-to-r from-lime-400 to-emerald-400"></div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="p-3 bg-white/5 hover:bg-white/10 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors border border-white/5 text-sm font-medium text-gray-300 hover:text-white hover:border-lime-500/30">
                <Plus size={20} className="text-lime-400" />
                New Product
              </button>
              <button className="p-3 bg-white/5 hover:bg-white/10 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors border border-white/5 text-sm font-medium text-gray-300 hover:text-white hover:border-lime-500/30">
                <ArrowUpRight size={20} className="text-lime-400" />
                Sync Stock
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, subtext, icon: Icon, trend, accent }: any) {
  return (
    <div className={`p-6 rounded-2xl border ${accent ? 'bg-gradient-to-br from-[#1c1c1c] to-[#252525] border-lime-500/20' : 'bg-[#1c1c1c] border-white/5'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${accent ? 'bg-lime-400 text-black' : 'bg-white/5 text-gray-400'}`}>
          <Icon size={20} />
        </div>
        {trend === 'up' && (
          <span className="text-xs font-medium text-lime-400 bg-lime-400/10 px-2 py-1 rounded-full flex items-center gap-1">
            <TrendingUp size={12} /> +12%
          </span>
        )}
      </div>
      <p className="text-gray-400 text-sm">{label}</p>
      <h3 className="text-2xl font-bold text-white mt-1">{value}</h3>
      <p className="text-xs text-gray-500 mt-2">{subtext}</p>
    </div>
  )
}

function LinkCard({ title, desc, href, icon: Icon }: any) {
  return (
    <Link href={href} className="group p-6 bg-[#1c1c1c] border border-white/5 rounded-2xl hover:bg-[#252525] transition-all flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-lime-400/20 group-hover:text-lime-400 transition-colors">
          <Icon size={20} />
        </div>
        <div>
          <h4 className="font-semibold text-white group-hover:text-lime-400 transition-colors">{title}</h4>
          <p className="text-sm text-gray-400">{desc}</p>
        </div>
      </div>
      <ArrowUpRight size={18} className="text-gray-600 group-hover:text-lime-400 transition-colors" />
    </Link>
  )
}

function AgentRow({ name, status }: any) {
  const isIdle = status === 'idle'
  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${isIdle ? 'bg-gray-500' : 'bg-lime-400 animate-pulse'}`}></div>
        <span className="text-sm font-medium text-white">{name}</span>
      </div>
      <span className={`text-xs px-2 py-1 rounded-md ${isIdle ? 'bg-gray-800 text-gray-400' : 'bg-lime-400/10 text-lime-400'}`}>
        {status}
      </span>
    </div>
  )
}
