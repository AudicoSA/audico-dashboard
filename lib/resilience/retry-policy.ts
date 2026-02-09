export interface RetryPolicyConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  jitterFactor: number
  retryableErrors?: string[]
}

const DEFAULT_CONFIG: RetryPolicyConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'ENETUNREACH']
}

export interface RetryMetrics {
  attemptNumber: number
  delayMs: number
  totalElapsedMs: number
}

export class RetryPolicy {
  private config: RetryPolicyConfig

  constructor(config: Partial<RetryPolicyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async execute<T>(
    fn: () => Promise<T>,
    onRetry?: (error: Error, metrics: RetryMetrics) => void
  ): Promise<T> {
    let lastError: Error | undefined
    const startTime = Date.now()

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt === this.config.maxRetries) {
          throw lastError
        }

        if (!this.isRetryable(lastError)) {
          throw lastError
        }

        const delay = this.calculateDelay(attempt)
        const metrics: RetryMetrics = {
          attemptNumber: attempt + 1,
          delayMs: delay,
          totalElapsedMs: Date.now() - startTime
        }

        if (onRetry) {
          onRetry(lastError, metrics)
        }

        await this.sleep(delay)
      }
    }

    throw lastError || new Error('Retry policy failed without error')
  }

  private calculateDelay(attemptNumber: number): number {
    const exponentialDelay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attemptNumber)
    
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs)
    
    const jitter = cappedDelay * this.config.jitterFactor * (Math.random() - 0.5) * 2
    
    const finalDelay = Math.max(0, cappedDelay + jitter)
    
    return Math.round(finalDelay)
  }

  private isRetryable(error: Error): boolean {
    if (!this.config.retryableErrors || this.config.retryableErrors.length === 0) {
      return true
    }

    const errorCode = (error as any).code
    const errorMessage = error.message.toLowerCase()

    return this.config.retryableErrors.some(retryableError => {
      const retryableLower = retryableError.toLowerCase()
      return errorCode === retryableError || 
             errorMessage.includes(retryableLower) ||
             errorMessage.includes('timeout') ||
             errorMessage.includes('network') ||
             errorMessage.includes('connect')
    })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  getConfig(): RetryPolicyConfig {
    return { ...this.config }
  }
}
