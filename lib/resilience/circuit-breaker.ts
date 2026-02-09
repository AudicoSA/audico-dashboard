export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  successThreshold: number
  timeout: number
  resetTimeout: number
  monitoringWindow: number
  name: string
}

export interface CircuitBreakerMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  consecutiveFailures: number
  consecutiveSuccesses: number
  lastFailureTime?: number
  lastSuccessTime?: number
  state: CircuitState
  stateChangedAt: number
}

const DEFAULT_CONFIG: Omit<CircuitBreakerConfig, 'name'> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  resetTimeout: 60000,
  monitoringWindow: 300000
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig
  private metrics: CircuitBreakerMetrics
  private requestHistory: { timestamp: number; success: boolean }[] = []
  private stateChangeListeners: ((state: CircuitState, metrics: CircuitBreakerMetrics) => void)[] = []

  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      state: CircuitState.CLOSED,
      stateChangedAt: Date.now()
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.metrics.state === CircuitState.OPEN) {
      const now = Date.now()
      const timeSinceStateChange = now - this.metrics.stateChangedAt
      
      if (timeSinceStateChange >= this.config.resetTimeout) {
        this.transitionTo(CircuitState.HALF_OPEN)
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.config.name}. Retry after ${Math.ceil((this.config.resetTimeout - timeSinceStateChange) / 1000)}s`)
      }
    }

    this.metrics.totalRequests++
    const requestStartTime = Date.now()

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Request timeout after ${this.config.timeout}ms`)), this.config.timeout)
      })

      const result = await Promise.race([fn(), timeoutPromise])
      
      this.recordSuccess()
      this.cleanupHistory()
      
      return result
    } catch (error) {
      this.recordFailure()
      this.cleanupHistory()
      throw error
    }
  }

  private recordSuccess(): void {
    this.metrics.successfulRequests++
    this.metrics.consecutiveSuccesses++
    this.metrics.consecutiveFailures = 0
    this.metrics.lastSuccessTime = Date.now()

    this.requestHistory.push({ timestamp: Date.now(), success: true })

    if (this.metrics.state === CircuitState.HALF_OPEN) {
      if (this.metrics.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED)
      }
    }
  }

  private recordFailure(): void {
    this.metrics.failedRequests++
    this.metrics.consecutiveFailures++
    this.metrics.consecutiveSuccesses = 0
    this.metrics.lastFailureTime = Date.now()

    this.requestHistory.push({ timestamp: Date.now(), success: false })

    if (this.metrics.state === CircuitState.CLOSED || this.metrics.state === CircuitState.HALF_OPEN) {
      if (this.metrics.consecutiveFailures >= this.config.failureThreshold) {
        this.transitionTo(CircuitState.OPEN)
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.metrics.state
    this.metrics.state = newState
    this.metrics.stateChangedAt = Date.now()

    if (newState === CircuitState.CLOSED) {
      this.metrics.consecutiveFailures = 0
      this.metrics.consecutiveSuccesses = 0
    }

    this.notifyStateChange(newState)
  }

  private cleanupHistory(): void {
    const cutoffTime = Date.now() - this.config.monitoringWindow
    this.requestHistory = this.requestHistory.filter(req => req.timestamp > cutoffTime)
  }

  onStateChange(listener: (state: CircuitState, metrics: CircuitBreakerMetrics) => void): void {
    this.stateChangeListeners.push(listener)
  }

  private notifyStateChange(state: CircuitState): void {
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(state, this.getMetrics())
      } catch (error) {
        console.error('Error in circuit breaker state change listener:', error)
      }
    })
  }

  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics }
  }

  getState(): CircuitState {
    return this.metrics.state
  }

  getName(): string {
    return this.config.name
  }

  getConfig(): CircuitBreakerConfig {
    return { ...this.config }
  }

  getHealthMetrics(): {
    successRate: number
    errorRate: number
    recentRequests: number
    avgResponseTime?: number
  } {
    const recentRequests = this.requestHistory.length
    const recentSuccesses = this.requestHistory.filter(r => r.success).length
    const recentFailures = recentRequests - recentSuccesses

    return {
      successRate: this.metrics.totalRequests > 0 
        ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 
        : 100,
      errorRate: this.metrics.totalRequests > 0 
        ? (this.metrics.failedRequests / this.metrics.totalRequests) * 100 
        : 0,
      recentRequests
    }
  }

  reset(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      state: CircuitState.CLOSED,
      stateChangedAt: Date.now()
    }
    this.requestHistory = []
  }
}
