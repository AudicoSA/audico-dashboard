import { NextRequest, NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/cron-auth'
import { getServerSupabase } from '@/lib/supabase'

const supabase = getServerSupabase()

const CLAUDE_COST_PER_1K_TOKENS = 0.003
const AVG_EMAIL_TOKENS = 500

export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ status: 'route-active', timestamp: new Date().toISOString() })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const scope = searchParams.get('scope') || 'all'
    const senderDomain = searchParams.get('sender_domain')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'start_date and end_date are required' },
        { status: 400 }
      )
    }

    let countQuery = supabase
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    let sampleQuery = supabase
      .from('email_logs')
      .select('id, from_email, subject, created_at, payload')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })
      .limit(10)

    if (senderDomain) {
      const domainFilter = `%${senderDomain}%`
      countQuery = countQuery.ilike('from_email', domainFilter)
      sampleQuery = sampleQuery.ilike('from_email', domainFilter)
    }

    const { count } = await countQuery
    const { data: sampleData } = await sampleQuery

    const estimatedCount = count || 0
    const estimatedCost = (estimatedCount * AVG_EMAIL_TOKENS / 1000) * CLAUDE_COST_PER_1K_TOKENS

    const sampleEmails = sampleData?.map(email => ({
      id: email.id,
      from: email.from_email,
      subject: email.subject,
      date: email.created_at,
      preview: email.payload?.snippet || email.payload?.body?.substring(0, 200) || 'No preview available'
    })) || []

    return NextResponse.json({
      success: true,
      estimated_count: estimatedCount,
      estimated_cost: estimatedCost,
      sample_emails: sampleEmails
    })

  } catch (error: any) {
    console.error('Preview error:', error)
    return NextResponse.json(
      { error: 'Failed to generate preview', details: error.message },
      { status: 500 }
    )
  }
}
