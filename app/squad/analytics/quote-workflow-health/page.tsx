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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  FileText,
  Building2,
  Zap,
  AlertCircle,
  RefreshCw,
  XCircle,
  Shield,
  Target,
  Wrench,
  BarChart3,
  Timer,
  ThumbsUp
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface WorkflowExecution {
  id: string
  workflow_id: string
  workflow_type: string
  status: string
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
  failure_step: string | null
  bottleneck_detected: boolean
  bottleneck_step: string | null
  bottleneck_duration: number | null
  recovery_attempted: boolean
  recovery_successful: boolean | null
  alert_triggered: boolean
  alert_type: string | null
  diagnostic_results: any
  suggested_fixes: string[]
}

interface HealthMetric {
  workflow_type: string
  status: string
  execution_count: number
  avg_duration_seconds: number
  median_duration_seconds: number
  p95_duration_seconds: number
  success_rate: number
  failure_rate: number
  avg_supplier_response_rate: number
  bottleneck_count: number
  bottleneck_rate: number
  recovery_attempt_count: number
  recovery_success_rate: number
  alert_count: number
}

interface Bottleneck {
  bottleneck_step: string
  occurrence_count: number
  avg_bottleneck_duration: number
  max_bottleneck_duration: number
  led_to_failure_count: number
  common_failure_reasons: string
}

interface FailureAnalysis {
  failure_step: string
  failure_reason: string
  failure_count: number
  recovery_attempted_count: number
  recovery_successful_count: number
  avg_duration_before_failure: number
  circuit_breaker_count: number
  common_suggested_fixes: any[]
}

interface Alert {
  alert_type: string
  alert_count: number
  resolved_count: number
  unresolved_count: number
  avg_resolution_time_seconds: number
  unresolved_workflow_ids: string[]
}

