'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
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
  FileText,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Package,
  Building2,
  Target,
  Zap,
  Edit3,
  ArrowUp,
  ArrowDown,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  RefreshCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface QuoteRequest {
  id: string
  customer_email: string
  customer_name: string | null
  requested_products: any[]
  status: 'detected' | 'suppliers_contacted' | 'quotes_received' | 'pdf_generated' | 'sent_to_customer' | 'completed'
  confidence_score: number | null
  metadata: {
    suppliers_contacted?: string[]
    supplier_responses?: any[]
    total_quoted_amount?: number
    automation_notes?: string[]
    sent_at?: string
    customer_decision?: 'accepted' | 'rejected' | 'pending'
    decision_at?: string
  }
  created_at: string
  completed_at: string | null
  updated_at: string
}

interface SupplierResponse {
  id: string
  supplier_id: string
  quote_request_id: string | null
  products_mentioned: string[]
  pricing_data: {
    items?: Array<{ product: string; price: number }>
    total?: number
  }
  extracted_at: string
  created_at: string
  supplier?: {
    id: string
    name: string
    company: string
    reliability_score: number
  }
}

interface QuoteApprovalFeedback {
  id: string
  quote_request_id: string
  action: 'approved' | 'rejected' | 'edited'
  reason: string | null
  original_total: number | null
  edited_total: number | null
  edits: any[]
  patterns: any
  created_at: string
}

interface QuoteEdit {
  id: string
  quote_request_id: string
  edit_type: string
  item_name: string | null
  reason: string | null
  created_at: string
}

interface SupplierProduct {
  id: string
  supplier_id: string
  product_name: string
  product_category: string | null
  avg_markup_percentage: number | null
  last_quoted_price: number | null
  last_quoted_date: string | null
}

