'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  Users,
  ShoppingCart,
  DollarSign,
  BarChart3,
  Activity,
  Download,
  RefreshCw,
  ChevronRight,
  Clock,
  Target,
  Zap,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'

interface AnalyticsData {
  sales_forecast?: any[]
  stockout_predictions?: any[]
  churn_analyses?: any[]
  product_recommendations?: any[]
  anomalies?: any[]
  executive_report?: any
}

export default function AnalyticsAgentPanel() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData>({})
  const [activeView, setActiveView] = useState<'overview' | 'forecast' | 'inventory' | 'churn' | 'products' | 'anomalies' | 'report'>('overview')
  const [refreshing, setRefreshing] = useState(false)
  
  useEffect(() => {
    fetchAnalytics()
  }, [])
  
  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/analytics')
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const refreshAnalytics = async () => {
    setRefreshing(true)
    await fetchAnalytics()
    setRefreshing(false)
  }
  
  const generateReport = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/analytics?action=executive-report')
      if (response.ok) {
        const result = await response.json()
        setData({ ...data, executive_report: result.report })
        setActiveView('report')
      }
    } catch (error) {
      console.error('Failed to generate report:', error)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading && !data.sales_forecast) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="animate-spin mx-auto text-lime-400 mb-4" size={40} />
          <p className="text-gray-400">Analyzing data...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="text-lime-400" size={28} />
            Analytics Agent
          </h3>
          <p className="text-gray-400 mt-1">AI-powered business intelligence and predictive insights</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={refreshAnalytics}
            disabled={refreshing}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={generateReport}
            className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl transition-colors flex items-center gap-2"
          >
            <Download size={16} />
            Generate Report
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'forecast', label: 'Forecast', icon: TrendingUp },
          { id: 'inventory', label: 'Inventory', icon: Package },
          { id: 'churn', label: 'Churn Risk', icon: Users },
          { id: 'products', label: 'Products', icon: ShoppingCart }
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id as any)}
            className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
              activeView === view.id
                ? 'bg-lime-400/20 border-lime-400 text-lime-400'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
            }`}
          >
            <view.icon size={20} />
            <span className="text-xs font-medium">{view.label}</span>
          </button>
        ))}
      </div>
      
      <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
        {activeView === 'overview' && <OverviewPanel data={data} />}
        {activeView === 'forecast' && <ForecastPanel forecast={data.sales_forecast || []} />}
        {activeView === 'inventory' && <InventoryPanel predictions={data.stockout_predictions || []} />}
        {activeView === 'churn' && <ChurnPanel analyses={data.churn_analyses || []} />}
        {activeView === 'products' && <ProductsPanel recommendations={data.product_recommendations || []} />}
        {activeView === 'report' && <ExecutiveReportPanel report={data.executive_report} />}
      </div>
      
      {data.anomalies && data.anomalies.length > 0 && (
        <AnomaliesAlert anomalies={data.anomalies} />
      )}
    </div>
  )
}

function OverviewPanel({ data }: { data: AnalyticsData }) {
  const criticalStockouts = data.stockout_predictions?.filter(p => p.risk_level === 'critical').length || 0
  const highChurnRisk = data.churn_analyses?.filter(c => c.risk_level === 'high' || c.risk_level === 'critical').length || 0
  const topOpportunities = data.product_recommendations?.slice(0, 3) || []
  const criticalAnomalies = data.anomalies?.filter(a => a.severity === 'critical').length || 0
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<TrendingUp className="text-lime-400" />}
          label="Sales Trend"
          value={data.sales_forecast?.[0]?.trend || 'stable'}
          subtext={`Next 7 days forecast available`}
          trend="up"
        />
        <MetricCard
          icon={<Package className="text-orange-400" />}
          label="Critical Stockouts"
          value={criticalStockouts.toString()}
          subtext="Require immediate action"
          alert={criticalStockouts > 0}
        />
        <MetricCard
          icon={<Users className="text-red-400" />}
          label="High Churn Risk"
          value={highChurnRisk.toString()}
          subtext="Customers need attention"
          alert={highChurnRisk > 0}
        />
        <MetricCard
          icon={<AlertTriangle className="text-yellow-400" />}
          label="Anomalies"
          value={criticalAnomalies.toString()}
          subtext="Detected today"
          alert={criticalAnomalies > 0}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="text-lime-400" size={20} />
            Top Opportunities
          </h4>
          <div className="space-y-3">
            {topOpportunities.map((product, idx) => (
              <div key={idx} className="bg-white/5 border border-white/5 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-white">{product.product_name}</p>
                  <span className="text-xs px-2 py-1 bg-lime-400/20 text-lime-400 rounded-md">
                    Priority: {product.recommendation_priority.toFixed(0)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mb-2">
                  <div>Searches: {product.search_count}</div>
                  <div>Purchases: {product.purchase_count}</div>
                  <div>Conversion: {product.conversion_rate.toFixed(1)}%</div>
                  <div className={`${product.inventory_status === 'out_of_stock' ? 'text-red-400' : ''}`}>
                    Stock: {product.inventory_status}
                  </div>
                </div>
                {product.suggested_actions.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">{product.suggested_actions[0]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="text-yellow-400" size={20} />
            Quick Actions Needed
          </h4>
          <div className="space-y-3">
            {criticalStockouts > 0 && (
              <ActionCard
                title="Critical Inventory Alert"
                description={`${criticalStockouts} products at risk of stockout`}
                action="View Inventory"
                severity="critical"
              />
            )}
            {highChurnRisk > 0 && (
              <ActionCard
                title="Customer Retention Alert"
                description={`${highChurnRisk} customers at high churn risk`}
                action="View Churn Analysis"
                severity="high"
              />
            )}
            {criticalAnomalies > 0 && (
              <ActionCard
                title="Anomaly Detected"
                description={`${criticalAnomalies} critical anomalies in metrics`}
                action="View Anomalies"
                severity="warning"
              />
            )}
            {criticalStockouts === 0 && highChurnRisk === 0 && criticalAnomalies === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle2 className="mx-auto mb-2 text-lime-400" size={32} />
                <p>All systems operating normally</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ForecastPanel({ forecast }: { forecast: any[] }) {
  if (forecast.length === 0) {
    return <div className="text-center py-8 text-gray-500">No forecast data available</div>
  }
  
  const maxValue = Math.max(...forecast.map(f => f.confidence_upper))
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-white">7-Day Sales Forecast</h4>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-lime-400 rounded"></div>
            <span className="text-xs text-gray-400">Predicted</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-lime-400/30 rounded"></div>
            <span className="text-xs text-gray-400">Confidence</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-2">
        {forecast.map((day, idx) => {
          const height = (day.predicted_value / maxValue) * 100
          const lowerHeight = (day.confidence_lower / maxValue) * 100
          const upperHeight = (day.confidence_upper / maxValue) * 100
          
          return (
            <div key={idx} className="flex flex-col items-center gap-2">
              <div className="flex-1 w-full flex flex-col-reverse items-center gap-1 h-48">
                <div className="w-full bg-lime-400/10 rounded-t relative" style={{ height: `${upperHeight}%` }}>
                  <div className="absolute inset-0 bg-lime-400 rounded-t" style={{ height: `${(height / upperHeight) * 100}%` }}></div>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-white">${day.predicted_value.toFixed(0)}</p>
                <p className="text-[10px] text-gray-500">
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                </p>
              </div>
            </div>
          )
        })}
      </div>
      
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
        <div className="text-center">
          <p className="text-xs text-gray-500">Average Daily</p>
          <p className="text-lg font-bold text-white">
            ${(forecast.reduce((sum, f) => sum + f.predicted_value, 0) / forecast.length).toFixed(0)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">7-Day Total</p>
          <p className="text-lg font-bold text-white">
            ${forecast.reduce((sum, f) => sum + f.predicted_value, 0).toFixed(0)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Trend</p>
          <p className={`text-lg font-bold ${
            forecast[0].trend === 'up' ? 'text-lime-400' : 
            forecast[0].trend === 'down' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {forecast[0].trend === 'up' ? '↑' : forecast[0].trend === 'down' ? '↓' : '→'} {forecast[0].trend}
          </p>
        </div>
      </div>
    </div>
  )
}

