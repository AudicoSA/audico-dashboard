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

    if (!auth.permissions.read_orders) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const supabase = getServerSupabase()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabase
      .from('tenant_orders')
      .select('*')
      .eq('tenant_id', auth.tenantId)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: orders, error } = await query.order('order_date', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await recordTenantUsage(auth.tenantId, 'api_call')
    await logTenantAudit(
      auth.tenantId,
      null,
      'api_request',
      'orders',
      null,
      { endpoint: '/api/v1/orders', method: 'GET' }
    )

    return NextResponse.json({ orders })
  } catch (error: any) {
    console.error('Error in GET /api/v1/orders:', error)
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

    if (!auth.permissions.write_orders) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const supabase = getServerSupabase()

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    const { data: order, error } = await supabase
      .from('tenant_orders')
      .insert({
        tenant_id: auth.tenantId,
        order_number: orderNumber,
        ...body,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await recordTenantUsage(auth.tenantId, 'api_call')
    await recordTenantUsage(auth.tenantId, 'order')
    await logTenantAudit(
      auth.tenantId,
      null,
      'order_created',
      'orders',
      order.id,
      { order_number: order.order_number, total: order.total }
    )

    return NextResponse.json({ order }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/v1/orders:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
