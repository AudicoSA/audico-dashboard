'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Users, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Plus,
  Filter,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  Zap,
  Play,
  DollarSign,
  TrendingUp,
  Activity,
  BarChart3,
  Target,
  AlertCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import VisualContentPanel from './components/VisualContentPanel'
import ApprovalQueue from './components/ApprovalQueue'
import SupplierIntelligencePanel from './components/SupplierIntelligencePanel'
import QuoteAutomationPanel from './components/QuoteAutomationPanel'

const AGENTS = [
  { id: 'jarvis', name: 'Jarvis', role: 'Master Orchestrator (Claude AI)', color: '#a855f7' },
  { id: 'email-agent', name: 'Email Agent', role: 'Email Management', color: '#3b82f6' },
  { id: 'social-media-agent', name: 'Social Media Agent', role: 'Social Media & Content', color: '#ec4899' },
  { id: 'google-ads-agent', name: 'Google Ads Agent', role: 'Advertising & PPC', color: '#f59e0b' },
  { id: 'seo-agent', name: 'SEO Agent', role: 'SEO & Product Optimization', color: '#22c55e' },
  { id: 'marketing-agent', name: 'Marketing Agent', role: 'Marketing & Resellers', color: '#14b8a6' },
  { id: 'supplier', name: 'Supplier Intel', role: 'Intelligence', color: '#06b6d4' },
]

type TaskStatus = 'new' | 'in_progress' | 'completed'
type Priority = 'low' | 'medium' | 'high' | 'urgent'

interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  assigned_agent: string
  priority: Priority
  mentions_kenny: boolean
  deliverable_url?: string
  created_at: string
  updated_at: string
}

interface ActivityItem {
  id: string
  from_agent: string
  to_agent?: string
  message: string
  task_id?: string
  created_at: string
}

interface AgentMetrics {
  agent: string
  tasks_total: number
  tasks_new: number
  tasks_in_progress: number
  tasks_completed: number
  completion_rate: number
  avg_completion_time: number
  cost_total: number
  status: 'active' | 'idle' | 'offline'
  last_active: string
}

