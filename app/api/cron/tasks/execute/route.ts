import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth'
/**
 * Task Execution Cron Job
 *
 * Runs every 2 minutes to poll for executable tasks and dispatch them to agents.
 * This is the heartbeat of the autonomous agent system.
 */

import { NextRequest, NextResponse } from 'next/server'
import { taskExecutor } from '@/services/task-executor'
import { checkRateLimit, AGENT_RATE_LIMITS } from '@/lib/rate-limiter'
import { logAgentActivity } from '@/lib/logger'

export const maxDuration = 60 // Maximum execution time: 60 seconds
export const dynamic = 'force-dynamic'

/**
 * Core task execution logic - shared between GET (Vercel Cron) and POST (manual trigger)
 */
async function handleExecute() {
  const startTime = Date.now()

  console.log('[CRON] Task executor started')

  try {
    // 1. Check rate limit
    const rateLimit = await checkRateLimit(AGENT_RATE_LIMITS.task_executor)
    if (!rateLimit.allowed) {
      console.log('[CRON] Rate limit exceeded, skipping execution')
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt
        },
        { status: 429 }
      )
    }

    // 2. Poll and execute tasks
    const results = await taskExecutor.pollAndExecute()

    const duration = Date.now() - startTime

    // 3. Log activity
    await logAgentActivity({
      agentName: 'Task Executor',
      eventType: 'cron_execution',
      logLevel: 'info',
      message: `Executed ${results.executed} tasks, ${results.failed} failed, ${results.skipped} skipped`,
      context: {
        executed: results.executed,
        failed: results.failed,
        skipped: results.skipped,
        duration_ms: duration,
        rate_limit_remaining: rateLimit.remaining
      }
    })

    console.log('[CRON] Task executor completed:', results, `(${duration}ms)`)

    // 4. Return results
    return NextResponse.json({
      success: true,
      executed: results.executed,
      failed: results.failed,
      skipped: results.skipped,
      duration_ms: duration,
      rate_limit: {
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt
      }
    })
  } catch (error: any) {
    console.error('[CRON] Task executor error:', error)

    await logAgentActivity({
      agentName: 'Task Executor',
      eventType: 'cron_error',
      logLevel: 'error',
      message: `Task executor failed: ${error.message}`,
      errorDetails: { error: error.message, stack: error.stack }
    })

    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}

// Vercel Cron sends GET requests - do the actual work
export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({
      status: 'task-executor-active',
      message: 'Use Authorization: Bearer CRON_SECRET to trigger',
      timestamp: new Date().toISOString()
    })
  }
  return handleExecute()
}

// Manual trigger via POST
export async function POST(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse()
  }
  return handleExecute()
}
