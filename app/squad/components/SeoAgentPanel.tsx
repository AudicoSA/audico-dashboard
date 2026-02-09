'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  ThumbsUp,
  ThumbsDown,
  Eye,
  EyeOff,
  Sparkles,
  Filter,
  ArrowRight,
  ExternalLink,
  Package,
  Image as ImageIcon,
  FileText,
  Tag,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  X,
  Edit3,
  ShoppingCart
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ProductAudit {
  id: string
  url: string
  audit_type: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  score: number | null
  issues_found: Issue[]
  recommendations: Recommendation[]
  metrics: {
    product_id?: string
    product_name?: string
    opencart_admin_url?: string
    total_issues?: number
    critical_issues?: number
    warnings?: number
  }
  performed_by: string | null
  completed_at: string | null
  metadata: {
    product_id?: string
    product_name?: string
    category?: string
  }
  created_at: string
  updated_at: string
}

interface Issue {
  id: string
  type: 'missing_description' | 'missing_image' | 'missing_meta_title' | 'missing_meta_description' | 'missing_keywords' | 'poor_quality' | 'other'
  severity: 'critical' | 'high' | 'medium' | 'low'
  field: string
  message: string
  current_value?: string
}

interface Recommendation {
  id: string
  issue_id: string
  field: string
  before: string
  after: string
  confidence: number
  approved: boolean
  rejected: boolean
  ai_notes?: string
}

const ISSUE_TYPE_BADGES = {
  missing_description: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: FileText, label: 'Missing Description' },
  missing_image: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: ImageIcon, label: 'Missing Image' },
  missing_meta_title: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Tag, label: 'Missing Meta Title' },
  missing_meta_description: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: FileText, label: 'Missing Meta Desc' },
  missing_keywords: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Tag, label: 'Missing Keywords' },
  poor_quality: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: AlertCircle, label: 'Poor Quality' },
  other: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Info, label: 'Other' }
}

const SEVERITY_BADGES = {
  critical: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertTriangle },
  high: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: AlertCircle },
  medium: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: AlertCircle },
  low: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Info }
}

const STATUS_COLORS = {
  pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30'
}

