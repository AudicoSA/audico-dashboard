import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'
import { validateApiKey, recordTenantUsage, logTenantAudit } from '@/lib/tenant'

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '')
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 })
    }

    const auth = await validateApiKey(apiKey)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    if (!auth.permissions.read_customers) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const supabase = getServerSupabase()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabase
      .from('tenant_customers')
      .select('*')
      .eq('tenant_id', auth.tenantId)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: customers, error } = await query.order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await recordTenantUsage(auth.tenantId, 'api_call')
    await logTenantAudit(
      auth.tenantId,
      null,
      'api_request',
      'customers',
      null,
      { endpoint: '/api/v1/customers', method: 'GET' }
    )

    return NextResponse.json({ customers })
  } catch (error: any) {
    console.error('Error in GET /api/v1/customers:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '')
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 })
    }

    const auth = await validateApiKey(apiKey)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    if (!auth.permissions.write_customers) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const supabase = getServerSupabase()

    const { data: customer, error } = await supabase
      .from('tenant_customers')
      .insert({
        tenant_id: auth.tenantId,
        ...body,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await recordTenantUsage(auth.tenantId, 'api_call')
    await logTenantAudit(
      auth.tenantId,
      null,
      'customer_created',
      'customers',
      customer.id,
      { customer_id: customer.customer_id }
    )

    return NextResponse.json({ customer }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/v1/customers:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
