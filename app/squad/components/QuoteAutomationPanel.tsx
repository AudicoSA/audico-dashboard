'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Package,
  Building2,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Edit3,
  Send,
  Mail,
  DollarSign,
  Users,
  Zap,
  Activity,
  Calendar,
  BarChart3,
  PieChart,
  Download,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare,
  Target
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface QuoteRequest {
  id: string
  customer_email: string
  customer_name: string | null
  requested_products: any[]
  source_email_id: string | null
  status: 'detected' | 'suppliers_contacted' | 'quotes_received' | 'pdf_generated' | 'sent_to_customer' | 'completed'
  confidence_score: number | null
  assigned_agent: string | null
  pdf_url: string | null
  metadata: {
    suppliers_contacted?: string[]
    supplier_responses?: any[]
    customer_feedback?: string
    automation_notes?: string[]
    total_quoted_amount?: number
    selected_supplier?: string
    sent_at?: string
  }
  created_at: string
  completed_at: string | null
  updated_at: string
}

interface SupplierResponse {
  id: string
  email_log_id: string
  supplier_id: string
  quote_request_id: string | null
  interaction_type: string
  products_mentioned: string[]
  pricing_data: {
    items?: Array<{
      product: string
      price: number
      quantity?: number
      lead_time?: string
    }>
    total?: number
    currency?: string
    valid_until?: string
  }
  stock_info: any
  extracted_at: string
  created_at: string
  supplier?: {
    id: string
    name: string
    company: string
    email: string
    relationship_strength: number
    reliability_score: number
  }
}

interface QuoteMetrics {
  total_quotes_processed: number
  avg_time_to_quote: number
  automation_success_rate: number
  kenny_intervention_rate: number
  confidence_distribution: {
    high: number
    medium: number
    low: number
  }
  category_breakdown: {
    [key: string]: number
  }
}

interface PendingQuotePDF {
  id: string
  quote_request_id: string
  customer_name: string | null
  customer_email: string
  pdf_url: string
  total_amount: number | null
  status: string
  created_at: string
  quote_request?: QuoteRequest
}

const STATUS_COLORS = {
  detected: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  suppliers_contacted: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  quotes_received: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  pdf_generated: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  sent_to_customer: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30'
}

