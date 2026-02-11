'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Gauge,
  FileCode2,
  Bot,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ChevronUp,
  ChevronDown,
  Activity,
  RefreshCw,
  ExternalLink,
  Zap,
  Eye,
  Shield
} from 'lucide-react'

interface VitalsRecord {
  id: string
  url: string
  product_id: number | null
  lcp: number | null
  inp: number | null
  cls: number | null
  fcp: number | null
  ttfb: number | null
  performance_score: number | null
  status: 'good' | 'needs-improvement' | 'poor'
  issues: any[]
  recommendations: any[]
  measured_at: string
}

interface SchemaAudit {
  id: string
  url: string
  product_id: number | null
  has_product_schema: boolean
  has_breadcrumb_schema: boolean
  has_organization_schema: boolean
  has_review_schema: boolean
  detected_schemas: any[]
  missing_required_fields: any[]
  validation_errors: any[]
  generated_schema: any | null
  created_at: string
}

interface GEOAnalysis {
  id: string
  url: string
  product_id: number | null
  ai_visibility_score: number | null
  content_structure: any
  ai_search_signals: any
  eeat_signals: any
  recommendations: any[]
  analyzed_at: string
}

interface SEOSummary {
  audits: {
    count: number
    avg_score: number
  }
  vitals: {
    count: number
    avg_performance: number
    good: number
    needs_improvement: number
    poor: number
  }
  schemas: {
    count: number
    with_product_schema: number
    without_product_schema: number
  }
  geo: {
    count: number
    avg_visibility_score: number
  }
}

interface SEOData {
  summary: SEOSummary
  recent_audits: any[]
  recent_vitals: VitalsRecord[]
  recent_schema_audits: SchemaAudit[]
  recent_geo_analyses: GEOAnalysis[]
}

