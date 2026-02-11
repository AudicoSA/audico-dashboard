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
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

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
        total_emails: state.total_emails,
        processed_count: state.processed_count,
        suppliers_found: state.suppliers_found,
        products_found: state.products_found,
        contacts_found: state.contacts_found,
        interactions_logged: state.interactions_logged,
        percentage: state.total_emails > 0 
          ? Math.round((state.processed_count / state.total_emails) * 100) 
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
