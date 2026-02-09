import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getServerSupabase()
    const { id } = await params

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
          sku
        )
      `)
      .eq('tenant_id', id)
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
      base_price: p.base_price,
      final_price: p.final_price,
      is_available: p.is_available,
    })) || []

    return NextResponse.json({ products: formattedProducts })
  } catch (error: any) {
    console.error('Error in GET /api/admin/tenants/[id]/products:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
