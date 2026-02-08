import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, logAgentExecution, AGENT_RATE_LIMITS } from '@/lib/rate-limiter'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function logToSquadMessages(fromAgent: string, message: string, data: any = null) {
  await supabase
    .from('squad_messages')
    .insert({
      from_agent: fromAgent,
      to_agent: null,
      message,
      task_id: null,
      data,
    })
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rateLimit = await checkRateLimit(AGENT_RATE_LIMITS.stock_check)
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          remaining: rateLimit.remaining,
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
        { status: 429 }
      )
    }

    await logToSquadMessages('stock_agent', 'Starting stock check', { 
      action: 'stock_check_start',
      remaining_executions: rateLimit.remaining,
    })

    const { data: queueItems, error } = await supabase
      .from('price_change_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) {
      throw error
    }

    await logAgentExecution('stock_check', {
      items_found: queueItems?.length || 0,
      status: 'completed',
    })

    await logToSquadMessages('stock_agent', `Stock check completed: ${queueItems?.length || 0} items`, {
      action: 'stock_check_complete',
      count: queueItems?.length || 0,
    })

    return NextResponse.json({
      success: true,
      itemsFound: queueItems?.length || 0,
      remaining: rateLimit.remaining,
    })
  } catch (error: any) {
    console.error('Stock check error:', error)
    await logToSquadMessages('stock_agent', `Stock check failed: ${error.message}`, {
      action: 'stock_check_error',
      error: error.message,
    })

    return NextResponse.json(
      { error: 'Stock check failed', details: error.message },
      { status: 500 }
    )
  }
}
