'use client'

import { useState, useEffect } from 'react'
import { supabase, type AgentLog } from '@/lib/supabase'

export default function LogsPage() {
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string>('all')
  const [selectedLevel, setSelectedLevel] = useState<string>('all')

  useEffect(() => {
    fetchLogs()
  }, [selectedAgent, selectedLevel])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('agent_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (selectedAgent !== 'all') {
        query = query.eq('agent', selectedAgent)
      }

      if (selectedLevel !== 'all') {
        query = query.eq('level', selectedLevel)
      }

      const { data, error } = await query

      if (error) throw error
      setLogs(data || [])
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getLevelBadge = (level: string) => {
    const styles: Record<string, string> = {
      INFO: 'bg-blue-100 text-blue-800',
      WARNING: 'bg-yellow-100 text-yellow-800',
      ERROR: 'bg-red-100 text-red-800',
      SUCCESS: 'bg-green-100 text-green-800',
    }
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          styles[level] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {level}
      </span>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agent Logs</h1>
        <p className="text-gray-600 mt-1">
          Monitor system activity and agent operations
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agent
            </label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Agents</option>
              <option value="EmailManagementAgent">Email Management</option>
              <option value="OrdersLogisticsAgent">Orders & Logistics</option>
              <option value="StockListingsAgent">Stock & Listings</option>
              <option value="CustomerServiceAgent">Customer Service</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Level
            </label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="INFO">Info</option>
              <option value="WARNING">Warning</option>
              <option value="ERROR">Error</option>
              <option value="SUCCESS">Success</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchLogs}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">Loading logs...</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <ul className="divide-y divide-gray-200">
            {logs.map((log) => (
              <li key={log.id} className="px-4 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {getLevelBadge(log.level)}
                      <span className="text-sm font-medium text-gray-900">
                        {log.agent}
                      </span>
                      <span className="text-sm text-gray-500">
                        {log.event_type}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded p-3 mt-2">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(log.context, null, 2)}
                      </pre>
                    </div>
                  </div>
                  <div className="ml-4 text-right flex-shrink-0">
                    <p className="text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
