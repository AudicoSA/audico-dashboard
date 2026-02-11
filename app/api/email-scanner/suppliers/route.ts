import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

const supabase = getServerSupabase()

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const jobId = searchParams.get('job_id')

    if (!jobId) {
      return NextResponse.json(
        { error: 'job_id is required' },
        { status: 400 }
      )
    }

    const { data: jobState } = await supabase
      .from('squad_messages')
      .select('data')
      .eq('from_agent', 'email_intelligence_scanner')
      .eq('data->>job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!jobState?.data?.state) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    const state = jobState.data.state
    const startDate = state.start_date
    const endDate = state.end_date

    const { data: suppliers, error } = await supabase
      .from('suppliers')
      .select(`
        id,
        company,
        email,
        last_contact_date,
        supplier_products (count)
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    const formattedSuppliers = suppliers?.map(s => ({
      id: s.id,
      company: s.company,
      email: s.email,
      products_count: Array.isArray(s.supplier_products) ? s.supplier_products.length : 0,
      last_contact: s.last_contact_date
    })) || []

    return NextResponse.json({
      success: true,
      suppliers: formattedSuppliers
    })

  } catch (error: any) {
    console.error('Get suppliers error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suppliers', details: error.message },
      { status: 500 }
    )
  }
}
