import { NextRequest, NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/cron-auth'
import { getServerSupabase } from '@/lib/supabase'

const supabase = getServerSupabase()

export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ status: 'route-active', timestamp: new Date().toISOString() })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const jobId = searchParams.get('job_id')

    if (!jobId) {
      return NextResponse.json(
        { error: 'job_id is required' },
        { status: 400 }
      )
    }

    const { data: errorLogs, error } = await supabase
      .from('squad_messages')
      .select('id, message, data, created_at')
      .eq('from_agent', 'email_intelligence_scanner')
      .eq('data->>job_id', jobId)
      .contains('message', 'Error processing email')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      throw error
    }

    const formattedErrors = errorLogs?.map(log => ({
      id: log.id,
      email_id: log.data?.email_id || 'unknown',
      error: log.message,
      timestamp: log.created_at,
      retried: false
    })) || []

    return NextResponse.json({
      success: true,
      errors: formattedErrors
    })

  } catch (error: any) {
    console.error('Get errors error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch errors', details: error.message },
      { status: 500 }
    )
  }
}
