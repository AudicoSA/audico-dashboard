'use client'

import { useEffect, useState } from 'react'
import { CircuitBreakerCard } from './circuit-breaker-card'
import { CircuitState } from '../../lib/resilience'

interface ServiceHealth {
  name: string
  state: CircuitState
  healthy: boolean
  successRate: number
  errorRate: number
  recentRequests: number
  degradationActive: boolean
  metrics?: {
    requestsTotal: number
    requestsSuccessful: number
    requestsFailed: number
    retriesTotal: number
    circuitBreakerTrips: number
    degradationInvocations: number
  } | null
}

interface OverallHealth {
  healthy: boolean
  totalServices: number
  healthyServices: number
  degradedServices: number
  unhealthyServices: number
}

export function ResilienceDashboard() {
  const [services, setServices] = useState<ServiceHealth[]>([])
  const [overall, setOverall] = useState<OverallHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/resilience/health')
      if (!response.ok) {
        throw new Error('Failed to fetch health data')
      }
      const data = await response.json()
      setServices(data.services)
      setOverall(data.overall)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (serviceName: string) => {
    try {
      const response = await fetch('/api/resilience/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceName })
      })
      
      if (!response.ok) {
        throw new Error('Failed to reset service')
      }
      
      await fetchHealth()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reset service')
    }
  }

  const handleResetAll = async () => {
    if (!confirm('Are you sure you want to reset all circuit breakers?')) {
      return
    }

    try {
      const response = await fetch('/api/resilience/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      
      if (!response.ok) {
        throw new Error('Failed to reset all services')
      }
      
      await fetchHealth()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reset services')
    }
  }

  useEffect(() => {
    fetchHealth()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchHealth()
    }, 5000)

    return () => clearInterval(interval)
  }, [autoRefresh])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading resilience metrics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-semibold mb-2">Error Loading Dashboard</h3>
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchHealth}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">API Resilience Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Circuit breaker states and API health metrics
          </p>
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Auto-refresh (5s)</span>
          </label>
          <button
            onClick={handleResetAll}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Reset All
          </button>
          <button
            onClick={fetchHealth}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {overall && (
        <div className={`border-2 rounded-lg p-6 ${
          overall.healthy 
            ? 'bg-green-50 border-green-300' 
            : 'bg-red-50 border-red-300'
        }`}>
          <h2 className="text-xl font-semibold mb-4">Overall System Health</h2>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <div className="text-sm opacity-75">Total Services</div>
              <div className="text-3xl font-bold">{overall.totalServices}</div>
            </div>
            <div>
              <div className="text-sm opacity-75">Healthy</div>
              <div className="text-3xl font-bold text-green-600">
                {overall.healthyServices}
              </div>
            </div>
            <div>
              <div className="text-sm opacity-75">Degraded</div>
              <div className="text-3xl font-bold text-yellow-600">
                {overall.degradedServices}
              </div>
            </div>
            <div>
              <div className="text-sm opacity-75">Unhealthy</div>
              <div className="text-3xl font-bold text-red-600">
                {overall.unhealthyServices}
              </div>
            </div>
            <div>
              <div className="text-sm opacity-75">System Status</div>
              <div className="text-2xl font-bold">
                {overall.healthy ? '✓ Healthy' : '✕ Issues Detected'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => (
          <CircuitBreakerCard
            key={service.name}
            serviceName={service.name}
            state={service.state}
            healthy={service.healthy}
            successRate={service.successRate}
            errorRate={service.errorRate}
            recentRequests={service.recentRequests}
            degradationActive={service.degradationActive}
            metrics={service.metrics}
            onReset={handleReset}
          />
        ))}
      </div>
    </div>
  )
}
