import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabase()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabase
      .from('reseller_tenants')
      .select('*')
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      if (status === 'trial') {
        query = query.eq('billing_status', 'trial')
      } else {
        query = query.eq('status', status)
      }
    }

    const { data: tenants, error } = await query

    if (error) {
      console.error('Error fetching tenants:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tenants })
  } catch (error: any) {
    console.error('Error in GET /api/admin/tenants:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getServerSupabase()
    const body = await request.json()

    const {
      reseller_id,
      company_name,
      subdomain,
      plan_tier = 'basic',
      monthly_fee = 0,
      product_markup_percentage = 0,
      billing_status = 'trial',
    } = body

    const tenant_slug = subdomain

    const { data: tenant, error } = await supabase
      .from('reseller_tenants')
      .insert({
        reseller_id,
        tenant_slug,
        company_name,
        subdomain,
        plan_tier,
        monthly_fee,
        product_markup_percentage,
        billing_status,
        status: 'pending_setup',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating tenant:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.rpc('sync_products_to_tenant', {
      p_tenant_id: tenant.id,
      p_category_filter: tenant.assigned_product_categories
    })

    return NextResponse.json({ tenant }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/admin/tenants:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
