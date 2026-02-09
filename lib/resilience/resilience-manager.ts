import { CircuitBreaker, CircuitState, CircuitBreakerConfig } from './circuit-breaker'
import { RetryPolicy, RetryPolicyConfig, RetryMetrics } from './retry-policy'

export interface ServiceConfig {
  name: string
  circuitBreaker?: Partial<CircuitBreakerConfig>
  retryPolicy?: Partial<RetryPolicyConfig>
  degradationStrategy?: () => Promise<any>
}

export interface ServiceHealth {
  name: string
  state: CircuitState
  healthy: boolean
  successRate: number
  errorRate: number
  recentRequests: number
  lastError?: string
  lastErrorTime?: number
  degradationActive: boolean
}

export interface ResilienceMetrics {
  serviceName: string
  requestsTotal: number
  requestsSuccessful: number
  requestsFailed: number
  retriesTotal: number
  circuitBreakerTrips: number
  degradationInvocations: number
  avgResponseTimeMs?: number
}

class ResilienceManager {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map()
  private retryPolicies: Map<string, RetryPolicy> = new Map()
  private degradationStrategies: Map<string, () => Promise<any>> = new Map()
  private metrics: Map<string, ResilienceMetrics> = new Map()
  private healthCheckListeners: ((services: ServiceHealth[]) => void)[] = []

  registerService(config: ServiceConfig): void {
    const circuitBreaker = new CircuitBreaker({
      name: config.name,
      ...config.circuitBreaker
    })

    circuitBreaker.onStateChange((state, metrics) => {
      if (state === CircuitState.OPEN) {
        const serviceMetrics = this.getOrCreateMetrics(config.name)
        serviceMetrics.circuitBreakerTrips++
      }
      this.notifyHealthChange()
    })

    this.circuitBreakers.set(config.name, circuitBreaker)
    this.retryPolicies.set(config.name, new RetryPolicy(config.retryPolicy))
    
    if (config.degradationStrategy) {
      this.degradationStrategies.set(config.name, config.degradationStrategy)
    }

    this.getOrCreateMetrics(config.name)
  }

  async executeWithResilience<T>(
    serviceName: string,
    operation: () => Promise<T>,
    options: {
      skipRetry?: boolean
      skipCircuitBreaker?: boolean
      fallbackValue?: T
    } = {}
  ): Promise<T> {
    const circuitBreaker = this.circuitBreakers.get(serviceName)
    const retryPolicy = this.retryPolicies.get(serviceName)
    const degradationStrategy = this.degradationStrategies.get(serviceName)
    const metrics = this.getOrCreateMetrics(serviceName)

    if (!circuitBreaker) {
      throw new Error(`Service ${serviceName} not registered with resilience manager`)
    }

    const startTime = Date.now()

    try {
      const executeOperation = async () => {
        if (options.skipCircuitBreaker) {
          return await operation()
        }
        return await circuitBreaker.execute(operation)
      }

      let result: T
      if (options.skipRetry || !retryPolicy) {
        result = await executeOperation()
      } else {
        result = await retryPolicy.execute(
          executeOperation,
          (error, retryMetrics) => {
            metrics.retriesTotal++
          }
        )
      }

      metrics.requestsSuccessful++
      return result

    } catch (error) {
      metrics.requestsFailed++
      
      if (degradationStrategy && circuitBreaker.getState() === CircuitState.OPEN) {
        try {
          metrics.degradationInvocations++
          const degradedResult = await degradationStrategy()
          return degradedResult as T
        } catch (degradationError) {
          console.error(`Degradation strategy failed for ${serviceName}:`, degradationError)
        }
      }

      if (options.fallbackValue !== undefined) {
        return options.fallbackValue
      }

      throw error
    } finally {
      metrics.requestsTotal++
      this.notifyHealthChange()
    }
  }

  getServiceHealth(serviceName: string): ServiceHealth | null {
    const circuitBreaker = this.circuitBreakers.get(serviceName)
    if (!circuitBreaker) {
      return null
    }

    const cbMetrics = circuitBreaker.getMetrics()
    const healthMetrics = circuitBreaker.getHealthMetrics()
    const state = circuitBreaker.getState()

    return {
      name: serviceName,
      state,
      healthy: state !== CircuitState.OPEN,
      successRate: healthMetrics.successRate,
      errorRate: healthMetrics.errorRate,
      recentRequests: healthMetrics.recentRequests,
      lastErrorTime: cbMetrics.lastFailureTime,
      degradationActive: state === CircuitState.OPEN && this.degradationStrategies.has(serviceName)
    }
  }

  getAllServicesHealth(): ServiceHealth[] {
    const health: ServiceHealth[] = []
    for (const serviceName of this.circuitBreakers.keys()) {
      const serviceHealth = this.getServiceHealth(serviceName)
      if (serviceHealth) {
        health.push(serviceHealth)
      }
    }
    return health
  }

  getServiceMetrics(serviceName: string): ResilienceMetrics | null {
    return this.metrics.get(serviceName) || null
  }

  getAllMetrics(): ResilienceMetrics[] {
    return Array.from(this.metrics.values())
  }

  onHealthChange(listener: (services: ServiceHealth[]) => void): void {
    this.healthCheckListeners.push(listener)
  }

  private notifyHealthChange(): void {
    const health = this.getAllServicesHealth()
    this.healthCheckListeners.forEach(listener => {
      try {
        listener(health)
      } catch (error) {
        console.error('Error in health change listener:', error)
      }
    })
  }

  private getOrCreateMetrics(serviceName: string): ResilienceMetrics {
    if (!this.metrics.has(serviceName)) {
      this.metrics.set(serviceName, {
        serviceName,
        requestsTotal: 0,
        requestsSuccessful: 0,
        requestsFailed: 0,
        retriesTotal: 0,
        circuitBreakerTrips: 0,
        degradationInvocations: 0
      })
    }
    return this.metrics.get(serviceName)!
  }

  resetService(serviceName: string): void {
    const circuitBreaker = this.circuitBreakers.get(serviceName)
    if (circuitBreaker) {
      circuitBreaker.reset()
    }
    
    this.metrics.set(serviceName, {
      serviceName,
      requestsTotal: 0,
      requestsSuccessful: 0,
      requestsFailed: 0,
      retriesTotal: 0,
      circuitBreakerTrips: 0,
      degradationInvocations: 0
    })
    
    this.notifyHealthChange()
  }

  resetAll(): void {
    for (const serviceName of this.circuitBreakers.keys()) {
      this.resetService(serviceName)
    }
  }
}

export const resilienceManager = new ResilienceManager()