export default function QuoteWorkflowHealthPage() {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([])
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([])
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([])
  const [failures, setFailures] = useState<FailureAnalysis[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [supplierTrends, setSupplierTrends] = useState<any[]>([])
  const [pdfStats, setPdfStats] = useState<any[]>([])
  const [acceptancePatterns, setAcceptancePatterns] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'day' | 'week' | 'month'>('week')

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    setIsLoading(true)
    try {
      const [
        executionsRes,
        metricsRes,
        bottlenecksRes,
        failuresRes,
        alertsRes,
        supplierRes,
        pdfRes,
        acceptanceRes
      ] = await Promise.all([
        supabase.from('quote_workflow_executions').select('*').order('started_at', { ascending: false }).limit(500),
        supabase.from('quote_workflow_health_metrics').select('*'),
        supabase.from('quote_workflow_bottlenecks').select('*').limit(20),
        supabase.from('quote_workflow_failure_analysis').select('*').limit(20),
        supabase.from('quote_workflow_alert_summary').select('*'),
        supabase.from('quote_workflow_supplier_trends').select('*').order('date', { ascending: false }).limit(30),
        supabase.from('quote_workflow_pdf_generation_stats').select('*').order('date', { ascending: false }).limit(30),
        supabase.from('quote_workflow_customer_acceptance_patterns').select('*').order('week', { ascending: false }).limit(12)
      ])

      if (executionsRes.data) setExecutions(executionsRes.data)
      if (metricsRes.data) setHealthMetrics(metricsRes.data)
      if (bottlenecksRes.data) setBottlenecks(bottlenecksRes.data)
      if (failuresRes.data) setFailures(failuresRes.data)
      if (alertsRes.data) setAlerts(alertsRes.data)
      if (supplierRes.data) setSupplierTrends(supplierRes.data.reverse())
      if (pdfRes.data) setPdfStats(pdfRes.data.reverse())
      if (acceptanceRes.data) setAcceptancePatterns(acceptanceRes.data.reverse())

    } catch (error) {
      console.error('Failed to fetch workflow health data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const dateFilteredExecutions = useMemo(() => {
    const now = new Date()
    const cutoffDate = new Date()
    
    switch (dateRange) {
      case 'day':
        cutoffDate.setDate(now.getDate() - 1)
        break
      case 'week':
        cutoffDate.setDate(now.getDate() - 7)
        break
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1)
        break
    }

    return executions.filter(e => new Date(e.started_at) >= cutoffDate)
  }, [executions, dateRange])

  const summaryStats = useMemo(() => {
    const total = dateFilteredExecutions.length
    const completed = dateFilteredExecutions.filter(e => e.status === 'completed').length
    const failed = dateFilteredExecutions.filter(e => e.status === 'failed').length
    const stuck = dateFilteredExecutions.filter(e => e.status === 'stuck').length
    const withBottlenecks = dateFilteredExecutions.filter(e => e.bottleneck_detected).length
    const withAlerts = dateFilteredExecutions.filter(e => e.alert_triggered).length
    const recovered = dateFilteredExecutions.filter(e => e.recovery_successful).length

    const avgDuration = dateFilteredExecutions
      .filter(e => e.total_duration_seconds)
      .reduce((sum, e) => sum + (e.total_duration_seconds || 0), 0) / 
      dateFilteredExecutions.filter(e => e.total_duration_seconds).length || 0

    return {
      total,
      completed,
      failed,
      stuck,
      successRate: total > 0 ? (completed / total) * 100 : 0,
      failureRate: total > 0 ? (failed / total) * 100 : 0,
      bottleneckRate: total > 0 ? (withBottlenecks / total) * 100 : 0,
      alertRate: total > 0 ? (withAlerts / total) * 100 : 0,
      recoveryRate: dateFilteredExecutions.filter(e => e.recovery_attempted).length > 0
        ? (recovered / dateFilteredExecutions.filter(e => e.recovery_attempted).length) * 100
        : 0,
      avgDuration
    }
  }, [dateFilteredExecutions])

  const stepTimingData = useMemo(() => {
    const steps = [
      { name: 'Detection', field: 'detection_duration' },
      { name: 'Supplier Contact', field: 'supplier_contact_duration' },
      { name: 'Response Wait', field: 'response_wait_duration' },
      { name: 'Quote Generation', field: 'quote_generation_duration' },
      { name: 'Approval', field: 'approval_duration' },
      { name: 'Send', field: 'send_duration' }
    ]

    return steps.map(step => {
      const values = dateFilteredExecutions
        .map(e => (e as any)[step.field])
        .filter(v => v !== null && v !== undefined)
      
      const avg = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0
      const sorted = [...values].sort((a, b) => a - b)
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0

      return {
        step: step.name,
        avg: avg / 60,
        p95: p95 / 60,
        count: values.length
      }
    })
  }, [dateFilteredExecutions])

  const statusDistribution = useMemo(() => {
    const statusCounts = dateFilteredExecutions.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: (count / dateFilteredExecutions.length) * 100
    }))
  }, [dateFilteredExecutions])

  const failuresByStep = useMemo(() => {
    const stepCounts = failures.reduce((acc, f) => {
      const step = f.failure_step || 'Unknown'
      if (!acc[step]) {
        acc[step] = { step, count: 0, reasons: [] }
      }
      acc[step].count += f.failure_count
      if (f.failure_reason) {
        acc[step].reasons.push(f.failure_reason)
      }
      return acc
    }, {} as Record<string, { step: string; count: number; reasons: string[] }>)

    return Object.values(stepCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [failures])

  const supplierResponseTrend = useMemo(() => {
    return supplierTrends.map(t => ({
      date: new Date(t.date).toLocaleDateString(),
      responseRate: parseFloat(t.avg_response_rate || 0),
      workflowCount: t.workflow_count,
      successRate: parseFloat(t.success_rate_for_day || 0)
    }))
  }, [supplierTrends])

  const pdfGenerationTrend = useMemo(() => {
    return pdfStats.map(p => ({
      date: new Date(p.date).toLocaleDateString(),
      successRate: parseFloat(p.pdf_success_rate || 0),
      totalAttempts: p.total_pdf_attempts,
      avgDuration: parseFloat(p.avg_generation_duration || 0) / 60
    }))
  }, [pdfStats])

  const acceptanceTrend = useMemo(() => {
    return acceptancePatterns.map(a => ({
      week: new Date(a.week).toLocaleDateString(),
      acceptanceRate: parseFloat(a.acceptance_rate || 0),
      quotesSent: a.quotes_sent,
      quotesAccepted: a.quotes_accepted,
      totalValue: parseFloat(a.total_accepted_value || 0)
    }))
  }, [acceptancePatterns])

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`
    return `${(seconds / 86400).toFixed(1)}d`
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0 }).format(amount)
  }

  const COLORS = {
    completed: '#34d399',
    failed: '#f87171',
    stuck: '#fbbf24',
    pending: '#60a5fa',
    recovering: '#c084fc'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="animate-spin text-lime-400" size={24} />
          <span className="text-lg">Loading workflow health data...</span>
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
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Activity className="text-lime-400" />
              Quote Workflow Health Monitoring
            </h1>
            <p className="text-gray-400 mt-1">Pipeline diagnostics, bottleneck detection, and automated recovery tracking</p>
          </div>
          
          <div className="flex gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="bg-[#1c1c1c] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-lime-500/50"
            >
              <option value="day">Last 24 Hours</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={<FileText className="text-blue-400" />}
            label="Total Executions"
            value={summaryStats.total}
            trend={summaryStats.total > 0 ? 'up' : undefined}
          />
          <MetricCard
            icon={<CheckCircle2 className="text-green-400" />}
            label="Success Rate"
            value={`${summaryStats.successRate.toFixed(1)}%`}
            trend={summaryStats.successRate >= 80 ? 'up' : summaryStats.successRate >= 60 ? undefined : 'down'}
          />
          <MetricCard
            icon={<XCircle className="text-red-400" />}
            label="Failure Rate"
            value={`${summaryStats.failureRate.toFixed(1)}%`}
            trend={summaryStats.failureRate <= 10 ? 'up' : summaryStats.failureRate <= 25 ? undefined : 'down'}
          />
          <MetricCard
            icon={<Clock className="text-purple-400" />}
            label="Avg Duration"
            value={formatDuration(summaryStats.avgDuration)}
          />
        </div>

        {alerts.filter(a => a.unresolved_count > 0).length > 0 && (
          <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="text-red-400" />
              Active Alerts ({alerts.reduce((sum, a) => sum + a.unresolved_count, 0)})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {alerts.filter(a => a.unresolved_count > 0).map((alert, idx) => (
                <div key={idx} className="bg-black/40 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-red-400 capitalize">
                      {alert.alert_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-lg font-bold text-white">{alert.unresolved_count}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {alert.resolved_count} resolved • {alert.alert_count} total
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Workflow Status Distribution" icon={<BarChart3 className="text-cyan-400" />}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.status}: ${entry.count}`}
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={(COLORS as any)[entry.status] || '#888'} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Average Step Timing (Minutes)" icon={<Timer className="text-orange-400" />}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stepTimingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="step" stroke="#888" angle={-15} textAnchor="end" height={100} />
                <YAxis stroke="#888" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number) => `${value.toFixed(1)}m`}
                />
                <Legend />
                <Bar dataKey="avg" fill="#a3e635" name="Average" radius={[8, 8, 0, 0]} />
                <Bar dataKey="p95" fill="#fb923c" name="95th Percentile" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Supplier Response Rate Trend" icon={<Building2 className="text-cyan-400" />}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={supplierResponseTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#888" />
                <YAxis stroke="#888" domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                />
                <Legend />
                <Line type="monotone" dataKey="responseRate" stroke="#34d399" strokeWidth={2} name="Response Rate %" dot={{ fill: '#34d399' }} />
                <Line type="monotone" dataKey="successRate" stroke="#60a5fa" strokeWidth={2} name="Success Rate %" dot={{ fill: '#60a5fa' }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="PDF Generation Success Rate" icon={<FileText className="text-purple-400" />}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={pdfGenerationTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#888" />
                <YAxis stroke="#888" domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number, name: string) => {
                    if (name === 'successRate') return `${value.toFixed(1)}%`
                    if (name === 'avgDuration') return `${value.toFixed(1)}m`
                    return value
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="successRate" stroke="#c084fc" fill="#c084fc" fillOpacity={0.6} name="Success Rate %" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard title="Customer Acceptance Rate Trend (Weekly)" icon={<ThumbsUp className="text-green-400" />}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={acceptanceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="week" stroke="#888" />
              <YAxis yAxisId="left" stroke="#888" domain={[0, 100]} />
              <YAxis yAxisId="right" orientation="right" stroke="#888" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
                formatter={(value: number, name: string) => {
                  if (name === 'acceptanceRate') return `${value.toFixed(1)}%`
                  if (name === 'totalValue') return formatCurrency(value)
                  return value
                }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="acceptanceRate" stroke="#34d399" strokeWidth={3} name="Acceptance Rate %" dot={{ fill: '#34d399', r: 5 }} />
              <Line yAxisId="right" type="monotone" dataKey="quotesSent" stroke="#60a5fa" strokeWidth={2} name="Quotes Sent" dot={{ fill: '#60a5fa' }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="text-yellow-400" />
              Top Bottlenecks
            </h3>
            <div className="space-y-3">
              {bottlenecks.slice(0, 8).map((bottleneck, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-[#252525] rounded-xl">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white capitalize">{bottleneck.bottleneck_step.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {bottleneck.occurrence_count} occurrences • Avg: {formatDuration(bottleneck.avg_bottleneck_duration)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-yellow-400">{formatDuration(bottleneck.max_bottleneck_duration)}</div>
                    <div className="text-xs text-gray-500">max</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <AlertCircle className="text-red-400" />
              Failure Analysis by Step
            </h3>
            <div className="space-y-3">
              {failuresByStep.map((failure, idx) => (
                <div key={idx} className="p-3 bg-[#252525] rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white capitalize">{failure.step.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-bold text-red-400">{failure.count} failures</span>
                  </div>
                  {failure.reasons.length > 0 && (
                    <div className="text-xs text-gray-400 truncate">
                      Common: {failure.reasons[0]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-lime-500/10 to-green-500/10 border border-lime-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="text-lime-400" size={32} />
              <h3 className="text-lg font-bold text-white">Recovery Stats</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Recovery Success Rate</p>
                <p className="text-2xl font-bold text-lime-400">{summaryStats.recoveryRate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Attempts This Period</p>
                <p className="text-xl font-bold text-white">
                  {dateFilteredExecutions.filter(e => e.recovery_attempted).length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Successful Recoveries</p>
                <p className="text-xl font-bold text-green-400">
                  {dateFilteredExecutions.filter(e => e.recovery_successful).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Wrench className="text-orange-400" size={32} />
              <h3 className="text-lg font-bold text-white">Diagnostics</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Bottleneck Detection Rate</p>
                <p className="text-2xl font-bold text-orange-400">{summaryStats.bottleneckRate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Workflows with Issues</p>
                <p className="text-xl font-bold text-white">
                  {dateFilteredExecutions.filter(e => e.bottleneck_detected || e.alert_triggered).length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Auto-fix Available</p>
                <p className="text-xl font-bold text-yellow-400">
                  {dateFilteredExecutions.filter(e => e.suggested_fixes && e.suggested_fixes.length > 0).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Target className="text-blue-400" size={32} />
              <h3 className="text-lg font-bold text-white">Performance</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Workflows Completed</p>
                <p className="text-2xl font-bold text-blue-400">{summaryStats.completed}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Currently Stuck</p>
                <p className="text-xl font-bold text-yellow-400">{summaryStats.stuck}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Median Duration</p>
                <p className="text-xl font-bold text-purple-400">
                  {formatDuration(healthMetrics.find(m => m.workflow_type === 'quote_automation')?.median_duration_seconds || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {failures.filter(f => f.common_suggested_fixes && f.common_suggested_fixes.length > 0).length > 0 && (
          <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Wrench className="text-lime-400" />
              Automated Diagnostic Suggestions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {failures.slice(0, 6).map((failure, idx) => (
                failure.common_suggested_fixes && failure.common_suggested_fixes.length > 0 && (
                  <div key={idx} className="p-4 bg-[#252525] rounded-xl">
                    <div className="text-sm font-medium text-red-400 mb-2 capitalize">
                      {failure.failure_step?.replace(/_/g, ' ')}
                    </div>
                    <div className="text-xs text-gray-400 mb-3 line-clamp-2">
                      {failure.failure_reason}
                    </div>
                    <div className="text-xs text-lime-400">
                      {failure.common_suggested_fixes[0]}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

function MetricCard({ 
  icon, 
  label, 
  value, 
  trend 
}: { 
  icon: React.ReactNode
  label: string
  value: string | number
  trend?: 'up' | 'down'
}) {
  return (
    <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
        </div>
        {trend && (
          trend === 'up' ? (
            <TrendingUp className="text-green-400" size={18} />
          ) : (
            <TrendingDown className="text-red-400" size={18} />
          )
        )}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400 mt-1">{label}</p>
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
