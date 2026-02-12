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
    const { start_date, end_date, scope, sender_domain } = body

    if (!start_date || !end_date) {
      return NextResponse.json(
        { error: 'start_date and end_date are required' },
        { status: 400 }
      )
    }

    const startDate = new Date(start_date)
    const endDate = new Date(end_date)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      )
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'start_date must be before end_date' },
        { status: 400 }
      )
    }

    const jobId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    let query = supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (sender_domain) {
      query = query.ilike('from_email', `%${sender_domain}%`)
    }

    const { count } = await query
    const totalEmails = count || 0

    const initialState = {
      job_id: jobId,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      scope: scope || 'all',
      sender_domain: sender_domain || null,
      total_emails: totalEmails,
      processed_count: 0,
      suppliers_found: 0,
      products_found: 0,
      contacts_found: 0,
      interactions_logged: 0,
      status: 'running',
      created_at: new Date().toISOString()
    }

    await supabase
      .from('squad_messages')
      .insert({
        from_agent: 'email_intelligence_scanner',
        to_agent: null,
        message: `Job ${jobId} started`,
        task_id: null,
        data: {
          job_id: jobId,
          state: initialState,
          timestamp: new Date().toISOString(),
        },
      })

    startBackgroundScan(jobId, startDate, endDate, sender_domain)

    return NextResponse.json({
      success: true,
      job_id: jobId,
      message: 'Email scan started in background',
      progress: {
        job_id: jobId,
        status: 'running',
        total_emails: totalEmails,
        processed_count: 0,
        suppliers_found: 0,
        products_found: 0,
        contacts_found: 0,
        interactions_logged: 0,
        percentage: 0,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      }
    })

  } catch (error: any) {
    console.error('Start scan error:', error)
    return NextResponse.json(
      { error: 'Failed to start scan', details: error.message },
      { status: 500 }
    )
  }
}

async function startBackgroundScan(
  jobId: string,
  startDate: Date,
  endDate: Date,
  senderDomain?: string
) {
  const { EmailIntelligenceScanner } = await import('@/lib/email-intelligence-scanner')
  const scanner = new EmailIntelligenceScanner()
  
  try {
    await scanner.scanHistoricalEmails(startDate, endDate)
  } catch (error) {
    console.error(`Background scan error for job ${jobId}:`, error)
  }
}
