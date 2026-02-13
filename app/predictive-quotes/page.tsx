'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
  Target,
  TrendingUp,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Play
} from 'lucide-react'

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
  trigger_reason: string
  suggested_discount: number
  priority: string
  status: string
  metadata: any
  identified_at: string
  actioned_at: string | null
}

export default function PredictiveQuotesPage() {
  const [opportunities, setOpportunities] = useState<PredictiveOpportunity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTriggering, setIsTriggering] = useState(false)

  useEffect(() => {
    fetchOpportunities()
  }, [])

  const fetchOpportunities = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('predictive_quote_opportunities')
        .select('*')
        .order('confidence_score', { ascending: false })

      if (error) throw error
      setOpportunities(data || [])
    } catch (error) {
      console.error('Error fetching opportunities:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const triggerAnalysis = async () => {
    setIsTriggering(true)
    try {
      const response = await fetch('/api/predictive-quotes/trigger', {
        method: 'POST'
      })
      const result = await response.json()
      
      if (result.success) {
        alert(`Analysis complete! Found ${result.opportunities_found} opportunities. Generated ${result.quotes_generated} quotes and created ${result.tasks_created} review tasks.`)
        fetchOpportunities()
      } else {
        alert(`Analysis failed: ${result.error}`)
      }
    } catch (error: any) {
      console.error('Error triggering analysis:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setIsTriggering(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
      review_pending: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
      quote_generated: 'text-lime-400 bg-lime-400/10 border-lime-400/20',
      contacted: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
      converted: 'text-green-400 bg-green-400/10 border-green-400/20',
      dismissed: 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    }
    return colors[status] || 'text-gray-400 bg-gray-400/10'
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'text-red-400',
      high: 'text-orange-400',
      medium: 'text-yellow-400',
      low: 'text-gray-400'
    }
    return colors[priority] || 'text-gray-400'
  }

  const getTriggerIcon = (trigger: string) => {
    const icons: Record<string, any> = {
      repeat_purchase_due: <Clock className="w-4 h-4" />,
      seasonal_opportunity: <TrendingUp className="w-4 h-4" />,
      product_interest_detected: <Target className="w-4 h-4" />,
      competitor_mention: <AlertTriangle className="w-4 h-4" />
    }
    return icons[trigger] || <Target className="w-4 h-4" />
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="animate-spin text-lime-400" size={24} />
          <span className="text-lg">Loading opportunities...</span>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Zap className="text-lime-400" />
              Predictive Quote Opportunities
            </h1>
            <p className="text-gray-400 mt-1">AI-detected opportunities for proactive customer engagement</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchOpportunities}
              className="px-4 py-2 bg-[#1c1c1c] hover:bg-[#252525] text-white border border-white/10 rounded-xl transition-colors flex items-center gap-2"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
            <button
              onClick={triggerAnalysis}
              disabled={isTriggering}
              className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(163,230,53,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTriggering ? (
                <>
                  <RefreshCw className="animate-spin" size={18} />
                  Running Analysis...
                </>
              ) : (
                <>
                  <Play size={18} />
                  Run Analysis Now
                </>
              )}
            </button>
            <a
              href="/squad/analytics/predictive-quotes"
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl transition-colors flex items-center gap-2"
            >
              <TrendingUp size={18} />
              View Analytics
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white">{opportunities.length}</p>
            <p className="text-sm text-gray-400 mt-1">Total Opportunities</p>
          </div>
          <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="text-lime-400" />
            </div>
            <p className="text-2xl font-bold text-white">
              {opportunities.filter(o => o.confidence_score > 0.8).length}
            </p>
            <p className="text-sm text-gray-400 mt-1">High Confidence (&gt;80%)</p>
          </div>
          <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="text-green-400" />
            </div>
            <p className="text-2xl font-bold text-white">
              {opportunities.filter(o => o.status === 'converted').length}
            </p>
            <p className="text-sm text-gray-400 mt-1">Converted</p>
          </div>
          <div className="bg-[#1c1c1c] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-white">
              {opportunities.length > 0
                ? ((opportunities.filter(o => o.status === 'converted').length / opportunities.length) * 100).toFixed(1)
                : 0}%
            </p>
            <p className="text-sm text-gray-400 mt-1">Conversion Rate</p>
          </div>
        </div>

        <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#252525] border-b border-white/5">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-400 px-6 py-4">Customer</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-6 py-4">Predicted Products</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-6 py-4">Confidence</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-6 py-4">Trigger</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-6 py-4">Priority</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-6 py-4">Discount</th>
                  <th className="text-center text-xs font-medium text-gray-400 px-6 py-4">Status</th>
                  <th className="text-right text-xs font-medium text-gray-400 px-6 py-4">Identified</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((opp) => (
                  <tr key={opp.id} className="border-b border-white/5 hover:bg-[#252525] transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {opp.customer_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-400">{opp.customer_email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {opp.predicted_products.slice(0, 3).map((product, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-lime-400/10 border border-lime-400/20 rounded-lg text-xs text-lime-400"
                          >
                            {product.product_name}
                            <span className="text-gray-400">
                              {(product.confidence * 100).toFixed(0)}%
                            </span>
                          </span>
                        ))}
                        {opp.predicted_products.length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{opp.predicted_products.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-lg font-bold ${
                        opp.confidence_score > 0.8 ? 'text-lime-400' :
                        opp.confidence_score > 0.6 ? 'text-yellow-400' :
                        'text-orange-400'
                      }`}>
                        {(opp.confidence_score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {getTriggerIcon(opp.trigger_reason)}
                        <span className="text-xs text-gray-400 capitalize">
                          {opp.trigger_reason.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm font-medium capitalize ${getPriorityColor(opp.priority)}`}>
                        {opp.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-medium text-white">
                        {opp.suggested_discount}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium capitalize border ${getStatusColor(opp.status)}`}>
                        {opp.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs text-gray-400">
                        {new Date(opp.identified_at).toLocaleDateString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {opportunities.length === 0 && (
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-xl text-gray-400 mb-2">No opportunities found</p>
            <p className="text-sm text-gray-500 mb-4">Run the analysis to identify potential quote opportunities</p>
            <button
              onClick={triggerAnalysis}
              disabled={isTriggering}
              className="px-6 py-3 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-colors flex items-center gap-2 mx-auto shadow-[0_0_15px_rgba(163,230,53,0.3)] disabled:opacity-50"
            >
              {isTriggering ? (
                <>
                  <RefreshCw className="animate-spin" size={18} />
                  Running Analysis...
                </>
              ) : (
                <>
                  <Play size={18} />
                  Run Analysis Now
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
