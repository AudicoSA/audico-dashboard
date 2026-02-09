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

    const { data: products, error } = await supabase
      .from('tenant_products')
      .select(`
        *,
        products:product_id (
          id,
          name,
          description,
          category,
          brand,
          sku,
          image_url
        )
      `)
      .eq('tenant_id', tenant.id)
      .eq('is_visible', true)

    if (error) {
      console.error('Error fetching tenant products:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formattedProducts = products?.map(p => ({
      id: p.id,
      name: p.custom_name || p.products.name,
      description: p.custom_description || p.products.description,
      category: p.products.category,
      brand: p.products.brand,
      sku: p.products.sku,
      image_url: (p.custom_images && p.custom_images[0]) || p.products.image_url,
      base_price: p.base_price,
      final_price: p.final_price,
      is_available: p.is_available,
    })) || []

    return NextResponse.json({ products: formattedProducts })
  } catch (error: any) {
    console.error('Error in GET /api/tenant/products:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
