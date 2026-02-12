import { NextRequest, NextResponse } from 'next/server'
import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth'
import { getServerSupabase } from '@/lib/supabase'

const supabase = getServerSupabase()

export async function POST(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse()
  }

  try {
    const body = await request.json()
    const { job_id } = body

    if (!job_id) {
      return NextResponse.json(
        { error: 'job_id is required' },
        { status: 400 }
      )
    }

    const { data: currentState } = await supabase
      .from('squad_messages')
      .select('data')
      .eq('from_agent', 'email_intelligence_scanner')
      .eq('data->>job_id', job_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!currentState?.data?.state) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    const updatedState = {
      ...currentState.data.state,
      status: 'running'
    }

    await supabase
      .from('squad_messages')
      .insert({
        from_agent: 'email_intelligence_scanner',
        to_agent: null,
        message: `Job ${job_id} resumed`,
        task_id: null,
        data: {
          job_id: job_id,
          state: updatedState,
          timestamp: new Date().toISOString(),
        },
      })

    const { EmailIntelligenceScanner } = await import('@/lib/email-intelligence-scanner')
    const scanner = new EmailIntelligenceScanner()
    
    const state = currentState.data.state
    scanner.scanHistoricalEmails(
      new Date(state.start_date),
      new Date(state.end_date),
      job_id
    ).catch(error => {
      console.error(`Resume scan error for job ${job_id}:`, error)
    })

    return NextResponse.json({
      success: true,
      message: 'Scan resumed successfully'
    })

  } catch (error: any) {
    console.error('Resume scan error:', error)
    return NextResponse.json(
      { error: 'Failed to resume scan', details: error.message },
      { status: 500 }
    )
  }
}