export default function SEODashboardPage() {
  const [data, setData] = useState<SEOData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [runningAction, setRunningAction] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/seo/dashboard')
      if (!res.ok) {
        throw new Error('Failed to fetch SEO data')
      }
      const result = await res.json()
      setData(result)
      setLastUpdated(new Date())
      setError(null)
    } catch (err: any) {
      console.error('SEO Dashboard fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const runSEOAction = async (action: string) => {
    setRunningAction(action)
    try {
      const res = await fetch('/api/seo/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to run SEO action')
      }

      // Refresh data after action completes
      await fetchData()
    } catch (err: any) {
      console.error('SEO action error:', err)
      setError(err.message)
    } finally {
      setRunningAction(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw className="animate-spin" size={24} />
          <span>Loading SEO data...</span>
        </div>
      </div>
    )
  }

  const summary = data?.summary || {
    audits: { count: 0, avg_score: 0 },
    vitals: { count: 0, avg_performance: 0, good: 0, needs_improvement: 0, poor: 0 },
    schemas: { count: 0, with_product_schema: 0, without_product_schema: 0 },
    geo: { count: 0, avg_visibility_score: 0 }
  }

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
            <Search className="text-lime-400" />
            SEO Dashboard
          </h2>
          <p className="text-gray-400 mt-1">Monitor Core Web Vitals, Schema.org compliance, and AI search visibility</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="px-4 py-2 bg-[#1c1c1c] border border-white/5 rounded-xl">
              <p className="text-xs text-gray-400">Last Updated</p>
              <p className="text-sm font-medium text-white">{lastUpdated.toLocaleTimeString()}</p>
            </div>
          )}
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="px-4 py-2 bg-[#1c1c1c] hover:bg-[#2c2c2c] text-white text-sm font-medium rounded-xl border border-white/5 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3"
        >
          <AlertCircle className="text-red-400" size={20} />
          <span className="text-red-400">{error}</span>
        </motion.div>
      )}

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Core Web Vitals"
          value={`${summary.vitals.avg_performance}%`}
          subValue={`${summary.vitals.count} pages analyzed`}
          icon={Gauge}
          color="blue"
          status={summary.vitals.avg_performance >= 90 ? 'good' : summary.vitals.avg_performance >= 50 ? 'warning' : 'poor'}
        />
        <MetricCard
          label="Schema Coverage"
          value={`${summary.schemas.with_product_schema}/${summary.schemas.count}`}
          subValue="Products with schema"
          icon={FileCode2}
          color="purple"
          status={summary.schemas.count > 0 && summary.schemas.with_product_schema === summary.schemas.count ? 'good' : 'warning'}
        />
        <MetricCard
          label="AI Visibility"
          value={`${summary.geo.avg_visibility_score}%`}
          subValue={`${summary.geo.count} pages analyzed`}
          icon={Bot}
          color="lime"
          status={summary.geo.avg_visibility_score >= 70 ? 'good' : summary.geo.avg_visibility_score >= 40 ? 'warning' : 'poor'}
        />
        <MetricCard
          label="SEO Audits"
          value={summary.audits.avg_score.toString()}
          subValue={`${summary.audits.count} audits completed`}
          icon={Search}
          color="orange"
          status={summary.audits.avg_score >= 80 ? 'good' : summary.audits.avg_score >= 50 ? 'warning' : 'poor'}
        />
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
          <Zap size={18} className="text-lime-400" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ActionButton
            label="Full Audit"
            description="Run comprehensive SEO check"
            icon={Search}
            onClick={() => runSEOAction('full_audit')}
            loading={runningAction === 'full_audit'}
          />
          <ActionButton
            label="Check Vitals"
            description="Measure Core Web Vitals"
            icon={Gauge}
            onClick={() => runSEOAction('check_vitals')}
            loading={runningAction === 'check_vitals'}
          />
          <ActionButton
            label="Audit Schema"
            description="Check Schema.org markup"
            icon={FileCode2}
            onClick={() => runSEOAction('audit_schema')}
            loading={runningAction === 'audit_schema'}
          />
          <ActionButton
            label="Analyze GEO"
            description="AI search optimization"
            icon={Bot}
            onClick={() => runSEOAction('analyze_geo')}
            loading={runningAction === 'analyze_geo'}
          />
        </div>
      </motion.div>

      {/* Core Web Vitals Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vitals Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Core Web Vitals Status</h3>
            <Gauge size={18} className="text-blue-400" />
          </div>

          <div className="space-y-4">
            <VitalsStatusBar
              label="Good"
              count={summary.vitals.good}
              total={summary.vitals.count}
              color="lime"
            />
            <VitalsStatusBar
              label="Needs Improvement"
              count={summary.vitals.needs_improvement}
              total={summary.vitals.count}
              color="yellow"
            />
            <VitalsStatusBar
              label="Poor"
              count={summary.vitals.poor}
              total={summary.vitals.count}
              color="red"
            />
          </div>

          {/* Recent Vitals */}
          {data?.recent_vitals && data.recent_vitals.length > 0 && (
            <div className="mt-6 pt-6 border-t border-white/5">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Recent Checks</h4>
              <div className="space-y-2">
                {data.recent_vitals.slice(0, 5).map((vital) => (
                  <VitalsRow key={vital.id} vital={vital} />
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Schema Coverage */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Schema.org Coverage</h3>
            <FileCode2 size={18} className="text-purple-400" />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-lime-500/10 border border-lime-500/30 rounded-xl p-4">
              <p className="text-2xl font-bold text-lime-400">{summary.schemas.with_product_schema}</p>
              <p className="text-sm text-gray-400">With Product Schema</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
              <p className="text-2xl font-bold text-orange-400">{summary.schemas.without_product_schema}</p>
              <p className="text-sm text-gray-400">Missing Schema</p>
            </div>
          </div>

          {/* Recent Schema Audits */}
          {data?.recent_schema_audits && data.recent_schema_audits.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Recent Audits</h4>
              <div className="space-y-2">
                {data.recent_schema_audits.slice(0, 5).map((audit) => (
                  <SchemaRow key={audit.id} audit={audit} />
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* AI Search Visibility (GEO) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <Bot className="text-purple-400" size={24} />
          <div>
            <h3 className="text-lg font-semibold text-white">AI Search Visibility (GEO)</h3>
            <p className="text-sm text-gray-400">Optimize for ChatGPT, Perplexity, and Google AI Overview</p>
          </div>
        </div>

        {data?.recent_geo_analyses && data.recent_geo_analyses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.recent_geo_analyses.slice(0, 6).map((geo) => (
              <GEOCard key={geo.id} analysis={geo} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Bot className="mx-auto text-gray-600 mb-3" size={48} />
            <p className="text-gray-400">No GEO analyses yet</p>
            <p className="text-sm text-gray-500">Run an analysis to see AI search visibility scores</p>
          </div>
        )}
      </motion.div>

      {/* No Data State */}
      {(!data || (summary.vitals.count === 0 && summary.schemas.count === 0 && summary.geo.count === 0)) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-12 text-center"
        >
          <Search className="mx-auto text-gray-600 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-white mb-2">No SEO Data Yet</h3>
          <p className="text-gray-400 mb-6">Run your first SEO audit to start monitoring your site's performance</p>
          <button
            onClick={() => runSEOAction('full_audit')}
            disabled={runningAction === 'full_audit'}
            className="px-6 py-3 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-colors inline-flex items-center gap-2"
          >
            {runningAction === 'full_audit' ? (
              <>
                <RefreshCw className="animate-spin" size={18} />
                Running...
              </>
            ) : (
              <>
                <Search size={18} />
                Run Full SEO Audit
              </>
            )}
          </button>
        </motion.div>
      )}
    </div>
  )
}

function MetricCard({ label, value, subValue, icon: Icon, color, status }: {
  label: string
  value: string
  subValue: string
  icon: any
  color: string
  status: 'good' | 'warning' | 'poor'
}) {
  const colorClasses = {
    blue: 'text-blue-400 bg-blue-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
    lime: 'text-lime-400 bg-lime-400/10',
    orange: 'text-orange-400 bg-orange-400/10'
  }

  const statusColors = {
    good: 'text-lime-400 bg-lime-400/10',
    warning: 'text-yellow-400 bg-yellow-400/10',
    poor: 'text-red-400 bg-red-400/10'
  }

  const statusIcons = {
    good: CheckCircle2,
    warning: AlertCircle,
    poor: XCircle
  }

  const StatusIcon = statusIcons[status]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${colorClasses[color as keyof typeof colorClasses]}`}>
          <Icon size={20} />
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${statusColors[status]}`}>
          <StatusIcon size={14} />
          {status === 'good' ? 'Good' : status === 'warning' ? 'Needs Work' : 'Poor'}
        </div>
      </div>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      <p className="text-xs text-gray-500 mt-2">{subValue}</p>
    </motion.div>
  )
}

function ActionButton({ label, description, icon: Icon, onClick, loading }: {
  label: string
  description: string
  icon: any
  onClick: () => void
  loading: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-lime-500/30 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex items-center gap-3 mb-2">
        {loading ? (
          <RefreshCw className="text-lime-400 animate-spin" size={20} />
        ) : (
          <Icon className="text-lime-400" size={20} />
        )}
        <span className="font-medium text-white">{label}</span>
      </div>
      <p className="text-xs text-gray-400">{description}</p>
    </button>
  )
}

function VitalsStatusBar({ label, count, total, color }: {
  label: string
  count: number
  total: number
  color: 'lime' | 'yellow' | 'red'
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0
  const colorClasses = {
    lime: 'bg-lime-400',
    yellow: 'bg-yellow-400',
    red: 'bg-red-400'
  }

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-medium">{count}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function VitalsRow({ vital }: { vital: VitalsRecord }) {
  const statusColors = {
    good: 'text-lime-400 bg-lime-400/10 border-lime-500/30',
    'needs-improvement': 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30',
    poor: 'text-red-400 bg-red-400/10 border-red-500/30'
  }

  const urlPath = vital.url ? new URL(vital.url).pathname : 'Unknown'

  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{urlPath}</p>
        <p className="text-xs text-gray-500">Score: {vital.performance_score || 'N/A'}</p>
      </div>
      <span className={`text-xs px-2 py-1 rounded-md border ${statusColors[vital.status]}`}>
        {vital.status}
      </span>
    </div>
  )
}

function SchemaRow({ audit }: { audit: SchemaAudit }) {
  const urlPath = audit.url ? new URL(audit.url).pathname : 'Unknown'
  const hasSchema = audit.has_product_schema

  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{urlPath}</p>
        <div className="flex gap-2 mt-1">
          {audit.has_product_schema && (
            <span className="text-xs text-lime-400">Product</span>
          )}
          {audit.has_breadcrumb_schema && (
            <span className="text-xs text-blue-400">Breadcrumb</span>
          )}
          {audit.has_review_schema && (
            <span className="text-xs text-purple-400">Review</span>
          )}
        </div>
      </div>
      {hasSchema ? (
        <CheckCircle2 size={18} className="text-lime-400" />
      ) : (
        <XCircle size={18} className="text-orange-400" />
      )}
    </div>
  )
}

function GEOCard({ analysis }: { analysis: GEOAnalysis }) {
  const score = analysis.ai_visibility_score || 0
  const urlPath = analysis.url ? new URL(analysis.url).pathname : 'Unknown'

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-lime-400'
    if (score >= 40) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'from-lime-500/20 to-lime-500/5'
    if (score >= 40) return 'from-yellow-500/20 to-yellow-500/5'
    return 'from-red-500/20 to-red-500/5'
  }

  return (
    <div className={`bg-gradient-to-br ${getScoreBg(score)} border border-white/10 rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`text-3xl font-bold ${getScoreColor(score)}`}>
          {score}%
        </div>
        <Eye size={20} className="text-gray-400" />
      </div>
      <p className="text-sm text-white truncate mb-1">{urlPath}</p>
      <p className="text-xs text-gray-400">
        {new Date(analysis.analyzed_at).toLocaleDateString()}
      </p>
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <p className="text-xs text-purple-400 mt-2">
          {analysis.recommendations.length} recommendations
        </p>
      )}
    </div>
  )
}
