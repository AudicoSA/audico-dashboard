export { CircuitBreaker, CircuitState } from './circuit-breaker'
export type { CircuitBreakerConfig, CircuitBreakerMetrics } from './circuit-breaker'

export { RetryPolicy } from './retry-policy'
export type { RetryPolicyConfig, RetryMetrics } from './retry-policy'

export { resilienceManager } from './resilience-manager'
export type { ServiceConfig, ServiceHealth, ResilienceMetrics } from './resilience-manager'

export {
  ALL_SERVICE_CONFIGS,
  GMAIL_API_CONFIG,
  FACEBOOK_API_CONFIG,
  INSTAGRAM_API_CONFIG,
  TWITTER_API_CONFIG,
  GOOGLE_ADS_API_CONFIG,
  OPENCART_MYSQL_CONFIG,
  NOTEBOOKLM_API_CONFIG
} from './service-configs'

export {
  ResilientFacebookConnector,
  ResilientInstagramConnector,
  ResilientTwitterConnector
} from './resilient-social-connectors'

export { resilienceMonitoring, sendSlackAlert, sendEmailAlert } from './monitoring'
export type { AlertConfig } from './monitoring'

import { resilienceManager } from './resilience-manager'
import { ALL_SERVICE_CONFIGS } from './service-configs'

export function initializeResilience(): void {
  ALL_SERVICE_CONFIGS.forEach(config => {
    resilienceManager.registerService(config)
  })
}

export async function withResilience<T>(
  serviceName: string,
  operation: () => Promise<T>,
  options?: {
    skipRetry?: boolean
    skipCircuitBreaker?: boolean
    fallbackValue?: T
  }
): Promise<T> {
  return resilienceManager.executeWithResilience(serviceName, operation, options)
}
