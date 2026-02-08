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
  Zap,
  Play,
  Square,
  TrendingUp,
  Mail,
  Twitter,
  BarChart3,
  Search,
  Megaphone,
  Calendar,
  Activity,
  DollarSign,
  Eye,
  MousePointer,
  FileText,
  Settings
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import OrchestratorPanel from './components/OrchestratorPanel'
import EmailAgentPanel from './components/EmailAgentPanel'
import SocialAgentPanel from './components/SocialAgentPanel'
import AdsAgentPanel from './components/AdsAgentPanel'
import SeoAgentPanel from './components/SeoAgentPanel'

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



interface SocialPost {
  id: string
  platform: string
  content: string
  status: string
  scheduled_for: string | null
  published_at: string | null
  engagement: {
    likes: number
    comments: number
    shares: number
  }
  created_at: string
}

interface AdCampaign {
  id: string
  name: string
  platform: string
  status: string
  budget_total: number | null
  budget_spent: number
  performance_metrics: {
    impressions: number
    clicks: number
    conversions: number
    ctr: number
    cpc: number
    roas: number
  }
  created_at: string
}

interface SeoAudit {
  id: string
  url: string
  audit_type: string
  status: string
  score: number | null
  issues_found: any[]
  recommendations: any[]
  created_at: string
}

interface ResellerApplication {
  id: string
  company_name: string
  contact_name: string
  contact_email: string
  status: string
  created_at: string
}

type TabType = 'overview' | 'orchestrator' | 'email' | 'social' | 'ads' | 'seo' | 'marketing'

// Mock data for initial display
const MOCK_TASKS: Task[] = [
  { id: '1', title: 'Process pending orders from today', description: 'Review and confirm all new orders', status: 'in_progress', assigned_agent: 'mpho', priority: 'high', mentions_kenny: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', title: 'Stock audit for Sonos products', description: 'Verify inventory levels match Supabase', status: 'new', assigned_agent: 'thandi', priority: 'medium', mentions_kenny: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '3', title: 'Customer complaint - Delivery delay', description: 'Order #45892 - Customer escalated', status: 'new', assigned_agent: 'sizwe', priority: 'urgent', mentions_kenny: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
]

const MOCK_ACTIVITY: ActivityItem[] = [
  { id: '1', from_agent: 'jarvis', message: 'Assigned delivery complaint to Sizwe for immediate handling', created_at: new Date(Date.now() - 5 * 60000).toISOString() },
]

export default function MissionControl() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS)
  const [activity, setActivity] = useState<ActivityItem[]>(MOCK_ACTIVITY)
  const [filterAgent, setFilterAgent] = useState<string>('all')
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([])
  const [adCampaigns, setAdCampaigns] = useState<AdCampaign[]>([])
  const [seoAudits, setSeoAudits] = useState<SeoAudit[]>([])
  const [resellerApps, setResellerApps] = useState<ResellerApplication[]>([])

  // Fetch initial data
  useEffect(() => {
    fetchData()
  }, [])

  // Real-time subscriptions for squad_messages, squad_tasks, and squad_agents
  useEffect(() => {
    const messagesChannel = supabase
      .channel('squad_messages_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'squad_messages' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setActivity(prev => [payload.new as ActivityItem, ...prev].slice(0, 50))
          }
        }
      )
      .subscribe()

    const tasksChannel = supabase
      .channel('squad_tasks_changes')
      .on('postgres_changes',
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

    const agentsChannel = supabase
      .channel('squad_agents_changes')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'squad_agents' },
        () => {
          // OrchestratorPanel handles its own status updates
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messagesChannel)
      supabase.removeChannel(tasksChannel)
      supabase.removeChannel(agentsChannel)
    }
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

  const fetchSocialPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('social_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setSocialPosts(data)
    } catch (err) {
      console.log('Could not fetch social posts')
    }
  }

  const fetchAdCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('ad_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setAdCampaigns(data)
    } catch (err) {
      console.log('Could not fetch ad campaigns')
    }
  }

  const fetchSeoAudits = async () => {
    try {
      const { data, error } = await supabase
        .from('seo_audits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setSeoAudits(data)
    } catch (err) {
      console.log('Could not fetch SEO audits')
    }
  }

  const fetchResellerApps = async () => {
    try {
      const { data, error } = await supabase
        .from('reseller_applications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setResellerApps(data)
    } catch (err) {
      console.log('Could not fetch reseller applications')
    }
  }

  useEffect(() => {
    if (activeTab === 'social') fetchSocialPosts()
    if (activeTab === 'ads') fetchAdCampaigns()
    if (activeTab === 'seo') fetchSeoAudits()
    if (activeTab === 'marketing') fetchResellerApps()
  }, [activeTab])

  // Filter tasks
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
    
    try {
      await fetch('/api/squad', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: newStatus })
      })
    } catch (err) {
      console.log('Failed to update task')
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

  const tabs = [
    { id: 'overview' as TabType, name: 'Overview', icon: Users },
    { id: 'orchestrator' as TabType, name: 'Orchestrator', icon: Settings },
    { id: 'email' as TabType, name: 'Email Agent', icon: Mail },
    { id: 'social' as TabType, name: 'Social Media', icon: Twitter },
    { id: 'ads' as TabType, name: 'Google Ads', icon: BarChart3 },
    { id: 'seo' as TabType, name: 'SEO', icon: Search },
    { id: 'marketing' as TabType, name: 'Marketing', icon: Megaphone },
  ]

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
        {activeTab === 'overview' && (
          <div className="flex gap-3">
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
        )}
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-lime-400 text-black'
                  : 'bg-[#1c1c1c] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              <Icon size={16} />
              {tab.name}
            </button>
          )
        })}
      </div>

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

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <OverviewTab
            newTasks={newTasks}
            inProgressTasks={inProgressTasks}
            completedTasks={completedTasks}
            activity={activity}
            moveTask={moveTask}
            getAgent={getAgent}
            getPriorityColor={getPriorityColor}
            formatTimeAgo={formatTimeAgo}
          />
        )}

        {activeTab === 'orchestrator' && (
          <motion.div
            key="orchestrator"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <OrchestratorPanel />
          </motion.div>
        )}

        {activeTab === 'email' && (
          <motion.div
            key="email"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <EmailAgentPanel />
          </motion.div>
        )}

        {activeTab === 'social' && (
          <motion.div
            key="social"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <SocialAgentPanel />
          </motion.div>
        )}

        {activeTab === 'ads' && (
          <motion.div
            key="ads"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <AdsAgentPanel />
          </motion.div>
        )}

        {activeTab === 'seo' && (
          <motion.div
            key="seo"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <SeoAgentPanel />
          </motion.div>
        )}

        {activeTab === 'marketing' && (
          <MarketingTab applications={resellerApps} formatTimeAgo={formatTimeAgo} />
        )}
      </AnimatePresence>

      {/* New Task Modal */}
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