export default function QuoteAutomationAnalyticsPage() {
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([])
  const [supplierResponses, setSupplierResponses] = useState<SupplierResponse[]>([])
  const [approvalFeedback, setApprovalFeedback] = useState<QuoteApprovalFeedback[]>([])
  const [quoteEdits, setQuoteEdits] = useState<QuoteEdit[]>([])
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month')

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    setIsLoading(true)
    try {
      const [quotesRes, responsesRes, feedbackRes, editsRes, productsRes] = await Promise.all([
        supabase.from('quote_requests').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('email_supplier_interactions').select(`
          *,
          supplier:suppliers(id, name, company, reliability_score)
        `).eq('interaction_type', 'quote_response').limit(500),
        supabase.from('quote_approval_feedback').select('*').limit(500),
        supabase.from('quote_edits').select('*').limit(500),
        supabase.from('supplier_products').select('*').limit(1000)
      ])

      if (quotesRes.data) setQuoteRequests(quotesRes.data)
      if (responsesRes.data) setSupplierResponses(responsesRes.data as any)
      if (feedbackRes.data) setApprovalFeedback(feedbackRes.data)
      if (editsRes.data) setQuoteEdits(editsRes.data)
      if (productsRes.data) setSupplierProducts(productsRes.data)
    } catch (error) {
      console.error('Failed to fetch analytics data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const dateFilteredQuotes = useMemo(() => {
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

    return quoteRequests.filter(q => new Date(q.created_at) >= cutoffDate)
  }, [quoteRequests, dateRange])

  const volumeOverTime = useMemo(() => {
    const dailyData: Record<string, { date: string; received: number; sent: number; wins: number; losses: number }> = {}
    
    dateFilteredQuotes.forEach(quote => {
      const date = new Date(quote.created_at).toLocaleDateString()
      if (!dailyData[date]) {
        dailyData[date] = { date, received: 0, sent: 0, wins: 0, losses: 0 }
      }
      dailyData[date].received++
      
      if (quote.status === 'sent_to_customer' || quote.status === 'completed') {
        dailyData[date].sent++
      }
      
      if (quote.metadata?.customer_decision === 'accepted') {
        dailyData[date].wins++
      } else if (quote.metadata?.customer_decision === 'rejected') {
        dailyData[date].losses++
      }
    })

    return Object.values(dailyData).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [dateFilteredQuotes])

  const timeMetrics = useMemo(() => {
    const metrics = {
      request_to_suppliers_contacted: [] as number[],
      suppliers_contacted_to_responses: [] as number[],
      responses_to_pdf: [] as number[],
      pdf_to_sent: [] as number[],
      sent_to_decision: [] as number[]
    }

    dateFilteredQuotes.forEach(quote => {
      const created = new Date(quote.created_at).getTime()
      
      if (quote.status !== 'detected') {
        const contactedTime = new Date(quote.updated_at).getTime()
        metrics.request_to_suppliers_contacted.push((contactedTime - created) / (1000 * 60 * 60))
      }
      
      if (quote.metadata?.supplier_responses && quote.metadata.supplier_responses.length > 0) {
        const firstResponse = Math.min(...quote.metadata.supplier_responses.map((r: any) => new Date(r.timestamp || quote.updated_at).getTime()))
        metrics.suppliers_contacted_to_responses.push((firstResponse - created) / (1000 * 60 * 60))
      }
      
      if (quote.status === 'pdf_generated' || quote.status === 'sent_to_customer' || quote.status === 'completed') {
        const pdfTime = new Date(quote.updated_at).getTime()
        metrics.responses_to_pdf.push((pdfTime - created) / (1000 * 60 * 60))
      }
      
      if (quote.metadata?.sent_at) {
        const sentTime = new Date(quote.metadata.sent_at).getTime()
        metrics.pdf_to_sent.push((sentTime - created) / (1000 * 60 * 60))
      }
      
      if (quote.metadata?.decision_at) {
        const decisionTime = new Date(quote.metadata.decision_at).getTime()
        const sentTime = quote.metadata.sent_at ? new Date(quote.metadata.sent_at).getTime() : created
        metrics.sent_to_decision.push((decisionTime - sentTime) / (1000 * 60 * 60))
      }
    })

    return {
      request_to_suppliers: metrics.request_to_suppliers_contacted.length > 0 
        ? metrics.request_to_suppliers_contacted.reduce((a, b) => a + b, 0) / metrics.request_to_suppliers_contacted.length 
        : 0,
      suppliers_to_responses: metrics.suppliers_contacted_to_responses.length > 0
        ? metrics.suppliers_contacted_to_responses.reduce((a, b) => a + b, 0) / metrics.suppliers_contacted_to_responses.length
        : 0,
      responses_to_pdf: metrics.responses_to_pdf.length > 0
        ? metrics.responses_to_pdf.reduce((a, b) => a + b, 0) / metrics.responses_to_pdf.length
        : 0,
      pdf_to_sent: metrics.pdf_to_sent.length > 0
        ? metrics.pdf_to_sent.reduce((a, b) => a + b, 0) / metrics.pdf_to_sent.length
        : 0,
      sent_to_decision: metrics.sent_to_decision.length > 0
        ? metrics.sent_to_decision.reduce((a, b) => a + b, 0) / metrics.sent_to_decision.length
        : 0
    }
  }, [dateFilteredQuotes])

  const supplierPerformance = useMemo(() => {
    const performanceMap: Record<string, {
      supplier: string
      totalResponses: number
      avgResponseTime: number
      quotedProducts: number
      avgAccuracy: number
      winRate: number
      responseTimes: number[]
    }> = {}

    supplierResponses.forEach(response => {
      if (!response.supplier) return
      
      const supplierId = response.supplier.id
      const supplierName = response.supplier.company
      
      if (!performanceMap[supplierId]) {
        performanceMap[supplierId] = {
          supplier: supplierName,
          totalResponses: 0,
          avgResponseTime: 0,
          quotedProducts: 0,
          avgAccuracy: response.supplier.reliability_score || 0,
          winRate: 0,
          responseTimes: []
        }
      }
      
      performanceMap[supplierId].totalResponses++
      performanceMap[supplierId].quotedProducts += response.products_mentioned.length
      
      if (response.quote_request_id) {
        const quote = quoteRequests.find(q => q.id === response.quote_request_id)
        if (quote) {
          const requestTime = new Date(quote.created_at).getTime()
          const responseTime = new Date(response.extracted_at).getTime()
          performanceMap[supplierId].responseTimes.push((responseTime - requestTime) / (1000 * 60 * 60))
        }
      }
    })

    return Object.values(performanceMap).map(perf => ({
      ...perf,
      avgResponseTime: perf.responseTimes.length > 0
        ? perf.responseTimes.reduce((a, b) => a + b, 0) / perf.responseTimes.length
        : 0
    })).sort((a, b) => b.totalResponses - a.totalResponses).slice(0, 10)
  }, [supplierResponses, quoteRequests])

  const productDemand = useMemo(() => {
    const productCounts: Record<string, { product: string; count: number; category: string | null }> = {}
    
    dateFilteredQuotes.forEach(quote => {
      quote.requested_products?.forEach((product: any) => {
        const name = product.name || product.product || 'Unknown'
        if (!productCounts[name]) {
          productCounts[name] = {
            product: name,
            count: 0,
            category: product.category || null
          }
        }
        productCounts[name].count++
      })
    })

    return Object.values(productCounts).sort((a, b) => b.count - a.count).slice(0, 15)
  }, [dateFilteredQuotes])

  const confidenceTrends = useMemo(() => {
    const weeklyData: Record<string, { week: string; avgConfidence: number; count: number; total: number }> = {}
    
    dateFilteredQuotes.forEach(quote => {
      if (quote.confidence_score === null) return
      
      const date = new Date(quote.created_at)
      const weekStart = new Date(date.setDate(date.getDate() - date.getDay()))
      const weekKey = weekStart.toLocaleDateString()
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { week: weekKey, avgConfidence: 0, count: 0, total: 0 }
      }
      
      weeklyData[weekKey].total += quote.confidence_score * 100
      weeklyData[weekKey].count++
    })

    return Object.values(weeklyData).map(w => ({
      week: w.week,
      avgConfidence: w.count > 0 ? w.total / w.count : 0
    })).sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime())
  }, [dateFilteredQuotes])

  const kennyInterventions = useMemo(() => {
    const interventionReasons: Record<string, number> = {}
    const editPatterns: Record<string, number> = {}
    
    approvalFeedback.forEach(feedback => {
      if (feedback.action === 'rejected' || feedback.action === 'edited') {
        const reason = feedback.reason || 'No reason specified'
        interventionReasons[reason] = (interventionReasons[reason] || 0) + 1
      }
    })

    quoteEdits.forEach(edit => {
      editPatterns[edit.edit_type] = (editPatterns[edit.edit_type] || 0) + 1
    })

    const totalInterventions = approvalFeedback.filter(f => f.action === 'rejected' || f.action === 'edited').length
    const totalQuotes = dateFilteredQuotes.length
    const interventionRate = totalQuotes > 0 ? (totalInterventions / totalQuotes) * 100 : 0

    return {
      rate: interventionRate,
      reasons: Object.entries(interventionReasons).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
      patterns: Object.entries(editPatterns).map(([pattern, count]) => ({ pattern, count })).sort((a, b) => b.count - a.count)
    }
  }, [approvalFeedback, quoteEdits, dateFilteredQuotes])

  const revenueImpact = useMemo(() => {
    const automatedQuotes = dateFilteredQuotes.filter(q => 
      (q.status === 'sent_to_customer' || q.status === 'completed') &&
      (!approvalFeedback.some(f => f.quote_request_id === q.id && f.action === 'edited'))
    )

    const totalAutomatedValue = automatedQuotes.reduce((sum, q) => 
      sum + (q.metadata?.total_quoted_amount || 0), 0
    )

    const acceptedQuotes = dateFilteredQuotes.filter(q => q.metadata?.customer_decision === 'accepted')
    const totalRevenue = acceptedQuotes.reduce((sum, q) => sum + (q.metadata?.total_quoted_amount || 0), 0)

    const avgTimePerManualQuote = 2
    const timesSaved = automatedQuotes.length * avgTimePerManualQuote
    const costPerHour = 150
    const timeSavingsValue = timesSaved * costPerHour

    const winRate = dateFilteredQuotes.filter(q => q.metadata?.customer_decision).length > 0
      ? (acceptedQuotes.length / dateFilteredQuotes.filter(q => q.metadata?.customer_decision).length) * 100
      : 0

    return {
      automatedCount: automatedQuotes.length,
      automatedValue: totalAutomatedValue,
      totalRevenue,
      timeSavingsHours: timesSaved,
      timeSavingsValue,
      winRate
    }
  }, [dateFilteredQuotes, approvalFeedback])

  const summaryMetrics = useMemo(() => {
    const total = dateFilteredQuotes.length
    const sent = dateFilteredQuotes.filter(q => q.status === 'sent_to_customer' || q.status === 'completed').length
    const wins = dateFilteredQuotes.filter(q => q.metadata?.customer_decision === 'accepted').length
    const withDecisions = dateFilteredQuotes.filter(q => q.metadata?.customer_decision).length
    
    return {
      totalQuotes: total,
      quotesSent: sent,
      winRate: withDecisions > 0 ? (wins / withDecisions) * 100 : 0,
      avgTimeToQuote: timeMetrics.request_to_suppliers + timeMetrics.suppliers_to_responses + timeMetrics.responses_to_pdf,
      automationRate: total > 0 ? ((sent - kennyInterventions.rate) / total) * 100 : 0
    }
  }, [dateFilteredQuotes, timeMetrics, kennyInterventions])

  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`
    if (hours < 24) return `${hours.toFixed(1)}h`
    return `${(hours / 24).toFixed(1)}d`
  }

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
              <BarChart3 className="text-lime-400" />
              Quote Automation Analytics
            </h1>
            <p className="text-gray-400 mt-1">Performance insights and automation metrics</p>
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
            </select>
            <button
              onClick={fetchAllData}
              className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            icon={<FileText className="text-blue-400" />}
            label="Total Quotes"
            value={summaryMetrics.totalQuotes}
          />
          <MetricCard
            icon={<CheckCircle2 className="text-lime-400" />}
            label="Quotes Sent"
            value={summaryMetrics.quotesSent}
          />
          <MetricCard
            icon={<Target className="text-green-400" />}
            label="Win Rate"
            value={`${summaryMetrics.winRate.toFixed(1)}%`}
          />
          <MetricCard
            icon={<Clock className="text-purple-400" />}
            label="Avg Time to Quote"
            value={formatHours(summaryMetrics.avgTimeToQuote)}
          />
          <MetricCard
            icon={<Zap className="text-yellow-400" />}
            label="Automation Rate"
            value={`${summaryMetrics.automationRate.toFixed(1)}%`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Quote Volume Over Time" icon={<Activity className="text-lime-400" />}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={volumeOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Area type="monotone" dataKey="received" stackId="1" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.6} name="Received" />
                <Area type="monotone" dataKey="sent" stackId="2" stroke="#a3e635" fill="#a3e635" fillOpacity={0.6} name="Sent" />
                <Area type="monotone" dataKey="wins" stackId="3" stroke="#34d399" fill="#34d399" fillOpacity={0.6} name="Wins" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Win Rate Trend" icon={<TrendingUp className="text-green-400" />}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={volumeOverTime.map(d => ({
                date: d.date,
                winRate: d.sent > 0 ? (d.wins / d.sent) * 100 : 0
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                />
                <Line type="monotone" dataKey="winRate" stroke="#34d399" strokeWidth={2} dot={{ fill: '#34d399' }} name="Win Rate %" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard title="Average Time Metrics (Hours)" icon={<Clock className="text-purple-400" />}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              { stage: 'Request → Suppliers', hours: timeMetrics.request_to_suppliers },
              { stage: 'Suppliers → Responses', hours: timeMetrics.suppliers_to_responses },
              { stage: 'Responses → PDF', hours: timeMetrics.responses_to_pdf },
              { stage: 'PDF → Sent', hours: timeMetrics.pdf_to_sent },
              { stage: 'Sent → Decision', hours: timeMetrics.sent_to_decision }
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="stage" stroke="#888" angle={-15} textAnchor="end" height={100} />
              <YAxis stroke="#888" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
                formatter={(value: number) => formatHours(value)}
              />
              <Bar dataKey="hours" fill="#c084fc" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Building2 className="text-cyan-400" />
              Supplier Performance
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs text-gray-400 pb-3 font-medium">Supplier</th>
                    <th className="text-right text-xs text-gray-400 pb-3 font-medium">Responses</th>
                    <th className="text-right text-xs text-gray-400 pb-3 font-medium">Avg Time</th>
                    <th className="text-right text-xs text-gray-400 pb-3 font-medium">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierPerformance.map((supplier, idx) => (
                    <tr key={idx} className="border-b border-white/5">
                      <td className="py-3 text-sm text-white">{supplier.supplier}</td>
                      <td className="py-3 text-sm text-right text-gray-300">{supplier.totalResponses}</td>
                      <td className="py-3 text-sm text-right text-gray-300">{formatHours(supplier.avgResponseTime)}</td>
                      <td className="py-3 text-sm text-right">
                        <span className={`${supplier.avgAccuracy >= 80 ? 'text-lime-400' : supplier.avgAccuracy >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {supplier.avgAccuracy.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ChartCard title="Product Demand Analysis" icon={<Package className="text-orange-400" />}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={productDemand} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" stroke="#888" />
                <YAxis dataKey="product" type="category" stroke="#888" width={150} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="count" fill="#fb923c" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Automation Confidence Trends" icon={<TrendingUp className="text-lime-400" />}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={confidenceTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="week" stroke="#888" />
                <YAxis stroke="#888" domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                />
                <Line type="monotone" dataKey="avgConfidence" stroke="#a3e635" strokeWidth={3} dot={{ fill: '#a3e635', r: 5 }} name="Confidence %" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Kenny Intervention Analysis" icon={<Edit3 className="text-yellow-400" />}>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#252525] rounded-xl">
                <span className="text-sm text-gray-400">Intervention Rate</span>
                <span className="text-2xl font-bold text-yellow-400">{kennyInterventions.rate.toFixed(1)}%</span>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-3">Top Intervention Reasons</h4>
                <div className="space-y-2">
                  {kennyInterventions.reasons.slice(0, 5).map((reason, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300 flex-1 truncate">{reason.reason}</span>
                      <span className="text-white font-medium ml-2">{reason.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-3 mt-4">Common Edit Patterns</h4>
                <div className="space-y-2">
                  {kennyInterventions.patterns.slice(0, 5).map((pattern, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300 capitalize">{pattern.pattern.replace(/_/g, ' ')}</span>
                      <span className="text-white font-medium">{pattern.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-lime-500/10 to-green-500/10 border border-lime-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="text-lime-400" size={32} />
              <h3 className="text-lg font-bold text-white">Revenue Impact</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Automated Quotes Value</p>
                <p className="text-2xl font-bold text-lime-400">{formatCurrency(revenueImpact.automatedValue)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Revenue (Accepted)</p>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(revenueImpact.totalRevenue)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Win Rate</p>
                <p className="text-xl font-bold text-white">{revenueImpact.winRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="text-purple-400" size={32} />
              <h3 className="text-lg font-bold text-white">Time Savings</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Hours Saved</p>
                <p className="text-2xl font-bold text-purple-400">{revenueImpact.timeSavingsHours.toFixed(1)}h</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Value of Time Saved</p>
                <p className="text-2xl font-bold text-pink-400">{formatCurrency(revenueImpact.timeSavingsValue)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Automated Quotes</p>
                <p className="text-xl font-bold text-white">{revenueImpact.automatedCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Target className="text-blue-400" size={32} />
              <h3 className="text-lg font-bold text-white">Efficiency Metrics</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Avg Time Per Quote</p>
                <p className="text-2xl font-bold text-blue-400">{formatHours(summaryMetrics.avgTimeToQuote)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Automation Success</p>
                <p className="text-2xl font-bold text-cyan-400">{summaryMetrics.automationRate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Manual vs Auto</p>
                <p className="text-xl font-bold text-white">{kennyInterventions.rate.toFixed(1)}% / {(100 - kennyInterventions.rate).toFixed(1)}%</p>
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
