import { ServiceConfig } from './resilience-manager'

export const GMAIL_API_CONFIG: ServiceConfig = {
  name: 'gmail-api',
  circuitBreaker: {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 15000,
    resetTimeout: 60000,
    monitoringWindow: 300000
  },
  retryPolicy: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'rate_limit_exceeded']
  },
  degradationStrategy: async () => {
    console.warn('Gmail API unavailable - emails will be queued')
    return { 
      success: false, 
      queued: true,
      message: 'Email queued for later delivery' 
    }
  }
}

export const FACEBOOK_API_CONFIG: ServiceConfig = {
  name: 'facebook-api',
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
    resetTimeout: 120000,
    monitoringWindow: 300000
  },
  retryPolicy: {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 20000,
    backoffMultiplier: 2,
    jitterFactor: 0.15,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'api_rate_limit']
  },
  degradationStrategy: async () => {
    return {
      success: false,
      platform: 'facebook',
      error: 'Facebook API temporarily unavailable - post saved as draft'
    }
  }
}

export const INSTAGRAM_API_CONFIG: ServiceConfig = {
  name: 'instagram-api',
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
    resetTimeout: 120000,
    monitoringWindow: 300000
  },
  retryPolicy: {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 20000,
    backoffMultiplier: 2,
    jitterFactor: 0.15,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'api_rate_limit']
  },
  degradationStrategy: async () => {
    return {
      success: false,
      platform: 'instagram',
      error: 'Instagram API temporarily unavailable - post saved as draft'
    }
  }
}

export const TWITTER_API_CONFIG: ServiceConfig = {
  name: 'twitter-api',
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 25000,
    resetTimeout: 120000,
    monitoringWindow: 300000
  },
  retryPolicy: {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 15000,
    backoffMultiplier: 2,
    jitterFactor: 0.15,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'rate_limit', 'too_many_requests']
  },
  degradationStrategy: async () => {
    return {
      success: false,
      platform: 'twitter',
      error: 'Twitter API temporarily unavailable - post saved as draft'
    }
  }
}

export const GOOGLE_ADS_API_CONFIG: ServiceConfig = {
  name: 'google-ads-api',
  circuitBreaker: {
    failureThreshold: 4,
    successThreshold: 2,
    timeout: 45000,
    resetTimeout: 180000,
    monitoringWindow: 300000
  },
  retryPolicy: {
    maxRetries: 4,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'QUOTA_EXCEEDED', 'RATE_LIMIT']
  },
  degradationStrategy: async () => {
    return {
      success: false,
      error: 'Google Ads API temporarily unavailable - campaign data may be stale'
    }
  }
}

export const OPENCART_MYSQL_CONFIG: ServiceConfig = {
  name: 'opencart-mysql',
  circuitBreaker: {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 10000,
    resetTimeout: 30000,
    monitoringWindow: 300000
  },
  retryPolicy: {
    maxRetries: 3,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ER_LOCK_DEADLOCK']
  },
  degradationStrategy: async () => {
    console.warn('OpenCart MySQL connection unavailable - using cached data')
    return {
      success: false,
      cached: true,
      error: 'Database temporarily unavailable - using cached product data'
    }
  }
}

export const NOTEBOOKLM_API_CONFIG: ServiceConfig = {
  name: 'notebooklm-api',
  circuitBreaker: {
    failureThreshold: 4,
    successThreshold: 2,
    timeout: 90000,
    resetTimeout: 180000,
    monitoringWindow: 300000
  },
  retryPolicy: {
    maxRetries: 2,
    initialDelayMs: 3000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.2,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'QUOTA_EXCEEDED', 'RATE_LIMIT']
  },
  degradationStrategy: async () => {
    return {
      success: false,
      error: 'NotebookLM temporarily unavailable - visual generation postponed'
    }
  }
}

export const ALL_SERVICE_CONFIGS = [
  GMAIL_API_CONFIG,
  FACEBOOK_API_CONFIG,
  INSTAGRAM_API_CONFIG,
  TWITTER_API_CONFIG,
  GOOGLE_ADS_API_CONFIG,
  OPENCART_MYSQL_CONFIG,
  NOTEBOOKLM_API_CONFIG
]
