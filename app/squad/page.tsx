'use client'

import { useState, useEffect } from 'react'
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
  Zap
} from 'lucide-react'

// Agent definitions with colors
const AGENTS = [
  { id: 'jarvis', name: 'Jarvis', role: 'Orchestrator', color: '#a855f7' },
  { id: 'mpho', name: 'Mpho', role: 'Orders', color: '#3b82f6' },
  { id: 'thandi', name: 'Thandi', role: 'Stock', color: '#22c55e' },
  { id: 'sizwe', name: 'Sizwe', role: 'Customer', color: '#f59e0b' },
  { id: 'naledi', name: 'Naledi', role: 'Comms', color: '#ec4899' },
  { id: 'lerato', name: 'Lerato', role: 'Content', color: '#14b8a6' },
  { id: 'vusi', name: 'Vusi', role: 'SEO', color: '#f43f5e' },
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

// Mock data for initial display
const MOCK_TASKS: Task[] = [
  { id: '1', title: 'Process pending orders from today', description: 'Review and confirm all new orders', status: 'in_progress', assigned_agent: 'mpho', priority: 'high', mentions_kenny: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', title: 'Stock audit for Sonos products', description: 'Verify inventory levels match Supabase', status: 'new', assigned_agent: 'thandi', priority: 'medium', mentions_kenny: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '3', title: 'Customer complaint - Delivery delay', description: 'Order #45892 - Customer escalated', status: 'new', assigned_agent: 'sizwe', priority: 'urgent', mentions_kenny: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '4', title: 'Write blog post about home automation', description: 'SEO-optimized content for blog', status: 'in_progress', assigned_agent: 'lerato', priority: 'low', mentions_kenny: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '5', title: 'Optimize product page meta descriptions', description: 'Improve SEO for top 50 products', status: 'completed', assigned_agent: 'vusi', priority: 'medium', mentions_kenny: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '6', title: 'Send newsletter to subscribers', description: 'February promo announcement', status: 'new', assigned_agent: 'naledi', priority: 'high', mentions_kenny: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
]

const MOCK_ACTIVITY: ActivityItem[] = [
  { id: '1', from_agent: 'jarvis', message: 'Assigned delivery complaint to Sizwe for immediate handling', created_at: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: '2', from_agent: 'mpho', to_agent: 'thandi', message: 'Need stock confirmation for order #45910 - 2x Sonos Era 300', task_id: '1', created_at: new Date(Date.now() - 15 * 60000).toISOString() },
  { id: '3', from_agent: 'thandi', to_agent: 'mpho', message: 'Confirmed - Stock available, proceed with order', created_at: new Date(Date.now() - 12 * 60000).toISOString() },
  { id: '4', from_agent: 'lerato', message: 'Draft blog post ready for review - "Top 5 Smart Home Speakers 2026"', task_id: '4', created_at: new Date(Date.now() - 30 * 60000).toISOString() },
  { id: '5', from_agent: 'vusi', message: 'Completed meta descriptions for 50 products - avg 15% improvement expected', task_id: '5', created_at: new Date(Date.now() - 45 * 60000).toISOString() },
  { id: '6', from_agent: 'sizwe', message: '@Kenny - Customer threatening chargeback on order #45892, need approval to offer 10% discount', created_at: new Date(Date.now() - 2 * 60000).toISOString() },
]

export default function MissionControl() {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS)
  const [activity, setActivity] = useState<ActivityItem[]>(MOCK_ACTIVITY)
  const [filterAgent, setFilterAgent] = useState<string>('all')
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [loading, setLoading] = useState(false)

  // Fetch real data
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/squad')
      if (res.ok) {
        const data = await res.json()
        if (data.tasks?.length) setTasks(data.tasks)
        if (data.activity?.length) setActivity(data.activity)
      }
    } catch (err) {
      console.log('Using mock data - API not connected yet')
    }
  }

  // Filter tasks (handle both lowercase id and capitalized name)
  const filteredTasks = filterAgent === 'all' 
    ? tasks 
    : tasks.filter(t => t.assigned_agent.toLowerCase() === filterAgent.toLowerCase())

  // Split into columns
  const newTasks = filteredTasks.filter(t => t.status === 'new')
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in_progress')
  const completedTasks = filteredTasks.filter(t => t.status === 'completed')

  // Mentions Kenny - urgent items
  const kennyMentions = tasks.filter(t => t.mentions_kenny && t.status !== 'completed')

  // Move task between columns
  const moveTask = async (taskId: string, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t
    ))
    // TODO: POST to API to persist
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
      >
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Users className="text-lime-400" />
            Mission Control
          </h2>
          <p className="text-gray-400 mt-1">Manage and coordinate your AI agent squad</p>
        </div>
        <div className="flex gap-3">
          {/* Agent Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <select 
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="bg-[#1c1c1c] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50 appearance-none cursor-pointer"
            >
              <option value="all">All Agents</option>
              {AGENTS.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
              ))}
            </select>
          </div>
          <button 
            onClick={() => setShowNewTaskModal(true)}
            className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black text-sm font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(163,230,53,0.3)] flex items-center gap-2"
          >
            <Plus size={18} />
            New Task
          </button>
        </div>
      </motion.div>

      {/* Mentions Kenny Section */}
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
                      <AgentAvatar agent={getAgent(task.assigned_agent)} size="sm" />
                      <span className="text-xs text-gray-400">{getAgent(task.assigned_agent).name}</span>
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Kanban Board - 3 columns */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* New Tasks Column */}
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
                agent={getAgent(task.assigned_agent)}
                priorityColor={getPriorityColor(task.priority)}
                timeAgo={formatTimeAgo(task.created_at)}
                onMoveLeft={null}
                onMoveRight={() => moveTask(task.id, 'in_progress')}
              />
            ))}
          </KanbanColumn>

          {/* In Progress Column */}
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
                agent={getAgent(task.assigned_agent)}
                priorityColor={getPriorityColor(task.priority)}
                timeAgo={formatTimeAgo(task.created_at)}
                onMoveLeft={() => moveTask(task.id, 'new')}
                onMoveRight={() => moveTask(task.id, 'completed')}
              />
            ))}
          </KanbanColumn>

          {/* Completed Column */}
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
                agent={getAgent(task.assigned_agent)}
                priorityColor={getPriorityColor(task.priority)}
                timeAgo={formatTimeAgo(task.updated_at)}
                onMoveLeft={() => moveTask(task.id, 'in_progress')}
                onMoveRight={null}
              />
            ))}
          </KanbanColumn>
        </div>

        {/* Activity Feed */}
        <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-4 h-fit max-h-[calc(100vh-300px)] overflow-hidden flex flex-col">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <MessageSquare className="text-purple-400" size={18} />
            Agent Activity
          </h3>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {activity.map(item => {
              const fromAgent = getAgent(item.from_agent)
              const toAgent = item.to_agent ? getAgent(item.to_agent) : null
              return (
                <div key={item.id} className="relative pl-4 border-l-2 border-white/10">
                  <div className="absolute -left-[9px] top-0">
                    <AgentAvatar agent={fromAgent} size="sm" />
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <span className="font-medium" style={{ color: fromAgent.color }}>{fromAgent.name}</span>
                      {toAgent && (
                        <>
                          <ArrowRight size={12} />
                          <span className="font-medium" style={{ color: toAgent.color }}>{toAgent.name}</span>
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

      {/* New Task Modal */}
      <AnimatePresence>
        {showNewTaskModal && (
          <NewTaskModal 
            agents={AGENTS}
            onClose={() => setShowNewTaskModal(false)}
            onSubmit={async (task) => {
              // Add to local state optimistically
              const newTask: Task = {
                ...task,
                id: Date.now().toString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
              setTasks(prev => [newTask, ...prev])
              setShowNewTaskModal(false)
              
              // POST to API
              try {
                await fetch('/api/squad', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(task)
                })
              } catch (err) {
                console.log('API not connected - task saved locally')
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Agent Avatar Component
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

// Kanban Column Component
function KanbanColumn({ title, icon, count, color, children }: { 
  title: string
  icon: React.ReactNode
  count: number
  color: string
  children: React.ReactNode 
}) {
  return (
    <div className="bg-[#1c1c1c]/50 border border-white/5 rounded-2xl p-4 flex flex-col h-fit max-h-[calc(100vh-300px)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
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

// Task Card Component
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

// New Task Modal
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
    // Send capitalized name (e.g. 'Jarvis') not lowercase id (e.g. 'jarvis')
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
