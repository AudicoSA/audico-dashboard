import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'pending'
    const requestType = searchParams.get('requestType')

    let query = supabase
      .from('prompt_approval_queue')
      .select(`
        *,
        prompt_version:prompt_versions!prompt_version_id(*),
        experiment:prompt_experiments(*)
      `)
      .eq('status', status)

    if (requestType) {
      query = query.eq('request_type', requestType)
    }

    query = query.order('priority', { ascending: false })
                 .order('created_at', { ascending: true })

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      approvals: data
    })
  } catch (error: any) {
    console.error('Error fetching approvals:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch approvals' },
      { status: 500 }
    )
  }
}
