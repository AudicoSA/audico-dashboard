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
    const { error_id } = body

    if (!error_id) {
      return NextResponse.json(
        { error: 'error_id is required' },
        { status: 400 }
      )
    }

    const { data: errorLog } = await supabase
      .from('squad_messages')
      .select('data')
      .eq('id', error_id)
      .single()

    if (!errorLog?.data?.email_id) {
      return NextResponse.json(
        { error: 'Error log not found or missing email_id' },
        { status: 404 }
      )
    }

    await supabase
      .from('squad_messages')
      .insert({
        from_agent: 'email_intelligence_scanner',
        to_agent: null,
        message: `Retrying email ${errorLog.data.email_id}`,
        task_id: null,
        data: {
          error_id: error_id,
          email_id: errorLog.data.email_id,
          retry_timestamp: new Date().toISOString(),
        },
      })

    return NextResponse.json({
      success: true,
      message: 'Email queued for retry'
    })

  } catch (error: any) {
    console.error('Retry error:', error)
    return NextResponse.json(
      { error: 'Failed to retry email', details: error.message },
      { status: 500 }
    )
  }
}
