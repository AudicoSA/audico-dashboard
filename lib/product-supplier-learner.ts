/**
 * Product-Supplier Learning Engine
 * 
 * Learns from successful quote outcomes to improve future supplier recommendations:
 * - Strengthens supplier-product associations based on quote success
 * - Updates markup percentages with actual margins
 * - Records successful lead times
 * - Tracks product alternatives and substitutions
 * - Provides ranked supplier recommendations with reasoning
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface QuoteRequest {
  id: string
  customer_name: string
  customer_email: string
  requested_products: Array<{
    product_name: string
    quantity: number
    specifications?: string
  }>
  status: string
  metadata?: {
    selected_products?: Array<{
      product_name: string
      supplier_id: string
      supplier_name: string
      supplier_company: string
      unit_price: number
      cost_price: number
      markup_percentage: number
      lead_time?: string
      lead_time_days?: number
      stock_availability?: string
      alternatives_mentioned?: string[]
    }>
    won_at?: string
    actual_delivery_date?: string
  }
  completed_at?: string
  created_at: string
}

interface SupplierInteraction {
  id: string
  supplier_id: string
  products_mentioned: string[]
  pricing_data: {
    [productName: string]: {
      unit_price?: number
      lead_time?: string
      stock_availability?: string
      alternatives?: string[]
      substitute_products?: string[]
    }
  }
  stock_info: any
}

interface SupplierProduct {
  id: string
  supplier_id: string
  product_name: string
  product_category?: string
  manufacturer?: string
  typical_lead_time_days?: number
  avg_markup_percentage?: number
  last_quoted_price?: number
  last_quoted_date?: string
  stock_reliability: string
  notes?: string
  metadata?: {
    quote_success_count?: number
    total_quote_count?: number
    confidence_score?: number
    successful_lead_times?: number[]
    alternatives?: Array<{
      product_name: string
      mentioned_count: number
      last_mentioned: string
    }>
  }
}

interface SupplierRecommendation {
  supplier_id: string
  supplier_name: string
  supplier_company: string
  supplier_email: string
  confidence_score: number
  reasoning: string
  stats: {
    quote_count: number
    success_rate: number
    avg_markup: number
    stock_reliability: string
    avg_lead_time_days?: number
    relationship_strength?: number
  }
}

export class ProductSupplierLearner {
  private supabase: SupabaseClient | null = null
  private agentName = 'ProductSupplierLearner'

  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      this.supabase = createClient(supabaseUrl, supabaseKey)
    }
    return this.supabase
  }

  /**
   * Learn from a successful quote to strengthen supplier-product associations
   * Called when a quote is marked as won/completed
   */
  async learnFromQuoteSuccess(quoteRequestId: string): Promise<{
    success: boolean
    learned_products: number
    updated_suppliers: string[]
    alternatives_added: number
    error?: string
  }> {
    try {
      await this.logToSquad(`Starting learning from successful quote ${quoteRequestId}`)

      // Fetch the quote request
      const quoteRequest = await this.fetchQuoteRequest(quoteRequestId)
      if (!quoteRequest) {
        throw new Error(`Quote request ${quoteRequestId} not found`)
      }

      if (quoteRequest.status !== 'completed') {
        throw new Error(`Quote request ${quoteRequestId} is not marked as completed`)
      }

      // Fetch supplier responses for this quote
      const supplierInteractions = await this.fetchSupplierInteractions(quoteRequestId)

      let learnedProducts = 0
      const updatedSuppliers = new Set<string>()
      let alternativesAdded = 0

      // Process selected products from metadata (actual products that won)
      if (quoteRequest.metadata?.selected_products) {
        for (const selectedProduct of quoteRequest.metadata.selected_products) {
          const result = await this.strengthenSupplierProductAssociation(
            selectedProduct,
            quoteRequest
          )

          if (result.success) {
            learnedProducts++
            updatedSuppliers.add(selectedProduct.supplier_company)
          }
        }
      }

      // Learn from supplier interactions - extract alternatives and substitutions
      for (const interaction of supplierInteractions) {
        const alternatives = await this.extractProductAlternatives(interaction)
        alternativesAdded += alternatives
      }

      const updatedSuppliersList = Array.from(updatedSuppliers)

      await this.logToSquad(
        `Learning completed for quote ${quoteRequestId}: ${learnedProducts} products learned, ${updatedSuppliersList.length} suppliers updated, ${alternativesAdded} alternatives added`,
        {
          quote_request_id: quoteRequestId,
          learned_products: learnedProducts,
          updated_suppliers: updatedSuppliersList,
          alternatives_added: alternativesAdded
        }
      )

      return {
        success: true,
        learned_products: learnedProducts,
        updated_suppliers: updatedSuppliersList,
        alternatives_added: alternativesAdded
      }

    } catch (error: any) {
      console.error('Error learning from quote success:', error)
      await this.logToSquad(`Error learning from quote ${quoteRequestId}: ${error.message}`)
      
      return {
        success: false,
        learned_products: 0,
        updated_suppliers: [],
        alternatives_added: 0,
        error: error.message
      }
    }
  }

  /**
   * Strengthen supplier-product association based on successful quote
   */
  private async strengthenSupplierProductAssociation(
    selectedProduct: any,
    quoteRequest: QuoteRequest
  ): Promise<{ success: boolean }> {
    try {
      const { supplier_id, product_name, markup_percentage, lead_time_days, stock_availability, alternatives_mentioned } = selectedProduct

      // Find existing supplier_product record
      const { data: existingProducts, error: fetchError } = await this.getSupabase()
        .from('supplier_products')
        .select('*')
        .eq('supplier_id', supplier_id)
        .ilike('product_name', `%${product_name}%`)
        .limit(1)

      if (fetchError) {
        throw fetchError
      }

      let existingProduct = existingProducts?.[0] as SupplierProduct | undefined

      // Calculate confidence score and update stats
      const metadata = existingProduct?.metadata || {}
      const currentSuccessCount = metadata.quote_success_count || 0
      const currentTotalCount = metadata.total_quote_count || 0
      const newSuccessCount = currentSuccessCount + 1
      const newTotalCount = currentTotalCount + 1
      
      // Confidence score: weighted by success rate and total experience
      const successRate = newSuccessCount / newTotalCount
      const experienceWeight = Math.min(newTotalCount / 20, 1) // Max weight at 20 quotes
      const confidenceScore = Math.round((successRate * 0.7 + experienceWeight * 0.3) * 100)

      // Track successful lead times
      const successfulLeadTimes = metadata.successful_lead_times || []
      if (lead_time_days && lead_time_days > 0) {
        successfulLeadTimes.push(lead_time_days)
        // Keep only last 10 lead times
        if (successfulLeadTimes.length > 10) {
          successfulLeadTimes.shift()
        }
      }

      // Calculate average lead time
      const avgLeadTime = successfulLeadTimes.length > 0
        ? Math.round(successfulLeadTimes.reduce((a: number, b: number) => a + b, 0) / successfulLeadTimes.length)
        : undefined

      // Update or calculate average markup
      const currentAvgMarkup = existingProduct?.avg_markup_percentage || 0
      const newAvgMarkup = currentAvgMarkup > 0
        ? (currentAvgMarkup * currentTotalCount + markup_percentage) / newTotalCount
        : markup_percentage

      // Process alternatives
      const existingAlternatives = metadata.alternatives || []
      if (alternatives_mentioned && alternatives_mentioned.length > 0) {
        for (const alt of alternatives_mentioned) {
          const existingAlt = existingAlternatives.find((a: any) => 
            a.product_name.toLowerCase() === alt.toLowerCase()
          )
          
          if (existingAlt) {
            existingAlt.mentioned_count++
            existingAlt.last_mentioned = new Date().toISOString()
          } else {
            existingAlternatives.push({
              product_name: alt,
              mentioned_count: 1,
              last_mentioned: new Date().toISOString()
            })
          }
        }
      }

      const updatedMetadata = {
        ...metadata,
        quote_success_count: newSuccessCount,
        total_quote_count: newTotalCount,
        confidence_score: confidenceScore,
        successful_lead_times: successfulLeadTimes,
        alternatives: existingAlternatives,
        last_won_quote: quoteRequest.id,
        last_won_at: new Date().toISOString()
      }

      if (existingProduct) {
        // Update existing record
        const { error: updateError } = await this.getSupabase()
          .from('supplier_products')
          .update({
            avg_markup_percentage: Math.round(newAvgMarkup * 100) / 100,
            typical_lead_time_days: avgLeadTime || existingProduct.typical_lead_time_days,
            stock_reliability: stock_availability || existingProduct.stock_reliability,
            last_quoted_date: new Date().toISOString(),
            metadata: updatedMetadata,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProduct.id)

        if (updateError) {
          throw updateError
        }
      } else {
        // Create new record
        const { error: insertError } = await this.getSupabase()
          .from('supplier_products')
          .insert({
            supplier_id,
            product_name,
            typical_lead_time_days: lead_time_days,
            avg_markup_percentage: Math.round(markup_percentage * 100) / 100,
            stock_reliability: stock_availability || 'usually_available',
            last_quoted_date: new Date().toISOString(),
            metadata: updatedMetadata
          })

        if (insertError) {
          throw insertError
        }
      }

      return { success: true }

    } catch (error: any) {
      console.error('Error strengthening supplier-product association:', error)
      return { success: false }
    }
  }

  /**
   * Extract product alternatives and substitutions from supplier interactions
   */
  private async extractProductAlternatives(interaction: SupplierInteraction): Promise<number> {
    let alternativesAdded = 0

    try {
      if (!interaction.pricing_data || typeof interaction.pricing_data !== 'object') {
        return 0
      }

      for (const [productName, priceInfo] of Object.entries(interaction.pricing_data)) {
        const alternatives = [
          ...(priceInfo.alternatives || []),
          ...(priceInfo.substitute_products || [])
        ]

        if (alternatives.length === 0) {
          continue
        }

        // Find or create supplier_product record
        const { data: existingProducts } = await this.getSupabase()
          .from('supplier_products')
          .select('*')
          .eq('supplier_id', interaction.supplier_id)
          .ilike('product_name', `%${productName}%`)
          .limit(1)

        const existingProduct = existingProducts?.[0] as SupplierProduct | undefined

        if (existingProduct) {
          const metadata = existingProduct.metadata || {}
          const existingAlternatives = metadata.alternatives || []

          for (const alt of alternatives) {
            const existingAlt = existingAlternatives.find((a: any) =>
              a.product_name.toLowerCase() === alt.toLowerCase()
            )

            if (existingAlt) {
              existingAlt.mentioned_count++
              existingAlt.last_mentioned = new Date().toISOString()
            } else {
              existingAlternatives.push({
                product_name: alt,
                mentioned_count: 1,
                last_mentioned: new Date().toISOString()
              })
              alternativesAdded++
            }
          }

          await this.getSupabase()
            .from('supplier_products')
            .update({
              metadata: {
                ...metadata,
                alternatives: existingAlternatives
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', existingProduct.id)
        }
      }

      return alternativesAdded

    } catch (error: any) {
      console.error('Error extracting product alternatives:', error)
      return alternativesAdded
    }
  }

  /**
   * Suggest suppliers for a product based on learned data
   * Returns ranked recommendations with reasoning
   */
  async suggestSupplierForProduct(productName: string): Promise<{
    success: boolean
    recommendations: SupplierRecommendation[]
    total_found: number
    error?: string
  }> {
    try {
      await this.logToSquad(`Generating supplier recommendations for product: ${productName}`)

      // Search for supplier products matching the product name
      const { data: supplierProducts, error: searchError } = await this.getSupabase()
        .from('supplier_products')
        .select(`
          *,
          supplier:suppliers(
            id,
            name,
            company,
            email,
            relationship_strength,
            reliability_score,
            avg_response_time_hours
          )
        `)
        .or(`product_name.ilike.%${productName}%,manufacturer.ilike.%${productName}%`)
        .order('last_quoted_date', { ascending: false })

      if (searchError) {
        throw searchError
      }

      if (!supplierProducts || supplierProducts.length === 0) {
        return {
          success: true,
          recommendations: [],
          total_found: 0
        }
      }

      // Build recommendations with scoring
      const recommendations: SupplierRecommendation[] = []

      for (const sp of supplierProducts) {
        const supplier = (sp as any).supplier
        if (!supplier) continue

        const metadata = sp.metadata || {}
        const successCount = metadata.quote_success_count || 0
        const totalCount = metadata.total_quote_count || 1
        const confidenceScore = metadata.confidence_score || 50
        const successRate = Math.round((successCount / totalCount) * 100)

        // Calculate stock availability percentage
        const stockReliabilityScore = {
          always_in_stock: 95,
          usually_available: 75,
          often_delayed: 50,
          unreliable: 25
        }[sp.stock_reliability as string] || 60

        // Build reasoning string
        const reasoningParts = []
        
        if (successCount > 0) {
          reasoningParts.push(
            `${supplier.name} at ${supplier.company} has quoted ${sp.product_name} ${totalCount} times with ${successRate}% success rate`
          )
        } else {
          reasoningParts.push(
            `${supplier.name} at ${supplier.company} has ${sp.product_name} in their catalog`
          )
        }

        reasoningParts.push(`${stockReliabilityScore}% stock availability`)

        if (sp.typical_lead_time_days) {
          reasoningParts.push(`typical lead time of ${sp.typical_lead_time_days} days`)
        }

        if (sp.avg_markup_percentage) {
          reasoningParts.push(`average markup of ${sp.avg_markup_percentage.toFixed(1)}%`)
        }

        if (supplier.relationship_strength) {
          reasoningParts.push(`relationship strength: ${supplier.relationship_strength}/100`)
        }

        const reasoning = reasoningParts.join(', ')

        recommendations.push({
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          supplier_company: supplier.company,
          supplier_email: supplier.email,
          confidence_score: confidenceScore,
          reasoning,
          stats: {
            quote_count: totalCount,
            success_rate: successRate,
            avg_markup: sp.avg_markup_percentage || 0,
            stock_reliability: sp.stock_reliability,
            avg_lead_time_days: sp.typical_lead_time_days,
            relationship_strength: supplier.relationship_strength
          }
        })
      }

      // Sort by confidence score (descending)
      recommendations.sort((a, b) => b.confidence_score - a.confidence_score)

      await this.logToSquad(
        `Found ${recommendations.length} supplier recommendations for ${productName}`,
        {
          product_name: productName,
          recommendations_count: recommendations.length,
          top_supplier: recommendations[0]?.supplier_company
        }
      )

      return {
        success: true,
        recommendations,
        total_found: recommendations.length
      }

    } catch (error: any) {
      console.error('Error suggesting supplier for product:', error)
      await this.logToSquad(`Error suggesting suppliers for ${productName}: ${error.message}`)

      return {
        success: false,
        recommendations: [],
        total_found: 0,
        error: error.message
      }
    }
  }

  /**
   * Fetch quote request by ID
   */
  private async fetchQuoteRequest(quoteRequestId: string): Promise<QuoteRequest | null> {
    const { data, error } = await this.getSupabase()
      .from('quote_requests')
      .select('*')
      .eq('id', quoteRequestId)
      .single()

    if (error) {
      console.error('Error fetching quote request:', error)
      return null
    }

    return data as QuoteRequest
  }

  /**
   * Fetch supplier interactions for a quote request
   */
  private async fetchSupplierInteractions(quoteRequestId: string): Promise<SupplierInteraction[]> {
    const { data, error } = await this.getSupabase()
      .from('email_supplier_interactions')
      .select('*')
      .eq('quote_request_id', quoteRequestId)

    if (error) {
      console.error('Error fetching supplier interactions:', error)
      return []
    }

    return (data || []) as SupplierInteraction[]
  }

  /**
   * Log messages to squad_messages table
   */
  private async logToSquad(message: string, data: any = {}): Promise<void> {
    try {
      await this.getSupabase()
        .from('squad_messages')
        .insert({
          from_agent: this.agentName,
          to_agent: null,
          message,
          task_id: null,
          data: {
            ...data,
            timestamp: new Date().toISOString()
          }
        })
    } catch (error) {
      console.error('Error logging to squad:', error)
    }
  }
}

export const productSupplierLearner = new ProductSupplierLearner()
