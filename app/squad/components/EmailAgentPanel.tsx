'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Send,
  Edit3,
  AlertTriangle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Archive,
  Sparkles,
  Filter,
  Search,
  Tag,
  User,
  Calendar,
  FileText,
  MessageSquare,
  Activity
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface EmailLog {
  id: string
  gmail_message_id: string
  from_email: string
  subject: string
  category: string
  status: 'unread' | 'classified' | 'draft_created' | 'sent' | 'archived'
  handled_by: string | null
  payload: {
    body?: string
    snippet?: string
    draft_response?: string
    classification_confidence?: number
    mentions_kenny?: boolean
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    classification_reason?: string
    requires_action?: boolean
  }
  created_at: string
  updated_at: string
}

const CLASSIFICATION_BADGES = {
  urgent: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertTriangle },
  spam: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Archive },
  quote: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: FileText },
  info: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: MessageSquare },
  order: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle2 },
  customer_service: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: User },
  unclassified: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Tag }
}

const STATUS_COLORS = {
  unread: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  classified: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  draft_created: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  sent: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  archived: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
}

export default function EmailAgentPanel() {
  const [emails, setEmails] = useState<EmailLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null)
  const [editingDraft, setEditingDraft] = useState(false)
  const [draftContent, setDraftContent] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [actioningEmail, setActioningEmail] = useState<string | null>(null)

  useEffect(() => {
    fetchEmails()
    
    // Real-time subscription
    const channel = supabase
      .channel('email_logs_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'email_logs' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setEmails(prev => [payload.new as EmailLog, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setEmails(prev => prev.map(e => e.id === payload.new.id ? payload.new as EmailLog : e))
            if (selectedEmail?.id === payload.new.id) {
              setSelectedEmail(payload.new as EmailLog)
            }
          } else if (payload.eventType === 'DELETE') {
            setEmails(prev => prev.filter(e => e.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchEmails = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (data) {
        setEmails(data)
      }
      if (error) {
        console.error('Error fetching emails:', error)
      }
    } catch (err) {
      console.error('Failed to fetch emails:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePoll = async () => {
    setIsPolling(true)
    try {
      const res = await fetch('/api/email-poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (res.ok) {
        await fetchEmails()
      }
    } catch (err) {
      console.error('Failed to poll emails:', err)
    } finally {
      setIsPolling(false)
    }
  }

  const handleClassify = async (emailId: string) => {
    setActioningEmail(emailId)
    try {
      const res = await fetch('/api/email-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId })
      })
      
      if (res.ok) {
        await fetchEmails()
      }
    } catch (err) {
      console.error('Failed to classify email:', err)
    } finally {
      setActioningEmail(null)
    }
  }

  const handleApproveClassification = async (email: EmailLog) => {
    setActioningEmail(email.id)
    try {
      const { error } = await supabase
        .from('email_logs')
        .update({ 
          status: 'draft_created',
          updated_at: new Date().toISOString()
        })
        .eq('id', email.id)
      
      if (!error) {
        await fetchEmails()
      }
    } catch (err) {
      console.error('Failed to approve classification:', err)
    } finally {
      setActioningEmail(null)
    }
  }

  const handleRejectClassification = async (email: EmailLog) => {
    setActioningEmail(email.id)
    try {
      const { error } = await supabase
        .from('email_logs')
        .update({ 
          category: 'unclassified',
          status: 'unread',
          payload: { ...email.payload, classification_confidence: 0 },
          updated_at: new Date().toISOString()
        })
        .eq('id', email.id)
      
      if (!error) {
        await fetchEmails()
      }
    } catch (err) {
      console.error('Failed to reject classification:', err)
    } finally {
      setActioningEmail(null)
    }
  }

  const handleSendDraft = async (email: EmailLog) => {
    setActioningEmail(email.id)
    try {
      const content = editingDraft && selectedEmail?.id === email.id 
        ? draftContent 
        : email.payload.draft_response || ''

      const res = await fetch('/api/email-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          emailId: email.id,
          draftContent: content
        })
      })
      
      if (res.ok) {
        await fetchEmails()
        setEditingDraft(false)
        setSelectedEmail(null)
      }
    } catch (err) {
      console.error('Failed to send email:', err)
    } finally {
      setActioningEmail(null)
    }
  }

  const handleSaveDraft = async (email: EmailLog) => {
    setActioningEmail(email.id)
    try {
      const { error } = await supabase
        .from('email_logs')
        .update({ 
          payload: { ...email.payload, draft_response: draftContent },
          updated_at: new Date().toISOString()
        })
        .eq('id', email.id)
      
      if (!error) {
        await fetchEmails()
        setEditingDraft(false)
      }
    } catch (err) {
      console.error('Failed to save draft:', err)
    } finally {
      setActioningEmail(null)
    }
  }

  const handleArchive = async (email: EmailLog) => {
    setActioningEmail(email.id)
    try {
      const { error } = await supabase
        .from('email_logs')
        .update({ 
          status: 'archived',
          updated_at: new Date().toISOString()
        })
        .eq('id', email.id)
      
      if (!error) {
        await fetchEmails()
        if (selectedEmail?.id === email.id) {
          setSelectedEmail(null)
        }
      }
    } catch (err) {
      console.error('Failed to archive email:', err)
    } finally {
      setActioningEmail(null)
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

  // Filter emails
  const filteredEmails = emails.filter(email => {
    if (filterStatus !== 'all' && email.status !== filterStatus) return false
    if (filterCategory !== 'all' && email.category !== filterCategory) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        email.subject.toLowerCase().includes(query) ||
        email.from_email.toLowerCase().includes(query) ||
        email.payload.snippet?.toLowerCase().includes(query)
      )
    }
    return true
  })

  // Categorize emails
  const kennyMentions = filteredEmails.filter(e => e.payload.mentions_kenny && e.status !== 'sent' && e.status !== 'archived')
  const pendingClassifications = filteredEmails.filter(e => e.status === 'classified')
  const draftsReady = filteredEmails.filter(e => e.status === 'draft_created')
  const unreadEmails = filteredEmails.filter(e => e.status === 'unread')

  // Stats
  const totalEmails = emails.length
  const totalUnread = emails.filter(e => e.status === 'unread').length
  const totalClassified = emails.filter(e => e.status === 'classified').length
  const totalDrafts = emails.filter(e => e.status === 'draft_created').length
  const totalSent = emails.filter(e => e.status === 'sent').length

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between"
      >
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handlePoll}
            disabled={isPolling}
            className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
          >
            <RefreshCw size={18} className={isPolling ? 'animate-spin' : ''} />
            {isPolling ? 'Polling...' : 'Poll Inbox'}
          </button>

          <button
            onClick={() => {
              unreadEmails.forEach(email => handleClassify(email.id))
            }}
            disabled={unreadEmails.length === 0}
            className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-bold rounded-xl transition-all flex items-center gap-2 border border-purple-500/30 disabled:opacity-50"
          >
            <Sparkles size={18} />
            Classify All
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search emails..."
              className="bg-[#1c1c1c] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50 w-64"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#1c1c1c] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50 appearance-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="unread">Unread</option>
            <option value="classified">Classified</option>
            <option value="draft_created">Draft Created</option>
            <option value="sent">Sent</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-[#1c1c1c] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50 appearance-none cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="urgent">Urgent</option>
            <option value="quote">Quote</option>
            <option value="order">Order</option>
            <option value="customer_service">Customer Service</option>
            <option value="spam">Spam</option>
            <option value="info">Info</option>
            <option value="unclassified">Unclassified</option>
          </select>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-5 gap-4"
      >
        <StatCard label="Total" value={totalEmails} color="text-white" icon={Mail} />
        <StatCard label="Unread" value={totalUnread} color="text-blue-400" icon={Activity} />
        <StatCard label="Classified" value={totalClassified} color="text-yellow-400" icon={Tag} />
        <StatCard label="Drafts" value={totalDrafts} color="text-purple-400" icon={FileText} />
        <StatCard label="Sent" value={totalSent} color="text-lime-400" icon={Send} />
      </motion.div>

      {/* Kenny Mentions Section */}
      {kennyMentions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-2xl p-4"
        >
          <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2 mb-3">
            <AlertTriangle className="animate-pulse" size={20} />
            Needs Kenny's Attention ({kennyMentions.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {kennyMentions.map(email => (
              <EmailCard
                key={email.id}
                email={email}
                onClick={() => setSelectedEmail(email)}
                formatTimeAgo={formatTimeAgo}
                isHighlight={true}
              />
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Email List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending Classifications */}
          {pendingClassifications.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
            >
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Tag className="text-yellow-400" />
                Pending Classifications ({pendingClassifications.length})
              </h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {pendingClassifications.map(email => (
                  <ClassificationCard
                    key={email.id}
                    email={email}
                    onApprove={() => handleApproveClassification(email)}
                    onReject={() => handleRejectClassification(email)}
                    onView={() => setSelectedEmail(email)}
                    formatTimeAgo={formatTimeAgo}
                    isActioning={actioningEmail === email.id}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Drafted Responses */}
          {draftsReady.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
            >
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <FileText className="text-purple-400" />
                Drafted Responses ({draftsReady.length})
              </h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {draftsReady.map(email => (
                  <DraftCard
                    key={email.id}
                    email={email}
                    onEdit={() => {
                      setSelectedEmail(email)
                      setEditingDraft(true)
                      setDraftContent(email.payload.draft_response || '')
                    }}
                    onSend={() => handleSendDraft(email)}
                    onView={() => setSelectedEmail(email)}
                    formatTimeAgo={formatTimeAgo}
                    isActioning={actioningEmail === email.id}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* All Emails */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Mail className="text-blue-400" />
              Inbox ({filteredEmails.length})
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="animate-spin text-lime-400" size={32} />
                </div>
              ) : filteredEmails.length > 0 ? (
                filteredEmails.map(email => (
                  <EmailCard
                    key={email.id}
                    email={email}
                    onClick={() => setSelectedEmail(email)}
                    formatTimeAgo={formatTimeAgo}
                  />
                ))
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">No emails found</p>
              )}
            </div>
          </motion.div>
        </div>

        {/* Email Detail Sidebar */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {selectedEmail ? (
              <EmailDetailPanel
                key={selectedEmail.id}
                email={selectedEmail}
                onClose={() => {
                  setSelectedEmail(null)
                  setEditingDraft(false)
                }}
                onArchive={() => handleArchive(selectedEmail)}
                onClassify={() => handleClassify(selectedEmail.id)}
                onSendDraft={() => handleSendDraft(selectedEmail)}
                onApprove={() => handleApproveClassification(selectedEmail)}
                onReject={() => handleRejectClassification(selectedEmail)}
                editingDraft={editingDraft}
                draftContent={draftContent}
                setDraftContent={setDraftContent}
                onStartEdit={() => {
                  setEditingDraft(true)
                  setDraftContent(selectedEmail.payload.draft_response || '')
                }}
                onSaveDraft={() => handleSaveDraft(selectedEmail)}
                onCancelEdit={() => {
                  setEditingDraft(false)
                  setDraftContent('')
                }}
                isActioning={actioningEmail === selectedEmail.id}
                formatTimeAgo={formatTimeAgo}
              />
            ) : (
              <motion.div
                key="no-selection"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6 flex items-center justify-center min-h-[400px]"
              >
                <div className="text-center text-gray-400">
                  <Mail className="mx-auto mb-2 opacity-50" size={48} />
                  <p className="text-sm">Select an email to view details</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// Stat Card Component
function StatCard({ label, value, color, icon: Icon }: { label: string, value: number, color: string, icon: any }) {
  return (
    <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={color} />
        <p className="text-xs text-gray-400">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

// Email Card Component
function EmailCard({ 
  email, 
  onClick, 
  formatTimeAgo,
  isHighlight = false 
}: { 
  email: EmailLog
  onClick: () => void
  formatTimeAgo: (date: string) => string
  isHighlight?: boolean
}) {
  const badge = CLASSIFICATION_BADGES[email.category as keyof typeof CLASSIFICATION_BADGES] || CLASSIFICATION_BADGES.unclassified
  const BadgeIcon = badge.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      onClick={onClick}
      className={`bg-[#252525] border rounded-xl p-4 hover:border-lime-500/30 transition-all cursor-pointer group ${
        isHighlight ? 'border-red-500/30' : 'border-white/5'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{email.subject}</p>
          <p className="text-xs text-gray-400 truncate mt-1">{email.from_email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {email.payload.mentions_kenny && (
            <AlertTriangle size={14} className="text-red-400" />
          )}
          {email.payload.priority && email.payload.priority !== 'low' && (
            <span className={`text-[10px] px-2 py-1 rounded-md border ${
              email.payload.priority === 'urgent' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
              email.payload.priority === 'high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
              'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
            }`}>
              {email.payload.priority}
            </span>
          )}
        </div>
      </div>
      {email.payload.snippet && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{email.payload.snippet}</p>
      )}
      <div className="flex items-center gap-2 text-xs pt-2 border-t border-white/5">
        <span className={`px-2 py-0.5 rounded border flex items-center gap-1 ${badge.color}`}>
          <BadgeIcon size={10} />
          {email.category}
        </span>
        <span className={`px-2 py-0.5 rounded border ${STATUS_COLORS[email.status]}`}>
          {email.status.replace('_', ' ')}
        </span>
        <span className="text-gray-500 ml-auto">{formatTimeAgo(email.created_at)}</span>
      </div>
    </motion.div>
  )
}

// Classification Card Component
function ClassificationCard({
  email,
  onApprove,
  onReject,
  onView,
  formatTimeAgo,
  isActioning
}: {
  email: EmailLog
  onApprove: () => void
  onReject: () => void
  onView: () => void
  formatTimeAgo: (date: string) => string
  isActioning: boolean
}) {
  const badge = CLASSIFICATION_BADGES[email.category as keyof typeof CLASSIFICATION_BADGES] || CLASSIFICATION_BADGES.unclassified
  const BadgeIcon = badge.icon

  return (
    <div className="bg-[#252525] border border-yellow-500/20 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{email.subject}</p>
          <p className="text-xs text-gray-400 mt-1">{email.from_email}</p>
          {email.payload.classification_reason && (
            <p className="text-xs text-gray-500 mt-2 italic">{email.payload.classification_reason}</p>
          )}
        </div>
        {email.payload.mentions_kenny && (
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
        )}
      </div>
      
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs px-2 py-1 rounded border flex items-center gap-1 ${badge.color}`}>
          <BadgeIcon size={12} />
          {email.category}
        </span>
        {email.payload.classification_confidence && (
          <span className="text-xs text-gray-400">
            {Math.round(email.payload.classification_confidence * 100)}% confidence
          </span>
        )}
      </div>

      <div className="flex gap-2 pt-3 border-t border-white/5">
        <button
          onClick={onApprove}
          disabled={isActioning}
          className="flex-1 px-3 py-2 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
        >
          <ThumbsUp size={14} />
          Approve
        </button>
        <button
          onClick={onReject}
          disabled={isActioning}
          className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
        >
          <ThumbsDown size={14} />
          Reject
        </button>
        <button
          onClick={onView}
          className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors text-sm"
        >
          View
        </button>
      </div>
    </div>
  )
}

// Draft Card Component
function DraftCard({
  email,
  onEdit,
  onSend,
  onView,
  formatTimeAgo,
  isActioning
}: {
  email: EmailLog
  onEdit: () => void
  onSend: () => void
  onView: () => void
  formatTimeAgo: (date: string) => string
  isActioning: boolean
}) {
  return (
    <div className="bg-[#252525] border border-purple-500/20 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{email.subject}</p>
          <p className="text-xs text-gray-400 mt-1">{email.from_email}</p>
          {email.payload.draft_response && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{email.payload.draft_response}</p>
          )}
        </div>
        {email.payload.mentions_kenny && (
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
        )}
      </div>

      <div className="flex gap-2 pt-3 border-t border-white/5">
        <button
          onClick={onSend}
          disabled={isActioning}
          className="flex-1 px-3 py-2 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
        >
          <Send size={14} />
          Send
        </button>
        <button
          onClick={onEdit}
          className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          <Edit3 size={14} />
          Edit
        </button>
        <button
          onClick={onView}
          className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors text-sm"
        >
          View
        </button>
      </div>
    </div>
  )
}

// Email Detail Panel Component
function EmailDetailPanel({
  email,
  onClose,
  onArchive,
  onClassify,
  onSendDraft,
  onApprove,
  onReject,
  editingDraft,
  draftContent,
  setDraftContent,
  onStartEdit,
  onSaveDraft,
  onCancelEdit,
  isActioning,
  formatTimeAgo
}: {
  email: EmailLog
  onClose: () => void
  onArchive: () => void
  onClassify: () => void
  onSendDraft: () => void
  onApprove: () => void
  onReject: () => void
  editingDraft: boolean
  draftContent: string
  setDraftContent: (content: string) => void
  onStartEdit: () => void
  onSaveDraft: () => void
  onCancelEdit: () => void
  isActioning: boolean
  formatTimeAgo: (date: string) => string
}) {
  const badge = CLASSIFICATION_BADGES[email.category as keyof typeof CLASSIFICATION_BADGES] || CLASSIFICATION_BADGES.unclassified
  const BadgeIcon = badge.icon

  return (
    <motion.div
      key={email.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6 sticky top-6"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Email Details</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
        >
          <XCircle size={20} className="text-gray-400" />
        </button>
      </div>

      <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        {/* Email Info */}
        <div className="space-y-3">
          {email.payload.mentions_kenny && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-400 font-medium">Requires Kenny's attention</p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400 mb-1">Subject</p>
            <p className="text-sm text-white font-medium">{email.subject}</p>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1">From</p>
            <p className="text-sm text-white">{email.from_email}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded border flex items-center gap-1 ${badge.color}`}>
              <BadgeIcon size={12} />
              {email.category}
            </span>
            <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[email.status]}`}>
              {email.status.replace('_', ' ')}
            </span>
          </div>

          {email.payload.priority && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Priority</p>
              <span className={`text-xs px-2 py-1 rounded border inline-block ${
                email.payload.priority === 'urgent' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                email.payload.priority === 'high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                email.payload.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                'bg-gray-500/20 text-gray-400 border-gray-500/30'
              }`}>
                {email.payload.priority}
              </span>
            </div>
          )}

          {email.handled_by && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Handled By</p>
              <p className="text-sm text-white">{email.handled_by}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400 mb-1">Received</p>
            <p className="text-sm text-white">{formatTimeAgo(email.created_at)}</p>
          </div>
        </div>

        {/* Email Body */}
        {email.payload.body && (
          <div className="pt-4 border-t border-white/5">
            <p className="text-xs text-gray-400 mb-2">Message</p>
            <div className="bg-[#252525] border border-white/5 rounded-lg p-4 text-sm text-gray-300 max-h-[300px] overflow-y-auto whitespace-pre-wrap">
              {email.payload.body}
            </div>
          </div>
        )}

        {/* Draft Response */}
        {email.status === 'draft_created' && email.payload.draft_response && (
          <div className="pt-4 border-t border-white/5">
            <p className="text-xs text-gray-400 mb-2">Drafted Response</p>
            {editingDraft ? (
              <div className="space-y-2">
                <textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  className="w-full bg-[#252525] border border-white/5 rounded-lg p-4 text-sm text-white focus:outline-none focus:border-lime-500/50 resize-none min-h-[200px]"
                  placeholder="Edit draft response..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={onSaveDraft}
                    disabled={isActioning}
                    className="flex-1 px-3 py-2 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    Save Draft
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#252525] border border-purple-500/20 rounded-lg p-4 text-sm text-gray-300 max-h-[300px] overflow-y-auto whitespace-pre-wrap">
                {email.payload.draft_response}
              </div>
            )}
          </div>
        )}

        {/* Classification Info */}
        {email.payload.classification_reason && (
          <div className="pt-4 border-t border-white/5">
            <p className="text-xs text-gray-400 mb-2">Classification Reason</p>
            <p className="text-sm text-gray-300 italic">{email.payload.classification_reason}</p>
            {email.payload.classification_confidence && (
              <p className="text-xs text-gray-400 mt-2">
                Confidence: {Math.round(email.payload.classification_confidence * 100)}%
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="pt-4 border-t border-white/5 space-y-2">
          {email.status === 'unread' && (
            <button
              onClick={onClassify}
              disabled={isActioning}
              className="w-full px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles size={16} />
              Classify Email
            </button>
          )}

          {email.status === 'classified' && (
            <>
              <button
                onClick={onApprove}
                disabled={isActioning}
                className="w-full px-4 py-2 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ThumbsUp size={16} />
                Approve Classification
              </button>
              <button
                onClick={onReject}
                disabled={isActioning}
                className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ThumbsDown size={16} />
                Reject Classification
              </button>
            </>
          )}

          {email.status === 'draft_created' && !editingDraft && (
            <>
              <button
                onClick={onSendDraft}
                disabled={isActioning}
                className="w-full px-4 py-2 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send size={16} />
                Send Draft
              </button>
              <button
                onClick={onStartEdit}
                className="w-full px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Edit3 size={16} />
                Edit Draft
              </button>
            </>
          )}

          {email.status !== 'archived' && (
            <button
              onClick={onArchive}
              disabled={isActioning}
              className="w-full px-4 py-2 bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Archive size={16} />
              Archive
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
