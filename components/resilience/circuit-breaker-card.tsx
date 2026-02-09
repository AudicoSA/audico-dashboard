'use client'

import { CircuitState } from '../../lib/resilience'

interface CircuitBreakerCardProps {
  serviceName: string
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
  onReset: (serviceName: string) => void
}

export function CircuitBreakerCard({
  serviceName,
  state,
  healthy,
  successRate,
  errorRate,
  recentRequests,
  degradationActive,
  metrics,
  onReset
}: CircuitBreakerCardProps) {
  const stateColors = {
    CLOSED: 'bg-green-100 text-green-800 border-green-300',
    HALF_OPEN: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    OPEN: 'bg-red-100 text-red-800 border-red-300'
  }

  const stateIcons = {
    CLOSED: '✓',
    HALF_OPEN: '◐',
    OPEN: '✕'
  }

  return (
    <div className={`border-2 rounded-lg p-4 ${stateColors[state]}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-semibold capitalize">
            {serviceName.replace(/-/g, ' ')}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl">{stateIcons[state]}</span>
            <span className="font-medium">{state}</span>
          </div>
        </div>
        <button
          onClick={() => onReset(serviceName)}
          className="px-3 py-1 text-sm bg-white rounded border hover:bg-gray-50"
          disabled={state === 'CLOSED'}
        >
          Reset
        </button>
      </div>

      {degradationActive && (
        <div className="mb-3 p-2 bg-orange-100 border border-orange-300 rounded text-orange-900 text-sm">
          ⚠️ Degradation Strategy Active
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="opacity-75">Success Rate</div>
          <div className="text-xl font-semibold">
            {successRate.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="opacity-75">Error Rate</div>
          <div className="text-xl font-semibold">
            {errorRate.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="opacity-75">Recent Requests</div>
          <div className="text-xl font-semibold">{recentRequests}</div>
        </div>
        <div>
          <div className="opacity-75">Status</div>
          <div className="text-xl font-semibold">
            {healthy ? '✓ Healthy' : '✕ Unhealthy'}
          </div>
        </div>
      </div>

      {metrics && (
        <div className="mt-4 pt-4 border-t border-current/20">
          <div className="text-xs opacity-75 mb-2">Lifetime Metrics</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="opacity-75">Total</div>
              <div className="font-semibold">{metrics.requestsTotal}</div>
            </div>
            <div>
              <div className="opacity-75">Retries</div>
              <div className="font-semibold">{metrics.retriesTotal}</div>
            </div>
            <div>
              <div className="opacity-75">Trips</div>
              <div className="font-semibold">{metrics.circuitBreakerTrips}</div>
            </div>
            <div>
              <div className="opacity-75">Success</div>
              <div className="font-semibold">{metrics.requestsSuccessful}</div>
            </div>
            <div>
              <div className="opacity-75">Failed</div>
              <div className="font-semibold">{metrics.requestsFailed}</div>
            </div>
            <div>
              <div className="opacity-75">Degraded</div>
              <div className="font-semibold">{metrics.degradationInvocations}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
