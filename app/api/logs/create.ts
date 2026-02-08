import { NextRequest, NextResponse } from 'next/server'
import { logAgentActivity } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentName, logLevel, eventType, message, errorDetails, context } = body

    if (!agentName || !logLevel || !eventType || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: agentName, logLevel, eventType, message' },
        { status: 400 }
      )
    }

    await logAgentActivity({
      agentName,
      logLevel,
      eventType,
      message,
      errorDetails: errorDetails || null,
      context: context || {}
    })

    return NextResponse.json({
      success: true,
      message: 'Log created successfully'
    })
  } catch (error: any) {
    console.error('Log creation error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create log', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
