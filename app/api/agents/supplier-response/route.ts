import { NextRequest, NextResponse } from 'next/server'
import { processSupplierResponse } from '@/lib/supplier-response-handler'
import { logAgentActivity } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { email_log_id } = body

    if (!email_log_id) {
      return NextResponse.json(
        { error: 'email_log_id is required' },
        { status: 400 }
      )
    }

    await logAgentActivity({
      agentName: 'supplier_response_handler',
      logLevel: 'info',
      eventType: 'process_start',
      message: `Processing supplier response for email ${email_log_id}`,
      context: { email_log_id }
    })

    const result = await processSupplierResponse(email_log_id)

    await logAgentActivity({
      agentName: 'supplier_response_handler',
      logLevel: 'info',
      eventType: 'process_complete',
      message: `Supplier response processing complete`,
      context: {
        email_log_id,
        ...result
      }
    })

    return NextResponse.json({
      success: true,
      result
    })

  } catch (error: any) {
    console.error('Supplier response processing error:', error)
    
    await logAgentActivity({
      agentName: 'supplier_response_handler',
      logLevel: 'error',
      eventType: 'process_error',
      message: `Supplier response processing failed: ${error.message}`,
      errorDetails: {
        error: error.message,
        stack: error.stack
      }
    })

    return NextResponse.json(
      { error: 'Failed to process supplier response', details: error.message },
      { status: 500 }
    )
  }
}
