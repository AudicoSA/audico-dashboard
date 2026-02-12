import Redis from 'ioredis'

// Initialize Redis client lazily to avoid build-time connection issues
let redisClient: Redis | null = null

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL || '', {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
    })
  }
  return redisClient
}

export interface RateLimitConfig {
  agentName: string
  maxExecutions: number
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export async function checkRateLimit(
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `rate-limit:${config.agentName}`
  const now = Date.now()
  const windowStart = now - config.windowSeconds * 1000

  try {
    const redis = getRedis()
    const currentCountStr = await redis.get(key)
    const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0
    const lastResetStr = await redis.get(`${key}:reset`)

    // If no reset timestamp exists OR the window has expired, start a fresh window
    if (!lastResetStr || parseInt(lastResetStr, 10) < windowStart) {
      await redis.set(key, '1')
      await redis.set(`${key}:reset`, now.toString())
      await redis.expire(key, config.windowSeconds)
      await redis.expire(`${key}:reset`, config.windowSeconds)

      return {
        allowed: true,
        remaining: config.maxExecutions - 1,
        resetAt: now + config.windowSeconds * 1000,
      }
    }

    const lastReset = parseInt(lastResetStr, 10)

    if (currentCount >= config.maxExecutions) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: lastReset + config.windowSeconds * 1000,
      }
    }

    await redis.incr(key)
    // Ensure TTL is set on the counter key (in case it was created without one)
    const ttl = await redis.ttl(key)
    if (ttl < 0) {
      await redis.expire(key, config.windowSeconds)
    }

    return {
      allowed: true,
      remaining: config.maxExecutions - currentCount - 1,
      resetAt: lastReset + config.windowSeconds * 1000,
    }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    return {
      allowed: true,
      remaining: config.maxExecutions,
      resetAt: now + config.windowSeconds * 1000,
    }
  }
}

export async function getAgentExecutionCount(
  agentName: string,
  windowSeconds: number = 3600
): Promise<number> {
  const key = `rate-limit:${agentName}`
  try {
    const countStr = await getRedis().get(key)
    return countStr ? parseInt(countStr, 10) : 0
  } catch (error) {
    console.error('Failed to get execution count:', error)
    return 0
  }
}

export async function resetRateLimit(agentName: string): Promise<void> {
  const key = `rate-limit:${agentName}`
  try {
    await getRedis().del(key)
    await getRedis().del(`${key}:reset`)
  } catch (error) {
    console.error('Failed to reset rate limit:', error)
  }
}

export async function logAgentExecution(
  agentName: string,
  metadata: Record<string, any>
): Promise<void> {
  const key = `agent-log:${agentName}:${Date.now()}`
  try {
    await getRedis().set(key, JSON.stringify({
      timestamp: Date.now(),
      agent: agentName,
      ...metadata,
    }))
    await getRedis().expire(key, 86400)
  } catch (error) {
    console.error('Failed to log agent execution:', error)
  }
}

export const AGENT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  task_executor: {
    agentName: 'task_executor',
    maxExecutions: 720,
    windowSeconds: 86400,
  },
  email_poll: {
    agentName: 'email_poll',
    maxExecutions: 96,
    windowSeconds: 86400,
  },
  email_classify: {
    agentName: 'email_classify',
    maxExecutions: 72,
    windowSeconds: 86400,
  },
  email_respond: {
    agentName: 'email_respond',
    maxExecutions: 200,
    windowSeconds: 86400,
  },
  email_send: {
    agentName: 'email_send',
    maxExecutions: 200,
    windowSeconds: 86400,
  },
  social_publish: {
    agentName: 'social_publish',
    maxExecutions: 20,
    windowSeconds: 86400,
  },
  newsletter_send: {
    agentName: 'newsletter_send',
    maxExecutions: 1,
    windowSeconds: 86400,
  },
  influencer_outreach: {
    agentName: 'influencer_outreach',
    maxExecutions: 10,
    windowSeconds: 86400,
  },
  seo_bulk_apply: {
    agentName: 'seo_bulk_apply',
    maxExecutions: 5,
    windowSeconds: 86400,
  },
  stock_check: {
    agentName: 'stock_check',
    maxExecutions: 4,
    windowSeconds: 86400,
  },
  analytics_update: {
    agentName: 'analytics_update',
    maxExecutions: 1,
    windowSeconds: 86400,
  },
  maintenance_cleanup: {
    agentName: 'maintenance_cleanup',
    maxExecutions: 1,
    windowSeconds: 86400,
  },
  social_generate: {
    agentName: 'social_generate',
    maxExecutions: 2,
    windowSeconds: 86400,
  },
  seo_audit: {
    agentName: 'seo_audit',
    maxExecutions: 1,
    windowSeconds: 86400,
  },
  marketing_check: {
    agentName: 'marketing_check',
    maxExecutions: 2,
    windowSeconds: 86400,
  },
}