export default function SeoAgentPanel() {
  const [audits, setAudits] = useState<ProductAudit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedAudit, setSelectedAudit] = useState<ProductAudit | null>(null)
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRecommendations, setSelectedRecommendations] = useState<Set<string>>(new Set())
  const [showBeforeAfter, setShowBeforeAfter] = useState<{ [key: string]: boolean }>({})
  const [actioningAudit, setActioningAudit] = useState<string | null>(null)

  useEffect(() => {
    fetchAudits()
    
    const channel = supabase
      .channel('seo_audits_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'seo_audits' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAudits(prev => [payload.new as ProductAudit, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setAudits(prev => prev.map(a => a.id === payload.new.id ? payload.new as ProductAudit : a))
            if (selectedAudit?.id === payload.new.id) {
              setSelectedAudit(payload.new as ProductAudit)
            }
          } else if (payload.eventType === 'DELETE') {
            setAudits(prev => prev.filter(a => a.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchAudits = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('seo_audits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (data) {
        setAudits(data as ProductAudit[])
      }
      if (error) {
        console.error('Error fetching audits:', error)
      }
    } catch (err) {
      console.error('Failed to fetch audits:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApproveRecommendation = async (auditId: string, recommendationId: string) => {
    const audit = audits.find(a => a.id === auditId)
    if (!audit) return

    const updatedRecommendations = audit.recommendations.map(rec =>
      rec.id === recommendationId ? { ...rec, approved: true, rejected: false } : rec
    )

    try {
      const { error } = await supabase
        .from('seo_audits')
        .update({ 
          recommendations: updatedRecommendations,
          updated_at: new Date().toISOString()
        })
        .eq('id', auditId)
      
      if (!error) {
        await fetchAudits()
      }
    } catch (err) {
      console.error('Failed to approve recommendation:', err)
    }
  }

  const handleRejectRecommendation = async (auditId: string, recommendationId: string) => {
    const audit = audits.find(a => a.id === auditId)
    if (!audit) return

    const updatedRecommendations = audit.recommendations.map(rec =>
      rec.id === recommendationId ? { ...rec, approved: false, rejected: true } : rec
    )

    try {
      const { error } = await supabase
        .from('seo_audits')
        .update({ 
          recommendations: updatedRecommendations,
          updated_at: new Date().toISOString()
        })
        .eq('id', auditId)
      
      if (!error) {
        await fetchAudits()
      }
    } catch (err) {
      console.error('Failed to reject recommendation:', err)
    }
  }

  const handleBatchApprove = async () => {
    if (!selectedAudit || selectedRecommendations.size === 0) return

    setActioningAudit(selectedAudit.id)
    const updatedRecommendations = selectedAudit.recommendations.map(rec =>
      selectedRecommendations.has(rec.id) ? { ...rec, approved: true, rejected: false } : rec
    )

    try {
      const { error } = await supabase
        .from('seo_audits')
        .update({ 
          recommendations: updatedRecommendations,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedAudit.id)
      
      if (!error) {
        await fetchAudits()
        setSelectedRecommendations(new Set())
      }
    } catch (err) {
      console.error('Failed to batch approve:', err)
    } finally {
      setActioningAudit(null)
    }
  }

  const handleBatchReject = async () => {
    if (!selectedAudit || selectedRecommendations.size === 0) return

    setActioningAudit(selectedAudit.id)
    const updatedRecommendations = selectedAudit.recommendations.map(rec =>
      selectedRecommendations.has(rec.id) ? { ...rec, approved: false, rejected: true } : rec
    )

    try {
      const { error } = await supabase
        .from('seo_audits')
        .update({ 
          recommendations: updatedRecommendations,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedAudit.id)
      
      if (!error) {
        await fetchAudits()
        setSelectedRecommendations(new Set())
      }
    } catch (err) {
      console.error('Failed to batch reject:', err)
    } finally {
      setActioningAudit(null)
    }
  }

  const toggleRecommendationSelection = (recId: string) => {
    setSelectedRecommendations(prev => {
      const newSet = new Set(prev)
      if (newSet.has(recId)) {
        newSet.delete(recId)
      } else {
        newSet.add(recId)
      }
      return newSet
    })
  }

  const toggleBeforeAfter = (recId: string) => {
    setShowBeforeAfter(prev => ({
      ...prev,
      [recId]: !prev[recId]
    }))
  }

  const formatTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const getHealthScoreColor = (score: number | null) => {
    if (!score) return 'text-gray-400'
    if (score >= 80) return 'text-lime-400'
    if (score >= 60) return 'text-yellow-400'
    if (score >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  const getHealthScoreIcon = (score: number | null) => {
    if (!score) return Minus
    if (score >= 80) return TrendingUp
    if (score >= 60) return Activity
    return TrendingDown
  }

  // Filter audits
  const filteredAudits = audits.filter(audit => {
    if (filterStatus !== 'all' && audit.status !== filterStatus) return false
    
    if (filterSeverity !== 'all') {
      const hasSeverity = audit.issues_found.some(issue => issue.severity === filterSeverity)
      if (!hasSeverity) return false
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        audit.url.toLowerCase().includes(query) ||
        audit.metadata.product_name?.toLowerCase().includes(query) ||
        audit.metadata.product_id?.toLowerCase().includes(query)
      )
    }
    
    return true
  })

  // Group issues by severity
  const groupIssuesBySeverity = (issues: Issue[]) => {
    return {
      critical: issues.filter(i => i.severity === 'critical'),
      high: issues.filter(i => i.severity === 'high'),
      medium: issues.filter(i => i.severity === 'medium'),
      low: issues.filter(i => i.severity === 'low')
    }
  }

  // Stats
  const totalAudits = audits.length
  const completedAudits = audits.filter(a => a.status === 'completed').length
  const totalIssues = audits.reduce((sum, a) => sum + a.issues_found.length, 0)
  const criticalIssues = audits.reduce((sum, a) => 
    sum + a.issues_found.filter(i => i.severity === 'critical').length, 0
  )
  const pendingRecommendations = audits.reduce((sum, a) => 
    sum + a.recommendations.filter(r => !r.approved && !r.rejected).length, 0
  )

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
            onClick={fetchAudits}
            disabled={isLoading}
            className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-bold rounded-xl transition-all flex items-center gap-2 border border-purple-500/30"
          >
            <Sparkles size={18} />
            Run Audit
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="bg-[#1c1c1c] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50 w-64"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#1c1c1c] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50 appearance-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-[#1c1c1c] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50 appearance-none cursor-pointer"
          >
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
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
        <StatCard label="Total Audits" value={totalAudits} color="text-white" icon={Package} />
        <StatCard label="Completed" value={completedAudits} color="text-lime-400" icon={CheckCircle2} />
        <StatCard label="Total Issues" value={totalIssues} color="text-yellow-400" icon={AlertCircle} />
        <StatCard label="Critical" value={criticalIssues} color="text-red-400" icon={AlertTriangle} />
        <StatCard label="Pending Fixes" value={pendingRecommendations} color="text-purple-400" icon={Edit3} />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Audit List */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Search className="text-indigo-400" />
              Product Audits ({filteredAudits.length})
            </h3>
            <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="animate-spin text-lime-400" size={32} />
                </div>
              ) : filteredAudits.length > 0 ? (
                filteredAudits.map(audit => (
                  <ProductAuditCard
                    key={audit.id}
                    audit={audit}
                    onClick={() => setSelectedAudit(audit)}
                    formatTimeAgo={formatTimeAgo}
                    getHealthScoreColor={getHealthScoreColor}
                    getHealthScoreIcon={getHealthScoreIcon}
                    isSelected={selectedAudit?.id === audit.id}
                  />
                ))
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">No audits found</p>
              )}
            </div>
          </motion.div>
        </div>

        {/* Detail Panel */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {selectedAudit ? (
              <AuditDetailPanel
                key={selectedAudit.id}
                audit={selectedAudit}
                onClose={() => {
                  setSelectedAudit(null)
                  setSelectedRecommendations(new Set())
                  setShowBeforeAfter({})
                }}
                groupIssuesBySeverity={groupIssuesBySeverity}
                selectedRecommendations={selectedRecommendations}
                toggleRecommendationSelection={toggleRecommendationSelection}
                showBeforeAfter={showBeforeAfter}
                toggleBeforeAfter={toggleBeforeAfter}
                handleApproveRecommendation={handleApproveRecommendation}
                handleRejectRecommendation={handleRejectRecommendation}
                handleBatchApprove={handleBatchApprove}
                handleBatchReject={handleBatchReject}
                actioningAudit={actioningAudit}
                formatTimeAgo={formatTimeAgo}
                getHealthScoreColor={getHealthScoreColor}
                getHealthScoreIcon={getHealthScoreIcon}
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
                  <Package className="mx-auto mb-2 opacity-50" size={48} />
                  <p className="text-sm">Select an audit to view details</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

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

function ProductAuditCard({ 
  audit, 
  onClick, 
  formatTimeAgo,
  getHealthScoreColor,
  getHealthScoreIcon,
  isSelected
}: { 
  audit: ProductAudit
  onClick: () => void
  formatTimeAgo: (date: string) => string
  getHealthScoreColor: (score: number | null) => string
  getHealthScoreIcon: (score: number | null) => any
  isSelected: boolean
}) {
  const HealthIcon = getHealthScoreIcon(audit.score)
  const criticalCount = audit.issues_found.filter(i => i.severity === 'critical').length
  const highCount = audit.issues_found.filter(i => i.severity === 'high').length

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      onClick={onClick}
      className={`bg-[#252525] border rounded-xl p-4 hover:border-lime-500/30 transition-all cursor-pointer ${
        isSelected ? 'border-lime-500/50 bg-lime-500/5' : 'border-white/5'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {audit.metadata.product_name || 'Unknown Product'}
          </p>
          <p className="text-xs text-gray-400 truncate mt-1">
            {audit.metadata.product_id && `#${audit.metadata.product_id}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {audit.score !== null && (
            <div className={`text-2xl font-bold ${getHealthScoreColor(audit.score)} flex items-center gap-1`}>
              <HealthIcon size={20} />
              {audit.score}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        {criticalCount > 0 && (
          <span className="text-xs px-2 py-1 rounded border bg-red-500/20 text-red-400 border-red-500/30 flex items-center gap-1">
            <AlertTriangle size={10} />
            {criticalCount} critical
          </span>
        )}
        {highCount > 0 && (
          <span className="text-xs px-2 py-1 rounded border bg-orange-500/20 text-orange-400 border-orange-500/30 flex items-center gap-1">
            <AlertCircle size={10} />
            {highCount} high
          </span>
        )}
        {audit.issues_found.length > 0 && (
          <span className="text-xs text-gray-400">
            {audit.issues_found.length} issue{audit.issues_found.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs pt-3 border-t border-white/5">
        <span className={`px-2 py-1 rounded border ${STATUS_COLORS[audit.status]}`}>
          {audit.status.replace('_', ' ')}
        </span>
        <span className="text-gray-500">{formatTimeAgo(audit.created_at)}</span>
      </div>
    </motion.div>
  )
}

function AuditDetailPanel({
  audit,
  onClose,
  groupIssuesBySeverity,
  selectedRecommendations,
  toggleRecommendationSelection,
  showBeforeAfter,
  toggleBeforeAfter,
  handleApproveRecommendation,
  handleRejectRecommendation,
  handleBatchApprove,
  handleBatchReject,
  actioningAudit,
  formatTimeAgo,
  getHealthScoreColor,
  getHealthScoreIcon
}: {
  audit: ProductAudit
  onClose: () => void
  groupIssuesBySeverity: (issues: Issue[]) => any
  selectedRecommendations: Set<string>
  toggleRecommendationSelection: (id: string) => void
  showBeforeAfter: { [key: string]: boolean }
  toggleBeforeAfter: (id: string) => void
  handleApproveRecommendation: (auditId: string, recId: string) => void
  handleRejectRecommendation: (auditId: string, recId: string) => void
  handleBatchApprove: () => void
  handleBatchReject: () => void
  actioningAudit: string | null
  formatTimeAgo: (date: string) => string
  getHealthScoreColor: (score: number | null) => string
  getHealthScoreIcon: (score: number | null) => any
}) {
  const HealthIcon = getHealthScoreIcon(audit.score)
  const groupedIssues = groupIssuesBySeverity(audit.issues_found)
  const pendingRecommendations = audit.recommendations.filter(r => !r.approved && !r.rejected)
  const opencartUrl = audit.metrics.opencart_admin_url || 
    (audit.metadata.product_id ? `https://admin.opencart.example.com/index.php?route=catalog/product/edit&product_id=${audit.metadata.product_id}` : null)

  return (
    <motion.div
      key={audit.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6 sticky top-6"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Audit Details</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
        >
          <XCircle size={20} className="text-gray-400" />
        </button>
      </div>

      <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        {/* Product Info */}
        <div className="bg-[#252525] border border-white/5 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-white">
                {audit.metadata.product_name || 'Unknown Product'}
              </p>
              {audit.metadata.product_id && (
                <p className="text-xs text-gray-400 mt-1">Product ID: {audit.metadata.product_id}</p>
              )}
              {audit.metadata.category && (
                <p className="text-xs text-gray-400 mt-1">Category: {audit.metadata.category}</p>
              )}
            </div>
            {audit.score !== null && (
              <div className={`text-3xl font-bold ${getHealthScoreColor(audit.score)} flex items-center gap-2`}>
                <HealthIcon size={24} />
                {audit.score}
              </div>
            )}
          </div>

          {opencartUrl && (
            <a
              href={opencartUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors text-sm font-medium mt-2"
            >
              <ShoppingCart size={14} />
              Edit in OpenCart
              <ExternalLink size={14} />
            </a>
          )}
        </div>

        {/* Issues by Priority */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" />
            Issues by Priority
          </h4>
          <div className="space-y-2">
            {groupedIssues.critical.length > 0 && (
              <IssueGroup issues={groupedIssues.critical} severity="critical" />
            )}
            {groupedIssues.high.length > 0 && (
              <IssueGroup issues={groupedIssues.high} severity="high" />
            )}
            {groupedIssues.medium.length > 0 && (
              <IssueGroup issues={groupedIssues.medium} severity="medium" />
            )}
            {groupedIssues.low.length > 0 && (
              <IssueGroup issues={groupedIssues.low} severity="low" />
            )}
            {audit.issues_found.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No issues found</p>
            )}
          </div>
        </div>

        {/* AI-Generated Fixes */}
        {audit.recommendations.length > 0 && (
          <div className="pt-4 border-t border-white/5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                AI-Generated Fixes ({pendingRecommendations.length} pending)
              </h4>
              {selectedRecommendations.size > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleBatchApprove}
                    disabled={actioningAudit === audit.id}
                    className="px-2 py-1 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 rounded text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <Check size={12} />
                    Approve ({selectedRecommendations.size})
                  </button>
                  <button
                    onClick={handleBatchReject}
                    disabled={actioningAudit === audit.id}
                    className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <X size={12} />
                    Reject ({selectedRecommendations.size})
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {audit.recommendations.map(rec => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  auditId={audit.id}
                  isSelected={selectedRecommendations.has(rec.id)}
                  showBeforeAfter={showBeforeAfter[rec.id]}
                  onToggleSelection={() => toggleRecommendationSelection(rec.id)}
                  onToggleBeforeAfter={() => toggleBeforeAfter(rec.id)}
                  onApprove={() => handleApproveRecommendation(audit.id, rec.id)}
                  onReject={() => handleRejectRecommendation(audit.id, rec.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Meta Info */}
        <div className="pt-4 border-t border-white/5 space-y-2 text-xs text-gray-400">
          <div className="flex justify-between">
            <span>Status:</span>
            <span className={`px-2 py-0.5 rounded border ${STATUS_COLORS[audit.status]}`}>
              {audit.status.replace('_', ' ')}
            </span>
          </div>
          {audit.performed_by && (
            <div className="flex justify-between">
              <span>Performed by:</span>
              <span className="text-white">{audit.performed_by}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Created:</span>
            <span className="text-white">{formatTimeAgo(audit.created_at)}</span>
          </div>
          {audit.completed_at && (
            <div className="flex justify-between">
              <span>Completed:</span>
              <span className="text-white">{formatTimeAgo(audit.completed_at)}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function IssueGroup({ issues, severity }: { issues: Issue[], severity: string }) {
  const badge = SEVERITY_BADGES[severity as keyof typeof SEVERITY_BADGES]
  const SeverityIcon = badge.icon

  return (
    <div className="bg-[#252525] border border-white/5 rounded-lg p-3">
      <div className={`flex items-center gap-2 mb-2 text-xs px-2 py-1 rounded border w-fit ${badge.color}`}>
        <SeverityIcon size={12} />
        {severity.toUpperCase()} ({issues.length})
      </div>
      <div className="space-y-2">
        {issues.map((issue, idx) => {
          const issueTypeBadge = ISSUE_TYPE_BADGES[issue.type as keyof typeof ISSUE_TYPE_BADGES] || ISSUE_TYPE_BADGES.other
          const IssueIcon = issueTypeBadge.icon
          
          return (
            <div key={idx} className="pl-3 border-l-2 border-white/10">
              <div className="flex items-start gap-2 mb-1">
                <IssueIcon size={14} className="shrink-0 mt-0.5" style={{ color: issueTypeBadge.color.match(/text-(\S+)/)?.[1] }} />
                <div className="flex-1">
                  <p className="text-xs text-white font-medium">{issue.field}</p>
                  <p className="text-xs text-gray-400 mt-1">{issue.message}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RecommendationCard({
  recommendation,
  auditId,
  isSelected,
  showBeforeAfter,
  onToggleSelection,
  onToggleBeforeAfter,
  onApprove,
  onReject
}: {
  recommendation: Recommendation
  auditId: string
  isSelected: boolean
  showBeforeAfter: boolean
  onToggleSelection: () => void
  onToggleBeforeAfter: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const isActioned = recommendation.approved || recommendation.rejected

  return (
    <div className={`bg-[#252525] border rounded-lg p-3 transition-all ${
      isSelected ? 'border-lime-500/50 bg-lime-500/5' : 
      isActioned ? 'border-white/10 opacity-60' : 'border-white/5'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 flex-1">
          {!isActioned && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelection}
              className="mt-1 w-4 h-4 rounded border-white/20 bg-[#1c1c1c] text-lime-500 focus:ring-lime-500 cursor-pointer"
            />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{recommendation.field}</p>
            <p className="text-xs text-gray-400 mt-1">
              Confidence: {Math.round(recommendation.confidence * 100)}%
            </p>
          </div>
        </div>
        {isActioned && (
          <div className="shrink-0">
            {recommendation.approved && (
              <span className="text-xs px-2 py-1 rounded border bg-lime-500/20 text-lime-400 border-lime-500/30 flex items-center gap-1">
                <Check size={10} />
                Approved
              </span>
            )}
            {recommendation.rejected && (
              <span className="text-xs px-2 py-1 rounded border bg-red-500/20 text-red-400 border-red-500/30 flex items-center gap-1">
                <X size={10} />
                Rejected
              </span>
            )}
          </div>
        )}
      </div>

      {recommendation.ai_notes && (
        <p className="text-xs text-purple-400 italic mb-2 pl-6">{recommendation.ai_notes}</p>
      )}

      {/* Before/After Preview */}
      <div className="pl-6 space-y-2">
        <button
          onClick={onToggleBeforeAfter}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
        >
          {showBeforeAfter ? <EyeOff size={12} /> : <Eye size={12} />}
          {showBeforeAfter ? 'Hide' : 'Show'} Before/After
        </button>

        <AnimatePresence>
          {showBeforeAfter && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <div className="bg-[#1c1c1c] border border-red-500/20 rounded p-2">
                <p className="text-[10px] text-red-400 font-medium mb-1 flex items-center gap-1">
                  <Minus size={10} />
                  BEFORE
                </p>
                <p className="text-xs text-gray-300 line-clamp-3">
                  {recommendation.before || '(empty)'}
                </p>
              </div>
              <div className="flex items-center justify-center">
                <ArrowRight size={14} className="text-gray-500" />
              </div>
              <div className="bg-[#1c1c1c] border border-lime-500/20 rounded p-2">
                <p className="text-[10px] text-lime-400 font-medium mb-1 flex items-center gap-1">
                  <Check size={10} />
                  AFTER
                </p>
                <p className="text-xs text-white line-clamp-3">
                  {recommendation.after}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!isActioned && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-white/5 pl-6">
          <button
            onClick={onApprove}
            className="flex-1 px-3 py-1.5 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 rounded-lg transition-colors flex items-center justify-center gap-1 text-xs font-medium"
          >
            <ThumbsUp size={12} />
            Approve
          </button>
          <button
            onClick={onReject}
            className="flex-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors flex items-center justify-center gap-1 text-xs font-medium"
          >
            <ThumbsDown size={12} />
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
