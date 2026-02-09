'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Search,
  Filter,
  Calendar,
  Phone,
  Mail,
  MessageSquare,
  Share2,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Clock,
  AlertCircle,
  Star,
  ChevronRight,
  X,
  Download,
  RefreshCw,
  Eye,
  ExternalLink,
  Package,
} from 'lucide-react'
import type { TimelineInteraction, CustomerProfile } from '@/lib/supabase'
import {
  formatCurrency,
  getSentimentColor,
  getSentimentEmoji,
  getInteractionIcon,
} from '@/lib/customer-timeline'

export default function CustomerTimelinePage() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null)
  const [timeline, setTimeline] = useState<TimelineInteraction[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [filterSources, setFilterSources] = useState<string[]>([])
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [activeTab, setActiveTab] = useState<'recent' | 'top' | 'attention'>('recent')
  const [showFilters, setShowFilters] = useState(false)

  const [detailedView, setDetailedView] = useState<{
    calls: any[]
    emails: any[]
    social: any[]
    orders: any[]
  } | null>(null)

  useEffect(() => {
    loadCustomers()
  }, [activeTab])

  useEffect(() => {
    if (selectedCustomer) {
      loadTimeline()
      loadDetailedData()
    }
  }, [selectedCustomer, filterSources, dateRange])

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/timeline?action=${activeTab}`)
      const data = await res.json()
      setCustomers(data.customers || [])
    } catch (error) {
      console.error('Failed to load customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTimeline = async () => {
    if (!selectedCustomer) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        action: 'timeline',
        customerId: selectedCustomer.customer_id,
      })

      if (filterSources.length > 0) {
        params.append('sources', filterSources.join(','))
      }

      if (dateRange.from) {
        params.append('dateFrom', dateRange.from)
      }

      if (dateRange.to) {
        params.append('dateTo', dateRange.to)
      }

      const res = await fetch(`/api/timeline?${params}`)
      const data = await res.json()
      setTimeline(data.timeline || [])
    } catch (error) {
      console.error('Failed to load timeline:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadDetailedData = async () => {
    if (!selectedCustomer) return

    try {
      const res = await fetch(
        `/api/timeline?action=customer_details&customerId=${selectedCustomer.customer_id}`
      )
      const data = await res.json()
      setDetailedView({
        calls: data.calls || [],
        emails: data.emails || [],
        social: data.social || [],
        orders: data.orders || [],
      })
    } catch (error) {
      console.error('Failed to load detailed data:', error)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadCustomers()
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/timeline?action=search&query=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      setCustomers(data.customers || [])
    } catch (error) {
      console.error('Failed to search customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshCustomerProfile = async () => {
    if (!selectedCustomer) return

    setLoading(true)
    try {
      await fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          customerId: selectedCustomer.customer_id,
        }),
      })

      await loadCustomers()
      await loadTimeline()
    } catch (error) {
      console.error('Failed to refresh profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleFilterSource = (source: string) => {
    setFilterSources(prev =>
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
    )
  }

  const clearFilters = () => {
    setFilterSources([])
    setDateRange({ from: '', to: '' })
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'call':
        return <Phone size={16} />
      case 'email':
        return <Mail size={16} />
      case 'chat':
        return <MessageSquare size={16} />
      case 'social':
        return <Share2 size={16} />
      case 'order':
        return <ShoppingCart size={16} />
      default:
        return <Clock size={16} />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getSentimentTrendIcon = (trend: string | null) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp size={16} className="text-green-400" />
      case 'declining':
        return <TrendingDown size={16} className="text-red-400" />
      default:
        return <Minus size={16} className="text-gray-400" />
    }
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Users className="text-lime-400" />
            Customer Interaction Timeline
          </h2>
          <p className="text-gray-400 mt-1">
            Unified view of all customer touchpoints: calls, emails, chats, social, and orders
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search by name, email, phone, company..."
              className="w-full bg-[#1c1c1c] border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-lime-500/50 transition-all placeholder:text-gray-600"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-6 py-2.5 bg-lime-400 hover:bg-lime-500 text-black text-sm font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(163,230,53,0.3)]"
          >
            Search
          </button>
          {selectedCustomer && (
            <button
              onClick={refreshCustomerProfile}
              disabled={loading}
              className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-[#1c1c1c] border border-white/5 rounded-2xl overflow-hidden">
          <div className="border-b border-white/5 p-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('recent')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'recent'
                    ? 'bg-lime-400 text-black'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Recent
              </button>
              <button
                onClick={() => setActiveTab('top')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'top'
                    ? 'bg-lime-400 text-black'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Star className="inline mr-1" size={14} />
                Top LTV
              </button>
              <button
                onClick={() => setActiveTab('attention')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'attention'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <AlertCircle className="inline mr-1" size={14} />
                Alert
              </button>
            </div>
          </div>

          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            {loading && !selectedCustomer ? (
              <div className="p-8 text-center text-gray-500">Loading customers...</div>
            ) : customers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No customers found</div>
            ) : (
              <div className="p-2 space-y-2">
                {customers.map(customer => (
                  <button
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className={`w-full p-3 rounded-xl text-left transition-all ${
                      selectedCustomer?.id === customer.id
                        ? 'bg-lime-400/10 border border-lime-500/30'
                        : 'bg-[#252525] border border-white/5 hover:border-lime-500/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {customer.full_name || customer.primary_email || 'Unknown Customer'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {customer.primary_email}
                        </p>
                        {customer.company_name && (
                          <p className="text-xs text-gray-600 truncate mt-0.5">
                            {customer.company_name}
                          </p>
                        )}
                      </div>
                      <ChevronRight
                        size={16}
                        className={selectedCustomer?.id === customer.id ? 'text-lime-400' : 'text-gray-500'}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-lime-400 font-medium">
                        {formatCurrency(customer.lifetime_value)}
                      </span>
                      <span className="text-gray-500">
                        {customer.interaction_count} interactions
                      </span>
                    </div>
                    {customer.sentiment_score < 0.4 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-red-400">
                        <AlertCircle size={12} />
                        Low sentiment
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selectedCustomer ? (
            <>
              <CustomerProfileCard customer={selectedCustomer} detailedView={detailedView} />

              <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl overflow-hidden">
                <div className="border-b border-white/5 p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
                    <h3 className="text-lg font-semibold text-white">Interaction Timeline</h3>
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 text-xs font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Filter size={14} />
                      Filters
                    </button>
                  </div>

                  <AnimatePresence>
                    {showFilters && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3 border-t border-white/5 space-y-3">
                          <div>
                            <label className="text-xs text-gray-500 mb-2 block">Filter by Source</label>
                            <div className="flex items-center gap-2 flex-wrap">
                              {(['call', 'email', 'chat', 'social', 'order'] as const).map(source => (
                                <button
                                  key={source}
                                  onClick={() => toggleFilterSource(source)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                    filterSources.includes(source)
                                      ? 'bg-lime-400 text-black'
                                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                  }`}
                                >
                                  {getSourceIcon(source)}
                                  {source.charAt(0).toUpperCase() + source.slice(1)}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">From Date</label>
                              <input
                                type="date"
                                value={dateRange.from}
                                onChange={e => setDateRange({ ...dateRange, from: e.target.value })}
                                className="w-full bg-[#252525] border border-white/5 rounded-lg px-3 py-1.5 text-sm text-white"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">To Date</label>
                              <input
                                type="date"
                                value={dateRange.to}
                                onChange={e => setDateRange({ ...dateRange, to: e.target.value })}
                                className="w-full bg-[#252525] border border-white/5 rounded-lg px-3 py-1.5 text-sm text-white"
                              />
                            </div>
                          </div>

                          {(filterSources.length > 0 || dateRange.from || dateRange.to) && (
                            <button
                              onClick={clearFilters}
                              className="w-full px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              <X size={14} />
                              Clear Filters
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="max-h-[calc(100vh-500px)] overflow-y-auto p-4">
                  {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading timeline...</div>
                  ) : timeline.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No interactions found</div>
                  ) : (
                    <div className="space-y-4">
                      {timeline.map((interaction, index) => (
                        <TimelineItem
                          key={interaction.id}
                          interaction={interaction}
                          isFirst={index === 0}
                          formatDate={formatDate}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-12 text-center">
              <Users size={48} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-500 text-lg">Select a customer to view their timeline</p>
              <p className="text-gray-600 text-sm mt-2">
                View all touchpoints: calls, emails, chats, social interactions, and orders
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CustomerProfileCard({
  customer,
  detailedView,
}: {
  customer: CustomerProfile
  detailedView: { calls: any[]; emails: any[]; social: any[]; orders: any[] } | null
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-[#1c1c1c] to-[#252525] border border-white/10 rounded-2xl p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold text-white">
            {customer.full_name || 'Unknown Customer'}
          </h3>
          {customer.company_name && (
            <p className="text-gray-400 mt-1">{customer.company_name}</p>
          )}
        </div>
        <div
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            customer.customer_status === 'vip'
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
              : customer.customer_status === 'active'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
          }`}
        >
          {customer.customer_status.toUpperCase()}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <DollarSign size={14} />
            Lifetime Value
          </div>
          <p className="text-lg font-bold text-lime-400">
            {formatCurrency(customer.lifetime_value)}
          </p>
        </div>

        <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <ShoppingCart size={14} />
            Total Orders
          </div>
          <p className="text-lg font-bold text-white">{customer.total_orders}</p>
        </div>

        <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <TrendingUp size={14} />
            Avg Order Value
          </div>
          <p className="text-lg font-bold text-white">
            {formatCurrency(customer.average_order_value)}
          </p>
        </div>

        <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Users size={14} />
            Interactions
          </div>
          <p className="text-lg font-bold text-white">{customer.interaction_count}</p>
        </div>
      </div>

      {detailedView && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-center">
            <Phone size={14} className="mx-auto text-blue-400 mb-1" />
            <p className="text-xs text-gray-500">Calls</p>
            <p className="text-sm font-bold text-white">{detailedView.calls.length}</p>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2 text-center">
            <Mail size={14} className="mx-auto text-purple-400 mb-1" />
            <p className="text-xs text-gray-500">Emails</p>
            <p className="text-sm font-bold text-white">{detailedView.emails.length}</p>
          </div>
          <div className="bg-pink-500/10 border border-pink-500/20 rounded-lg p-2 text-center">
            <Share2 size={14} className="mx-auto text-pink-400 mb-1" />
            <p className="text-xs text-gray-500">Social</p>
            <p className="text-sm font-bold text-white">{detailedView.social.length}</p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 text-center">
            <Package size={14} className="mx-auto text-yellow-400 mb-1" />
            <p className="text-xs text-gray-500">Orders</p>
            <p className="text-sm font-bold text-white">{detailedView.orders.length}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Sentiment:</span>
          <span
            className={`px-2 py-1 rounded border text-xs font-medium ${
              customer.sentiment_score >= 0.7
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : customer.sentiment_score >= 0.4
                ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}
          >
            {getSentimentEmoji(
              customer.sentiment_score >= 0.7
                ? 'positive'
                : customer.sentiment_score >= 0.4
                ? 'mixed'
                : 'negative'
            )}{' '}
            {(customer.sentiment_score * 100).toFixed(0)}%
          </span>
        </div>

        {customer.sentiment_trend && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Trend:</span>
            <span className="flex items-center gap-1">
              {customer.sentiment_trend === 'improving' ? (
                <>
                  <TrendingUp size={14} className="text-green-400" />
                  <span className="text-green-400 text-xs">Improving</span>
                </>
              ) : customer.sentiment_trend === 'declining' ? (
                <>
                  <TrendingDown size={14} className="text-red-400" />
                  <span className="text-red-400 text-xs">Declining</span>
                </>
              ) : (
                <>
                  <Minus size={14} className="text-gray-400" />
                  <span className="text-gray-400 text-xs">Stable</span>
                </>
              )}
            </span>
          </div>
        )}

        {customer.last_interaction_date && (
          <div className="flex items-center gap-2 ml-auto">
            <Clock size={14} className="text-gray-500" />
            <span className="text-gray-500 text-xs">
              Last active:{' '}
              {new Date(customer.last_interaction_date).toLocaleDateString('en-ZA', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        )}
      </div>

      {(customer.primary_email || customer.primary_phone) && (
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-4 text-sm flex-wrap">
          {customer.primary_email && (
            <div className="flex items-center gap-2 text-gray-400">
              <Mail size={14} />
              {customer.primary_email}
            </div>
          )}
          {customer.primary_phone && (
            <div className="flex items-center gap-2 text-gray-400">
              <Phone size={14} />
              {customer.primary_phone}
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

function TimelineItem({
  interaction,
  isFirst,
  formatDate,
}: {
  interaction: TimelineInteraction
  isFirst: boolean
  formatDate: (date: string) => string
}) {
  const [expanded, setExpanded] = useState(false)

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'call':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'email':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'chat':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'social':
        return 'bg-pink-500/20 text-pink-400 border-pink-500/30'
      case 'order':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative pl-8 pb-4 border-l-2 border-white/10 last:border-0"
    >
      <div className="absolute -left-2.5 top-0 w-5 h-5 rounded-full bg-[#1c1c1c] border-2 border-lime-400 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-lime-400" />
      </div>

      <div className="bg-[#252525] border border-white/5 rounded-xl p-4 hover:border-lime-500/30 transition-all">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-1 rounded-md border text-xs font-medium ${getSourceColor(interaction.source)}`}>
              {getInteractionIcon(interaction.source)} {interaction.interaction_type}
            </span>
            {interaction.sentiment && (
              <span className={`px-2 py-1 rounded-md border text-xs font-medium ${getSentimentColor(interaction.sentiment)}`}>
                {getSentimentEmoji(interaction.sentiment)}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {formatDate(interaction.interaction_date)}
          </span>
        </div>

        {interaction.subject && (
          <p className="text-sm font-medium text-white mb-1">{interaction.subject}</p>
        )}

        {interaction.summary && (
          <p className={`text-sm text-gray-400 ${!expanded && 'line-clamp-2'}`}>
            {interaction.summary}
          </p>
        )}

        {interaction.outcome && (
          <div className="mt-2 text-xs text-gray-500">
            Status: <span className="text-gray-400">{interaction.outcome}</span>
          </div>
        )}

        {interaction.metadata && Object.keys(interaction.metadata).length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-lime-400 hover:text-lime-300 flex items-center gap-1"
            >
              <Eye size={12} />
              {expanded ? 'Hide' : 'View'} details
            </button>
            {expanded && (
              <pre className="mt-2 text-xs text-gray-400 bg-[#1c1c1c] p-2 rounded overflow-auto max-h-40">
                {JSON.stringify(interaction.metadata, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
