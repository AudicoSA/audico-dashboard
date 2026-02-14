'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import {
  Target,
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Filter,
  RefreshCw,
  Sparkles,
  Package,
  Calendar
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface PredictiveOpportunity {
  id: string
  customer_email: string
  customer_name: string | null
  predicted_products: Array<{
    product_name: string
    category: string
    confidence: number
    reasoning: string
  }>
  confidence_score: number
  trigger_reason: 'repeat_purchase_due' | 'seasonal_opportunity' | 'product_interest_detected' | 'competitor_mention'
  suggested_discount: number
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'new' | 'review_pending' | 'quote_generated' | 'contacted' | 'converted' | 'dismissed'
  metadata: {
    last_purchase_date: string | null
    avg_order_value: number
    purchase_frequency_days: number | null
    interaction_signals: string[]
    seasonal_factors: any[]
    competitor_mentions: string[]
    next_expected_purchase: string | null
  }
  identified_at: string
  actioned_at: string | null
  created_at: string
  updated_at: string
}

interface ConversionAnalytics {
  trigger_reason: string
  total_opportunities: number
  converted: number
  conversion_rate: number
  avg_confidence_score: number
  avg_converted_confidence: number
  avg_suggested_discount: number
}

export default function PredictiveQuotesAnalyticsPage() {
  const [opportunities, setOpportunities] = useState<PredictiveOpportunity[]>([])
  const [conversionAnalytics, setConversionAnalytics] = useState<ConversionAnalytics[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'all'>('month')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [oppsRes, analyticsRes] = await Promise.all([
        supabase
          .from('predictive_quote_opportunities')
          .select('*')
          .order('identified_at', { ascending: false })
          .limit(1000),
        supabase
          .from('predictive_quote_opportunities_conversion_analytics')
          .select('*')
      ])

      if (oppsRes.data) setOpportunities(oppsRes.data)
      if (analyticsRes.data) setConversionAnalytics(analyticsRes.data)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredOpportunities = useMemo(() => {
    let filtered = [...opportunities]

    const now = new Date()
    const cutoffDate = new Date()
    
    switch (dateRange) {
      case 'week':
        cutoffDate.setDate(now.getDate() - 7)
        break
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1)
        break
      case 'quarter':
        cutoffDate.setMonth(now.getMonth() - 3)
        break
    }

    if (dateRange !== 'all') {
      filtered = filtered.filter(o => new Date(o.identified_at) >= cutoffDate)
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter)
    }

    return filtered
  }, [opportunities, dateRange, statusFilter])

  const summaryMetrics = useMemo(() => {
    const total = filteredOpportunities.length
    const highConfidence = filteredOpportunities.filter(o => o.confidence_score > 0.8).length
    const converted = filteredOpportunities.filter(o => o.status === 'converted').length
    const avgConfidence = total > 0
      ? filteredOpportunities.reduce((sum, o) => sum + o.confidence_score, 0) / total
      : 0
    const totalPotentialRevenue = filteredOpportunities.reduce((sum, o) => 
      sum + (o.metadata.avg_order_value || 0), 0
    )
    const convertedRevenue = filteredOpportunities
      .filter(o => o.status === 'converted')
      .reduce((sum, o) => sum + (o.metadata.avg_order_value || 0), 0)

    return {
      total,
      highConfidence,
      converted,
      conversionRate: total > 0 ? (converted / total) * 100 : 0,
      avgConfidence: avgConfidence * 100,
      totalPotentialRevenue,
      convertedRevenue
    }
  }, [filteredOpportunities])

  const pipelineByStatus = useMemo(() => {
    const statusCounts: Record<string, number> = {
      new: 0,
      review_pending: 0,
      quote_generated: 0,
      contacted: 0,
      converted: 0,
      dismissed: 0
    }

    filteredOpportunities.forEach(o => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1
    })

    return Object.entries(statusCounts).map(([status, count]) => ({
      status: status.replace(/_/g, ' ').toUpperCase(),
      count
    }))
  }, [filteredOpportunities])

  const opportunitiesByTrigger = useMemo(() => {
    const triggerCounts: Record<string, number> = {}
    
    filteredOpportunities.forEach(o => {
      triggerCounts[o.trigger_reason] = (triggerCounts[o.trigger_reason] || 0) + 1
    })

    return Object.entries(triggerCounts).map(([trigger, count]) => ({
      trigger: trigger.replace(/_/g, ' ').toUpperCase(),
      count
    }))
  }, [filteredOpportunities])

  const confidenceDistribution = useMemo(() => {
    const ranges = [
      { label: '50-60%', min: 0.5, max: 0.6, count: 0 },
      { label: '60-70%', min: 0.6, max: 0.7, count: 0 },
      { label: '70-80%', min: 0.7, max: 0.8, count: 0 },
      { label: '80-90%', min: 0.8, max: 0.9, count: 0 },
      { label: '90-100%', min: 0.9, max: 1.0, count: 0 }
    ]

    filteredOpportunities.forEach(o => {
      const range = ranges.find(r => o.confidence_score >= r.min && o.confidence_score < r.max)
      if (range) range.count++
    })

    return ranges
  }, [filteredOpportunities])

  const topProducts = useMemo(() => {
    const productCounts = new Map<string, { count: number; category: string }>()

    filteredOpportunities.forEach(o => {
      o.predicted_products.forEach(p => {
        const existing = productCounts.get(p.product_name)
        if (existing) {
          existing.count++
        } else {
          productCounts.set(p.product_name, { count: 1, category: p.category })
        }
      })
    })

    return Array.from(productCounts.entries())
      .map(([name, data]) => ({ product: name, count: data.count, category: data.category }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [filteredOpportunities])

  const conversionTimeline = useMemo(() => {
    const dailyData: Record<string, { date: string; identified: number; converted: number; dismissed: number }> = {}

    filteredOpportunities.forEach(o => {
      const date = new Date(o.identified_at).toLocaleDateString()
      if (!dailyData[date]) {
        dailyData[date] = { date, identified: 0, converted: 0, dismissed: 0 }
      }
      dailyData[date].identified++
      
      if (o.status === 'converted') dailyData[date].converted++
      if (o.status === 'dismissed') dailyData[date].dismissed++
    })

    return Object.values(dailyData).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  }, [filteredOpportunities])

  const revenueImpact = useMemo(() => {
    const opportunities = filteredOpportunities.filter(o => o.status === 'converted')
    const totalRevenue = opportunities.reduce((sum, o) => sum + (o.metadata.avg_order_value || 0), 0)
    const avgDealSize = opportunities.length > 0 ? totalRevenue / opportunities.length : 0
    const projectedAnnualRevenue = (summaryMetrics.total / (dateRange === 'month' ? 1 : dateRange === 'quarter' ? 3 : 12)) * 12 * summaryMetrics.conversionRate / 100 * avgDealSize

    return {
      actualRevenue: totalRevenue,
      avgDealSize,
      projectedAnnualRevenue,
      opportunitiesValue: filteredOpportunities.reduce((sum, o) => sum + (o.metadata.avg_order_value || 0), 0)
    }
  }, [filteredOpportunities, summaryMetrics, dateRange])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0 }).format(amount)
  }

  const COLORS = ['#a3e635', '#facc15', '#fb923c', '#f87171', '#c084fc', '#60a5fa', '#34d399', '#fbbf24']

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="animate-spin text-lime-400" size={24} />
          <span className="text-lg">Loading analytics...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[1600px] mx-auto space-y-6"
      >
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Sparkles className="text-lime-400" />
              Predictive Quote Analytics
            </h1>
            <p className="text-gray-400 mt-1">AI-powered opportunity detection and conversion tracking</p>
          </div>
          
          <div className="flex gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="bg-[#1c1c1c] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
            >
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="quarter">Last Quarter</option>
              <option value="all">All Time</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#1c1c1c] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="review_pending">Review Pending</option>
              <option value="quote_generated">Quote Generated</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            icon={<Target className="text-lime-400" />}
            label="Total Opportunities"
            value={summaryMetrics.total}
          />
          <MetricCard
            icon={<Zap className="text-yellow-400" />}
            label="High Confidence (>80%)"
            value={summaryMetrics.highConfidence}
          />
          <MetricCard
            icon={<CheckCircle2 className="text-green-400" />}
            label="Converted"
            value={summaryMetrics.converted}
          />
          <MetricCard
            icon={<TrendingUp className="text-blue-400" />}
            label="Conversion Rate"
            value={`${summaryMetrics.conversionRate.toFixed(1)}%`}
          />
          <MetricCard
            icon={<Users className="text-purple-400" />}
            label="Avg Confidence"
            value={`${summaryMetrics.avgConfidence.toFixed(1)}%`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Opportunity Pipeline by Status" icon={<Filter className="text-cyan-400" />}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pipelineByStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="status" stroke="#888" angle={-15} textAnchor="end" height={100} />
                <YAxis stroke="#888" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="count" fill="#a3e635" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Opportunities by Trigger Reason" icon={<AlertTriangle className="text-orange-400" />}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={opportunitiesByTrigger}
                  dataKey="count"
                  nameKey="trigger"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.trigger}: ${entry.count}`}
                >
                  {opportunitiesByTrigger.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Confidence Score Distribution" icon={<TrendingUp className="text-lime-400" />}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={confidenceDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="label" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="count" fill="#c084fc" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Conversion Timeline" icon={<Calendar className="text-blue-400" />}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={conversionTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Line type="monotone" dataKey="identified" stroke="#60a5fa" strokeWidth={2} dot={{ fill: '#60a5fa' }} name="Identified" />
                <Line type="monotone" dataKey="converted" stroke="#34d399" strokeWidth={2} dot={{ fill: '#34d399' }} name="Converted" />
                <Line type="monotone" dataKey="dismissed" stroke="#f87171" strokeWidth={2} dot={{ fill: '#f87171' }} name="Dismissed" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Package className="text-orange-400" />
              Top Predicted Products
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs text-gray-400 pb-3 font-medium">Product</th>
                    <th className="text-left text-xs text-gray-400 pb-3 font-medium">Category</th>
                    <th className="text-right text-xs text-gray-400 pb-3 font-medium">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((product, idx) => (
                    <tr key={idx} className="border-b border-white/5">
                      <td className="py-3 text-sm text-white">{product.product}</td>
                      <td className="py-3 text-sm text-gray-300 capitalize">{product.category}</td>
                      <td className="py-3 text-sm text-right text-lime-400 font-medium">{product.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="text-green-400" />
              Conversion Rates by Trigger
            </h3>
            <div className="space-y-3">
              {conversionAnalytics.map((analytics, idx) => (
                <div key={idx} className="p-4 bg-[#252525] rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white capitalize">
                      {analytics.trigger_reason.replace(/_/g, ' ')}
                    </span>
                    <span className="text-lg font-bold text-lime-400">
                      {analytics.conversion_rate?.toFixed(1) || 0}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                    <div>
                      <span className="block">Total: {analytics.total_opportunities}</span>
                      <span className="block">Converted: {analytics.converted}</span>
                    </div>
                    <div>
                      <span className="block">Avg Confidence: {(analytics.avg_confidence_score * 100).toFixed(0)}%</span>
                      <span className="block">Avg Discount: {analytics.avg_suggested_discount?.toFixed(1) || 0}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-lime-500/10 to-green-500/10 border border-lime-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="text-lime-400" size={32} />
              <h3 className="text-lg font-bold text-white">Revenue Impact</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Actual Revenue (Converted)</p>
                <p className="text-2xl font-bold text-lime-400">{formatCurrency(revenueImpact.actualRevenue)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Opportunity Value</p>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(revenueImpact.opportunitiesValue)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Avg Deal Size</p>
                <p className="text-xl font-bold text-white">{formatCurrency(revenueImpact.avgDealSize)}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Target className="text-purple-400" size={32} />
              <h3 className="text-lg font-bold text-white">Projected Annual</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Projected Revenue</p>
                <p className="text-2xl font-bold text-purple-400">{formatCurrency(revenueImpact.projectedAnnualRevenue)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Based on current conversion rate of</p>
                <p className="text-xl font-bold text-pink-400">{summaryMetrics.conversionRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="text-blue-400" size={32} />
              <h3 className="text-lg font-bold text-white">Pipeline Health</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Active Opportunities</p>
                <p className="text-2xl font-bold text-blue-400">
                  {opportunities.filter(o => !['converted', 'dismissed'].includes(o.status)).length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Awaiting Review</p>
                <p className="text-2xl font-bold text-cyan-400">
                  {opportunities.filter(o => o.status === 'review_pending').length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Success Rate</p>
                <p className="text-xl font-bold text-white">{summaryMetrics.conversionRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400 mt-1">{label}</p>
    </div>
  )
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  )
}
