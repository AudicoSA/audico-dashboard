'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare,
  ArrowRight,
  Filter,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Calendar,
  X
} from 'lucide-react'
import { supabase, SquadMessage } from '@/lib/supabase'

interface Agent {
  id: string
  name: string
  role: string
  color: string
}

interface Task {
  id: string
  title: string
  status: string
  priority: string
  mentions_kenny: boolean
}

interface ActivityMessage extends SquadMessage {
  task?: Task
}

const AGENTS: Agent[] = [
  { id: 'email-agent', name: 'Email Agent', role: 'Email Management', color: '#3b82f6' },
  { id: 'social-media-agent', name: 'Social Media Agent', role: 'Social Media & Content', color: '#ec4899' },
  { id: 'google-ads-agent', name: 'Google Ads Agent', role: 'Advertising & PPC', color: '#f59e0b' },
  { id: 'seo-agent', name: 'SEO Agent', role: 'SEO & Product Optimization', color: '#22c55e' },
  { id: 'marketing-agent', name: 'Marketing Agent', role: 'Marketing & Resellers', color: '#a855f7' },
]

type TimeRange = 'all' | '1h' | '24h' | '7d' | '30d'

interface ActivityFeedProps {
  maxHeight?: string
  showFilters?: boolean
}

export default function ActivityFeed({ 
  maxHeight = 'calc(100vh - 300px)', 
  showFilters = true 
}: ActivityFeedProps) {
  const [messages, setMessages] = useState<ActivityMessage[]>([])
  const [filteredMessages, setFilteredMessages] = useState<ActivityMessage[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [isLoading, setIsLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    fetchInitialMessages()
    setupRealtimeSubscription()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [messages, selectedAgent, timeRange])

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [filteredMessages])

  const fetchInitialMessages = async () => {
    try {
      setIsLoading(true)
      
      let query = supabase
        .from('squad_messages')
        .select('*, task:squad_tasks(*)')
        .order('created_at', { ascending: false })
        .limit(100)

      const { data, error } = await query

      if (error) throw error

      if (data) {
        setMessages(data as ActivityMessage[])
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('activity_feed_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'squad_messages'
        },
        async (payload) => {
          const newMessage = payload.new as SquadMessage

          if (newMessage.task_id) {
            const { data: task } = await supabase
              .from('squad_tasks')
              .select('*')
              .eq('id', newMessage.task_id)
              .single()

            setMessages(prev => [{
              ...newMessage,
              task: task || undefined
            }, ...prev].slice(0, 100))
          } else {
            setMessages(prev => [newMessage, ...prev].slice(0, 100))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const applyFilters = () => {
    let filtered = [...messages]

    if (selectedAgent !== 'all') {
      filtered = filtered.filter(
        m => m.from_agent.toLowerCase() === selectedAgent.toLowerCase() ||
             m.to_agent?.toLowerCase() === selectedAgent.toLowerCase()
      )
    }

    if (timeRange !== 'all') {
      const now = new Date()
      const cutoff = new Date()
      
      switch (timeRange) {
        case '1h':
          cutoff.setHours(now.getHours() - 1)
          break
        case '24h':
          cutoff.setDate(now.getDate() - 1)
          break
        case '7d':
          cutoff.setDate(now.getDate() - 7)
          break
        case '30d':
          cutoff.setDate(now.getDate() - 30)
          break
      }

      filtered = filtered.filter(m => new Date(m.created_at) >= cutoff)
    }

    setFilteredMessages(filtered)
  }

  const getAgent = (name: string): Agent => {
    return AGENTS.find(a => a.name.toLowerCase() === name.toLowerCase()) || AGENTS[0]
  }

  const formatTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime()
    const mins = Math.floor(diff / 60000)
    
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    
    return new Date(dateString).toLocaleDateString()
  }

  const isUrgentMessage = (message: ActivityMessage): boolean => {
    return (
      message.task?.priority === 'urgent' ||
      message.task?.mentions_kenny ||
      message.message.toLowerCase().includes('urgent') ||
      message.message.toLowerCase().includes('critical') ||
      message.message.toLowerCase().includes('escalated')
    )
  }

  const hasKennyMention = (message: ActivityMessage): boolean => {
    return (
      message.task?.mentions_kenny ||
      message.message.toLowerCase().includes('kenny') ||
      message.message.toLowerCase().includes('@kenny')
    )
  }

  const getPriorityIcon = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return <AlertTriangle size={12} className="text-red-400" />
      case 'high':
        return <Zap size={12} className="text-orange-400" />
      case 'completed':
        return <CheckCircle2 size={12} className="text-lime-400" />
      default:
        return null
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const isAtTop = target.scrollTop === 0
    setAutoScroll(isAtTop)
  }

  const clearFilters = () => {
    setSelectedAgent('all')
    setTimeRange('all')
  }

  const hasActiveFilters = selectedAgent !== 'all' || timeRange !== 'all'

  return (
    <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <MessageSquare className="text-purple-400" size={18} />
          Activity Feed
          {filteredMessages.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
              {filteredMessages.length}
            </span>
          )}
        </h3>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="bg-[#252525] border border-white/10 rounded-lg pl-9 pr-8 py-1.5 text-xs text-white focus:outline-none focus:border-lime-500/50 appearance-none cursor-pointer"
            >
              <option value="all">All Agents</option>
              {AGENTS.map(agent => (
                <option key={agent.id} value={agent.name}>{agent.name}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="bg-[#252525] border border-white/10 rounded-lg pl-9 pr-8 py-1.5 text-xs text-white focus:outline-none focus:border-lime-500/50 appearance-none cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors flex items-center gap-1"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-lime-400 border-t-transparent" />
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <MessageSquare className="mb-3 opacity-50" size={32} />
          <p className="text-sm">No activity yet</p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-2 text-xs text-lime-400 hover:text-lime-300"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto space-y-4 pr-2"
          style={{ maxHeight }}
        >
          <AnimatePresence initial={false}>
            {filteredMessages.map((message, index) => {
              const fromAgent = getAgent(message.from_agent)
              const toAgent = message.to_agent ? getAgent(message.to_agent) : null
              const isUrgent = isUrgentMessage(message)
              const mentionsKenny = hasKennyMention(message)

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  className={`relative pl-4 border-l-2 ${
                    isUrgent 
                      ? 'border-red-500/50' 
                      : mentionsKenny 
                      ? 'border-orange-500/50' 
                      : 'border-white/10'
                  }`}
                >
                  <div className="absolute -left-[9px] top-0">
                    <AgentAvatar agent={fromAgent} size="sm" />
                  </div>

                  <div className="ml-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1 flex-wrap">
                      <span
                        className="font-medium"
                        style={{ color: fromAgent.color }}
                      >
                        {fromAgent.name}
                      </span>
                      
                      {toAgent && (
                        <>
                          <ArrowRight size={12} />
                          <span
                            className="font-medium"
                            style={{ color: toAgent.color }}
                          >
                            {toAgent.name}
                          </span>
                        </>
                      )}

                      <span>•</span>
                      <span>{formatTimeAgo(message.created_at)}</span>

                      {message.task && (
                        <>
                          <span>•</span>
                          {getPriorityIcon(message.task.priority)}
                        </>
                      )}

                      {mentionsKenny && (
                        <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[10px] font-medium">
                          @Kenny
                        </span>
                      )}

                      {isUrgent && (
                        <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-medium animate-pulse">
                          URGENT
                        </span>
                      )}
                    </div>

                    <p className={`text-sm ${
                      isUrgent 
                        ? 'text-red-300 font-medium' 
                        : mentionsKenny 
                        ? 'text-orange-300' 
                        : 'text-gray-300'
                    }`}>
                      {message.message}
                    </p>

                    {message.task && (
                      <div className="mt-2 p-2 bg-white/5 rounded-lg border border-white/10">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white truncate">
                              {message.task.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                message.task.status === 'completed'
                                  ? 'bg-lime-500/20 text-lime-400 border-lime-500/30'
                                  : message.task.status === 'in_progress'
                                  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                  : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                              }`}>
                                {message.task.status.replace('_', ' ')}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                message.task.priority === 'urgent'
                                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                  : message.task.priority === 'high'
                                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                                  : message.task.priority === 'medium'
                                  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                  : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                              }`}>
                                {message.task.priority}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {!autoScroll && filteredMessages.length > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          onClick={() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = 0
              setAutoScroll(true)
            }
          }}
          className="mt-2 w-full px-3 py-2 bg-lime-400/10 hover:bg-lime-400/20 text-lime-400 text-xs font-medium rounded-lg transition-colors border border-lime-500/30"
        >
          New messages • Scroll to top
        </motion.button>
      )}
    </div>
  )
}

function AgentAvatar({ agent, size = 'md' }: { agent: Agent; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-8 h-8 text-xs'
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white border-2 border-[#1c1c1c]`}
      style={{ backgroundColor: agent.color }}
      title={`${agent.name} (${agent.role})`}
    >
      {agent.name[0]}
    </div>
  )
}
