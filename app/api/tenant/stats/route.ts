import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantSlug = searchParams.get('tenant')

    if (!tenantSlug) {
      return NextResponse.json({ error: 'Tenant parameter required' }, { status: 400 })
    }

    const supabase = getServerSupabase()

    const { data: tenant } = await supabase
      .from('reseller_tenants')
      .select('id')
      .eq('subdomain', tenantSlug)
      .single()

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const [productsCount, customersCount, ordersCount, revenueData] = await Promise.all([
      supabase
        .from('tenant_products')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('is_visible', true),
      supabase
        .from('tenant_customers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id),
      supabase
        .from('tenant_orders')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id),
      supabase
        .from('tenant_orders')
        .select('total')
        .eq('tenant_id', tenant.id)
        .eq('status', 'completed'),
    ])

    const totalRevenue = revenueData.data?.reduce((sum, order) => sum + (order.total || 0), 0) || 0

    const stats = {
      products_count: productsCount.count || 0,
      customers_count: customersCount.count || 0,
      orders_count: ordersCount.count || 0,
      total_revenue: totalRevenue,
    }

    return NextResponse.json({ stats })
  } catch (error: any) {
    console.error('Error in GET /api/tenant/stats:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
