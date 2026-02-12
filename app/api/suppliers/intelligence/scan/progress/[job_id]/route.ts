import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

const supabase = getServerSupabase()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  try {
    const { job_id: jobId } = await params

    const { data, error } = await supabase
      .from('squad_messages')
      .select('data, created_at')
      .eq('from_agent', 'email_intelligence_scanner')
      .eq('data->>job_id', jobId)
      .eq('data->>type', 'state')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data?.data?.state) {
      return NextResponse.json(
        { error: 'Job not found or no state available', job_id: jobId },
        { status: 404 }
      )
    }

    const state = data.data.state

    return NextResponse.json({
      success: true,
      job_id: jobId,
      status: state.status,
      progress: {
        total_messages: state.total_messages,
        processed_count: state.processed_count,
        suppliers_found: state.suppliers_found,
        products_found: state.products_found,
        contacts_found: state.contacts_found,
        interactions_logged: state.interactions_logged,
        errors: state.errors || 0,
        tokens_used: state.tokens_used || 0,
        estimated_cost_usd: Math.round((state.estimated_cost_usd || 0) * 100) / 100,
        percentage: state.total_messages > 0
          ? Math.round((state.processed_count / state.total_messages) * 100)
          : 0,
      },
      start_date: state.start_date,
      end_date: state.end_date,
      error_message: state.error_message,
      last_updated: data.created_at,
    })

  } catch (error: any) {
    console.error('Get scan progress error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scan progress', details: error.message },
      { status: 500 }
    )
  }
}
