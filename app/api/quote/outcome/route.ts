import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      quoteRequestId,
      quoteNumber,
      outcome,
      rejectionReason,
      negotiationDetails,
      responseTimeHours
    } = body

    if (!quoteRequestId || !quoteNumber || !outcome) {
      return NextResponse.json(
        { error: 'Missing required fields: quoteRequestId, quoteNumber, outcome' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: quoteRequest, error: fetchError } = await supabase
      .from('quote_requests')
      .select('*')
      .eq('id', quoteRequestId)
      .single()

    if (fetchError || !quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found' },
        { status: 404 }
      )
    }

    const quotedItems = quoteRequest.metadata?.quoted_items || []
    const totalAmount = quoteRequest.metadata?.total_amount || 0
    const finalAmount = outcome === 'accepted' ? totalAmount : 
                        negotiationDetails?.final_amount || null

    const { data: outcomeRecord, error: insertError } = await supabase
      .from('quote_outcomes')
      .insert({
        quote_request_id: quoteRequestId,
        quote_number: quoteNumber,
        outcome,
        customer_email: quoteRequest.customer_email,
        customer_name: quoteRequest.customer_name,
        customer_segment: quoteRequest.customer_segment,
        total_quoted_amount: totalAmount,
        final_amount: finalAmount,
        items: quotedItems,
        urgency_level: quoteRequest.urgency_level,
        order_size_category: quoteRequest.order_size_category,
        rejection_reason: rejectionReason,
        negotiation_details: negotiationDetails,
        response_time_hours: responseTimeHours,
        metadata: {
          recorded_at: new Date().toISOString(),
          source: 'api'
        }
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting quote outcome:', insertError)
      return NextResponse.json(
        { error: 'Failed to record quote outcome', details: insertError.message },
        { status: 500 }
      )
    }

    await supabase
      .from('quote_requests')
      .update({
        status: outcome === 'accepted' ? 'completed' : 'completed',
        completed_at: new Date().toISOString(),
        metadata: {
          ...quoteRequest.metadata,
          outcome,
          outcome_recorded_at: new Date().toISOString()
        }
      })
      .eq('id', quoteRequestId)

    await supabase
      .from('squad_messages')
      .insert({
        from_agent: 'QuoteOutcomeTracker',
        to_agent: null,
        message: `📊 Quote outcome recorded: ${quoteNumber} - ${outcome.toUpperCase()}\n` +
                 `Customer: ${quoteRequest.customer_name}\n` +
                 `Amount: R ${totalAmount.toFixed(2)}\n` +
                 `${rejectionReason ? `Reason: ${rejectionReason}` : ''}`,
        task_id: null,
        data: {
          quote_request_id: quoteRequestId,
          quote_number: quoteNumber,
          outcome,
          amount: totalAmount,
          timestamp: new Date().toISOString()
        }
      })

    return NextResponse.json({
      success: true,
      outcomeId: outcomeRecord.id,
      message: `Quote outcome '${outcome}' recorded successfully`,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Error recording quote outcome:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const quoteRequestId = searchParams.get('quoteRequestId')

    if (!quoteRequestId) {
      return NextResponse.json(
        { error: 'Missing quoteRequestId parameter' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: outcomes, error } = await supabase
      .from('quote_outcomes')
      .select('*')
      .eq('quote_request_id', quoteRequestId)
      .order('outcome_date', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch quote outcomes', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      outcomes,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Error fetching quote outcomes:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
