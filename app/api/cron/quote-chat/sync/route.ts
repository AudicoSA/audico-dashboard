import { NextRequest, NextResponse } from 'next/server'
import { logAgentActivity } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await logAgentActivity({
      agentName: 'quote_chat_sync',
      logLevel: 'info',
      eventType: 'sync_start',
      message: 'Starting quote chat session sync',
      context: { action: 'cron_sync' }
    })

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/integrations/quote-chat?action=sync`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`)
    }

    const result = await response.json()

    await logAgentActivity({
      agentName: 'quote_chat_sync',
      logLevel: 'info',
      eventType: 'sync_complete',
      message: `Quote chat sync completed: ${result.synced}/${result.total} sessions`,
      context: {
        action: 'cron_sync',
        synced: result.synced,
        total: result.total,
      }
    })

    return NextResponse.json({
      success: true,
      synced: result.synced,
      total: result.total,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Quote chat sync error:', error)
    
    await logAgentActivity({
      agentName: 'quote_chat_sync',
      logLevel: 'error',
      eventType: 'sync_error',
      message: `Quote chat sync failed: ${error.message}`,
      errorDetails: {
        error: error.message,
        stack: error.stack,
      },
      context: { action: 'cron_sync' }
    })

    return NextResponse.json(
      {
        error: 'Failed to sync quote chat sessions',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
