'use client'

import { useEffect, useState } from 'react'

/**
 * Agent Intelligence Dashboard
 * 
 * This is a placeholder component. To use it, you'll need to:
 * 1. Install shadcn/ui components (card, button, badge, tabs)
 * 2. Or create your own UI components
 * 3. Or integrate with your existing UI library
 * 
 * For now, it displays raw data without styling.
 * 
 * To install shadcn/ui:
 * npx shadcn-ui@latest add card button badge tabs
 */

export default function AgentIntelligenceDashboard() {
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string>('all')

  useEffect(() => {
    fetchDashboardData()
  }, [selectedAgent])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ days: '30' })
      if (selectedAgent !== 'all') {
        params.append('agentName', selectedAgent)
      }

      const response = await fetch(`/api/agent-intelligence/dashboard?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setDashboard(data.dashboard)
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8">Loading agent intelligence dashboard...</div>
  }

  if (!dashboard) {
    return <div className="p-8">Failed to load dashboard data</div>
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Agent Intelligence Evolution</h1>
        <button 
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 bg-white shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Decisions</h3>
          <p className="text-sm text-gray-600 mb-2">Last 30 days</p>
          <p className="text-3xl font-bold">{dashboard.summary.total_decisions.toLocaleString()}</p>
        </div>

        <div className="border rounded-lg p-4 bg-white shadow">
          <h3 className="text-sm font-medium text-gray-500">Avg Accuracy</h3>
          <p className="text-sm text-gray-600 mb-2">Success rate</p>
          <p className="text-3xl font-bold">{dashboard.summary.avg_accuracy}%</p>
        </div>

        <div className="border rounded-lg p-4 bg-white shadow">
          <h3 className="text-sm font-medium text-gray-500">Optimizations</h3>
          <p className="text-sm text-gray-600 mb-2">Generated suggestions</p>
          <p className="text-3xl font-bold">{dashboard.summary.total_optimizations}</p>
        </div>

        <div className="border rounded-lg p-4 bg-white shadow">
          <h3 className="text-sm font-medium text-gray-500">Experiments</h3>
          <p className="text-sm text-gray-600 mb-2">Running A/B tests</p>
          <p className="text-3xl font-bold">{dashboard.summary.experiments_running}</p>
        </div>
      </div>

      {/* Learning Insights */}
      <div className="border rounded-lg p-4 bg-white shadow">
        <h2 className="text-xl font-bold mb-4">Recent Learning Insights</h2>
        <p className="text-sm text-gray-600 mb-4">AI-generated analysis and optimization suggestions</p>
        <div className="space-y-4">
          {dashboard.recent_insights.map((insight: any) => (
            <div key={insight.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold">{insight.agent_name}</h3>
                  <p className="text-sm text-gray-600">{insight.decision_type || 'All decisions'}</p>
                </div>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                  {insight.total_decisions} decisions
                </span>
              </div>
              <p className="text-sm mb-2">{insight.analysis_summary}</p>
              <div className="flex gap-2 text-xs text-gray-600">
                <span>{insight.optimization_suggestions?.length || 0} suggestions</span>
                <span>•</span>
                <span>{insight.generated_variants?.length || 0} variants</span>
                <span>•</span>
                <span>{new Date(insight.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Running Experiments */}
      <div className="border rounded-lg p-4 bg-white shadow">
        <h2 className="text-xl font-bold mb-4">Running Experiments</h2>
        <p className="text-sm text-gray-600 mb-4">Active A/B tests for prompt optimization</p>
        <div className="space-y-4">
          {dashboard.running_experiments.length === 0 ? (
            <p className="text-sm text-gray-600">No experiments running</p>
          ) : (
            dashboard.running_experiments.map((exp: any) => (
              <div key={exp.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold">{exp.name}</h3>
                    <p className="text-sm text-gray-600">{exp.agent_name}</p>
                  </div>
                  <span className="px-2 py-1 border rounded text-sm">{exp.status}</span>
                </div>
                <p className="text-sm mb-2">{exp.description}</p>
                <div className="flex gap-4 text-xs text-gray-600">
                  <span>Traffic Split: {exp.traffic_split}%</span>
                  <span>Sample: {exp.current_sample_size}/{exp.target_sample_size}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pending Approvals */}
      <div className="border rounded-lg p-4 bg-white shadow">
        <h2 className="text-xl font-bold mb-4">
          Pending Approvals
          {dashboard.summary.pending_approvals > 0 && (
            <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
              {dashboard.summary.pending_approvals}
            </span>
          )}
        </h2>
        <p className="text-sm text-gray-600 mb-4">Prompt changes requiring human review</p>
        <div className="space-y-4">
          {dashboard.pending_approvals.length === 0 ? (
            <p className="text-sm text-gray-600">No pending approvals</p>
          ) : (
            dashboard.pending_approvals.map((approval: any) => (
              <div key={approval.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold">{approval.request_type.replace(/_/g, ' ')}</h3>
                    <p className="text-sm text-gray-600">{approval.prompt_version?.agent_name}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-sm ${
                    approval.priority === 'high' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {approval.priority}
                  </span>
                </div>
                <p className="text-sm mb-2">{approval.change_summary}</p>
                {approval.risk_assessment && (
                  <p className="text-xs text-amber-600 mb-2">Risk: {approval.risk_assessment}</p>
                )}
                <button className="mt-2 px-3 py-1 border rounded text-sm hover:bg-gray-50">
                  Review
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Performance Timeline */}
      <div className="border rounded-lg p-4 bg-white shadow">
        <h2 className="text-xl font-bold mb-4">Performance Timeline</h2>
        <p className="text-sm text-gray-600 mb-4">Historical accuracy and decision volume</p>
        <div className="space-y-2">
          {dashboard.performance_timeline.map((snapshot: any) => (
            <div 
              key={`${snapshot.agent_name}-${snapshot.snapshot_date}`} 
              className="flex justify-between items-center py-2 border-b"
            >
              <div>
                <span className="font-medium">{snapshot.agent_name}</span>
                <span className="text-sm text-gray-600 ml-2">
                  {new Date(snapshot.snapshot_date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex gap-4">
                <span className="text-sm">{snapshot.total_decisions} decisions</span>
                <span className="text-sm font-semibold">{snapshot.overall_accuracy}% accuracy</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
