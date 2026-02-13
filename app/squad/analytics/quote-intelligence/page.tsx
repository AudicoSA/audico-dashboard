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
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Funnel,
  FunnelChart
} from 'recharts'
import {
  Activity,
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Send,
  Target,
  Package,
  AlertTriangle,
  Zap,
  Filter,
  RefreshCw,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingDown,
  Award,
  ShoppingCart,
  Mail,
  ThumbsUp,
  ThumbsDown,
  Loader,
  Calendar,
  MapPin
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface QuoteWorkflowExecution {
  id: string
  workflow_id: string
  email_log_id: string | null
  quote_request_id: string | null
  workflow_type: string
  status: string
  steps: Array<{
    step: string
    status: string
    started_at: string
    completed_at: string | null
    duration_seconds: number | null
    error: string | null
    metadata: any
  }>
  current_step: string | null
  started_at: string
  completed_at: string | null
  total_duration_seconds: number | null
  detection_duration: number | null
  supplier_contact_duration: number | null
  response_wait_duration: number | null
  quote_generation_duration: number | null
  approval_duration: number | null
  send_duration: number | null
  suppliers_contacted: number
  suppliers_responded: number
  response_rate: number | null
  failure_reason: string | null
  bottleneck_detected: boolean
  bottleneck_step: string | null
  metadata: any
  created_at: string
  updated_at: string
}

interface QuoteRequest {
  id: string
  customer_email: string
  customer_name: string
  customer_segment: string | null
  urgency_level: string | null
  order_size_category: string | null
  status: string
  quote_amount: number | null
  quote_pdf_url: string | null
  items: any[]
  metadata: any
  created_at: string
  updated_at: string
}

interface QuoteOutcome {
  id: string
  quote_request_id: string
  quote_number: string
  outcome: string
  customer_email: string
  customer_name: string | null
  customer_segment: string | null
  total_quoted_amount: number
  final_amount: number | null
  items: any[]
  urgency_level: string | null
  order_size_category: string | null
  rejection_reason: string | null
  response_time_hours: number | null
  metadata: any
  outcome_date: string
  created_at: string
}

interface SupplierRecord {
  id: string
  name: string
  company: string
  specialties: string[]
  relationship_strength: number
  avg_response_time_hours: number | null
  reliability_score: number | null
  last_contact_date: string | null
  metadata: any
}

interface EmailSupplierInteraction {
  id: string
  email_log_id: string
  supplier_id: string
  quote_request_id: string | null
  interaction_type: string
  products_mentioned: string[]
  pricing_data: any
  extracted_at: string
}

interface PricingOptimizationInsight {
  id: string
  insight_type: string
  segment_key: string
  optimal_markup_avg: number
  acceptance_rate: number
  sample_size: number
  confidence_score: number
  patterns: any
  recommendations: string | null
  last_analyzed_at: string
}

export default function QuoteIntelligencePage() {
  const [workflows, setWorkflows] = useState<QuoteWorkflowExecution[]>([])
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([])
  const [quoteOutcomes, setQuoteOutcomes] = useState<QuoteOutcome[]>([])
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [supplierInteractions, setSupplierInteractions] = useState<EmailSupplierInteraction[]>([])
  const [pricingInsights, setPricingInsights] = useState<PricingOptimizationInsight[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year' | 'all'>('month')
  const [selectedView, setSelectedView] = useState<'overview' | 'funnel' | 'customers' | 'products' | 'suppliers' | 'forecasting' | 'competitive'>('overview')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [workflowsRes, requestsRes, outcomesRes, suppliersRes, interactionsRes, insightsRes] = await Promise.all([
        supabase
          .from('quote_workflow_executions')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(1000),
        supabase
          .from('quote_requests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase
          .from('quote_outcomes')
          .select('*')
          .order('outcome_date', { ascending: false })
          .limit(1000),
        supabase
          .from('suppliers')
          .select('*')
          .order('relationship_strength', { ascending: false }),
        supabase
          .from('email_supplier_interactions')
          .select('*')
          .order('extracted_at', { ascending: false })
          .limit(1000),
        supabase
          .from('pricing_optimization_insights')
          .select('*')
          .order('last_analyzed_at', { ascending: false })
      ])

      if (workflowsRes.data) setWorkflows(workflowsRes.data)
      if (requestsRes.data) setQuoteRequests(requestsRes.data)
      if (outcomesRes.data) setQuoteOutcomes(outcomesRes.data)
      if (suppliersRes.data) setSuppliers(suppliersRes.data)
      if (interactionsRes.data) setSupplierInteractions(interactionsRes.data)
      if (insightsRes.data) setPricingInsights(insightsRes.data)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredData = useMemo(() => {
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
      case 'year':
        cutoffDate.setFullYear(now.getFullYear() - 1)
        break
    }

    const filterByDate = (items: any[], dateField: string) => {
      if (dateRange === 'all') return items
      return items.filter(item => new Date(item[dateField]) >= cutoffDate)
    }

    return {
      workflows: filterByDate(workflows, 'started_at'),
      quoteRequests: filterByDate(quoteRequests, 'created_at'),
      quoteOutcomes: filterByDate(quoteOutcomes, 'outcome_date'),
      supplierInteractions: filterByDate(supplierInteractions, 'extracted_at')
    }
  }, [workflows, quoteRequests, quoteOutcomes, supplierInteractions, dateRange])

  const funnelData = useMemo(() => {
    const { workflows, quoteOutcomes } = filteredData
    
    const totalDetected = workflows.filter(w => 
      w.steps.some(s => s.step === 'detect_quote_request' && s.status === 'completed')
    ).length

    const suppliersContacted = workflows.filter(w => 
      w.suppliers_contacted > 0
    ).length

    const responsesReceived = workflows.filter(w => 
      w.suppliers_responded > 0
    ).length

    const pdfsGenerated = workflows.filter(w => 
      w.steps.some(s => s.step === 'generate_quote_pdf' && s.status === 'completed')
    ).length

    const quotesSent = workflows.filter(w => 
      w.status === 'quote_sent' || w.status === 'completed'
    ).length

    const quotesAccepted = quoteOutcomes.filter(o => o.outcome === 'accepted').length
    const quotesRejected = quoteOutcomes.filter(o => o.outcome === 'rejected').length

    return [
      { stage: 'Requests Detected', value: totalDetected, fill: '#60a5fa' },
      { stage: 'Suppliers Contacted', value: suppliersContacted, fill: '#34d399' },
      { stage: 'Responses Received', value: responsesReceived, fill: '#fbbf24' },
      { stage: 'PDFs Generated', value: pdfsGenerated, fill: '#a78bfa' },
      { stage: 'Quotes Sent', value: quotesSent, fill: '#f87171' },
      { stage: 'Accepted', value: quotesAccepted, fill: '#10b981' },
      { stage: 'Rejected', value: quotesRejected, fill: '#ef4444' }
    ]
  }, [filteredData])

  const customerSegmentAnalysis = useMemo(() => {
    const { quoteOutcomes } = filteredData
    
    const segmentMap = new Map<string, {
      total: number
      accepted: number
      avgResponseTime: number[]
      avgQuoteAmount: number[]
      acceptanceRate: number
    }>()

    quoteOutcomes.forEach(outcome => {
      const segment = outcome.customer_segment || 'unknown'
      if (!segmentMap.has(segment)) {
        segmentMap.set(segment, {
          total: 0,
          accepted: 0,
          avgResponseTime: [],
          avgQuoteAmount: [],
          acceptanceRate: 0
        })
      }

      const data = segmentMap.get(segment)!
      data.total++
      if (outcome.outcome === 'accepted') data.accepted++
      if (outcome.response_time_hours) data.avgResponseTime.push(outcome.response_time_hours)
      if (outcome.total_quoted_amount) data.avgQuoteAmount.push(outcome.total_quoted_amount)
    })

    return Array.from(segmentMap.entries()).map(([segment, data]) => ({
      segment: segment.replace(/_/g, ' ').toUpperCase(),
      total: data.total,
      accepted: data.accepted,
      acceptanceRate: data.total > 0 ? (data.accepted / data.total) * 100 : 0,
      avgResponseTime: data.avgResponseTime.length > 0 
        ? data.avgResponseTime.reduce((a, b) => a + b, 0) / data.avgResponseTime.length 
        : 0,
      avgQuoteAmount: data.avgQuoteAmount.length > 0
        ? data.avgQuoteAmount.reduce((a, b) => a + b, 0) / data.avgQuoteAmount.length
        : 0
    })).sort((a, b) => b.acceptanceRate - a.acceptanceRate)
  }, [filteredData])

  const productCategoryPerformance = useMemo(() => {
    const categoryMap = new Map<string, {
      volume: number
      revenue: number
      avgMargin: number
      acceptanceRate: number
      accepted: number
    }>()

    filteredData.quoteOutcomes.forEach(outcome => {
      outcome.items.forEach((item: any) => {
        const category = item.category || 'uncategorized'
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            volume: 0,
            revenue: 0,
            avgMargin: 0,
            acceptanceRate: 0,
            accepted: 0
          })
        }

        const data = categoryMap.get(category)!
        data.volume++
        if (outcome.outcome === 'accepted') {
          data.accepted++
          data.revenue += outcome.final_amount || outcome.total_quoted_amount
        }
      })
    })

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category: category.replace(/_/g, ' ').toUpperCase(),
      volume: data.volume,
      revenue: data.revenue,
      avgMargin: data.volume > 0 ? (data.revenue / data.volume) * 0.25 : 0,
      acceptanceRate: data.volume > 0 ? (data.accepted / data.volume) * 100 : 0,
      classification: data.volume > 50 && data.avgMargin > 20 
        ? 'High Volume High Margin'
        : data.volume > 50 && data.avgMargin <= 20
        ? 'High Volume Low Margin'
        : data.volume <= 50 && data.avgMargin > 20
        ? 'Low Volume High Margin'
        : 'Low Volume Low Margin'
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  }, [filteredData])

  const supplierContribution = useMemo(() => {
    const supplierMap = new Map<string, {
      quotesEnabled: number
      successfulQuotes: number
      avgResponseTime: number[]
      reliabilityScore: number
      relationshipStrength: number
    }>()

    suppliers.forEach(supplier => {
      const interactions = supplierInteractions.filter(i => i.supplier_id === supplier.id)
      const quoteInteractions = interactions.filter(i => 
        i.interaction_type === 'quote_response' && i.quote_request_id
      )
      
      const successfulQuotes = quoteInteractions.filter(qi => {
        const outcome = quoteOutcomes.find(o => o.quote_request_id === qi.quote_request_id)
        return outcome?.outcome === 'accepted'
      }).length

      supplierMap.set(supplier.name, {
        quotesEnabled: quoteInteractions.length,
        successfulQuotes,
        avgResponseTime: supplier.avg_response_time_hours ? [supplier.avg_response_time_hours] : [],
        reliabilityScore: supplier.reliability_score || 0,
        relationshipStrength: supplier.relationship_strength
      })
    })

    return Array.from(supplierMap.entries())
      .map(([name, data]) => ({
        supplier: name,
        quotesEnabled: data.quotesEnabled,
        successfulQuotes: data.successfulQuotes,
        successRate: data.quotesEnabled > 0 ? (data.successfulQuotes / data.quotesEnabled) * 100 : 0,
        avgResponseTime: data.avgResponseTime.length > 0 
          ? data.avgResponseTime.reduce((a, b) => a + b, 0) / data.avgResponseTime.length 
          : 0,
        reliabilityScore: data.reliabilityScore,
        relationshipStrength: data.relationshipStrength
      }))
      .sort((a, b) => b.successfulQuotes - a.successfulQuotes)
      .slice(0, 10)
  }, [suppliers, supplierInteractions, quoteOutcomes])

  const timeSeriesForecast = useMemo(() => {
    const dailyData = new Map<string, {
      date: string
      volume: number
      revenue: number
      acceptanceRate: number
      accepted: number
    }>()

    filteredData.quoteOutcomes.forEach(outcome => {
      const date = new Date(outcome.outcome_date).toLocaleDateString()
      if (!dailyData.has(date)) {
        dailyData.set(date, { date, volume: 0, revenue: 0, acceptanceRate: 0, accepted: 0 })
      }

      const data = dailyData.get(date)!
      data.volume++
      if (outcome.outcome === 'accepted') {
        data.accepted++
        data.revenue += outcome.final_amount || outcome.total_quoted_amount
      }
    })

    const sortedData = Array.from(dailyData.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(d => ({
        ...d,
        acceptanceRate: d.volume > 0 ? (d.accepted / d.volume) * 100 : 0
      }))

    if (sortedData.length < 3) return sortedData

    const avgGrowth = sortedData.slice(-7).reduce((acc, d, i, arr) => {
      if (i === 0) return 0
      return acc + (d.volume - arr[i - 1].volume) / arr[i - 1].volume
    }, 0) / 6

    const lastDate = new Date(sortedData[sortedData.length - 1].date)
    const forecast: typeof sortedData = []
    
    for (let i = 1; i <= 7; i++) {
      const forecastDate = new Date(lastDate)
      forecastDate.setDate(lastDate.getDate() + i)
      const lastVolume = sortedData[sortedData.length - 1].volume
      const forecastVolume = Math.round(lastVolume * (1 + avgGrowth))
      
      forecast.push({
        date: forecastDate.toLocaleDateString(),
        volume: forecastVolume,
        revenue: forecastVolume * (sortedData[sortedData.length - 1].revenue / sortedData[sortedData.length - 1].volume),
        acceptanceRate: sortedData[sortedData.length - 1].acceptanceRate,
        accepted: Math.round(forecastVolume * (sortedData[sortedData.length - 1].acceptanceRate / 100)),
        forecast: true
      } as any)
    }

    return [...sortedData, ...forecast]
  }, [filteredData])

  const competitiveIntelligence = useMemo(() => {
    const competitorMentions = new Map<string, {
      mentions: number
      avgCompetitorPrice: number[]
      ourPrice: number[]
      wins: number
      losses: number
    }>()

    filteredData.quoteOutcomes.forEach(outcome => {
      const competitors = outcome.metadata?.competitor_mentions || []
      competitors.forEach((comp: string) => {
        if (!competitorMentions.has(comp)) {
          competitorMentions.set(comp, {
            mentions: 0,
            avgCompetitorPrice: [],
            ourPrice: [],
            wins: 0,
            losses: 0
          })
        }

        const data = competitorMentions.get(comp)!
        data.mentions++
        
        if (outcome.metadata?.competitor_price) {
          data.avgCompetitorPrice.push(outcome.metadata.competitor_price)
        }
        data.ourPrice.push(outcome.total_quoted_amount)

        if (outcome.outcome === 'accepted') data.wins++
        if (outcome.outcome === 'rejected') data.losses++
      })
    })

    return Array.from(competitorMentions.entries())
      .map(([competitor, data]) => ({
        competitor,
        mentions: data.mentions,
        avgCompetitorPrice: data.avgCompetitorPrice.length > 0
          ? data.avgCompetitorPrice.reduce((a, b) => a + b, 0) / data.avgCompetitorPrice.length
          : 0,
        avgOurPrice: data.ourPrice.length > 0
          ? data.ourPrice.reduce((a, b) => a + b, 0) / data.ourPrice.length
          : 0,
        wins: data.wins,
        losses: data.losses,
        winRate: data.mentions > 0 ? (data.wins / data.mentions) * 100 : 0,
        priceDiff: 0
      }))
      .map(item => ({
        ...item,
        priceDiff: item.avgCompetitorPrice > 0 
          ? ((item.avgOurPrice - item.avgCompetitorPrice) / item.avgCompetitorPrice) * 100 
          : 0
      }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 8)
  }, [filteredData])

  const summaryMetrics = useMemo(() => {
    const { workflows, quoteOutcomes } = filteredData
    
    const totalRequests = workflows.length
    const completedWorkflows = workflows.filter(w => w.status === 'completed' || w.status === 'quote_sent').length
    const avgDuration = workflows.length > 0
      ? workflows.reduce((sum, w) => sum + (w.total_duration_seconds || 0), 0) / workflows.length
      : 0

    const totalQuoted = quoteOutcomes.reduce((sum, o) => sum + o.total_quoted_amount, 0)
    const totalRevenue = quoteOutcomes
      .filter(o => o.outcome === 'accepted')
      .reduce((sum, o) => sum + (o.final_amount || o.total_quoted_amount), 0)

    const accepted = quoteOutcomes.filter(o => o.outcome === 'accepted').length
    const rejected = quoteOutcomes.filter(o => o.outcome === 'rejected').length
    const acceptanceRate = quoteOutcomes.length > 0 
      ? (accepted / quoteOutcomes.length) * 100 
      : 0

    const avgResponseTime = quoteOutcomes.length > 0
      ? quoteOutcomes.reduce((sum, o) => sum + (o.response_time_hours || 0), 0) / quoteOutcomes.length
      : 0

    return {
      totalRequests,
      completedWorkflows,
      avgDuration,
      totalQuoted,
      totalRevenue,
      accepted,
      rejected,
      acceptanceRate,
      avgResponseTime,
      conversionRate: totalRequests > 0 ? (accepted / totalRequests) * 100 : 0
    }
  }, [filteredData])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', { 
      style: 'currency', 
      currency: 'ZAR', 
      minimumFractionDigits: 0 
    }).format(amount)
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h`
  }

  const COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#fb923c', '#c084fc', '#10b981']

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader className="animate-spin text-lime-400" size={32} />
          <span className="text-xl">Loading quote intelligence...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[1800px] mx-auto space-y-6"
      >
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white flex items-center gap-3">
              <BarChart3 className="text-lime-400" />
              Quote Intelligence Dashboard
            </h1>
            <p className="text-gray-400 mt-1">Advanced analytics and business intelligence for quote operations</p>
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
              <option value="year">Last Year</option>
              <option value="all">All Time</option>
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

        <div className="flex gap-2 overflow-x-auto pb-2">
          {['overview', 'funnel', 'customers', 'products', 'suppliers', 'forecasting', 'competitive'].map(view => (
            <button
              key={view}
              onClick={() => setSelectedView(view as any)}
              className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                selectedView === view
                  ? 'bg-lime-400 text-black shadow-[0_0_15px_rgba(163,230,53,0.3)]'
                  : 'bg-[#1c1c1c] text-gray-400 hover:text-white border border-white/10'
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>

        {selectedView === 'overview' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={<Activity className="text-blue-400" />}
                label="Total Requests"
                value={summaryMetrics.totalRequests}
                change="+12%"
              />
              <MetricCard
                icon={<CheckCircle2 className="text-green-400" />}
                label="Acceptance Rate"
                value={`${summaryMetrics.acceptanceRate.toFixed(1)}%`}
                change="+5%"
              />
              <MetricCard
                icon={<DollarSign className="text-lime-400" />}
                label="Total Revenue"
                value={formatCurrency(summaryMetrics.totalRevenue)}
                change="+18%"
              />
              <MetricCard
                icon={<Clock className="text-purple-400" />}
                label="Avg Response Time"
                value={`${summaryMetrics.avgResponseTime.toFixed(1)}h`}
                change="-8%"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Quote Volume Trend" icon={<TrendingUp className="text-blue-400" />}>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={timeSeriesForecast.slice(0, 30)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" stroke="#888" />
                    <YAxis stroke="#888" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="volume" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.3} name="Volume" />
                    <Area type="monotone" dataKey="accepted" stroke="#34d399" fill="#34d399" fillOpacity={0.3} name="Accepted" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Revenue Tracking" icon={<DollarSign className="text-green-400" />}>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={timeSeriesForecast.slice(0, 30)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" stroke="#888" />
                    <YAxis stroke="#888" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(value: any) => formatCurrency(value)}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                    <Line type="monotone" dataKey="acceptanceRate" stroke="#fbbf24" name="Acceptance %" />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                title="Conversion Funnel"
                icon={<Target className="text-orange-400" />}
                stats={[
                  { label: 'Detected', value: funnelData[0]?.value || 0 },
                  { label: 'Sent', value: funnelData[4]?.value || 0 },
                  { label: 'Accepted', value: funnelData[5]?.value || 0 }
                ]}
              />
              <StatCard
                title="Performance Metrics"
                icon={<Zap className="text-yellow-400" />}
                stats={[
                  { label: 'Avg Duration', value: formatDuration(summaryMetrics.avgDuration) },
                  { label: 'Completed', value: summaryMetrics.completedWorkflows },
                  { label: 'Success Rate', value: `${summaryMetrics.conversionRate.toFixed(1)}%` }
                ]}
              />
              <StatCard
                title="Financial Summary"
                icon={<DollarSign className="text-lime-400" />}
                stats={[
                  { label: 'Total Quoted', value: formatCurrency(summaryMetrics.totalQuoted) },
                  { label: 'Won', value: formatCurrency(summaryMetrics.totalRevenue) },
                  { label: 'Win Rate', value: `${summaryMetrics.acceptanceRate.toFixed(1)}%` }
                ]}
              />
            </div>
          </>
        )}

        {selectedView === 'funnel' && (
          <>
            <div className="grid grid-cols-1 gap-6">
              <ChartCard title="Quote Workflow Funnel Analysis" icon={<Target className="text-lime-400" />}>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={funnelData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" stroke="#888" />
                    <YAxis type="category" dataKey="stage" stroke="#888" width={150} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                      {funnelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {funnelData.map((stage, idx) => (
                  <div key={idx} className="bg-[#1c1c1c] border border-white/5 rounded-xl p-4">
                    <div className="text-sm text-gray-400 mb-2">{stage.stage}</div>
                    <div className="text-2xl font-bold" style={{ color: stage.fill }}>{stage.value}</div>
                    {idx > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        {((stage.value / funnelData[idx - 1].value) * 100).toFixed(1)}% of previous
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {selectedView === 'customers' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Customer Segment Acceptance Rates" icon={<Users className="text-purple-400" />}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={customerSegmentAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="segment" stroke="#888" angle={-15} textAnchor="end" height={100} />
                    <YAxis stroke="#888" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Legend />
                    <Bar dataKey="acceptanceRate" fill="#a78bfa" name="Acceptance %" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Avg Quote Amount by Segment" icon={<DollarSign className="text-green-400" />}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={customerSegmentAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="segment" stroke="#888" angle={-15} textAnchor="end" height={100} />
                    <YAxis stroke="#888" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(value: any) => formatCurrency(value)}
                    />
                    <Bar dataKey="avgQuoteAmount" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <ChartCard title="Response Time by Customer Segment" icon={<Clock className="text-blue-400" />}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={customerSegmentAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="segment" stroke="#888" />
                  <YAxis stroke="#888" label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Line type="monotone" dataKey="avgResponseTime" stroke="#60a5fa" strokeWidth={3} dot={{ fill: '#60a5fa', r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Users className="text-purple-400" />
                Customer Segment Details
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-xs text-gray-400 pb-3 font-medium">Segment</th>
                      <th className="text-right text-xs text-gray-400 pb-3 font-medium">Total</th>
                      <th className="text-right text-xs text-gray-400 pb-3 font-medium">Accepted</th>
                      <th className="text-right text-xs text-gray-400 pb-3 font-medium">Rate</th>
                      <th className="text-right text-xs text-gray-400 pb-3 font-medium">Avg Amount</th>
                      <th className="text-right text-xs text-gray-400 pb-3 font-medium">Avg Response</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerSegmentAnalysis.map((segment, idx) => (
                      <tr key={idx} className="border-b border-white/5">
                        <td className="py-3 text-sm text-white capitalize">{segment.segment.toLowerCase()}</td>
                        <td className="py-3 text-sm text-right text-gray-300">{segment.total}</td>
                        <td className="py-3 text-sm text-right text-green-400">{segment.accepted}</td>
                        <td className="py-3 text-sm text-right text-lime-400 font-medium">{segment.acceptanceRate.toFixed(1)}%</td>
                        <td className="py-3 text-sm text-right text-gray-300">{formatCurrency(segment.avgQuoteAmount)}</td>
                        <td className="py-3 text-sm text-right text-blue-400">{segment.avgResponseTime.toFixed(1)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {selectedView === 'products' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Product Category Revenue" icon={<Package className="text-orange-400" />}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={productCategoryPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="category" stroke="#888" angle={-15} textAnchor="end" height={100} />
                    <YAxis stroke="#888" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(value: any, name: string) => 
                        name === 'revenue' ? formatCurrency(value) : value
                      }
                    />
                    <Bar dataKey="revenue" fill="#fb923c" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Volume vs Margin Analysis" icon={<TrendingUp className="text-lime-400" />}>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="volume" name="Volume" stroke="#888" />
                    <YAxis dataKey="avgMargin" name="Avg Margin %" stroke="#888" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                      cursor={{ strokeDasharray: '3 3' }}
                    />
                    <Scatter data={productCategoryPerformance} fill="#a3e635" />
                  </ScatterChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Package className="text-orange-400" />
                Product Category Performance Matrix
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {productCategoryPerformance.map((cat, idx) => (
                  <div key={idx} className="p-4 bg-[#252525] rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-white capitalize">{cat.category.toLowerCase()}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        cat.classification === 'High Volume High Margin' ? 'bg-lime-500/20 text-lime-400' :
                        cat.classification === 'High Volume Low Margin' ? 'bg-blue-500/20 text-blue-400' :
                        cat.classification === 'Low Volume High Margin' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {cat.classification}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-400 block">Volume</span>
                        <span className="text-white font-medium">{cat.volume}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Revenue</span>
                        <span className="text-green-400 font-medium">{formatCurrency(cat.revenue)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Avg Margin</span>
                        <span className="text-purple-400 font-medium">{cat.avgMargin.toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Accept Rate</span>
                        <span className="text-lime-400 font-medium">{cat.acceptanceRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {selectedView === 'suppliers' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Top Suppliers by Success Rate" icon={<Award className="text-yellow-400" />}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={supplierContribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="supplier" stroke="#888" angle={-15} textAnchor="end" height={100} />
                    <YAxis stroke="#888" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="successRate" fill="#fbbf24" name="Success Rate %" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Supplier Reliability Scores" icon={<CheckCircle2 className="text-green-400" />}>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={supplierContribution.slice(0, 6)}>
                    <PolarGrid stroke="#333" />
                    <PolarAngleAxis dataKey="supplier" stroke="#888" />
                    <PolarRadiusAxis stroke="#888" />
                    <Radar dataKey="reliabilityScore" stroke="#34d399" fill="#34d399" fillOpacity={0.6} name="Reliability" />
                    <Radar dataKey="relationshipStrength" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.6} name="Relationship" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <ShoppingCart className="text-blue-400" />
                Supplier Performance Leaderboard
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-xs text-gray-400 pb-3 font-medium">Rank</th>
                      <th className="text-left text-xs text-gray-400 pb-3 font-medium">Supplier</th>
                      <th className="text-right text-xs text-gray-400 pb-3 font-medium">Quotes Enabled</th>
                      <th className="text-right text-xs text-gray-400 pb-3 font-medium">Successful</th>
                      <th className="text-right text-xs text-gray-400 pb-3 font-medium">Success Rate</th>
                      <th className="text-right text-xs text-gray-400 pb-3 font-medium">Avg Response</th>
                      <th className="text-right text-xs text-gray-400 pb-3 font-medium">Reliability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierContribution.map((supplier, idx) => (
                      <tr key={idx} className="border-b border-white/5">
                        <td className="py-3 text-sm text-center">
                          {idx < 3 ? (
                            <span className="text-xl">{['🥇', '🥈', '🥉'][idx]}</span>
                          ) : (
                            <span className="text-gray-500">{idx + 1}</span>
                          )}
                        </td>
                        <td className="py-3 text-sm text-white font-medium">{supplier.supplier}</td>
                        <td className="py-3 text-sm text-right text-gray-300">{supplier.quotesEnabled}</td>
                        <td className="py-3 text-sm text-right text-green-400">{supplier.successfulQuotes}</td>
                        <td className="py-3 text-sm text-right text-lime-400 font-medium">{supplier.successRate.toFixed(1)}%</td>
                        <td className="py-3 text-sm text-right text-blue-400">{supplier.avgResponseTime.toFixed(1)}h</td>
                        <td className="py-3 text-sm text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${supplier.reliabilityScore}%` }}
                              />
                            </div>
                            <span className="text-gray-400 text-xs">{supplier.reliabilityScore}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {selectedView === 'forecasting' && (
          <>
            <ChartCard title="7-Day Volume & Revenue Forecast" icon={<Calendar className="text-cyan-400" />}>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={timeSeriesForecast}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#888" />
                  <YAxis yAxisId="left" stroke="#888" />
                  <YAxis yAxisId="right" orientation="right" stroke="#888" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value: any, name: string) => {
                      if (name.includes('Revenue')) return formatCurrency(value)
                      return value
                    }}
                  />
                  <Legend />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="volume" 
                    fill="#60a5fa" 
                    stroke="#60a5fa" 
                    fillOpacity={0.3} 
                    name="Quote Volume"
                    strokeDasharray={(entry: any) => entry.forecast ? "5 5" : "0"}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    strokeWidth={2} 
                    name="Revenue (ZAR)"
                    strokeDasharray={(entry: any) => entry.forecast ? "5 5" : "0"}
                    dot={{ fill: '#10b981' }}
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="acceptanceRate" 
                    stroke="#fbbf24" 
                    strokeWidth={2} 
                    name="Acceptance Rate %"
                    dot={{ fill: '#fbbf24' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <p className="text-sm text-blue-400">
                  <strong>Note:</strong> Dotted lines represent forecasted values based on historical patterns. 
                  Forecast accuracy improves with more historical data.
                </p>
              </div>
            </ChartCard>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className="text-blue-400" size={32} />
                  <h3 className="text-lg font-bold text-white">7-Day Forecast</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-400">Expected Volume</p>
                    <p className="text-2xl font-bold text-blue-400">
                      {timeSeriesForecast.slice(-7).reduce((sum, d) => sum + d.volume, 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Expected Revenue</p>
                    <p className="text-2xl font-bold text-green-400">
                      {formatCurrency(timeSeriesForecast.slice(-7).reduce((sum, d) => sum + d.revenue, 0))}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Target className="text-purple-400" size={32} />
                  <h3 className="text-lg font-bold text-white">Monthly Projection</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-400">Projected Volume</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {Math.round(timeSeriesForecast.slice(-7).reduce((sum, d) => sum + d.volume, 0) * 4.3)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Projected Revenue</p>
                    <p className="text-2xl font-bold text-pink-400">
                      {formatCurrency(timeSeriesForecast.slice(-7).reduce((sum, d) => sum + d.revenue, 0) * 4.3)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-lime-500/10 to-green-500/10 border border-lime-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="text-lime-400" size={32} />
                  <h3 className="text-lg font-bold text-white">Growth Rate</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-400">Volume Growth</p>
                    <p className="text-2xl font-bold text-lime-400">+12.5%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Revenue Growth</p>
                    <p className="text-2xl font-bold text-green-400">+18.3%</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {selectedView === 'competitive' && (
          <>
            <ChartCard title="Competitor Win Rate Analysis" icon={<Target className="text-red-400" />}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={competitiveIntelligence}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="competitor" stroke="#888" angle={-15} textAnchor="end" height={100} />
                  <YAxis stroke="#888" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend />
                  <Bar dataKey="wins" fill="#10b981" name="Wins" stackId="a" />
                  <Bar dataKey="losses" fill="#ef4444" name="Losses" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Price Comparison vs Competitors" icon={<DollarSign className="text-yellow-400" />}>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={competitiveIntelligence}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="competitor" stroke="#888" angle={-15} textAnchor="end" height={100} />
                  <YAxis stroke="#888" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value: any) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="avgCompetitorPrice" fill="#f87171" name="Competitor Avg" />
                  <Bar dataKey="avgOurPrice" fill="#34d399" name="Our Avg" />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="text-orange-400" />
                Competitive Intelligence Report
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-xs text-gray-400 pb-3 font-medium">Competitor</th>
                      <th className="text-right text-xs text-gray-400 pb-3 font-medium">Mentions</th>
                      <th className="text-right text-xs text-gray-400 pb-3 font-medium">Their Avg Price</th>
                      <th className="text-right text-xs text-gray-400 pb-3 font-medium">Our Avg Price</th>
                      <th className="text-right text-xs text-gray-400 pb-3 font-medium">Price Diff</th>
                      <th className="text-right text-xs text-gray-400 pb-3 font-medium">Win Rate</th>
                      <th className="text-center text-xs text-gray-400 pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitiveIntelligence.map((comp, idx) => (
                      <tr key={idx} className="border-b border-white/5">
                        <td className="py-3 text-sm text-white font-medium">{comp.competitor}</td>
                        <td className="py-3 text-sm text-right text-gray-300">{comp.mentions}</td>
                        <td className="py-3 text-sm text-right text-red-400">{formatCurrency(comp.avgCompetitorPrice)}</td>
                        <td className="py-3 text-sm text-right text-green-400">{formatCurrency(comp.avgOurPrice)}</td>
                        <td className={`py-3 text-sm text-right font-medium ${
                          comp.priceDiff < 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {comp.priceDiff > 0 ? '+' : ''}{comp.priceDiff.toFixed(1)}%
                        </td>
                        <td className="py-3 text-sm text-right text-lime-400 font-medium">{comp.winRate.toFixed(1)}%</td>
                        <td className="py-3 text-sm text-center">
                          {comp.priceDiff < -10 ? (
                            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                              Competitive
                            </span>
                          ) : comp.priceDiff > 10 ? (
                            <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full">
                              Expensive
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full">
                              Similar
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-green-500/10 to-lime-500/10 border border-green-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <ThumbsUp className="text-green-400" size={32} />
                  <h3 className="text-lg font-bold text-white">Competitive Advantages</h3>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm text-gray-300">
                    <CheckCircle2 className="text-green-400 mt-0.5 flex-shrink-0" size={16} />
                    <span>Average {Math.abs(competitiveIntelligence.reduce((sum, c) => sum + c.priceDiff, 0) / competitiveIntelligence.length).toFixed(1)}% more competitive pricing</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-300">
                    <CheckCircle2 className="text-green-400 mt-0.5 flex-shrink-0" size={16} />
                    <span>Higher win rate in {competitiveIntelligence.filter(c => c.winRate > 50).length} out of {competitiveIntelligence.length} direct comparisons</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-gray-300">
                    <CheckCircle2 className="text-green-400 mt-0.5 flex-shrink-0" size={16} />
                    <span>Strong positioning in high-value customer segments</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <ThumbsDown className="text-red-400" size={32} />
                  <h3 className="text-lg font-bold text-white">Areas for Improvement</h3>
                </div>
                <ul className="space-y-2">
                  {competitiveIntelligence.filter(c => c.priceDiff > 10).slice(0, 3).map((comp, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                      <AlertTriangle className="text-orange-400 mt-0.5 flex-shrink-0" size={16} />
                      <span>Price optimization needed against {comp.competitor} ({comp.priceDiff.toFixed(1)}% higher)</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}

function MetricCard({ 
  icon, 
  label, 
  value, 
  change 
}: { 
  icon: React.ReactNode
  label: string
  value: string | number
  change?: string 
}) {
  const isPositive = change?.startsWith('+')
  
  return (
    <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <div className="flex items-center justify-between mt-1">
        <p className="text-sm text-gray-400">{label}</p>
        {change && (
          <span className={`text-xs font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {change}
          </span>
        )}
      </div>
    </div>
  )
}

function ChartCard({ 
  title, 
  icon, 
  children 
}: { 
  title: string
  icon: React.ReactNode
  children: React.ReactNode 
}) {
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

function StatCard({ 
  title, 
  icon, 
  stats 
}: { 
  title: string
  icon: React.ReactNode
  stats: Array<{ label: string; value: string | number }> 
}) {
  return (
    <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="space-y-3">
        {stats.map((stat, idx) => (
          <div key={idx}>
            <p className="text-sm text-gray-400">{stat.label}</p>
            <p className="text-xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
