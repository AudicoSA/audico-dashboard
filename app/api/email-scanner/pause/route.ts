import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

const supabase = getServerSupabase()

export async function POST(request: NextRequest) {
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
      status: 'paused'
    }

    await supabase
      .from('squad_messages')
      .insert({
        from_agent: 'email_intelligence_scanner',
        to_agent: null,
        message: `Job ${job_id} paused`,
        task_id: null,
        data: {
          job_id: job_id,
          state: updatedState,
          timestamp: new Date().toISOString(),
        },
      })

    return NextResponse.json({
      success: true,
      message: 'Scan paused successfully'
    })

  } catch (error: any) {
    console.error('Pause scan error:', error)
    return NextResponse.json(
      { error: 'Failed to pause scan', details: error.message },
      { status: 500 }
    )
  }
}
