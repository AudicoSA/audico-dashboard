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
    const format = searchParams.get('format') || 'json'

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

    const { data: suppliers } = await supabase
      .from('suppliers')
      .select(`
        *,
        supplier_products (*),
        supplier_contacts (*)
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const { data: interactions } = await supabase
      .from('email_supplier_interactions')
      .select('*')
      .gte('extracted_at', startDate)
      .lte('extracted_at', endDate)

    const exportData = {
      job_id: jobId,
      scan_period: {
        start_date: startDate,
        end_date: endDate
      },
      summary: {
        total_emails: state.total_emails,
        processed_count: state.processed_count,
        suppliers_found: state.suppliers_found,
        products_found: state.products_found,
        contacts_found: state.contacts_found,
        interactions_logged: state.interactions_logged
      },
      suppliers: suppliers || [],
      interactions: interactions || [],
      exported_at: new Date().toISOString()
    }

    if (format === 'csv') {
      const csvRows = []
      csvRows.push('Company,Email,Phone,Products Count,Last Contact')
      
      suppliers?.forEach(supplier => {
        const productsCount = supplier.supplier_products?.length || 0
        csvRows.push([
          supplier.company,
          supplier.email,
          supplier.phone || '',
          productsCount,
          supplier.last_contact_date || ''
        ].join(','))
      })

      const csvContent = csvRows.join('\n')
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="email-scan-${jobId}.csv"`
        }
      })
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="email-scan-${jobId}.json"`
      }
    })

  } catch (error: any) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Failed to export data', details: error.message },
      { status: 500 }
    )
  }
}
