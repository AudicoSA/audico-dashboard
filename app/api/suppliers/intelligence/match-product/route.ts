import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

const supabase = getServerSupabase()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { product_description } = body

    if (!product_description || typeof product_description !== 'string') {
      return NextResponse.json(
        { error: 'product_description is required and must be a string' },
        { status: 400 }
      )
    }

    const searchTerms = product_description.toLowerCase().split(/\s+/).filter(term => term.length > 2)

    if (searchTerms.length === 0) {
      return NextResponse.json(
        { error: 'product_description must contain meaningful search terms (at least 3 characters each)' },
        { status: 400 }
      )
    }

    const { data: products, error: productsError } = await supabase
      .from('supplier_products')
      .select(`
        *,
        supplier:suppliers(*)
      `)

    if (productsError) {
      return NextResponse.json(
        { error: 'Failed to search products', details: productsError.message },
        { status: 500 }
      )
    }

    const matches = (products || []).map(product => {
      const productText = `${product.product_name} ${product.manufacturer || ''} ${product.model_number || ''} ${product.product_category || ''}`.toLowerCase()
      
      let matchCount = 0
      searchTerms.forEach(term => {
        if (productText.includes(term)) {
          matchCount++
        }
      })

      const matchScore = matchCount / searchTerms.length
      
      let reliabilityBonus = 0
      if (product.stock_reliability === 'always_in_stock') reliabilityBonus = 0.2
      else if (product.stock_reliability === 'usually_available') reliabilityBonus = 0.1

      let relationshipBonus = 0
      if (product.supplier?.relationship_strength) {
        relationshipBonus = (product.supplier.relationship_strength / 100) * 0.15
      }

      let priceBonus = 0
      if (product.last_quoted_price && product.last_quoted_date) {
        const daysSinceQuote = Math.floor(
          (Date.now() - new Date(product.last_quoted_date).getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysSinceQuote < 90) {
          priceBonus = 0.1
        } else if (daysSinceQuote < 180) {
          priceBonus = 0.05
        }
      }

      const confidenceScore = Math.min(
        1.0,
        matchScore * 0.55 + reliabilityBonus + relationshipBonus + priceBonus
      )

      return {
        supplier_id: product.supplier_id,
        supplier_name: product.supplier?.company,
        supplier_email: product.supplier?.email,
        supplier_phone: product.supplier?.phone,
        product_id: product.id,
        product_name: product.product_name,
        manufacturer: product.manufacturer,
        model_number: product.model_number,
        category: product.product_category,
        last_quoted_price: product.last_quoted_price,
        last_quoted_date: product.last_quoted_date,
        typical_lead_time_days: product.typical_lead_time_days,
        stock_reliability: product.stock_reliability,
        relationship_strength: product.supplier?.relationship_strength,
        confidence_score: Math.round(confidenceScore * 100) / 100,
        match_reason: matchCount > 0 
          ? `Matched ${matchCount}/${searchTerms.length} search terms` 
          : 'No direct match',
      }
    })

    const rankedMatches = matches
      .filter(m => m.confidence_score >= 0.3)
      .sort((a, b) => b.confidence_score - a.confidence_score)
      .slice(0, 20)

    const supplierSummary = rankedMatches.reduce((acc, match) => {
      if (!acc[match.supplier_id]) {
        acc[match.supplier_id] = {
          supplier_id: match.supplier_id,
          supplier_name: match.supplier_name,
          supplier_email: match.supplier_email,
          supplier_phone: match.supplier_phone,
          relationship_strength: match.relationship_strength,
          matching_products: [],
          avg_confidence: 0,
          best_confidence: 0,
        }
      }

      acc[match.supplier_id].matching_products.push({
        product_id: match.product_id,
        product_name: match.product_name,
        manufacturer: match.manufacturer,
        model_number: match.model_number,
        category: match.category,
        confidence_score: match.confidence_score,
        last_quoted_price: match.last_quoted_price,
        typical_lead_time_days: match.typical_lead_time_days,
        stock_reliability: match.stock_reliability,
      })

      return acc
    }, {} as Record<string, any>)

    Object.values(supplierSummary).forEach((supplier: any) => {
      const confidences = supplier.matching_products.map((p: any) => p.confidence_score)
      supplier.best_confidence = Math.max(...confidences)
      supplier.avg_confidence = confidences.reduce((sum: number, c: number) => sum + c, 0) / confidences.length
      supplier.avg_confidence = Math.round(supplier.avg_confidence * 100) / 100
    })

    const rankedSuppliers = Object.values(supplierSummary)
      .sort((a: any, b: any) => b.best_confidence - a.best_confidence)

    return NextResponse.json({
      success: true,
      query: product_description,
      matches_found: rankedMatches.length,
      suppliers: rankedSuppliers,
      all_product_matches: rankedMatches,
    })

  } catch (error: any) {
    console.error('Product matching error:', error)
    return NextResponse.json(
      { error: 'Failed to match products', details: error.message },
      { status: 500 }
    )
  }
}
