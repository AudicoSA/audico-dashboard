/**
 * Supplier Learning Engine
 * 
 * Comprehensive system that analyzes email_supplier_interactions to:
 * - Identify response time patterns and preferred contact methods
 * - Track pricing trends and markup percentages
 * - Measure stock reliability accuracy
 * - Calculate supplier response quality scores
 * - Identify emerging supplier relationships
 * - Generate category-specific supplier insights
 * 
 * Integrates with SupplierAgent to improve future supplier selection
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ============================================
// INTERFACES
// ============================================

interface EmailSupplierInteraction {
  id: string
  email_log_id: string
  supplier_id: string
  interaction_type: 'quote_request' | 'quote_response' | 'stock_inquiry' | 'order_placement' | 'support'
  products_mentioned: string[]
  pricing_data: Record<string, {
    unit_price?: number
    lead_time?: string
    lead_time_days?: number
    stock_availability?: string
    quantity?: number
    cost_price?: number
    markup_percentage?: number
  }>
  stock_info: any
  quote_request_id?: string
  extracted_at: string
  created_at: string
  email_log?: {
    from_email: string
    created_at: string
    subject?: string
  }
}

interface Supplier {
  id: string
  name: string
  company: string
  email: string
  relationship_strength: number
  reliability_score?: number
  avg_response_time_hours?: number
  metadata?: {
    response_quality_score?: number
    preferred_contact_method?: string
    preferred_contact_time?: string
    response_completeness_avg?: number
    pricing_accuracy_score?: number
    stock_accuracy_score?: number
    interaction_frequency_trend?: 'increasing' | 'stable' | 'decreasing'
    last_analysis_date?: string
  }
}

interface SupplierProduct {
  id: string
  supplier_id: string
  product_name: string
  product_category?: string
  manufacturer?: string
  avg_markup_percentage?: number
  last_quoted_price?: number
  stock_reliability: string
  metadata?: {
    markup_history?: Array<{
      markup: number
      date: string
      quote_id?: string
    }>
    pricing_trend?: 'increasing' | 'stable' | 'decreasing'
    stock_accuracy_count?: number
    stock_inaccuracy_count?: number
  }
}

interface QuoteRequest {
  id: string
  status: string
  metadata?: {
    selected_products?: Array<{
      product_name: string
      supplier_id: string
      unit_price: number
      cost_price?: number
      markup_percentage?: number
      lead_time_days?: number
      stock_availability?: string
      quote_accurate?: boolean
    }>
  }
  created_at: string
  completed_at?: string
}

interface ResponseTimePattern {
  supplier_id: string
  avg_response_hours: number
  min_response_hours: number
  max_response_hours: number
  response_count: number
  preferred_day_of_week?: string
  preferred_hour_of_day?: number
}

interface PricingTrend {
  supplier_id: string
  product_category: string
  avg_markup: number
  markup_trend: 'increasing' | 'stable' | 'decreasing'
  price_volatility: number
  quote_count: number
}

interface StockReliabilityMetric {
  supplier_id: string
  product_category: string
  accuracy_rate: number
  total_checks: number
  stock_reliability_rating: 'always_in_stock' | 'usually_available' | 'often_delayed' | 'unreliable'
}

interface CategoryInsight {
  category: string
  top_suppliers: Array<{
    supplier_id: string
    supplier_company: string
    score: number
    avg_markup: number
    response_time_hours: number
    stock_accuracy: number
    relationship_strength: number
  }>
  metrics: {
    total_suppliers: number
    avg_response_time: number
    avg_markup: number
    avg_stock_accuracy: number
  }
}

interface EmergingSupplierRelationship {
  supplier_id: string
  supplier_company: string
  interaction_frequency: number
  frequency_trend: 'increasing' | 'stable'
  recent_interaction_count: number
  older_interaction_count: number
  growth_rate: number
}

interface LearningResults {
  success: boolean
  timestamp: string
  response_patterns_analyzed: number
  pricing_trends_identified: number
  stock_reliability_updated: number
  quality_scores_updated: number
  emerging_relationships: number
  category_insights_generated: number
  supplier_products_updated: number
  error?: string
}

// ============================================
// MAIN CLASS
// ============================================

export class SupplierLearningEngine {
  private supabase: SupabaseClient | null = null
  private agentName = 'SupplierLearningEngine'

  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      this.supabase = createClient(supabaseUrl, supabaseKey)
    }
    return this.supabase
  }

  /**
   * Main weekly analysis function - runs comprehensive learning across all data
   */
  async runWeeklyAnalysis(): Promise<LearningResults> {
    const startTime = new Date().toISOString()
    
    try {
      await this.logToSquad('🧠 Starting weekly supplier learning analysis')

      // Run all analysis components
      const responsePatterns = await this.analyzeResponseTimePatterns()
      const pricingTrends = await this.analyzePricingTrends()
      const stockReliability = await this.updateStockReliabilityAccuracy()
      const qualityScores = await this.calculateSupplierQualityScores()
      const emergingRelationships = await this.identifyEmergingRelationships()
      const categoryInsights = await this.generateCategoryInsights()

      // Update supplier products with successful quote data
      const productsUpdated = await this.updateProductsFromSuccessfulQuotes()

      await this.logToSquad(
        `✅ Weekly supplier learning completed:\n` +
        `- Response patterns analyzed: ${responsePatterns}\n` +
        `- Pricing trends identified: ${pricingTrends}\n` +
        `- Stock reliability updated: ${stockReliability}\n` +
        `- Quality scores updated: ${qualityScores}\n` +
        `- Emerging relationships: ${emergingRelationships}\n` +
        `- Category insights: ${categoryInsights}\n` +
        `- Products updated: ${productsUpdated}`,
        {
          response_patterns: responsePatterns,
          pricing_trends: pricingTrends,
          stock_reliability: stockReliability,
          quality_scores: qualityScores,
          emerging_relationships: emergingRelationships,
          category_insights: categoryInsights,
          products_updated: productsUpdated
        }
      )

      return {
        success: true,
        timestamp: startTime,
        response_patterns_analyzed: responsePatterns,
        pricing_trends_identified: pricingTrends,
        stock_reliability_updated: stockReliability,
        quality_scores_updated: qualityScores,
        emerging_relationships: emergingRelationships,
        category_insights_generated: categoryInsights,
        supplier_products_updated: productsUpdated
      }

    } catch (error: any) {
      console.error('Error in weekly supplier learning:', error)
      await this.logToSquad(`❌ Weekly supplier learning failed: ${error.message}`)
      
      return {
        success: false,
        timestamp: startTime,
        response_patterns_analyzed: 0,
        pricing_trends_identified: 0,
        stock_reliability_updated: 0,
        quality_scores_updated: 0,
        emerging_relationships: 0,
        category_insights_generated: 0,
        supplier_products_updated: 0,
        error: error.message
      }
    }
  }

  /**
   * Analyze response time patterns from email interactions
   * Identifies when suppliers typically respond and preferred contact methods
   */
  private async analyzeResponseTimePatterns(): Promise<number> {
    try {
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

      // Get all interactions from last 90 days with email timestamps
      const { data: interactions, error } = await this.getSupabase()
        .from('email_supplier_interactions')
        .select(`
          id,
          supplier_id,
          interaction_type,
          created_at,
          email_log:email_logs!email_supplier_interactions_email_log_id_fkey(
            created_at,
            from_email,
            subject
          )
        `)
        .gte('created_at', ninetyDaysAgo.toISOString())
        .order('created_at', { ascending: true })

      if (error || !interactions) {
        throw error
      }

      // Group interactions by supplier
      const supplierInteractions = new Map<string, EmailSupplierInteraction[]>()
      for (const interaction of interactions) {
        if (!supplierInteractions.has(interaction.supplier_id)) {
          supplierInteractions.set(interaction.supplier_id, [])
        }
        supplierInteractions.get(interaction.supplier_id)!.push(interaction as any)
      }

      let patternsAnalyzed = 0

      // Analyze each supplier's patterns
      for (const [supplierId, supplierData] of Array.from(supplierInteractions.entries())) {
        const pattern = this.extractResponsePattern(supplierData)
        
        if (pattern) {
          await this.updateSupplierWithResponsePattern(supplierId, pattern)
          patternsAnalyzed++
        }
      }

      return patternsAnalyzed

    } catch (error: any) {
      console.error('Error analyzing response time patterns:', error)
      return 0
    }
  }

  /**
   * Extract response time pattern from supplier interactions
   */
  private extractResponsePattern(interactions: EmailSupplierInteraction[]): ResponseTimePattern | null {
    const responseTimes: number[] = []
    const responseHours: number[] = []
    const responseDays: number[] = []
    let lastRequestTime: Date | null = null

    for (const interaction of interactions) {
      if (interaction.interaction_type === 'quote_request' || interaction.interaction_type === 'stock_inquiry') {
        lastRequestTime = new Date((interaction.email_log as any)?.created_at || interaction.created_at)
      } else if (interaction.interaction_type === 'quote_response' && lastRequestTime) {
        const responseTime = new Date((interaction.email_log as any)?.created_at || interaction.created_at)
        const hoursDiff = (responseTime.getTime() - lastRequestTime.getTime()) / (1000 * 60 * 60)
        
        if (hoursDiff > 0 && hoursDiff < 168) {
          responseTimes.push(hoursDiff)
          responseHours.push(responseTime.getHours())
          responseDays.push(responseTime.getDay())
        }
        lastRequestTime = null
      }
    }

    if (responseTimes.length === 0) {
      return null
    }

    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    const minResponseTime = Math.min(...responseTimes)
    const maxResponseTime = Math.max(...responseTimes)

    // Find preferred day of week (0 = Sunday, 6 = Saturday)
    const dayFrequency = new Map<number, number>()
    responseDays.forEach(day => {
      dayFrequency.set(day, (dayFrequency.get(day) || 0) + 1)
    })
    const preferredDay = Array.from(dayFrequency.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    // Find preferred hour of day
    const hourFrequency = new Map<number, number>()
    responseHours.forEach(hour => {
      hourFrequency.set(hour, (hourFrequency.get(hour) || 0) + 1)
    })
    const preferredHour = Array.from(hourFrequency.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]

    return {
      supplier_id: interactions[0].supplier_id,
      avg_response_hours: Math.round(avgResponseTime * 100) / 100,
      min_response_hours: Math.round(minResponseTime * 100) / 100,
      max_response_hours: Math.round(maxResponseTime * 100) / 100,
      response_count: responseTimes.length,
      preferred_day_of_week: preferredDay !== undefined ? dayNames[preferredDay] : undefined,
      preferred_hour_of_day: preferredHour
    }
  }

  /**
   * Update supplier record with response pattern insights
   */
  private async updateSupplierWithResponsePattern(
    supplierId: string,
    pattern: ResponseTimePattern
  ): Promise<void> {
    try {
      const { data: supplier, error: fetchError } = await this.getSupabase()
        .from('suppliers')
        .select('metadata')
        .eq('id', supplierId)
        .single()

      if (fetchError) throw fetchError

      const metadata = supplier?.metadata || {}
      const preferredContactTime = pattern.preferred_hour_of_day !== undefined
        ? `${pattern.preferred_day_of_week} around ${pattern.preferred_hour_of_day}:00`
        : undefined

      await this.getSupabase()
        .from('suppliers')
        .update({
          avg_response_time_hours: pattern.avg_response_hours,
          metadata: {
            ...metadata,
            preferred_contact_method: 'email',
            preferred_contact_time: preferredContactTime,
            response_pattern_updated: new Date().toISOString(),
            min_response_hours: pattern.min_response_hours,
            max_response_hours: pattern.max_response_hours
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', supplierId)

    } catch (error: any) {
      console.error(`Error updating supplier ${supplierId} with response pattern:`, error)
    }
  }

  /**
   * Analyze pricing trends from successful quotes
   */
  private async analyzePricingTrends(): Promise<number> {
    try {
      const sixtyDaysAgo = new Date()
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

      // Get supplier products with pricing history
      const { data: products, error } = await this.getSupabase()
        .from('supplier_products')
        .select('*')
        .not('avg_markup_percentage', 'is', null)
        .not('product_category', 'is', null)

      if (error || !products) {
        throw error
      }

      const categoryTrends = new Map<string, PricingTrend[]>()
      
      for (const product of products) {
        const category = product.product_category || 'Uncategorized'
        const markupHistory = product.metadata?.markup_history || []

        if (markupHistory.length >= 2) {
          const trend = this.calculatePricingTrend(markupHistory)
          
          if (!categoryTrends.has(category)) {
            categoryTrends.set(category, [])
          }

          categoryTrends.get(category)!.push({
            supplier_id: product.supplier_id,
            product_category: category,
            avg_markup: product.avg_markup_percentage || 0,
            markup_trend: trend.direction,
            price_volatility: trend.volatility,
            quote_count: markupHistory.length
          })
        }
      }

      return categoryTrends.size

    } catch (error: any) {
      console.error('Error analyzing pricing trends:', error)
      return 0
    }
  }

  /**
   * Calculate pricing trend direction and volatility
   */
  private calculatePricingTrend(markupHistory: Array<{ markup: number; date: string }>): {
    direction: 'increasing' | 'stable' | 'decreasing'
    volatility: number
  } {
    if (markupHistory.length < 2) {
      return { direction: 'stable', volatility: 0 }
    }

    // Sort by date
    const sorted = [...markupHistory].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Calculate trend using recent vs older data
    const recentCount = Math.ceil(sorted.length / 2)
    const recent = sorted.slice(-recentCount)
    const older = sorted.slice(0, -recentCount)

    const recentAvg = recent.reduce((sum, h) => sum + h.markup, 0) / recent.length
    const olderAvg = older.reduce((sum, h) => sum + h.markup, 0) / older.length

    const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100

    let direction: 'increasing' | 'stable' | 'decreasing'
    if (percentChange > 5) {
      direction = 'increasing'
    } else if (percentChange < -5) {
      direction = 'decreasing'
    } else {
      direction = 'stable'
    }

    // Calculate volatility (standard deviation)
    const markups = sorted.map(h => h.markup)
    const mean = markups.reduce((a, b) => a + b, 0) / markups.length
    const variance = markups.reduce((sum, m) => sum + Math.pow(m - mean, 2), 0) / markups.length
    const volatility = Math.sqrt(variance)

    return { direction, volatility }
  }

  /**
   * Update stock reliability accuracy based on actual outcomes
   */
  private async updateStockReliabilityAccuracy(): Promise<number> {
    try {
      // Get completed quote requests from last 90 days
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

      const { data: completedQuotes, error } = await this.getSupabase()
        .from('quote_requests')
        .select('*')
        .eq('status', 'completed')
        .gte('created_at', ninetyDaysAgo.toISOString())

      if (error || !completedQuotes) {
        throw error
      }

      let updatedCount = 0

      for (const quote of completedQuotes as QuoteRequest[]) {
        if (!quote.metadata?.selected_products) continue

        for (const selectedProduct of quote.metadata.selected_products) {
          // Find matching supplier_product
          const { data: products } = await this.getSupabase()
            .from('supplier_products')
            .select('*')
            .eq('supplier_id', selectedProduct.supplier_id)
            .ilike('product_name', `%${selectedProduct.product_name}%`)
            .limit(1)

          if (products && products.length > 0) {
            const product = products[0]
            const metadata = product.metadata || {}
            
            // Track accuracy
            const accuracyCount = metadata.stock_accuracy_count || 0
            const inaccuracyCount = metadata.stock_inaccuracy_count || 0
            
            const quoteAccurate = selectedProduct.quote_accurate !== false
            const newAccuracyCount = quoteAccurate ? accuracyCount + 1 : accuracyCount
            const newInaccuracyCount = quoteAccurate ? inaccuracyCount : inaccuracyCount + 1

            // Calculate new reliability rating
            const totalChecks = newAccuracyCount + newInaccuracyCount
            const accuracyRate = newAccuracyCount / totalChecks
            
            let newReliability: string = product.stock_reliability
            if (totalChecks >= 5) {
              if (accuracyRate >= 0.95) {
                newReliability = 'always_in_stock'
              } else if (accuracyRate >= 0.75) {
                newReliability = 'usually_available'
              } else if (accuracyRate >= 0.50) {
                newReliability = 'often_delayed'
              } else {
                newReliability = 'unreliable'
              }
            }

            await this.getSupabase()
              .from('supplier_products')
              .update({
                stock_reliability: newReliability,
                metadata: {
                  ...metadata,
                  stock_accuracy_count: newAccuracyCount,
                  stock_inaccuracy_count: newInaccuracyCount,
                  stock_accuracy_rate: Math.round(accuracyRate * 100)
                },
                updated_at: new Date().toISOString()
              })
              .eq('id', product.id)

            updatedCount++
          }
        }
      }

      return updatedCount

    } catch (error: any) {
      console.error('Error updating stock reliability accuracy:', error)
      return 0
    }
  }

  /**
   * Calculate comprehensive supplier response quality scores
   */
  private async calculateSupplierQualityScores(): Promise<number> {
    try {
      const { data: suppliers, error } = await this.getSupabase()
        .from('suppliers')
        .select('id, email')

      if (error || !suppliers) {
        throw error
      }

      let updatedCount = 0

      for (const supplier of suppliers) {
        const qualityScore = await this.calculateSupplierQualityScore(supplier.id)
        
        if (qualityScore !== null) {
          const { data: supplierData } = await this.getSupabase()
            .from('suppliers')
            .select('metadata')
            .eq('id', supplier.id)
            .single()

          const metadata = supplierData?.metadata || {}

          await this.getSupabase()
            .from('suppliers')
            .update({
              metadata: {
                ...metadata,
                response_quality_score: qualityScore.overall_score,
                response_completeness_avg: qualityScore.completeness,
                pricing_accuracy_score: qualityScore.pricing_accuracy,
                stock_accuracy_score: qualityScore.stock_accuracy,
                quality_score_updated: new Date().toISOString()
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', supplier.id)

          updatedCount++
        }
      }

      return updatedCount

    } catch (error: any) {
      console.error('Error calculating supplier quality scores:', error)
      return 0
    }
  }

  /**
   * Calculate quality score components for a supplier
   */
  private async calculateSupplierQualityScore(supplierId: string): Promise<{
    overall_score: number
    completeness: number
    pricing_accuracy: number
    stock_accuracy: number
  } | null> {
    try {
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

      // Get quote responses
      const { data: interactions } = await this.getSupabase()
        .from('email_supplier_interactions')
        .select('*')
        .eq('supplier_id', supplierId)
        .eq('interaction_type', 'quote_response')
        .gte('created_at', ninetyDaysAgo.toISOString())

      if (!interactions || interactions.length === 0) {
        return null
      }

      // 1. Response Completeness (40 points)
      let completenessScore = 0
      let completeResponses = 0

      for (const interaction of interactions) {
        const pricingData = interaction.pricing_data || {}
        const products = Object.keys(pricingData)
        
        if (products.length > 0) {
          const hasPrice = products.some(p => pricingData[p]?.unit_price)
          const hasLeadTime = products.some(p => pricingData[p]?.lead_time || pricingData[p]?.lead_time_days)
          const hasStock = products.some(p => pricingData[p]?.stock_availability)
          
          const fieldsProvided = [hasPrice, hasLeadTime, hasStock].filter(Boolean).length
          const completeness = fieldsProvided / 3
          
          if (completeness >= 0.8) {
            completeResponses++
          }
        }
      }

      completenessScore = Math.round((completeResponses / interactions.length) * 40)

      // 2. Pricing Accuracy (30 points)
      const { data: products } = await this.getSupabase()
        .from('supplier_products')
        .select('metadata')
        .eq('supplier_id', supplierId)

      let pricingAccuracyScore = 30 // Default to full score
      if (products && products.length > 0) {
        const accuracyRates = products
          .map(p => p.metadata?.stock_accuracy_rate)
          .filter((rate): rate is number => rate !== undefined)
        
        if (accuracyRates.length > 0) {
          const avgAccuracy = accuracyRates.reduce((a, b) => a + b, 0) / accuracyRates.length
          pricingAccuracyScore = Math.round((avgAccuracy / 100) * 30)
        }
      }

      // 3. Stock Accuracy (30 points)
      let stockAccuracyScore = 30 // Default to full score
      if (products && products.length > 0) {
        const stockProducts = products.filter(p => 
          p.metadata?.stock_accuracy_count && p.metadata.stock_accuracy_count > 0
        )
        
        if (stockProducts.length > 0) {
          const accuracyRates = stockProducts.map(p => {
            const correct = p.metadata.stock_accuracy_count || 0
            const incorrect = p.metadata.stock_inaccuracy_count || 0
            return correct / (correct + incorrect)
          })
          
          const avgAccuracy = accuracyRates.reduce((a, b) => a + b, 0) / accuracyRates.length
          stockAccuracyScore = Math.round(avgAccuracy * 30)
        }
      }

      const overallScore = completenessScore + pricingAccuracyScore + stockAccuracyScore

      return {
        overall_score: Math.min(100, Math.max(0, overallScore)),
        completeness: Math.round((completenessScore / 40) * 100),
        pricing_accuracy: Math.round((pricingAccuracyScore / 30) * 100),
        stock_accuracy: Math.round((stockAccuracyScore / 30) * 100)
      }

    } catch (error: any) {
      console.error(`Error calculating quality score for supplier ${supplierId}:`, error)
      return null
    }
  }

  /**
   * Identify emerging supplier relationships based on interaction frequency trends
   */
  private async identifyEmergingRelationships(): Promise<number> {
    try {
      const { data: suppliers, error } = await this.getSupabase()
        .from('suppliers')
        .select('id, company')

      if (error || !suppliers) {
        throw error
      }

      const emergingRelationships: EmergingSupplierRelationship[] = []

      for (const supplier of suppliers) {
        const relationship = await this.analyzeRelationshipTrend(supplier.id)
        
        if (relationship && relationship.frequency_trend === 'increasing' && relationship.growth_rate > 50) {
          emergingRelationships.push({
            ...relationship,
            supplier_company: supplier.company
          })
        }
      }

      // Log emerging relationships
      for (const rel of emergingRelationships) {
        await this.getSupabase()
          .from('squad_messages')
          .insert({
            from_agent: this.agentName,
            to_agent: null,
            message: `🚀 Emerging supplier relationship: ${rel.supplier_company} - interaction frequency increased ${rel.growth_rate.toFixed(0)}% (${rel.older_interaction_count} → ${rel.recent_interaction_count} contacts)`,
            task_id: null,
            data: {
              type: 'emerging_relationship',
              supplier_id: rel.supplier_id,
              supplier_company: rel.supplier_company,
              growth_rate: rel.growth_rate,
              recent_interactions: rel.recent_interaction_count,
              timestamp: new Date().toISOString()
            }
          })

        // Update supplier metadata
        const { data: supplierData } = await this.getSupabase()
          .from('suppliers')
          .select('metadata')
          .eq('id', rel.supplier_id)
          .single()

        const metadata = supplierData?.metadata || {}

        await this.getSupabase()
          .from('suppliers')
          .update({
            metadata: {
              ...metadata,
              interaction_frequency_trend: 'increasing',
              growth_rate: rel.growth_rate,
              emerging_relationship_detected: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', rel.supplier_id)
      }

      return emergingRelationships.length

    } catch (error: any) {
      console.error('Error identifying emerging relationships:', error)
      return 0
    }
  }

  /**
   * Analyze relationship trend for a supplier
   */
  private async analyzeRelationshipTrend(supplierId: string): Promise<EmergingSupplierRelationship | null> {
    try {
      const sixtyDaysAgo = new Date()
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // Get recent interactions (last 30 days)
      const { data: recentInteractions } = await this.getSupabase()
        .from('email_supplier_interactions')
        .select('id')
        .eq('supplier_id', supplierId)
        .gte('created_at', thirtyDaysAgo.toISOString())

      // Get older interactions (30-60 days ago)
      const { data: olderInteractions } = await this.getSupabase()
        .from('email_supplier_interactions')
        .select('id')
        .eq('supplier_id', supplierId)
        .gte('created_at', sixtyDaysAgo.toISOString())
        .lt('created_at', thirtyDaysAgo.toISOString())

      const recentCount = recentInteractions?.length || 0
      const olderCount = olderInteractions?.length || 0

      if (recentCount === 0 && olderCount === 0) {
        return null
      }

      const growthRate = olderCount > 0 
        ? ((recentCount - olderCount) / olderCount) * 100
        : recentCount > 0 ? 100 : 0

      let trend: 'increasing' | 'stable'
      if (recentCount > olderCount * 1.5) {
        trend = 'increasing'
      } else {
        trend = 'stable'
      }

      return {
        supplier_id: supplierId,
        supplier_company: '',
        interaction_frequency: recentCount + olderCount,
        frequency_trend: trend,
        recent_interaction_count: recentCount,
        older_interaction_count: olderCount,
        growth_rate: Math.round(growthRate)
      }

    } catch (error: any) {
      console.error(`Error analyzing relationship trend for supplier ${supplierId}:`, error)
      return null
    }
  }

  /**
   * Generate category-specific supplier insights
   */
  private async generateCategoryInsights(): Promise<number> {
    try {
      const { data: products, error } = await this.getSupabase()
        .from('supplier_products')
        .select(`
          *,
          supplier:suppliers(
            id,
            company,
            relationship_strength,
            avg_response_time_hours,
            metadata
          )
        `)
        .not('product_category', 'is', null)

      if (error || !products) {
        throw error
      }

      // Group by category
      const categoryMap = new Map<string, any[]>()
      for (const product of products) {
        const category = product.product_category || 'Uncategorized'
        if (!categoryMap.has(category)) {
          categoryMap.set(category, [])
        }
        categoryMap.get(category)!.push(product)
      }

      const insights: CategoryInsight[] = []

      for (const [category, categoryProducts] of Array.from(categoryMap.entries())) {
        // Calculate supplier scores for this category
        const supplierScores = new Map<string, {
          supplier_id: string
          supplier_company: string
          total_score: number
          avg_markup: number
          response_time: number
          stock_accuracy: number
          relationship_strength: number
          product_count: number
        }>()

        for (const product of categoryProducts) {
          const supplier = (product as any).supplier
          if (!supplier) continue

          const supplierId = supplier.id
          if (!supplierScores.has(supplierId)) {
            supplierScores.set(supplierId, {
              supplier_id: supplierId,
              supplier_company: supplier.company,
              total_score: 0,
              avg_markup: 0,
              response_time: supplier.avg_response_time_hours || 24,
              stock_accuracy: 0,
              relationship_strength: supplier.relationship_strength || 50,
              product_count: 0
            })
          }

          const supplierScore = supplierScores.get(supplierId)!
          supplierScore.product_count++
          supplierScore.avg_markup += product.avg_markup_percentage || 0
          
          // Stock accuracy from metadata
          const stockAccuracy = product.metadata?.stock_accuracy_rate || 75
          supplierScore.stock_accuracy += stockAccuracy
        }

        // Calculate averages and total scores
        const topSuppliers = Array.from(supplierScores.values())
          .map(s => {
            s.avg_markup = s.avg_markup / s.product_count
            s.stock_accuracy = s.stock_accuracy / s.product_count
            
            // Overall score calculation
            const responseScore = Math.max(0, 100 - (s.response_time / 48) * 100)
            const markupScore = Math.max(0, 100 - s.avg_markup)
            const stockScore = s.stock_accuracy
            const relationshipScore = s.relationship_strength
            
            s.total_score = Math.round(
              responseScore * 0.25 +
              markupScore * 0.25 +
              stockScore * 0.25 +
              relationshipScore * 0.25
            )
            
            return s
          })
          .sort((a, b) => b.total_score - a.total_score)
          .slice(0, 5)

        // Calculate category metrics
        const allScores = Array.from(supplierScores.values())
        const metrics = {
          total_suppliers: allScores.length,
          avg_response_time: allScores.reduce((sum, s) => sum + s.response_time, 0) / allScores.length,
          avg_markup: allScores.reduce((sum, s) => sum + (s.avg_markup / s.product_count), 0) / allScores.length,
          avg_stock_accuracy: allScores.reduce((sum, s) => sum + (s.stock_accuracy / s.product_count), 0) / allScores.length
        }

        insights.push({
          category,
          top_suppliers: topSuppliers.map(s => ({
            supplier_id: s.supplier_id,
            supplier_company: s.supplier_company,
            score: s.total_score,
            avg_markup: Math.round(s.avg_markup * 100) / 100,
            response_time_hours: Math.round(s.response_time * 100) / 100,
            stock_accuracy: Math.round(s.stock_accuracy),
            relationship_strength: s.relationship_strength
          })),
          metrics: {
            total_suppliers: metrics.total_suppliers,
            avg_response_time: Math.round(metrics.avg_response_time * 100) / 100,
            avg_markup: Math.round(metrics.avg_markup * 100) / 100,
            avg_stock_accuracy: Math.round(metrics.avg_stock_accuracy)
          }
        })
      }

      // Store insights in database
      for (const insight of insights) {
        await this.getSupabase()
          .from('squad_messages')
          .insert({
            from_agent: this.agentName,
            to_agent: null,
            message: `📊 Category Insight: ${insight.category}\n` +
              `Top Suppliers: ${insight.top_suppliers.slice(0, 3).map(s => s.supplier_company).join(', ')}\n` +
              `Avg Response Time: ${insight.metrics.avg_response_time.toFixed(1)}h\n` +
              `Avg Markup: ${insight.metrics.avg_markup.toFixed(1)}%\n` +
              `Stock Accuracy: ${insight.metrics.avg_stock_accuracy}%`,
            task_id: null,
            data: {
              type: 'category_insight',
              category: insight.category,
              top_suppliers: insight.top_suppliers,
              metrics: insight.metrics,
              timestamp: new Date().toISOString()
            }
          })
      }

      return insights.length

    } catch (error: any) {
      console.error('Error generating category insights:', error)
      return 0
    }
  }

  /**
   * Update supplier_products with data from successful quotes
   */
  private async updateProductsFromSuccessfulQuotes(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // Get recently completed quotes
      const { data: completedQuotes, error } = await this.getSupabase()
        .from('quote_requests')
        .select('*')
        .eq('status', 'completed')
        .gte('completed_at', thirtyDaysAgo.toISOString())

      if (error || !completedQuotes) {
        throw error
      }

      let updatedCount = 0

      for (const quote of completedQuotes as QuoteRequest[]) {
        if (!quote.metadata?.selected_products) continue

        for (const selectedProduct of quote.metadata.selected_products) {
          const { data: existingProducts } = await this.getSupabase()
            .from('supplier_products')
            .select('*')
            .eq('supplier_id', selectedProduct.supplier_id)
            .ilike('product_name', `%${selectedProduct.product_name}%`)
            .limit(1)

          if (existingProducts && existingProducts.length > 0) {
            const product = existingProducts[0]
            const metadata = product.metadata || {}
            const markupHistory = metadata.markup_history || []

            // Add new markup to history
            if (selectedProduct.markup_percentage) {
              markupHistory.push({
                markup: selectedProduct.markup_percentage,
                date: quote.completed_at || quote.created_at,
                quote_id: quote.id
              })

              // Keep only last 20 entries
              if (markupHistory.length > 20) {
                markupHistory.shift()
              }
            }

            // Calculate new average markup
            const currentAvg = product.avg_markup_percentage || 0
            const markupCount = markupHistory.length
            const newAvg = markupHistory.reduce((sum, h) => sum + h.markup, 0) / markupCount

            // Calculate pricing trend
            const trend = this.calculatePricingTrend(markupHistory)

            await this.getSupabase()
              .from('supplier_products')
              .update({
                avg_markup_percentage: Math.round(newAvg * 100) / 100,
                last_quoted_price: selectedProduct.unit_price,
                last_quoted_date: new Date().toISOString(),
                metadata: {
                  ...metadata,
                  markup_history: markupHistory,
                  pricing_trend: trend.direction,
                  price_volatility: Math.round(trend.volatility * 100) / 100
                },
                updated_at: new Date().toISOString()
              })
              .eq('id', product.id)

            updatedCount++
          }
        }
      }

      return updatedCount

    } catch (error: any) {
      console.error('Error updating products from successful quotes:', error)
      return 0
    }
  }

  /**
   * Get enhanced supplier ranking data for SupplierAgent integration
   */
  async getEnhancedSupplierRanking(supplierId: string): Promise<{
    response_quality_score: number
    preferred_contact_time?: string
    pricing_trend?: string
    stock_accuracy_rate: number
    interaction_trend?: string
  } | null> {
    try {
      const { data: supplier } = await this.getSupabase()
        .from('suppliers')
        .select('metadata, avg_response_time_hours')
        .eq('id', supplierId)
        .single()

      if (!supplier) return null

      const metadata = supplier.metadata || {}

      // Get product stock accuracy
      const { data: products } = await this.getSupabase()
        .from('supplier_products')
        .select('metadata')
        .eq('supplier_id', supplierId)

      let avgStockAccuracy = 75 // Default
      if (products && products.length > 0) {
        const accuracyRates = products
          .map(p => p.metadata?.stock_accuracy_rate)
          .filter((rate): rate is number => rate !== undefined)
        
        if (accuracyRates.length > 0) {
          avgStockAccuracy = accuracyRates.reduce((a, b) => a + b, 0) / accuracyRates.length
        }
      }

      return {
        response_quality_score: metadata.response_quality_score || 75,
        preferred_contact_time: metadata.preferred_contact_time,
        pricing_trend: metadata.pricing_trend,
        stock_accuracy_rate: avgStockAccuracy,
        interaction_trend: metadata.interaction_frequency_trend
      }

    } catch (error: any) {
      console.error(`Error getting enhanced ranking for supplier ${supplierId}:`, error)
      return null
    }
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

export const supplierLearningEngine = new SupplierLearningEngine()
