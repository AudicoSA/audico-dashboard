import { NextRequest, NextResponse } from 'next/server'
import { quoteAgent } from '../../../../services/agents'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function logToSquad(message: string, data: any = {}) {
  await supabase
    .from('squad_messages')
    .insert({
      from_agent: 'quote_agent_api',
      to_agent: null,
      message,
      task_id: null,
      data: {
        ...data,
        timestamp: new Date().toISOString()
      }
    })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, quoteRequestId } = body

    await logToSquad(`Quote Agent API called: ${action}`, { quoteRequestId })

    if (action === 'generate_customer_quote' && quoteRequestId) {
      const result = await quoteAgent.generateCustomerQuote(quoteRequestId)

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Quote generated successfully',
          quoteNumber: result.quoteNumber,
          pdfUrl: result.pdfUrl,
          taskId: result.taskId
        })
      } else {
        return NextResponse.json(
          {
            success: false,
            error: result.error || 'Failed to generate quote'
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Invalid action or missing required parameters' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('Quote Agent API error:', error)
    await logToSquad(`Error in Quote Agent API: ${error.message}`, {
      error: error.message,
      stack: error.stack
    })

    return NextResponse.json(
      {
        error: 'Failed to process quote agent request',
        details: error.message
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'status') {
      return NextResponse.json({
        success: true,
        status: 'active',
        agent: 'QuoteAgent',
        capabilities: [
          'generate_customer_quote'
        ]
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Quote Agent API',
      endpoints: {
        POST: {
          generate_customer_quote: {
            description: 'Generate customer quote from supplier responses',
            params: {
              action: 'generate_customer_quote',
              quoteRequestId: 'UUID of the quote request'
            }
          }
        },
        GET: {
          status: {
            description: 'Get agent status',
            params: {
              action: 'status'
            }
          }
        }
      }
    })

  } catch (error: any) {
    console.error('Quote Agent API GET error:', error)
    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 }
    )
  }
}
