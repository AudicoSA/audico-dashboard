import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getServerSupabase()
    const { id } = await params

    const { data: tenant, error: tenantError } = await supabase
      .from('reseller_tenants')
      .select('assigned_product_categories')
      .eq('id', id)
      .single()

    if (tenantError) {
      return NextResponse.json({ error: tenantError.message }, { status: 500 })
    }

    const { data: count, error } = await supabase.rpc('sync_products_to_tenant', {
      p_tenant_id: id,
      p_category_filter: tenant.assigned_product_categories
    })

    if (error) {
      console.error('Error syncing products:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ synced: count })
  } catch (error: any) {
    console.error('Error in POST /api/admin/tenants/[id]/products/sync:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
