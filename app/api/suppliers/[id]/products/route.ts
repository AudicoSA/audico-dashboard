import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

const supabase = getServerSupabase()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: supplierId } = await params
    const { searchParams } = new URL(request.url)
    const includeHistory = searchParams.get('include_history') === 'true'

    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .single()

    if (supplierError || !supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }

    const { data: products, error: productsError } = await supabase
      .from('supplier_products')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('product_name', { ascending: true })

    if (productsError) {
      return NextResponse.json(
        { error: 'Failed to fetch products', details: productsError.message },
        { status: 500 }
      )
    }

    let productsWithHistory = products || []

    if (includeHistory && products && products.length > 0) {
      const productIds = products.map(p => p.id)
      
      const { data: interactions } = await supabase
        .from('email_supplier_interactions')
        .select('products_mentioned, pricing_data, extracted_at')
        .eq('supplier_id', supplierId)
        .order('extracted_at', { ascending: false })

      const priceHistory: Record<string, any[]> = {}

      interactions?.forEach(interaction => {
        if (interaction.pricing_data && typeof interaction.pricing_data === 'object') {
          Object.entries(interaction.pricing_data).forEach(([productName, pricing]: [string, any]) => {
            if (!priceHistory[productName]) {
              priceHistory[productName] = []
            }
            priceHistory[productName].push({
              date: interaction.extracted_at,
              price: pricing.price,
              currency: pricing.currency || 'ZAR',
              quantity: pricing.quantity,
              lead_time_days: pricing.lead_time_days,
            })
          })
        }
      })

      productsWithHistory = products.map(product => {
        const normalizedName = product.product_name.toLowerCase()
        const history = Object.entries(priceHistory)
          .filter(([name]) => 
            name.toLowerCase().includes(normalizedName) || 
            normalizedName.includes(name.toLowerCase())
          )
          .flatMap(([_, prices]) => prices)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 10)

        return {
          ...product,
          pricing_history: history,
        }
      })
    }

    return NextResponse.json({
      success: true,
      supplier: {
        id: supplier.id,
        name: supplier.name,
        company: supplier.company,
        email: supplier.email,
      },
      products: productsWithHistory,
      count: productsWithHistory.length,
    })

  } catch (error: any) {
    console.error('Get supplier products error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