const MOCK_TASKS: Task[] = [
  { id: '1', title: 'Process pending orders from today', description: 'Review and confirm all new orders', status: 'in_progress', assigned_agent: 'Mpho', priority: 'high', mentions_kenny: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', title: 'Stock audit for Sonos products', description: 'Verify inventory levels match Supabase', status: 'new', assigned_agent: 'Thandi', priority: 'medium', mentions_kenny: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '3', title: 'Customer complaint - Delivery delay', description: 'Order #45892 - Customer escalated', status: 'new', assigned_agent: 'Sizwe', priority: 'urgent', mentions_kenny: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '4', title: 'Write blog post about home automation', description: 'SEO-optimized content for blog', status: 'in_progress', assigned_agent: 'Lerato', priority: 'low', mentions_kenny: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '5', title: 'Optimize product page meta descriptions', description: 'Improve SEO for top 50 products', status: 'completed', assigned_agent: 'Vusi', priority: 'medium', mentions_kenny: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '6', title: 'Send newsletter to subscribers', description: 'February promo announcement', status: 'new', assigned_agent: 'Naledi', priority: 'high', mentions_kenny: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
]

const MOCK_ACTIVITY: ActivityItem[] = [
  { id: '1', from_agent: 'Jarvis', message: 'Assigned delivery complaint to Sizwe for immediate handling', created_at: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: '2', from_agent: 'Mpho', to_agent: 'Thandi', message: 'Need stock confirmation for order #45910 - 2x Sonos Era 300', task_id: '1', created_at: new Date(Date.now() - 15 * 60000).toISOString() },
  { id: '3', from_agent: 'Thandi', to_agent: 'Mpho', message: 'Confirmed - Stock available, proceed with order', created_at: new Date(Date.now() - 12 * 60000).toISOString() },
  { id: '4', from_agent: 'Lerato', message: 'Draft blog post ready for review - "Top 5 Smart Home Speakers 2026"', task_id: '4', created_at: new Date(Date.now() - 30 * 60000).toISOString() },
  { id: '5', from_agent: 'Vusi', message: 'Completed meta descriptions for 50 products - avg 15% improvement expected', task_id: '5', created_at: new Date(Date.now() - 45 * 60000).toISOString() },
  { id: '6', from_agent: 'Sizwe', message: '@Kenny - Customer threatening chargeback on order #45892, need approval to offer 10% discount', created_at: new Date(Date.now() - 2 * 60000).toISOString() },
]

export default function MissionControl() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [activeTab, setActiveTab] = useState<string>('all')
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [filterKennyMentions, setFilterKennyMentions] = useState(false)
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all')
  const [agentStatuses, setAgentStatuses] = useState<Record<string, any>>({})
  const [triggeringAgent, setTriggeringAgent] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
    setupRealtimeSubscriptions()
  }, [])

  const fetchData = async () => {
    try {
      const [tasksRes, messagesRes, agentsRes] = await Promise.all([
        supabase.from('squad_tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('squad_messages').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('squad_agents').select('*')
      ])

      if (tasksRes.data) {
        setTasks(tasksRes.data)
      }

      if (messagesRes.data) {
        setActivity(messagesRes.data)
      }

      if (agentsRes.data) {
        const statusMap = agentsRes.data.reduce((acc, agent) => {
          acc[agent.name] = agent
          return acc
        }, {} as Record<string, any>)
        setAgentStatuses(statusMap)
      }
    } catch (err) {
      console.log('Using mock data - DB not connected')
    }
  }

  const setupRealtimeSubscriptions = () => {
    const tasksSubscription = supabase
      .channel('squad_tasks_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'squad_tasks' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTasks(prev => [payload.new as Task, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setTasks(prev => prev.map(t => t.id === payload.new.id ? payload.new as Task : t))
          } else if (payload.eventType === 'DELETE') {
            setTasks(prev => prev.filter(t => t.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    const messagesSubscription = supabase
      .channel('squad_messages_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'squad_messages' },
        (payload) => {
          setActivity(prev => [payload.new as ActivityItem, ...prev])
        }
      )
      .subscribe()

    const agentsSubscription = supabase
      .channel('squad_agents_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'squad_agents' },
        (payload) => {
          setAgentStatuses(prev => ({
            ...prev,
            [payload.new.name]: payload.new
          }))
        }
      )
      .subscribe()

    return () => {
      tasksSubscription.unsubscribe()
      messagesSubscription.unsubscribe()
      agentsSubscription.unsubscribe()
    }
  }

  const agentMetrics = useMemo(() => {
    const metrics: Record<string, AgentMetrics> = {}
    
    AGENTS.forEach(agent => {
      const agentTasks = tasks.filter(t => 
        t.assigned_agent.toLowerCase() === agent.name.toLowerCase()
      )
      
      const completedTasks = agentTasks.filter(t => t.status === 'completed')
      const avgCompletionTime = completedTasks.length > 0
        ? completedTasks.reduce((acc, task) => {
            const created = new Date(task.created_at).getTime()
            const updated = new Date(task.updated_at).getTime()
            return acc + (updated - created)
          }, 0) / completedTasks.length / 3600000
        : 0

      const estimatedCostPerTask = 0.15
      const costTotal = agentTasks.length * estimatedCostPerTask

      const agentStatus = agentStatuses[agent.name]

      metrics[agent.id] = {
        agent: agent.name,
        tasks_total: agentTasks.length,
        tasks_new: agentTasks.filter(t => t.status === 'new').length,
        tasks_in_progress: agentTasks.filter(t => t.status === 'in_progress').length,
        tasks_completed: completedTasks.length,
        completion_rate: agentTasks.length > 0 ? (completedTasks.length / agentTasks.length) * 100 : 0,
        avg_completion_time: avgCompletionTime,
        cost_total: costTotal,
        status: agentStatus?.status || 'idle',
        last_active: agentStatus?.last_active || new Date().toISOString()
      }
    })
    
    return metrics
  }, [tasks, agentStatuses])

  const filteredTasks = useMemo(() => {
    let filtered = tasks

    if (activeTab !== 'all') {
      const agent = AGENTS.find(a => a.id === activeTab)
      if (agent) {
        filtered = filtered.filter(t => 
          t.assigned_agent.toLowerCase() === agent.name.toLowerCase()
        )
      }
    }

    if (filterKennyMentions) {
      filtered = filtered.filter(t => t.mentions_kenny)
    }

    if (filterPriority !== 'all') {
      filtered = filtered.filter(t => t.priority === filterPriority)
    }

    return filtered
  }, [tasks, activeTab, filterKennyMentions, filterPriority])

  const newTasks = filteredTasks.filter(t => t.status === 'new')
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in_progress')
  const completedTasks = filteredTasks.filter(t => t.status === 'completed')

  const kennyMentions = tasks.filter(t => t.mentions_kenny && !['completed', 'rejected', 'failed'].includes(t.status))

  const moveTask = async (taskId: string, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t
    ))

    try {
      await supabase
        .from('squad_tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', taskId)

      await supabase
        .from('squad_messages')
        .insert({
          from_agent: 'System',
          message: `Task status updated to ${newStatus}`,
          task_id: taskId
        })
    } catch (err) {
      console.log('Failed to update task in DB')
    }
  }

  const triggerAgent = async (agentId: string) => {
    setTriggeringAgent(agentId)
    const agent = AGENTS.find(a => a.id === agentId)
    
    try {
      await supabase
        .from('squad_agents')
        .update({ 
          status: 'active',
          last_active: new Date().toISOString()
        })
        .eq('name', agent?.name)

      await supabase
        .from('squad_messages')
        .insert({
          from_agent: 'System',
          message: `Manual trigger: ${agent?.name} activated by user`,
          to_agent: agent?.name
        })

      setTimeout(() => setTriggeringAgent(null), 2000)
    } catch (err) {
      console.log('Failed to trigger agent')
      setTriggeringAgent(null)
    }
  }

  const getAgent = (id: string) => AGENTS.find(a => a.id === id) || AGENTS[0]

  const getPriorityColor = (priority: Priority) => {
    switch(priority) {
      case 'urgent': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'low': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const totalCost = Object.values(agentMetrics).reduce((sum, m) => sum + m.cost_total, 0)

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Users className="text-lime-400" />
              Mission Control
            </h2>
            <p className="text-gray-400 mt-1">Manage and coordinate your AI agent squad</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button 
              onClick={() => setShowNewTaskModal(true)}
              className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black text-sm font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(163,230,53,0.3)] flex items-center gap-2"
            >
              <Plus size={18} />
              New Task
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            icon={<Target className="text-blue-400" />}
            label="Total Tasks"
            value={tasks.length.toString()}
            trend="+12%"
          />
          <MetricCard
            icon={<TrendingUp className="text-green-400" />}
            label="Completion Rate"
            value={`${Math.round((completedTasks.length / Math.max(tasks.length, 1)) * 100)}%`}
            trend="+5%"
          />
          <MetricCard
            icon={<DollarSign className="text-yellow-400" />}
            label="Total Cost"
            value={`$${totalCost.toFixed(2)}`}
            trend="-8%"
          />
          <MetricCard
            icon={<AlertCircle className="text-red-400" />}
            label="Kenny Mentions"
            value={kennyMentions.length.toString()}
            trend={kennyMentions.length > 0 ? 'Urgent' : 'None'}
            trendColor={kennyMentions.length > 0 ? 'text-red-400' : 'text-gray-500'}
          />
        </div>
      </motion.div>

      {kennyMentions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-2xl p-4"
        >
          <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2 mb-3">
            <AlertTriangle className="animate-pulse" size={20} />
            Needs Your Attention ({kennyMentions.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {kennyMentions.map(task => (
              <div key={task.id} className="bg-[#1c1c1c] border border-red-500/30 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{task.title}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <AgentAvatar agent={getAgent(task.assigned_agent.toLowerCase())} size="sm" />
                      <span className="text-xs text-gray-400">{task.assigned_agent}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-md border ${getPriorityColor(task.priority)}`}>
                    {task.priority.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Approval Queue - Phase 1 & 2 */}
      <ApprovalQueue />

      <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl overflow-hidden">
        <div className="border-b border-white/5 p-1 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-lime-400 text-black'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            All Agents
          </button>
          {AGENTS.map(agent => {
            const metrics = agentMetrics[agent.id]
            return (
              <button
                key={agent.id}
                onClick={() => setActiveTab(agent.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === agent.id
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: agent.color }}
                />
                {agent.name}
                {metrics && metrics.tasks_total > 0 && (
                  <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded">
                    {metrics.tasks_total}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="p-4">
          {activeTab === 'all' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setFilterKennyMentions(!filterKennyMentions)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    filterKennyMentions
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'
                  }`}
                >
                  <AlertTriangle size={14} />
                  Kenny Mentions Only
                </button>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value as Priority | 'all')}
                  className="bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-lime-500/50"
                >
                  <option value="all">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KanbanColumn 
                  title="New Tasks" 
                  icon={<Clock className="text-blue-400" size={18} />}
                  count={newTasks.length}
                  color="blue"
                >
                  {newTasks.map(task => (
                    <TaskCard 
                      key={task.id}
                      task={task}
                      agent={getAgent(task.assigned_agent.toLowerCase())}
                      priorityColor={getPriorityColor(task.priority)}
                      timeAgo={formatTimeAgo(task.created_at)}
                      onMoveLeft={null}
                      onMoveRight={() => moveTask(task.id, 'in_progress')}
                    />
                  ))}
                </KanbanColumn>

                <KanbanColumn 
                  title="In Progress" 
                  icon={<Zap className="text-yellow-400" size={18} />}
                  count={inProgressTasks.length}
                  color="yellow"
                >
                  {inProgressTasks.map(task => (
                    <TaskCard 
                      key={task.id}
                      task={task}
                      agent={getAgent(task.assigned_agent.toLowerCase())}
                      priorityColor={getPriorityColor(task.priority)}
                      timeAgo={formatTimeAgo(task.created_at)}
                      onMoveLeft={() => moveTask(task.id, 'new')}
                      onMoveRight={() => moveTask(task.id, 'completed')}
                    />
                  ))}
                </KanbanColumn>

                <KanbanColumn 
                  title="Completed" 
                  icon={<CheckCircle2 className="text-lime-400" size={18} />}
                  count={completedTasks.length}
                  color="lime"
                >
                  {completedTasks.map(task => (
                    <TaskCard 
                      key={task.id}
                      task={task}
                      agent={getAgent(task.assigned_agent.toLowerCase())}
                      priorityColor={getPriorityColor(task.priority)}
                      timeAgo={formatTimeAgo(task.updated_at)}
                      onMoveLeft={() => moveTask(task.id, 'in_progress')}
                      onMoveRight={null}
                    />
                  ))}
                </KanbanColumn>
              </div>
            </div>
          ) : (
            <AgentDetailView
              agent={AGENTS.find(a => a.id === activeTab)!}
              metrics={agentMetrics[activeTab]}
              tasks={filteredTasks}
              onMoveTask={moveTask}
              onTriggerAgent={triggerAgent}
              isTriggering={triggeringAgent === activeTab}
              getPriorityColor={getPriorityColor}
              formatTimeAgo={formatTimeAgo}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#1c1c1c] border border-white/5 rounded-2xl p-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <BarChart3 className="text-purple-400" size={18} />
            Agent Performance
          </h3>
          <div className="space-y-3">
            {AGENTS.map(agent => {
              const metrics = agentMetrics[agent.id]
              return (
                <div key={agent.id} className="bg-[#252525] border border-white/5 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <AgentAvatar agent={agent} size="md" />
                      <div>
                        <p className="text-sm font-medium text-white">{agent.name}</p>
                        <p className="text-xs text-gray-500">{agent.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-right">
                        <p className="text-gray-500">Tasks</p>
                        <p className="text-white font-medium">{metrics.tasks_total}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500">Complete</p>
                        <p className="text-lime-400 font-medium">{Math.round(metrics.completion_rate)}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500">Cost</p>
                        <p className="text-yellow-400 font-medium">${metrics.cost_total.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${metrics.completion_rate}%`,
                        backgroundColor: agent.color
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-4 h-fit max-h-[600px] overflow-hidden flex flex-col">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <MessageSquare className="text-purple-400" size={18} />
            Live Activity Feed
          </h3>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {activity.map(item => {
              const fromAgent = AGENTS.find(a => a.name.toLowerCase() === item.from_agent.toLowerCase())
              const toAgent = item.to_agent 
                ? AGENTS.find(a => a.name.toLowerCase() === item.to_agent?.toLowerCase())
                : null
              
              return (
                <div key={item.id} className="relative pl-4 border-l-2 border-white/10">
                  <div className="absolute -left-[9px] top-0">
                    {fromAgent ? (
                      <AgentAvatar agent={fromAgent} size="sm" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-500 flex items-center justify-center text-[10px] text-white">
                        S
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <span className="font-medium" style={{ color: fromAgent?.color || '#999' }}>
                        {item.from_agent}
                      </span>
                      {toAgent && (
                        <>
                          <ArrowRight size={12} />
                          <span className="font-medium" style={{ color: toAgent.color }}>
                            {toAgent.name}
                          </span>
                        </>
                      )}
                      <span>• {formatTimeAgo(item.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-300">{item.message}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showNewTaskModal && (
          <NewTaskModal 
            agents={AGENTS}
            onClose={() => setShowNewTaskModal(false)}
            onSubmit={async (task) => {
              const newTask: Task = {
                ...task,
                id: Date.now().toString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
              setTasks(prev => [newTask, ...prev])
              setShowNewTaskModal(false)
              
              try {
                await supabase.from('squad_tasks').insert(task)
                await supabase.from('squad_messages').insert({
                  from_agent: 'System',
                  message: `New task created: "${task.title}" assigned to ${task.assigned_agent}`,
                })
              } catch (err) {
                console.log('Failed to save to DB')
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function MetricCard({ icon, label, value, trend, trendColor }: {
  icon: React.ReactNode
  label: string
  value: string
  trend: string
  trendColor?: string
}) {
  return (
    <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-gray-400">{icon}</div>
        <span className={`text-xs ${trendColor || 'text-lime-400'}`}>{trend}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  )
}

function AgentDetailView({ agent, metrics, tasks, onMoveTask, onTriggerAgent, isTriggering, getPriorityColor, formatTimeAgo }: {
  agent: typeof AGENTS[0]
  metrics: AgentMetrics
  tasks: Task[]
  onMoveTask: (taskId: string, status: TaskStatus) => void
  onTriggerAgent: (agentId: string) => void
  isTriggering: boolean
  getPriorityColor: (priority: Priority) => string
  formatTimeAgo: (date: string) => string
}) {
  const newTasks = tasks.filter(t => t.status === 'new')
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress')
  const completedTasks = tasks.filter(t => t.status === 'completed')

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white"
            style={{ backgroundColor: agent.color }}
          >
            {agent.name[0]}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">{agent.name}</h3>
            <p className="text-gray-400">{agent.role}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-2 h-2 rounded-full ${
                metrics.status === 'active' ? 'bg-lime-400' : 
                metrics.status === 'idle' ? 'bg-yellow-400' : 'bg-gray-500'
              }`} />
              <span className="text-xs text-gray-500">
                {metrics.status.charAt(0).toUpperCase() + metrics.status.slice(1)} • {formatTimeAgo(metrics.last_active)}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onTriggerAgent(agent.id)}
          disabled={isTriggering}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Play size={16} className={isTriggering ? 'animate-pulse' : ''} />
          {isTriggering ? 'Triggering...' : 'Trigger Agent'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#252525] border border-white/5 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Total Tasks</p>
          <p className="text-xl font-bold text-white">{metrics.tasks_total}</p>
        </div>
        <div className="bg-[#252525] border border-white/5 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Completed</p>
          <p className="text-xl font-bold text-lime-400">{metrics.tasks_completed}</p>
        </div>
        <div className="bg-[#252525] border border-white/5 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Success Rate</p>
          <p className="text-xl font-bold text-blue-400">{Math.round(metrics.completion_rate)}%</p>
        </div>
        <div className="bg-[#252525] border border-white/5 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Total Cost</p>
          <p className="text-xl font-bold text-yellow-400">${metrics.cost_total.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KanbanColumn 
          title="New" 
          icon={<Clock className="text-blue-400" size={16} />}
          count={newTasks.length}
          color="blue"
        >
          {newTasks.map(task => (
            <TaskCard 
              key={task.id}
              task={task}
              agent={agent}
              priorityColor={getPriorityColor(task.priority)}
              timeAgo={formatTimeAgo(task.created_at)}
              onMoveLeft={null}
              onMoveRight={() => onMoveTask(task.id, 'in_progress')}
            />
          ))}
        </KanbanColumn>

        <KanbanColumn 
          title="In Progress" 
          icon={<Zap className="text-yellow-400" size={16} />}
          count={inProgressTasks.length}
          color="yellow"
        >
          {inProgressTasks.map(task => (
            <TaskCard 
              key={task.id}
              task={task}
              agent={agent}
              priorityColor={getPriorityColor(task.priority)}
              timeAgo={formatTimeAgo(task.created_at)}
              onMoveLeft={() => onMoveTask(task.id, 'new')}
              onMoveRight={() => onMoveTask(task.id, 'completed')}
            />
          ))}
        </KanbanColumn>

        <KanbanColumn 
          title="Completed" 
          icon={<CheckCircle2 className="text-lime-400" size={16} />}
          count={completedTasks.length}
          color="lime"
        >
          {completedTasks.map(task => (
            <TaskCard 
              key={task.id}
              task={task}
              agent={agent}
              priorityColor={getPriorityColor(task.priority)}
              timeAgo={formatTimeAgo(task.updated_at)}
              onMoveLeft={() => onMoveTask(task.id, 'in_progress')}
              onMoveRight={null}
            />
          ))}
        </KanbanColumn>
      </div>

      {(agent.name === 'Naledi' || agent.name === 'Lerato') && (
        <div className="mt-6 bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
          <VisualContentPanel agentName={agent.name as 'Naledi' | 'Lerato'} />
        </div>
      )}

      {agent.name === 'Supplier Intel' && (
        <div className="mt-6 space-y-6">
          <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
            <SupplierIntelligencePanel />
          </div>
          <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
            <QuoteAutomationPanel />
          </div>
        </div>
      )}
    </div>
  )
}

function AgentAvatar({ agent, size = 'md' }: { agent: typeof AGENTS[0], size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-8 h-8 text-xs'
  return (
    <div 
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white`}
      style={{ backgroundColor: agent.color }}
      title={`${agent.name} (${agent.role})`}
    >
      {agent.name[0]}
    </div>
  )
}

function KanbanColumn({ title, icon, count, color, children }: { 
  title: string
  icon: React.ReactNode
  count: number
  color: string
  children: React.ReactNode 
}) {
  return (
    <div className="bg-[#1c1c1c]/50 border border-white/5 rounded-2xl p-4 flex flex-col h-fit max-h-[calc(100vh-400px)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          {icon}
          {title}
        </h3>
        <span className={`text-xs px-2 py-1 rounded-full bg-${color}-500/20 text-${color}-400`}>
          {count}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {children}
      </div>
    </div>
  )
}

function TaskCard({ task, agent, priorityColor, timeAgo, onMoveLeft, onMoveRight }: {
  task: Task
  agent: typeof AGENTS[0]
  priorityColor: string
  timeAgo: string
  onMoveLeft: (() => void) | null
  onMoveRight: (() => void) | null
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-[#252525] border border-white/5 rounded-xl p-3 hover:border-lime-500/30 transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-white leading-snug">{task.title}</p>
        {task.mentions_kenny && (
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
        )}
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AgentAvatar agent={agent} size="sm" />
          <span className="text-xs text-gray-400">{agent.name}</span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded border ${priorityColor}`}>
          {task.priority}
        </span>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
        <span className="text-[10px] text-gray-500">{timeAgo}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onMoveLeft && (
            <button 
              onClick={onMoveLeft}
              className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
              title="Move left"
            >
              <ArrowLeft size={14} />
            </button>
          )}
          {onMoveRight && (
            <button 
              onClick={onMoveRight}
              className="p-1 hover:bg-lime-500/20 rounded text-gray-400 hover:text-lime-400 transition-colors"
              title="Move right"
            >
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function NewTaskModal({ agents, onClose, onSubmit }: {
  agents: typeof AGENTS
  onClose: () => void
  onSubmit: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedAgent, setAssignedAgent] = useState('jarvis')
  const [priority, setPriority] = useState<Priority>('medium')
  const [mentionsKenny, setMentionsKenny] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const agent = agents.find(a => a.id === assignedAgent)
    onSubmit({
      title,
      description,
      status: 'new',
      assigned_agent: agent?.name || assignedAgent,
      priority,
      mentions_kenny: mentionsKenny,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#1c1c1c] border border-white/10 rounded-2xl p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-4">Create New Task</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50 resize-none"
              rows={3}
              placeholder="Additional details..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Assign to</label>
              <select
                value={assignedAgent}
                onChange={e => setAssignedAgent(e.target.value)}
                className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
              >
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Priority)}
                className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mentionsKenny"
              checked={mentionsKenny}
              onChange={e => setMentionsKenny(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-[#252525] text-lime-500 focus:ring-lime-500"
            />
            <label htmlFor="mentionsKenny" className="text-sm text-gray-400">
              Requires Kenny's attention
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-colors"
            >
              Create Task
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