function InventoryPanel({ predictions }: { predictions: any[] }) {
  const critical = predictions.filter(p => p.risk_level === 'critical')
  const high = predictions.filter(p => p.risk_level === 'high')
  const medium = predictions.filter(p => p.risk_level === 'medium')
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-white">Stockout Predictions</h4>
        <div className="flex gap-2 text-xs">
          {critical.length > 0 && <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded">Critical: {critical.length}</span>}
          {high.length > 0 && <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded">High: {high.length}</span>}
        </div>
      </div>
      
      <div className="space-y-3">
        {[...critical, ...high, ...medium].slice(0, 10).map((pred, idx) => (
          <div
            key={idx}
            className={`bg-white/5 border rounded-xl p-4 ${
              pred.risk_level === 'critical' ? 'border-red-500/30' :
              pred.risk_level === 'high' ? 'border-orange-500/30' :
              'border-white/5'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-medium text-white">{pred.product_name}</p>
                <p className="text-xs text-gray-500 mt-1">ID: {pred.product_id}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${
                pred.risk_level === 'critical' ? 'bg-red-500/20 text-red-400' :
                pred.risk_level === 'high' ? 'bg-orange-500/20 text-orange-400' :
                pred.risk_level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {pred.risk_level.toUpperCase()}
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-gray-500">Current Stock</p>
                <p className="text-white font-medium">{pred.current_stock}</p>
              </div>
              <div>
                <p className="text-gray-500">Daily Velocity</p>
                <p className="text-white font-medium">{pred.daily_velocity.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-gray-500">Stockout In</p>
                <p className={`font-medium ${
                  pred.days_until_stockout !== null && pred.days_until_stockout < 7 
                    ? 'text-red-400' 
                    : 'text-white'
                }`}>
                  {pred.days_until_stockout !== null ? `${pred.days_until_stockout} days` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Reorder Point</p>
                <p className="text-lime-400 font-medium">{pred.recommended_reorder_point}</p>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-xs text-gray-400">
                Recommended: Order {pred.recommended_reorder_quantity} units (30-day supply)
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChurnPanel({ analyses }: { analyses: any[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-white">Customer Churn Risk</h4>
        <p className="text-xs text-gray-400">{analyses.length} customers analyzed</p>
      </div>
      
      <div className="space-y-3">
        {analyses.slice(0, 10).map((analysis, idx) => (
          <div
            key={idx}
            className={`bg-white/5 border rounded-xl p-4 ${
              analysis.risk_level === 'critical' ? 'border-red-500/30' :
              analysis.risk_level === 'high' ? 'border-orange-500/30' :
              'border-yellow-500/30'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-medium text-white">{analysis.customer_name}</p>
                <p className="text-xs text-gray-500">{analysis.customer_email}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-red-400">{(analysis.churn_probability * 100).toFixed(0)}%</p>
                <p className="text-xs text-gray-500">Churn Risk</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3 text-xs mb-3">
              <div>
                <p className="text-gray-500">Last Interaction</p>
                <p className="text-white">{analysis.last_interaction_days}d ago</p>
              </div>
              <div>
                <p className="text-gray-500">Last Order</p>
                <p className="text-white">{analysis.last_order_days !== null ? `${analysis.last_order_days}d ago` : 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-500">Trend</p>
                <p className={`font-medium ${
                  analysis.interaction_frequency_trend === 'decreasing' ? 'text-red-400' :
                  analysis.interaction_frequency_trend === 'increasing' ? 'text-lime-400' :
                  'text-gray-400'
                }`}>
                  {analysis.interaction_frequency_trend}
                </p>
              </div>
            </div>
            
            {analysis.contributing_factors.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-400 mb-1">Contributing Factors:</p>
                {analysis.contributing_factors.map((factor: any, fidx: number) => (
                  <p key={fidx} className="text-xs text-gray-500">• {factor.description}</p>
                ))}
              </div>
            )}
            
            {analysis.recommended_actions.length > 0 && (
              <div className="pt-3 border-t border-white/10">
                <p className="text-xs font-medium text-lime-400 mb-1">Recommended Actions:</p>
                {analysis.recommended_actions.slice(0, 2).map((action: string, aidx: number) => (
                  <p key={aidx} className="text-xs text-gray-400">• {action}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ProductsPanel({ recommendations }: { recommendations: any[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-white">Product Opportunities</h4>
        <p className="text-xs text-gray-400">Sorted by priority</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recommendations.slice(0, 10).map((rec, idx) => (
          <div key={idx} className="bg-white/5 border border-white/5 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="font-medium text-white">{rec.product_name}</p>
              <span className="text-xs px-2 py-1 bg-lime-400/20 text-lime-400 rounded">
                #{idx + 1}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div>
                <p className="text-gray-500">Searches</p>
                <p className="text-white font-medium">{rec.search_count}</p>
              </div>
              <div>
                <p className="text-gray-500">Views</p>
                <p className="text-white font-medium">{rec.view_count}</p>
              </div>
              <div>
                <p className="text-gray-500">Cart Adds</p>
                <p className="text-white font-medium">{rec.add_to_cart_count}</p>
              </div>
              <div>
                <p className="text-gray-500">Purchases</p>
                <p className="text-white font-medium">{rec.purchase_count}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div>
                <p className="text-gray-500">Conversion Rate</p>
                <p className={`font-medium ${rec.conversion_rate < 5 ? 'text-red-400' : 'text-lime-400'}`}>
                  {rec.conversion_rate.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-gray-500">Opportunity Gap</p>
                <p className="text-yellow-400 font-medium">{rec.search_to_purchase_gap.toFixed(1)}x</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs px-2 py-1 rounded ${
                rec.inventory_status === 'out_of_stock' ? 'bg-red-500/20 text-red-400' :
                rec.inventory_status === 'low_stock' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-lime-500/20 text-lime-400'
              }`}>
                {rec.inventory_status.replace('_', ' ')}
              </span>
            </div>
            
            {rec.suggested_actions.length > 0 && (
              <div className="pt-3 border-t border-white/10">
                <p className="text-xs text-gray-400">{rec.suggested_actions[0]}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ExecutiveReportPanel({ report }: { report: any }) {
  if (!report) {
    return <div className="text-center py-8 text-gray-500">No report generated yet</div>
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-lg font-semibold text-white mb-2">Executive Summary</h4>
        <p className="text-xs text-gray-500">Period: {report.period}</p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard
          icon={<DollarSign className="text-lime-400" />}
          label="Total Revenue"
          value={`$${report.summary.total_revenue.toLocaleString()}`}
          trend={report.summary.revenue_trend}
        />
        <MetricCard
          icon={<ShoppingCart className="text-blue-400" />}
          label="Total Orders"
          value={report.summary.total_orders.toLocaleString()}
          trend={report.summary.order_trend}
        />
        <MetricCard
          icon={<Users className="text-purple-400" />}
          label="Active Customers"
          value={report.summary.active_customers.toString()}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h5 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Target className="text-lime-400" size={18} />
            Top Opportunities ({report.opportunities.length})
          </h5>
          <div className="space-y-3">
            {report.opportunities.slice(0, 5).map((opp: any, idx: number) => (
              <div key={idx} className="bg-lime-400/10 border border-lime-400/30 rounded-xl p-3">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-white">{opp.title}</p>
                  <span className={`text-[10px] px-2 py-1 rounded ${
                    opp.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                    opp.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {opp.priority.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-2">{opp.description}</p>
                <p className="text-xs text-lime-400 font-medium">Impact: {opp.estimated_impact}</p>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h5 className="font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="text-red-400" size={18} />
            Key Risks ({report.risks.length})
          </h5>
          <div className="space-y-3">
            {report.risks.slice(0, 5).map((risk: any, idx: number) => (
              <div key={idx} className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-white">{risk.title}</p>
                  <span className={`text-[10px] px-2 py-1 rounded ${
                    risk.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                    risk.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {risk.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-2">{risk.description}</p>
                <p className="text-xs text-red-400 font-medium">Impact: {risk.potential_impact}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function AnomaliesAlert({ anomalies }: { anomalies: any[] }) {
  const critical = anomalies.filter(a => a.severity === 'critical')
  
  if (critical.length === 0) return null
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-2xl p-4"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="text-red-400 shrink-0 mt-1" size={24} />
        <div className="flex-1">
          <h4 className="font-semibold text-red-400 mb-2">Critical Anomalies Detected</h4>
          <div className="space-y-2">
            {critical.map((anomaly, idx) => (
              <div key={idx} className="text-sm text-gray-300">
                <p className="font-medium">{anomaly.description}</p>
                <p className="text-xs text-gray-500 mt-1">Recommended: {anomaly.recommended_actions[0]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function MetricCard({ icon, label, value, subtext, trend, alert }: any) {
  return (
    <div className={`bg-white/5 border rounded-xl p-4 ${alert ? 'border-red-500/30' : 'border-white/5'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-gray-400">{icon}</div>
        {trend && (
          <span className={`text-xs ${
            trend === 'up' ? 'text-lime-400' : 
            trend === 'down' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      {subtext && <p className="text-xs text-gray-600 mt-1">{subtext}</p>}
    </div>
  )
}

function ActionCard({ title, description, action, severity }: any) {
  return (
    <div className={`border rounded-xl p-4 ${
      severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
      severity === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
      'bg-yellow-500/10 border-yellow-500/30'
    }`}>
      <p className="font-medium text-white mb-1">{title}</p>
      <p className="text-xs text-gray-400 mb-3">{description}</p>
      <button className="text-xs text-lime-400 hover:text-lime-300 flex items-center gap-1">
        {action} <ChevronRight size={12} />
      </button>
    </div>
  )
}