export default function QuoteAutomationPanel() {
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([])
  const [supplierResponses, setSupplierResponses] = useState<SupplierResponse[]>([])
  const [pendingPDFs, setPendingPDFs] = useState<PendingQuotePDF[]>([])
  const [metrics, setMetrics] = useState<QuoteMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [selectedPDF, setSelectedPDF] = useState<PendingQuotePDF | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterDateRange, setFilterDateRange] = useState<'today' | 'week' | 'month' | 'all'>('all')
  const [actioningId, setActioningId] = useState<string | null>(null)

  useEffect(() => {
    fetchAllData()

    const channels = [
      supabase
        .channel('quote_requests_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quote_requests' }, handleRealtimeQuoteUpdate)
        .subscribe(),
      supabase
        .channel('email_supplier_interactions_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'email_supplier_interactions' }, handleRealtimeSupplierUpdate)
        .subscribe()
    ]

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel))
    }
  }, [])

  const handleRealtimeQuoteUpdate = (payload: any) => {
    if (payload.eventType === 'INSERT') {
      setQuoteRequests(prev => [payload.new, ...prev])
    } else if (payload.eventType === 'UPDATE') {
      setQuoteRequests(prev => prev.map(q => q.id === payload.new.id ? payload.new : q))
    } else if (payload.eventType === 'DELETE') {
      setQuoteRequests(prev => prev.filter(q => q.id !== payload.old.id))
    }
  }

  const handleRealtimeSupplierUpdate = (payload: any) => {
    if (payload.eventType === 'INSERT') {
      fetchSupplierResponses()
    }
  }

  const fetchAllData = async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        fetchQuoteRequests(),
        fetchSupplierResponses(),
        fetchPendingPDFs(),
        fetchMetrics()
      ])
    } catch (error) {
      console.error('Failed to fetch quote automation data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchQuoteRequests = async () => {
    const { data, error } = await supabase
      .from('quote_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && data) {
      setQuoteRequests(data)
    }
  }

  const fetchSupplierResponses = async () => {
    const { data, error } = await supabase
      .from('email_supplier_interactions')
      .select(`
        *,
        supplier:suppliers(id, name, company, email, relationship_strength, reliability_score)
      `)
      .eq('interaction_type', 'quote_response')
      .order('extracted_at', { ascending: false })
      .limit(200)

    if (!error && data) {
      setSupplierResponses(data as any)
    }
  }

  const fetchPendingPDFs = async () => {
    const { data, error } = await supabase
      .from('quote_requests')
      .select('*')
      .eq('status', 'pdf_generated')
      .not('pdf_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setPendingPDFs(data.map(q => ({
        id: q.id,
        quote_request_id: q.id,
        customer_name: q.customer_name,
        customer_email: q.customer_email,
        pdf_url: q.pdf_url!,
        total_amount: q.metadata?.total_quoted_amount || null,
        status: q.status,
        created_at: q.created_at,
        quote_request: q
      })))
    }
  }

  const fetchMetrics = async () => {
    const { data: quotes } = await supabase
      .from('quote_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (quotes) {
      const now = Date.now()
      const completedQuotes = quotes.filter(q => q.completed_at)
      
      const avgTime = completedQuotes.length > 0
        ? completedQuotes.reduce((sum, q) => {
            const start = new Date(q.created_at).getTime()
            const end = new Date(q.completed_at!).getTime()
            return sum + (end - start)
          }, 0) / completedQuotes.length / (1000 * 60 * 60)
        : 0

      const automatedQuotes = quotes.filter(q => 
        q.status === 'sent_to_customer' || q.status === 'completed'
      )
      const kennyInterventions = quotes.filter(q => 
        q.metadata?.automation_notes?.some((note: string) => note.includes('Kenny')) || false
      )

      const highConfidence = quotes.filter(q => (q.confidence_score || 0) >= 0.8).length
      const mediumConfidence = quotes.filter(q => (q.confidence_score || 0) >= 0.5 && (q.confidence_score || 0) < 0.8).length
      const lowConfidence = quotes.filter(q => (q.confidence_score || 0) < 0.5).length

      const categoryBreakdown: { [key: string]: number } = {}
      quotes.forEach(q => {
        q.requested_products?.forEach((p: any) => {
          const category = p.category || 'Uncategorized'
          categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1
        })
      })

      setMetrics({
        total_quotes_processed: quotes.length,
        avg_time_to_quote: avgTime,
        automation_success_rate: quotes.length > 0 ? (automatedQuotes.length / quotes.length) * 100 : 0,
        kenny_intervention_rate: quotes.length > 0 ? (kennyInterventions.length / quotes.length) * 100 : 0,
        confidence_distribution: {
          high: highConfidence,
          medium: mediumConfidence,
          low: lowConfidence
        },
        category_breakdown: categoryBreakdown
      })
    }
  }

  const handleApprovePDF = async (pdf: PendingQuotePDF) => {
    setActioningId(pdf.id)
    try {
      const { error } = await supabase
        .from('quote_requests')
        .update({
          status: 'sent_to_customer',
          metadata: {
            ...pdf.quote_request?.metadata,
            sent_at: new Date().toISOString(),
            approved_by: 'Kenny'
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', pdf.quote_request_id)

      if (!error) {
        await fetchAllData()
      }
    } catch (error) {
      console.error('Failed to approve PDF:', error)
    } finally {
      setActioningId(null)
    }
  }

  const handleRejectPDF = async (pdf: PendingQuotePDF) => {
    setActioningId(pdf.id)
    try {
      const { error } = await supabase
        .from('quote_requests')
        .update({
          status: 'quotes_received',
          metadata: {
            ...pdf.quote_request?.metadata,
            rejected_by: 'Kenny',
            rejection_reason: 'Requires revision'
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', pdf.quote_request_id)

      if (!error) {
        await fetchAllData()
      }
    } catch (error) {
      console.error('Failed to reject PDF:', error)
    } finally {
      setActioningId(null)
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

  const formatDuration = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`
    if (hours < 24) return `${hours.toFixed(1)}h`
    return `${(hours / 24).toFixed(1)}d`
  }

  const formatCurrency = (amount: number, currency?: string) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: currency || 'ZAR' }).format(amount)
  }

  const getConfidenceColor = (score: number | null) => {
    if (!score) return 'text-gray-400'
    if (score >= 0.8) return 'text-lime-400'
    if (score >= 0.5) return 'text-yellow-400'
    return 'text-red-400'
  }

  const filterQuotesByDate = (quote: QuoteRequest) => {
    if (filterDateRange === 'all') return true
    const quoteDate = new Date(quote.created_at)
    const now = new Date()
    const dayDiff = (now.getTime() - quoteDate.getTime()) / (1000 * 60 * 60 * 24)
    
    if (filterDateRange === 'today') return dayDiff < 1
    if (filterDateRange === 'week') return dayDiff < 7
    if (filterDateRange === 'month') return dayDiff < 30
    return true
  }

  const filteredQuotes = quoteRequests.filter(quote => {
    if (filterStatus !== 'all' && quote.status !== filterStatus) return false
    if (!filterQuotesByDate(quote)) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        quote.customer_email.toLowerCase().includes(query) ||
        quote.customer_name?.toLowerCase().includes(query) ||
        quote.requested_products?.some(p => 
          p.name?.toLowerCase().includes(query) ||
          p.product?.toLowerCase().includes(query)
        )
      )
    }
    return true
  })

  const activeQuotes = filteredQuotes.filter(q => 
    ['detected', 'suppliers_contacted', 'quotes_received', 'pdf_generated'].includes(q.status)
  )
  const completedQuotes = filteredQuotes.filter(q => 
    q.status === 'sent_to_customer' || q.status === 'completed'
  )

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAllData}
            disabled={isLoading}
            className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quotes..."
              className="bg-[#1c1c1c] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50 w-64"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#1c1c1c] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50"
          >
            <option value="all">All Statuses</option>
            <option value="detected">Detected</option>
            <option value="suppliers_contacted">Suppliers Contacted</option>
            <option value="quotes_received">Quotes Received</option>
            <option value="pdf_generated">PDF Generated</option>
            <option value="sent_to_customer">Sent to Customer</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={filterDateRange}
            onChange={(e) => setFilterDateRange(e.target.value as any)}
            className="bg-[#1c1c1c] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </motion.div>

      {/* Performance Metrics */}
      {metrics && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <MetricCard
            label="Total Quotes Processed"
            value={metrics.total_quotes_processed}
            icon={FileText}
            color="text-blue-400"
          />
          <MetricCard
            label="Avg Time to Quote"
            value={formatDuration(metrics.avg_time_to_quote)}
            icon={Clock}
            color="text-purple-400"
          />
          <MetricCard
            label="Automation Success"
            value={`${metrics.automation_success_rate.toFixed(1)}%`}
            icon={Zap}
            color="text-lime-400"
          />
          <MetricCard
            label="Kenny Intervention"
            value={`${metrics.kenny_intervention_rate.toFixed(1)}%`}
            icon={AlertTriangle}
            color="text-yellow-400"
          />
        </motion.div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Quotes & PDFs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Quote Requests */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="text-lime-400" />
              Active Quote Requests ({activeQuotes.length})
            </h3>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {activeQuotes.length > 0 ? (
                activeQuotes.map(quote => (
                  <QuoteRequestCard
                    key={quote.id}
                    quote={quote}
                    supplierResponses={supplierResponses.filter(r => r.quote_request_id === quote.id)}
                    expanded={expandedRow === quote.id}
                    onToggleExpand={() => setExpandedRow(expandedRow === quote.id ? null : quote.id)}
                    formatTimeAgo={formatTimeAgo}
                    formatCurrency={formatCurrency}
                    getConfidenceColor={getConfidenceColor}
                  />
                ))
              ) : (
                <EmptyState icon={FileText} message="No active quote requests" />
              )}
            </div>
          </motion.div>

          {/* Quote Generation Queue */}
          {pendingPDFs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
            >
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <CheckCircle2 className="text-orange-400" />
                Quote Generation Queue ({pendingPDFs.length})
              </h3>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {pendingPDFs.map(pdf => (
                  <PDFApprovalCard
                    key={pdf.id}
                    pdf={pdf}
                    onApprove={() => handleApprovePDF(pdf)}
                    onReject={() => handleRejectPDF(pdf)}
                    onView={() => setSelectedPDF(pdf)}
                    isActioning={actioningId === pdf.id}
                    formatTimeAgo={formatTimeAgo}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Quote History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="text-green-400" />
              Quote History ({completedQuotes.length})
            </h3>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {completedQuotes.length > 0 ? (
                completedQuotes.map(quote => (
                  <CompletedQuoteCard
                    key={quote.id}
                    quote={quote}
                    formatTimeAgo={formatTimeAgo}
                    formatCurrency={formatCurrency}
                  />
                ))
              ) : (
                <EmptyState icon={Calendar} message="No completed quotes" />
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Column: Analytics */}
        <div className="space-y-6">
          {/* Confidence Score Distribution */}
          {metrics && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
            >
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <PieChart size={20} className="text-purple-400" />
                Confidence Distribution
              </h3>

              <div className="space-y-3">
                <DistributionBar
                  label="High (≥80%)"
                  value={metrics.confidence_distribution.high}
                  total={metrics.total_quotes_processed}
                  color="bg-lime-400"
                />
                <DistributionBar
                  label="Medium (50-80%)"
                  value={metrics.confidence_distribution.medium}
                  total={metrics.total_quotes_processed}
                  color="bg-yellow-400"
                />
                <DistributionBar
                  label="Low (<50%)"
                  value={metrics.confidence_distribution.low}
                  total={metrics.total_quotes_processed}
                  color="bg-red-400"
                />
              </div>
            </motion.div>
          )}

          {/* Product Category Breakdown */}
          {metrics && Object.keys(metrics.category_breakdown).length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
            >
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Package size={20} className="text-blue-400" />
                Product Category Breakdown
              </h3>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {Object.entries(metrics.category_breakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">{category}</span>
                      <span className="text-white font-medium">{count}</span>
                    </div>
                  ))}
              </div>
            </motion.div>
          )}

          {/* Recent Supplier Activity */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
          >
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Building2 size={20} className="text-lime-400" />
              Recent Supplier Responses
            </h3>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {supplierResponses.slice(0, 10).map(response => (
                <div key={response.id} className="bg-[#252525] rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {response.supplier?.company || 'Unknown Supplier'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {response.products_mentioned.length} product{response.products_mentioned.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {response.pricing_data?.total && (
                      <span className="text-xs font-medium text-lime-400">
                        {formatCurrency(response.pricing_data.total)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTimeAgo(response.extracted_at)}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* PDF Preview Modal */}
      <AnimatePresence>
        {selectedPDF && (
          <PDFPreviewModal
            pdf={selectedPDF}
            onClose={() => setSelectedPDF(null)}
            onApprove={() => {
              handleApprovePDF(selectedPDF)
              setSelectedPDF(null)
            }}
            onReject={() => {
              handleRejectPDF(selectedPDF)
              setSelectedPDF(null)
            }}
            isActioning={actioningId === selectedPDF.id}
            formatCurrency={formatCurrency}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, color }: {
  label: string
  value: number | string
  icon: any
  color: string
}) {
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

function QuoteRequestCard({ 
  quote, 
  supplierResponses, 
  expanded, 
  onToggleExpand,
  formatTimeAgo,
  formatCurrency,
  getConfidenceColor
}: {
  quote: QuoteRequest
  supplierResponses: SupplierResponse[]
  expanded: boolean
  onToggleExpand: () => void
  formatTimeAgo: (date: string) => string
  formatCurrency: (amount: number) => string
  getConfidenceColor: (score: number | null) => string
}) {
  const suppliersContacted = quote.metadata?.suppliers_contacted?.length || 0
  const responsesReceived = supplierResponses.length

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#252525] border border-white/5 rounded-xl overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Users size={16} className="text-blue-400 shrink-0" />
              <p className="text-sm font-medium text-white truncate">
                {quote.customer_name || quote.customer_email}
              </p>
            </div>
            <p className="text-xs text-gray-400 truncate">{quote.customer_email}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[quote.status as keyof typeof STATUS_COLORS]}`}>
              {quote.status.replace(/_/g, ' ')}
            </span>
            {quote.confidence_score !== null && (
              <span className={`text-xs font-medium ${getConfidenceColor(quote.confidence_score)}`}>
                {(quote.confidence_score * 100).toFixed(0)}% confidence
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {quote.requested_products?.slice(0, 2).map((product, idx) => (
            <span key={idx} className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
              {product.name || product.product || `Product ${idx + 1}`}
            </span>
          ))}
          {quote.requested_products?.length > 2 && (
            <span className="text-xs px-2 py-1 rounded bg-white/5 text-gray-400">
              +{quote.requested_products.length - 2} more
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-white/5">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Building2 size={12} />
              {suppliersContacted} contacted
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare size={12} />
              {responsesReceived} responses
            </span>
          </div>
          <span>{formatTimeAgo(quote.created_at)}</span>
        </div>

        {supplierResponses.length > 0 && (
          <button
            onClick={onToggleExpand}
            className="w-full mt-3 pt-3 border-t border-white/5 flex items-center justify-center gap-2 text-xs text-lime-400 hover:text-lime-300 transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'Hide' : 'Show'} supplier responses
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && supplierResponses.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5 bg-[#1c1c1c] p-4"
          >
            <h4 className="text-xs font-medium text-gray-400 mb-3 uppercase">Supplier Responses</h4>
            <div className="space-y-2">
              {supplierResponses.map(response => (
                <SupplierResponseCard
                  key={response.id}
                  response={response}
                  formatCurrency={formatCurrency}
                  formatTimeAgo={formatTimeAgo}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function SupplierResponseCard({ 
  response, 
  formatCurrency,
  formatTimeAgo
}: {
  response: SupplierResponse
  formatCurrency: (amount: number, currency?: string) => string
  formatTimeAgo: (date: string) => string
}) {
  return (
    <div className="bg-[#252525] rounded-lg p-3 border border-white/5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{response.supplier?.company || 'Unknown'}</p>
          <p className="text-xs text-gray-400 mt-1">
            {response.products_mentioned.length} product{response.products_mentioned.length !== 1 ? 's' : ''} quoted
          </p>
        </div>
        {response.pricing_data?.total && (
          <div className="text-right">
            <p className="text-sm font-bold text-lime-400">
              {formatCurrency(response.pricing_data.total, response.pricing_data.currency)}
            </p>
            {response.supplier?.reliability_score && (
              <p className="text-xs text-gray-500">{response.supplier.reliability_score}% reliable</p>
            )}
          </div>
        )}
      </div>

      {response.pricing_data?.items && response.pricing_data.items.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
          {response.pricing_data.items.slice(0, 3).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="text-gray-400 truncate flex-1">{item.product}</span>
              <span className="text-white font-medium ml-2">
                {formatCurrency(item.price, response.pricing_data.currency)}
              </span>
            </div>
          ))}
          {response.pricing_data.items.length > 3 && (
            <p className="text-xs text-gray-500">+{response.pricing_data.items.length - 3} more items</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-white/5">
        <span>{formatTimeAgo(response.extracted_at)}</span>
        {response.pricing_data?.valid_until && (
          <span>Valid until {new Date(response.pricing_data.valid_until).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  )
}

function PDFApprovalCard({ 
  pdf, 
  onApprove, 
  onReject, 
  onView,
  isActioning,
  formatTimeAgo,
  formatCurrency
}: {
  pdf: PendingQuotePDF
  onApprove: () => void
  onReject: () => void
  onView: () => void
  isActioning: boolean
  formatTimeAgo: (date: string) => string
  formatCurrency: (amount: number) => string
}) {
  return (
    <div className="bg-[#252525] border border-orange-500/20 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{pdf.customer_name || 'Quote'}</p>
          <p className="text-xs text-gray-400 mt-1">{pdf.customer_email}</p>
          {pdf.total_amount && (
            <p className="text-sm font-bold text-lime-400 mt-2">
              {formatCurrency(pdf.total_amount)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs px-2 py-1 rounded border bg-orange-500/20 text-orange-400 border-orange-500/30">
            Awaiting Approval
          </span>
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t border-white/5">
        <button
          onClick={onView}
          className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          <Eye size={14} />
          Preview
        </button>
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
      </div>

      <div className="text-xs text-gray-500 mt-2">
        Generated {formatTimeAgo(pdf.created_at)}
      </div>
    </div>
  )
}

function CompletedQuoteCard({ 
  quote, 
  formatTimeAgo,
  formatCurrency
}: {
  quote: QuoteRequest
  formatTimeAgo: (date: string) => string
  formatCurrency: (amount: number) => string
}) {
  const hasFeedback = quote.metadata?.customer_feedback

  return (
    <div className="bg-[#252525] border border-white/5 rounded-xl p-4 hover:border-lime-500/30 transition-all">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{quote.customer_name || quote.customer_email}</p>
          <p className="text-xs text-gray-400 mt-1">{quote.customer_email}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[quote.status as keyof typeof STATUS_COLORS]}`}>
          {quote.status.replace(/_/g, ' ')}
        </span>
      </div>

      {quote.metadata?.total_quoted_amount && (
        <p className="text-sm font-bold text-lime-400 mb-2">
          {formatCurrency(quote.metadata.total_quoted_amount)}
        </p>
      )}

      {hasFeedback && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 mb-3">
          <p className="text-xs text-blue-400 mb-1 flex items-center gap-1">
            <MessageSquare size={12} />
            Customer Feedback
          </p>
          <p className="text-xs text-gray-300">{quote.metadata.customer_feedback}</p>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-white/5">
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          Completed {formatTimeAgo(quote.completed_at || quote.updated_at)}
        </span>
        {quote.pdf_url && (
          <a
            href={quote.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-lime-400 hover:text-lime-300"
          >
            <Download size={12} />
            PDF
          </a>
        )}
      </div>
    </div>
  )
}

function DistributionBar({ 
  label, 
  value, 
  total,
  color
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-medium">{value} ({percentage.toFixed(0)}%)</span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function PDFPreviewModal({ 
  pdf, 
  onClose, 
  onApprove, 
  onReject,
  isActioning,
  formatCurrency
}: {
  pdf: PendingQuotePDF
  onClose: () => void
  onApprove: () => void
  onReject: () => void
  isActioning: boolean
  formatCurrency: (amount: number) => string
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#1c1c1c] border border-white/10 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Quote Preview</h2>
            <p className="text-sm text-gray-400">{pdf.customer_email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <XCircle size={24} className="text-gray-400" />
          </button>
        </div>

        <div className="bg-[#252525] rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-lg font-bold text-white">{pdf.customer_name || 'Customer Quote'}</p>
              {pdf.total_amount && (
                <p className="text-2xl font-bold text-lime-400 mt-2">
                  {formatCurrency(pdf.total_amount)}
                </p>
              )}
            </div>
            <a
              href={pdf.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors flex items-center gap-2"
            >
              <ExternalLink size={16} />
              Open PDF
            </a>
          </div>

          {pdf.quote_request?.requested_products && (
            <div className="pt-4 border-t border-white/5">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Requested Products</h3>
              <div className="space-y-2">
                {pdf.quote_request.requested_products.map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-white">{product.name || product.product || `Product ${idx + 1}`}</span>
                    {product.quantity && <span className="text-gray-400">Qty: {product.quantity}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onReject}
            disabled={isActioning}
            className="flex-1 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ThumbsDown size={18} />
            Reject & Revise
          </button>
          <button
            onClick={onApprove}
            disabled={isActioning}
            className="flex-1 px-6 py-3 bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ThumbsUp size={18} />
            Approve & Send
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function EmptyState({ icon: Icon, message }: {
  icon: any
  message: string
}) {
  return (
    <div className="text-center py-12 text-gray-400">
      <Icon className="mx-auto mb-3 opacity-50" size={48} />
      <p className="text-sm">{message}</p>
    </div>
  )
}
