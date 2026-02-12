import { NextRequest, NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/cron-auth'
import { getServerSupabase } from '@/lib/supabase'

const supabase = getServerSupabase()

export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ status: 'route-active', timestamp: new Date().toISOString() })
  }

  try {
    const { searchParams } = new URL(request.url)
    const specialty = searchParams.get('specialty')
    const product = searchParams.get('product')
    const reliability = searchParams.get('reliability')
    const minRelationship = searchParams.get('min_relationship')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('suppliers')
      .select(`
        *,
        supplier_products(count),
        supplier_contacts(count)
      `)

    if (specialty) {
      query = query.contains('specialties', [specialty])
    }

    if (minRelationship) {
      const minRel = parseInt(minRelationship)
      if (!isNaN(minRel)) {
        query = query.gte('relationship_strength', minRel)
      }
    }

    if (reliability) {
      const minScore = parseInt(reliability)
      if (!isNaN(minScore)) {
        query = query.gte('reliability_score', minScore)
      }
    }

    query = query
      .order('relationship_strength', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: suppliers, error } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch suppliers', details: error.message },
        { status: 500 }
      )
    }

    let filteredSuppliers = suppliers || []

    if (product) {
      const supplierIds = filteredSuppliers.map(s => s.id)
      
      if (supplierIds.length > 0) {
        const { data: productsData } = await supabase
          .from('supplier_products')
          .select('supplier_id')
          .in('supplier_id', supplierIds)
          .ilike('product_name', `%${product}%`)

        const matchingSupplierIds = new Set(productsData?.map(p => p.supplier_id) || [])
        filteredSuppliers = filteredSuppliers.filter(s => matchingSupplierIds.has(s.id))
      }
    }

    return NextResponse.json({
      success: true,
      suppliers: filteredSuppliers,
      count: filteredSuppliers.length,
      offset,
      limit,
      filters_applied: {
        specialty: specialty || null,
        product: product || null,
        min_reliability: reliability || null,
        min_relationship: minRelationship || null,
      },
    })

  } catch (error: any) {
    console.error('Get suppliers error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
