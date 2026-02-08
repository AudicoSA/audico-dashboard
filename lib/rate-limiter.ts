import Redis from 'ioredis'

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL || '', {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  lazyConnect: true,
})

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
    const currentCountStr = await redis.get(key)
    const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0
    const lastResetStr = await redis.get(`${key}:reset`)
    const lastReset = lastResetStr ? parseInt(lastResetStr, 10) : now

    if (lastReset < windowStart) {
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

    if (currentCount >= config.maxExecutions) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: lastReset + config.windowSeconds * 1000,
      }
    }

    await redis.incr(key)

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
    const countStr = await redis.get(key)
    return countStr ? parseInt(countStr, 10) : 0
  } catch (error) {
    console.error('Failed to get execution count:', error)
    return 0
  }
}

export async function resetRateLimit(agentName: string): Promise<void> {
  const key = `rate-limit:${agentName}`
  try {
    await redis.del(key)
    await redis.del(`${key}:reset`)
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
    await redis.set(key, JSON.stringify({
      timestamp: Date.now(),
      agent: agentName,
      ...metadata,
    }))
    await redis.expire(key, 86400)
  } catch (error) {
    console.error('Failed to log agent execution:', error)
  }
}

export const AGENT_RATE_LIMITS: Record<string, RateLimitConfig> = {
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
    maxExecutions: 50,
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
}
