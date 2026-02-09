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

    if (!auth.permissions.read_products) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const supabase = getServerSupabase()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    let query = supabase
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
          image_url,
          features,
          tags
        )
      `)
      .eq('tenant_id', auth.tenantId)
      .eq('is_visible', true)
      .eq('is_available', true)

    if (category) {
      query = query.eq('products.category', category)
    }

    const { data: products, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formattedProducts = products?.map(p => ({
      id: p.id,
      product_id: p.product_id,
      name: p.custom_name || p.products.name,
      description: p.custom_description || p.products.description,
      category: p.products.category,
      brand: p.products.brand,
      sku: p.products.sku,
      image_url: (p.custom_images && p.custom_images[0]) || p.products.image_url,
      features: p.products.features,
      tags: p.products.tags,
      price: p.final_price,
      currency: 'ZAR',
    })) || []

    await recordTenantUsage(auth.tenantId, 'api_call')
    await logTenantAudit(
      auth.tenantId,
      null,
      'api_request',
      'products',
      null,
      { endpoint: '/api/v1/products', method: 'GET' }
    )

    return NextResponse.json({ products: formattedProducts })
  } catch (error: any) {
    console.error('Error in GET /api/v1/products:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