// Overview Tab Component
function OverviewTab({ newTasks, inProgressTasks, completedTasks, activity, moveTask, getAgent, getPriorityColor, formatTimeAgo }: any) {
  return (
    <motion.div
      key="overview"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 lg:grid-cols-4 gap-6"
    >
      <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
        <KanbanColumn 
          title="New Tasks" 
          icon={<Clock className="text-blue-400" size={18} />}
          count={newTasks.length}
          color="blue"
        >
          {newTasks.map((task: Task) => (
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

        <KanbanColumn 
          title="In Progress" 
          icon={<Zap className="text-yellow-400" size={18} />}
          count={inProgressTasks.length}
          color="yellow"
        >
          {inProgressTasks.map((task: Task) => (
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

        <KanbanColumn 
          title="Completed" 
          icon={<CheckCircle2 className="text-lime-400" size={18} />}
          count={completedTasks.length}
          color="lime"
        >
          {completedTasks.map((task: Task) => (
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

      <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-4 h-fit max-h-[calc(100vh-300px)] overflow-hidden flex flex-col">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <MessageSquare className="text-purple-400" size={18} />
          Agent Activity
        </h3>
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {activity.map((item: ActivityItem) => {
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
    </motion.div>
  )
}

// Social Media Tab
function SocialMediaTab({ posts, formatTimeAgo }: { posts: SocialPost[], formatTimeAgo: (date: string) => string }) {
  return (
    <motion.div
      key="social"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Twitter className="text-blue-400" />
          Post Queue
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {posts.length > 0 ? posts.map((post) => (
            <div key={post.id} className="bg-[#252525] border border-white/5 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className={`text-xs px-2 py-1 rounded-md border ${
                  post.status === 'published' ? 'bg-lime-500/20 text-lime-400 border-lime-500/30' :
                  post.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                  'bg-gray-500/20 text-gray-400 border-gray-500/30'
                }`}>
                  {post.status}
                </span>
                <span className="text-xs text-gray-400 uppercase">{post.platform}</span>
              </div>
              <p className="text-sm text-white mb-3 line-clamp-3">{post.content}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400 pt-3 border-t border-white/5">
                <span className="flex items-center gap-1">
                  <Activity size={12} />
                  {post.engagement.likes}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare size={12} />
                  {post.engagement.comments}
                </span>
                <span className="ml-auto">{formatTimeAgo(post.created_at)}</span>
              </div>
            </div>
          )) : (
            <p className="text-gray-400 text-sm text-center py-8 col-span-2">No posts scheduled</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}





// Marketing Tab
function MarketingTab({ applications, formatTimeAgo }: { applications: ResellerApplication[], formatTimeAgo: (date: string) => string }) {
  return (
    <motion.div
      key="marketing"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Megaphone className="text-pink-400" />
          Reseller Applications
        </h3>
        <div className="space-y-3">
          {applications.length > 0 ? applications.map((app) => (
            <div key={app.id} className="bg-[#252525] border border-white/5 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{app.company_name}</p>
                  <p className="text-xs text-gray-400 mt-1">{app.contact_name} • {app.contact_email}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-md border ${
                  app.status === 'approved' ? 'bg-lime-500/20 text-lime-400 border-lime-500/30' :
                  app.status === 'under_review' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                  app.status === 'rejected' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                  'bg-gray-500/20 text-gray-400 border-gray-500/30'
                }`}>
                  {app.status}
                </span>
              </div>
              <div className="text-xs text-gray-400 pt-2 border-t border-white/5">
                {formatTimeAgo(app.created_at)}
              </div>
            </div>
          )) : (
            <p className="text-gray-400 text-sm text-center py-8">No applications submitted yet</p>
          )}
        </div>
      </div>
    </motion.div>
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
