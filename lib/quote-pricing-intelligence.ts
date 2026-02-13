/**
 * Quote Pricing Intelligence Engine
 * 
 * Uses Claude AI to analyze quote history and customer acceptance/rejection data
 * to learn optimal pricing strategies. Discovers patterns in:
 * - Customer segment pricing preferences
 * - Product category price sensitivity
 * - Order size vs markup relationships
 * - Urgency impact on pricing power
 * - Bundling effectiveness
 * - Seasonal pricing patterns
 * 
 * Integrates with QuoteAgent for dynamic, intelligent pricing decisions
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ============================================
// INTERFACES
// ============================================

interface QuoteOutcome {
  id: string
  quote_request_id: string
  quote_number: string
  outcome: 'accepted' | 'rejected' | 'negotiation' | 'no_response' | 'pending'
  customer_email: string
  customer_name: string
  customer_segment: string
  total_quoted_amount: number
  final_amount?: number
  items: Array<{
    product_name: string
    product_category?: string
    quantity: number
    unit_price: number
    cost_price?: number
    markup_percentage?: number
    total_price: number
  }>
  urgency_level?: 'low' | 'medium' | 'high' | 'urgent'
  order_size_category?: 'small' | 'medium' | 'large' | 'enterprise'
  rejection_reason?: string
  negotiation_details?: any
  response_time_hours?: number
  metadata?: any
  outcome_date: string
  created_at: string
}

interface PricingInsight {
  id?: string
  insight_type: 'customer_segment' | 'product_category' | 'order_size' | 'urgency_level' | 
                'bundling_strategy' | 'price_sensitivity' | 'seasonal_pattern' | 'general_strategy'
  segment_key: string
  optimal_markup_min?: number
  optimal_markup_max?: number
  optimal_markup_avg: number
  acceptance_rate: number
  sample_size: number
  confidence_score: number
  insights_data: any
  patterns?: any
  recommendations?: string
  last_analyzed_at?: string
}

interface CustomerProfile {
  email: string
  name?: string
  segment?: string
  total_quotes: number
  accepted_quotes: number
  acceptance_rate: number
  avg_order_value: number
  preferred_markup_range?: { min: number; max: number }
  price_sensitivity: 'low' | 'medium' | 'high'
  response_patterns: any
}

interface PricingRecommendation {
  base_markup: number
  min_markup: number
  max_markup: number
  confidence: number
  reasoning: string
  adjustments: Array<{
    factor: string
    adjustment: number
    reason: string
  }>
  risk_level: 'low' | 'medium' | 'high'
  alternative_strategies?: string[]
}

interface AnalysisResult {
  success: boolean
  insights_generated: number
  customer_segments_analyzed: number
  product_categories_analyzed: number
  patterns_identified: string[]
  recommendations: string[]
  timestamp: string
  error?: string
}

// ============================================
// MAIN CLASS
// ============================================

export class QuotePricingIntelligence {
  private supabase: SupabaseClient | null = null
  private anthropic: Anthropic | null = null
  private agentName = 'QuotePricingIntelligence'

  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      this.supabase = createClient(supabaseUrl, supabaseKey)
    }
    return this.supabase
  }

  private getAnthropic(): Anthropic {
    if (!this.anthropic) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required')
      }
      this.anthropic = new Anthropic({ apiKey })
    }
    return this.anthropic
  }

  /**
   * Main analysis function - runs comprehensive pricing intelligence analysis
   */
  async runPricingAnalysis(): Promise<AnalysisResult> {
    const startTime = new Date().toISOString()
    
    try {
      await this.logToSquad('🧠 Starting intelligent quote pricing analysis')

      const quoteOutcomes = await this.fetchQuoteOutcomes()
      
      if (quoteOutcomes.length < 10) {
        await this.logToSquad(`⚠️ Insufficient data for analysis (${quoteOutcomes.length} outcomes). Need at least 10.`)
        return {
          success: false,
          insights_generated: 0,
          customer_segments_analyzed: 0,
          product_categories_analyzed: 0,
          patterns_identified: [],
          recommendations: [],
          timestamp: startTime,
          error: 'Insufficient quote outcome data'
        }
      }

      const analysisData = await this.prepareAnalysisData(quoteOutcomes)
      
      const claudeInsights = await this.analyzeWithClaude(analysisData)
      
      const storedInsights = await this.storeInsights(claudeInsights.insights)
      
      const patterns = claudeInsights.patterns || []
      const recommendations = claudeInsights.recommendations || []

      await this.logToSquad(
        `✅ Pricing intelligence analysis completed:\n` +
        `- Insights generated: ${storedInsights}\n` +
        `- Customer segments analyzed: ${claudeInsights.customer_segments_count}\n` +
        `- Product categories analyzed: ${claudeInsights.product_categories_count}\n` +
        `- Patterns identified: ${patterns.length}\n` +
        `- Key recommendations: ${recommendations.slice(0, 3).join('; ')}`,
        {
          insights_count: storedInsights,
          segments: claudeInsights.customer_segments_count,
          categories: claudeInsights.product_categories_count,
          patterns: patterns
        }
      )

      return {
        success: true,
        insights_generated: storedInsights,
        customer_segments_analyzed: claudeInsights.customer_segments_count,
        product_categories_analyzed: claudeInsights.product_categories_count,
        patterns_identified: patterns,
        recommendations: recommendations,
        timestamp: startTime
      }

    } catch (error: any) {
      console.error('Error in pricing analysis:', error)
      await this.logToSquad(`❌ Pricing analysis failed: ${error.message}`)
      
      return {
        success: false,
        insights_generated: 0,
        customer_segments_analyzed: 0,
        product_categories_analyzed: 0,
        patterns_identified: [],
        recommendations: [],
        timestamp: startTime,
        error: error.message
      }
    }
  }

  /**
   * Fetch quote outcomes with full details
   */
  private async fetchQuoteOutcomes(daysBack: number = 180): Promise<QuoteOutcome[]> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysBack)

    const { data, error } = await this.getSupabase()
      .from('quote_outcomes')
      .select('*')
      .gte('outcome_date', cutoffDate.toISOString())
      .order('outcome_date', { ascending: false })

    if (error) {
      console.error('Error fetching quote outcomes:', error)
      return []
    }

    return data as QuoteOutcome[]
  }

  /**
   * Prepare structured data for Claude analysis
   */
  private async prepareAnalysisData(outcomes: QuoteOutcome[]): Promise<any> {
    const acceptedQuotes = outcomes.filter(o => o.outcome === 'accepted')
    const rejectedQuotes = outcomes.filter(o => o.outcome === 'rejected')
    
    const customerSegments = new Map<string, QuoteOutcome[]>()
    const productCategories = new Map<string, QuoteOutcome[]>()
    const urgencyLevels = new Map<string, QuoteOutcome[]>()
    const orderSizes = new Map<string, QuoteOutcome[]>()

    for (const outcome of outcomes) {
      if (outcome.customer_segment) {
        if (!customerSegments.has(outcome.customer_segment)) {
          customerSegments.set(outcome.customer_segment, [])
        }
        customerSegments.get(outcome.customer_segment)!.push(outcome)
      }

      if (outcome.urgency_level) {
        if (!urgencyLevels.has(outcome.urgency_level)) {
          urgencyLevels.set(outcome.urgency_level, [])
        }
        urgencyLevels.get(outcome.urgency_level)!.push(outcome)
      }

      if (outcome.order_size_category) {
        if (!orderSizes.has(outcome.order_size_category)) {
          orderSizes.set(outcome.order_size_category, [])
        }
        orderSizes.get(outcome.order_size_category)!.push(outcome)
      }

      for (const item of outcome.items) {
        const category = item.product_category || 'uncategorized'
        if (!productCategories.has(category)) {
          productCategories.set(category, [])
        }
        productCategories.get(category)!.push(outcome)
      }
    }

    return {
      summary: {
        total_quotes: outcomes.length,
        accepted: acceptedQuotes.length,
        rejected: rejectedQuotes.length,
        acceptance_rate: acceptedQuotes.length / outcomes.length,
        avg_quoted_amount: outcomes.reduce((sum, o) => sum + o.total_quoted_amount, 0) / outcomes.length,
        date_range: {
          from: outcomes[outcomes.length - 1]?.outcome_date,
          to: outcomes[0]?.outcome_date
        }
      },
      by_customer_segment: Array.from(customerSegments.entries()).map(([segment, quotes]) => ({
        segment,
        total: quotes.length,
        accepted: quotes.filter(q => q.outcome === 'accepted').length,
        acceptance_rate: quotes.filter(q => q.outcome === 'accepted').length / quotes.length,
        avg_markup: this.calculateAverageMarkup(quotes),
        avg_order_value: quotes.reduce((sum, q) => sum + q.total_quoted_amount, 0) / quotes.length,
        sample_quotes: quotes.slice(0, 5).map(q => ({
          outcome: q.outcome,
          amount: q.total_quoted_amount,
          markup: this.calculateQuoteMarkup(q),
          urgency: q.urgency_level,
          order_size: q.order_size_category
        }))
      })),
      by_product_category: Array.from(productCategories.entries()).map(([category, quotes]) => {
        const uniqueQuotes = Array.from(new Set(quotes.map(q => q.id))).map(id => 
          quotes.find(q => q.id === id)!
        )
        return {
          category,
          total: uniqueQuotes.length,
          accepted: uniqueQuotes.filter(q => q.outcome === 'accepted').length,
          acceptance_rate: uniqueQuotes.filter(q => q.outcome === 'accepted').length / uniqueQuotes.length,
          avg_markup: this.calculateAverageMarkup(uniqueQuotes),
          items_sold: quotes.reduce((sum, q) => sum + q.items.filter(i => 
            (i.product_category || 'uncategorized') === category
          ).length, 0)
        }
      }),
      by_urgency_level: Array.from(urgencyLevels.entries()).map(([urgency, quotes]) => ({
        urgency,
        total: quotes.length,
        accepted: quotes.filter(q => q.outcome === 'accepted').length,
        acceptance_rate: quotes.filter(q => q.outcome === 'accepted').length / quotes.length,
        avg_markup: this.calculateAverageMarkup(quotes),
        avg_response_time_hours: quotes
          .filter(q => q.response_time_hours)
          .reduce((sum, q) => sum + (q.response_time_hours || 0), 0) / 
          quotes.filter(q => q.response_time_hours).length
      })),
      by_order_size: Array.from(orderSizes.entries()).map(([size, quotes]) => ({
        size,
        total: quotes.length,
        accepted: quotes.filter(q => q.outcome === 'accepted').length,
        acceptance_rate: quotes.filter(q => q.outcome === 'accepted').length / quotes.length,
        avg_markup: this.calculateAverageMarkup(quotes),
        avg_order_value: quotes.reduce((sum, q) => sum + q.total_quoted_amount, 0) / quotes.length
      })),
      bundling_analysis: this.analyzeBundling(outcomes),
      rejection_reasons: rejectedQuotes
        .filter(q => q.rejection_reason)
        .map(q => ({
          reason: q.rejection_reason,
          markup: this.calculateQuoteMarkup(q),
          amount: q.total_quoted_amount,
          segment: q.customer_segment,
          urgency: q.urgency_level
        }))
    }
  }

  /**
   * Calculate average markup from quotes
   */
  private calculateAverageMarkup(quotes: QuoteOutcome[]): number {
    let totalMarkup = 0
    let count = 0

    for (const quote of quotes) {
      for (const item of quote.items) {
        if (item.markup_percentage) {
          totalMarkup += item.markup_percentage
          count++
        }
      }
    }

    return count > 0 ? totalMarkup / count : 0
  }

  /**
   * Calculate overall markup for a quote
   */
  private calculateQuoteMarkup(quote: QuoteOutcome): number {
    const items = quote.items.filter(i => i.markup_percentage)
    if (items.length === 0) return 0
    return items.reduce((sum, i) => sum + i.markup_percentage!, 0) / items.length
  }

  /**
   * Analyze bundling effectiveness
   */
  private analyzeBundling(outcomes: QuoteOutcome[]): any {
    const singleItemQuotes = outcomes.filter(o => o.items.length === 1)
    const multiItemQuotes = outcomes.filter(o => o.items.length > 1)

    return {
      single_item: {
        total: singleItemQuotes.length,
        accepted: singleItemQuotes.filter(q => q.outcome === 'accepted').length,
        acceptance_rate: singleItemQuotes.filter(q => q.outcome === 'accepted').length / 
          (singleItemQuotes.length || 1),
        avg_markup: this.calculateAverageMarkup(singleItemQuotes)
      },
      multi_item: {
        total: multiItemQuotes.length,
        accepted: multiItemQuotes.filter(q => q.outcome === 'accepted').length,
        acceptance_rate: multiItemQuotes.filter(q => q.outcome === 'accepted').length / 
          (multiItemQuotes.length || 1),
        avg_markup: this.calculateAverageMarkup(multiItemQuotes),
        avg_items_per_quote: multiItemQuotes.reduce((sum, q) => sum + q.items.length, 0) / 
          (multiItemQuotes.length || 1)
      }
    }
  }

  /**
   * Use Claude to analyze pricing patterns and generate insights
   */
  private async analyzeWithClaude(data: any): Promise<{
    insights: PricingInsight[]
    patterns: string[]
    recommendations: string[]
    customer_segments_count: number
    product_categories_count: number
  }> {
    const prompt = `You are an expert pricing strategist analyzing quote acceptance/rejection data to discover optimal pricing strategies.

Analyze the following quote data and provide actionable pricing insights:

${JSON.stringify(data, null, 2)}

Please analyze and provide:

1. **Customer Segment Insights**: For each customer segment, determine:
   - Optimal markup range (min, max, average)
   - Price sensitivity level (low/medium/high)
   - Acceptance patterns
   - Confidence score (0-1)

2. **Product Category Insights**: For each product category, identify:
   - Which markup percentages work best
   - Price sensitivity indicators
   - Value-driven vs price-driven behavior

3. **Urgency Impact**: How does urgency affect pricing power?
   - Can we charge more when urgent?
   - Optimal markup adjustments by urgency level

4. **Order Size Patterns**: How should markups vary by order size?
   - Volume discount patterns
   - Enterprise vs small order strategies

5. **Bundling Effectiveness**: Does bundling improve acceptance?
   - Multi-item vs single-item quote performance
   - Optimal bundling strategies

6. **Key Patterns**: List 5-10 actionable patterns discovered

7. **Strategic Recommendations**: Provide 5-10 specific pricing recommendations

Return your analysis as a JSON object with this structure:
{
  "customer_segments": [
    {
      "segment": "segment_name",
      "optimal_markup_min": 20,
      "optimal_markup_max": 35,
      "optimal_markup_avg": 27.5,
      "acceptance_rate": 0.78,
      "sample_size": 45,
      "confidence_score": 0.85,
      "price_sensitivity": "medium",
      "insights_data": {
        "key_factors": ["factor1", "factor2"],
        "success_patterns": "description",
        "failure_patterns": "description"
      },
      "recommendations": "specific advice"
    }
  ],
  "product_categories": [
    {
      "category": "category_name",
      "optimal_markup_avg": 30,
      "acceptance_rate": 0.82,
      "sample_size": 60,
      "confidence_score": 0.9,
      "price_sensitivity": "low",
      "insights_data": {
        "characteristics": "value-driven customers, quality focus",
        "pricing_power": "high"
      },
      "recommendations": "can support higher markups"
    }
  ],
  "urgency_levels": [
    {
      "urgency": "high",
      "optimal_markup_avg": 32,
      "markup_adjustment": "+5%",
      "acceptance_rate": 0.85,
      "insights_data": {
        "reasoning": "customers prioritize speed over price"
      }
    }
  ],
  "order_sizes": [
    {
      "size": "large",
      "optimal_markup_avg": 22,
      "acceptance_rate": 0.75,
      "insights_data": {
        "volume_discount_expectation": "5-8%"
      }
    }
  ],
  "bundling": {
    "multi_item_advantage": true,
    "optimal_strategy": "description",
    "markup_adjustment": "+2-3% for bundles"
  },
  "patterns": [
    "Pattern 1: description",
    "Pattern 2: description"
  ],
  "recommendations": [
    "Recommendation 1",
    "Recommendation 2"
  ]
}`

    try {
      const message = await this.getAnthropic().messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })

      const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
      const analysis = JSON.parse(responseText)

      const insights: PricingInsight[] = []

      for (const segment of analysis.customer_segments || []) {
        insights.push({
          insight_type: 'customer_segment',
          segment_key: segment.segment,
          optimal_markup_min: segment.optimal_markup_min,
          optimal_markup_max: segment.optimal_markup_max,
          optimal_markup_avg: segment.optimal_markup_avg,
          acceptance_rate: segment.acceptance_rate,
          sample_size: segment.sample_size,
          confidence_score: segment.confidence_score,
          insights_data: segment.insights_data,
          patterns: { price_sensitivity: segment.price_sensitivity },
          recommendations: segment.recommendations
        })
      }

      for (const category of analysis.product_categories || []) {
        insights.push({
          insight_type: 'product_category',
          segment_key: category.category,
          optimal_markup_avg: category.optimal_markup_avg,
          acceptance_rate: category.acceptance_rate,
          sample_size: category.sample_size,
          confidence_score: category.confidence_score,
          insights_data: category.insights_data,
          patterns: { price_sensitivity: category.price_sensitivity },
          recommendations: category.recommendations
        })
      }

      for (const urgency of analysis.urgency_levels || []) {
        insights.push({
          insight_type: 'urgency_level',
          segment_key: urgency.urgency,
          optimal_markup_avg: urgency.optimal_markup_avg,
          acceptance_rate: urgency.acceptance_rate,
          sample_size: data.by_urgency_level.find((u: any) => u.urgency === urgency.urgency)?.total || 0,
          confidence_score: 0.8,
          insights_data: urgency.insights_data
        })
      }

      for (const size of analysis.order_sizes || []) {
        insights.push({
          insight_type: 'order_size',
          segment_key: size.size,
          optimal_markup_avg: size.optimal_markup_avg,
          acceptance_rate: size.acceptance_rate,
          sample_size: data.by_order_size.find((s: any) => s.size === size.size)?.total || 0,
          confidence_score: 0.75,
          insights_data: size.insights_data
        })
      }

      if (analysis.bundling) {
        insights.push({
          insight_type: 'bundling_strategy',
          segment_key: 'multi_item',
          optimal_markup_avg: data.bundling_analysis.multi_item.avg_markup,
          acceptance_rate: data.bundling_analysis.multi_item.acceptance_rate,
          sample_size: data.bundling_analysis.multi_item.total,
          confidence_score: 0.85,
          insights_data: analysis.bundling,
          recommendations: analysis.bundling.optimal_strategy
        })
      }

      return {
        insights,
        patterns: analysis.patterns || [],
        recommendations: analysis.recommendations || [],
        customer_segments_count: analysis.customer_segments?.length || 0,
        product_categories_count: analysis.product_categories?.length || 0
      }

    } catch (error: any) {
      console.error('Error analyzing with Claude:', error)
      throw new Error(`Claude analysis failed: ${error.message}`)
    }
  }

  /**
   * Store insights in database
   */
  private async storeInsights(insights: PricingInsight[]): Promise<number> {
    let storedCount = 0

    for (const insight of insights) {
      try {
        const { data: existing } = await this.getSupabase()
          .from('pricing_optimization_insights')
          .select('id')
          .eq('insight_type', insight.insight_type)
          .eq('segment_key', insight.segment_key)
          .single()

        if (existing) {
          await this.getSupabase()
            .from('pricing_optimization_insights')
            .update({
              optimal_markup_min: insight.optimal_markup_min,
              optimal_markup_max: insight.optimal_markup_max,
              optimal_markup_avg: insight.optimal_markup_avg,
              acceptance_rate: insight.acceptance_rate,
              sample_size: insight.sample_size,
              confidence_score: insight.confidence_score,
              insights_data: insight.insights_data,
              patterns: insight.patterns,
              recommendations: insight.recommendations,
              last_analyzed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
        } else {
          await this.getSupabase()
            .from('pricing_optimization_insights')
            .insert({
              insight_type: insight.insight_type,
              segment_key: insight.segment_key,
              optimal_markup_min: insight.optimal_markup_min,
              optimal_markup_max: insight.optimal_markup_max,
              optimal_markup_avg: insight.optimal_markup_avg,
              acceptance_rate: insight.acceptance_rate,
              sample_size: insight.sample_size,
              confidence_score: insight.confidence_score,
              insights_data: insight.insights_data,
              patterns: insight.patterns,
              recommendations: insight.recommendations,
              last_analyzed_at: new Date().toISOString()
            })
        }

        storedCount++
      } catch (error: any) {
        console.error(`Error storing insight for ${insight.segment_key}:`, error)
      }
    }

    return storedCount
  }

  /**
   * Get intelligent pricing recommendation for a quote
   */
  async getIntelligentPricing(params: {
    customerEmail: string
    customerSegment?: string
    products: Array<{
      name: string
      category?: string
      quantity: number
      costPrice: number
    }>
    urgencyLevel?: 'low' | 'medium' | 'high' | 'urgent'
    orderSizeCategory?: 'small' | 'medium' | 'large' | 'enterprise'
  }): Promise<PricingRecommendation> {
    try {
      const customerProfile = await this.getCustomerProfile(params.customerEmail)
      
      const insights = await this.getRelevantInsights({
        customerSegment: params.customerSegment || customerProfile?.segment,
        productCategories: params.products.map(p => p.category).filter(Boolean) as string[],
        urgencyLevel: params.urgencyLevel,
        orderSizeCategory: params.orderSizeCategory
      })

      let baseMarkup = 25
      const adjustments: Array<{ factor: string; adjustment: number; reason: string }> = []

      if (insights.customerSegment && insights.customerSegment.confidence_score > 0.7) {
        baseMarkup = insights.customerSegment.optimal_markup_avg
        adjustments.push({
          factor: 'customer_segment',
          adjustment: insights.customerSegment.optimal_markup_avg - 25,
          reason: `Based on ${insights.customerSegment.segment_key} segment performance (${insights.customerSegment.sample_size} samples, ${(insights.customerSegment.acceptance_rate * 100).toFixed(0)}% acceptance)`
        })
      }

      if (insights.productCategory && insights.productCategory.confidence_score > 0.7) {
        const categoryAdjustment = insights.productCategory.optimal_markup_avg - baseMarkup
        if (Math.abs(categoryAdjustment) > 2) {
          baseMarkup = insights.productCategory.optimal_markup_avg
          adjustments.push({
            factor: 'product_category',
            adjustment: categoryAdjustment,
            reason: `${insights.productCategory.segment_key} category shows ${insights.productCategory.patterns?.price_sensitivity || 'medium'} price sensitivity`
          })
        }
      }

      if (insights.urgency && params.urgencyLevel === 'high' || params.urgencyLevel === 'urgent') {
        const urgencyBoost = insights.urgency.optimal_markup_avg - 25
        if (urgencyBoost > 0) {
          baseMarkup += urgencyBoost * 0.5
          adjustments.push({
            factor: 'urgency',
            adjustment: urgencyBoost * 0.5,
            reason: `${params.urgencyLevel} urgency allows ${urgencyBoost.toFixed(1)}% premium`
          })
        }
      }

      if (insights.orderSize) {
        const sizeAdjustment = insights.orderSize.optimal_markup_avg - 25
        if (sizeAdjustment !== 0) {
          baseMarkup += sizeAdjustment * 0.3
          adjustments.push({
            factor: 'order_size',
            adjustment: sizeAdjustment * 0.3,
            reason: `${params.orderSizeCategory} orders typically ${sizeAdjustment > 0 ? 'support' : 'require'} ${Math.abs(sizeAdjustment).toFixed(1)}% ${sizeAdjustment > 0 ? 'premium' : 'discount'}`
          })
        }
      }

      if (params.products.length > 1 && insights.bundling) {
        const bundlingData = insights.bundling.insights_data
        if (bundlingData?.multi_item_advantage) {
          baseMarkup += 2
          adjustments.push({
            factor: 'bundling',
            adjustment: 2,
            reason: 'Multi-item bundle shows higher acceptance rate'
          })
        }
      }

      if (customerProfile) {
        const historicalMarkup = customerProfile.preferred_markup_range
        if (historicalMarkup && customerProfile.accepted_quotes >= 3) {
          const avgHistorical = (historicalMarkup.min + historicalMarkup.max) / 2
          if (Math.abs(avgHistorical - baseMarkup) > 5) {
            const adjustment = (avgHistorical - baseMarkup) * 0.4
            baseMarkup += adjustment
            adjustments.push({
              factor: 'customer_history',
              adjustment,
              reason: `Customer has ${customerProfile.accepted_quotes} accepted quotes with avg ${avgHistorical.toFixed(1)}% markup`
            })
          }
        }
      }

      const minMarkup = Math.max(15, baseMarkup - 5)
      const maxMarkup = Math.min(50, baseMarkup + 5)

      const avgConfidence = insights.all.reduce((sum, i) => sum + i.confidence_score, 0) / 
        (insights.all.length || 1)
      
      const riskLevel = avgConfidence > 0.8 ? 'low' : avgConfidence > 0.6 ? 'medium' : 'high'

      const reasoning = adjustments.length > 0
        ? `Intelligent pricing based on ${adjustments.length} factors: ${adjustments.map(a => a.factor).join(', ')}`
        : 'Default pricing applied (insufficient historical data)'

      return {
        base_markup: Math.round(baseMarkup * 100) / 100,
        min_markup: Math.round(minMarkup * 100) / 100,
        max_markup: Math.round(maxMarkup * 100) / 100,
        confidence: Math.round(avgConfidence * 100) / 100,
        reasoning,
        adjustments,
        risk_level: riskLevel,
        alternative_strategies: this.generateAlternativeStrategies(baseMarkup, insights)
      }

    } catch (error: any) {
      console.error('Error getting intelligent pricing:', error)
      
      return {
        base_markup: 25,
        min_markup: 20,
        max_markup: 30,
        confidence: 0.5,
        reasoning: 'Fallback pricing due to error: ' + error.message,
        adjustments: [],
        risk_level: 'high',
        alternative_strategies: ['Consider manual review', 'Use category-based defaults']
      }
    }
  }

  /**
   * Get relevant insights for pricing decision
   */
  private async getRelevantInsights(criteria: {
    customerSegment?: string
    productCategories: string[]
    urgencyLevel?: string
    orderSizeCategory?: string
  }): Promise<{
    customerSegment?: PricingInsight
    productCategory?: PricingInsight
    urgency?: PricingInsight
    orderSize?: PricingInsight
    bundling?: PricingInsight
    all: PricingInsight[]
  }> {
    const insights: PricingInsight[] = []

    if (criteria.customerSegment) {
      const { data } = await this.getSupabase()
        .from('pricing_optimization_insights')
        .select('*')
        .eq('insight_type', 'customer_segment')
        .eq('segment_key', criteria.customerSegment)
        .single()
      
      if (data) insights.push(data as PricingInsight)
    }

    if (criteria.productCategories.length > 0) {
      for (const category of criteria.productCategories) {
        const { data } = await this.getSupabase()
          .from('pricing_optimization_insights')
          .select('*')
          .eq('insight_type', 'product_category')
          .eq('segment_key', category)
          .single()
        
        if (data) insights.push(data as PricingInsight)
      }
    }

    if (criteria.urgencyLevel) {
      const { data } = await this.getSupabase()
        .from('pricing_optimization_insights')
        .select('*')
        .eq('insight_type', 'urgency_level')
        .eq('segment_key', criteria.urgencyLevel)
        .single()
      
      if (data) insights.push(data as PricingInsight)
    }

    if (criteria.orderSizeCategory) {
      const { data } = await this.getSupabase()
        .from('pricing_optimization_insights')
        .select('*')
        .eq('insight_type', 'order_size')
        .eq('segment_key', criteria.orderSizeCategory)
        .single()
      
      if (data) insights.push(data as PricingInsight)
    }

    const { data: bundling } = await this.getSupabase()
      .from('pricing_optimization_insights')
      .select('*')
      .eq('insight_type', 'bundling_strategy')
      .single()

    if (bundling) insights.push(bundling as PricingInsight)

    return {
      customerSegment: insights.find(i => i.insight_type === 'customer_segment'),
      productCategory: insights.find(i => i.insight_type === 'product_category'),
      urgency: insights.find(i => i.insight_type === 'urgency_level'),
      orderSize: insights.find(i => i.insight_type === 'order_size'),
      bundling: insights.find(i => i.insight_type === 'bundling_strategy'),
      all: insights
    }
  }

  /**
   * Get customer profile with pricing preferences
   */
  private async getCustomerProfile(email: string): Promise<CustomerProfile | null> {
    try {
      const { data: outcomes } = await this.getSupabase()
        .from('quote_outcomes')
        .select('*')
        .eq('customer_email', email)
        .order('outcome_date', { ascending: false })

      if (!outcomes || outcomes.length === 0) {
        return null
      }

      const accepted = outcomes.filter(o => o.outcome === 'accepted')
      const acceptedMarkups = accepted.flatMap(o => 
        o.items.filter(i => i.markup_percentage).map(i => i.markup_percentage!)
      )

      const profile: CustomerProfile = {
        email,
        name: outcomes[0].customer_name,
        segment: outcomes[0].customer_segment,
        total_quotes: outcomes.length,
        accepted_quotes: accepted.length,
        acceptance_rate: accepted.length / outcomes.length,
        avg_order_value: accepted.reduce((sum, o) => sum + o.total_quoted_amount, 0) / 
          (accepted.length || 1),
        price_sensitivity: this.determinePriceSensitivity(outcomes),
        response_patterns: {
          avg_response_time: outcomes
            .filter(o => o.response_time_hours)
            .reduce((sum, o) => sum + (o.response_time_hours || 0), 0) / 
            outcomes.filter(o => o.response_time_hours).length
        }
      }

      if (acceptedMarkups.length > 0) {
        profile.preferred_markup_range = {
          min: Math.min(...acceptedMarkups),
          max: Math.max(...acceptedMarkups)
        }
      }

      return profile
    } catch (error: any) {
      console.error(`Error getting customer profile for ${email}:`, error)
      return null
    }
  }

  /**
   * Determine price sensitivity from outcomes
   */
  private determinePriceSensitivity(outcomes: QuoteOutcome[]): 'low' | 'medium' | 'high' {
    const rejected = outcomes.filter(o => o.outcome === 'rejected')
    const priceRelatedRejections = rejected.filter(o => 
      o.rejection_reason?.toLowerCase().includes('price') ||
      o.rejection_reason?.toLowerCase().includes('cost') ||
      o.rejection_reason?.toLowerCase().includes('expensive')
    )

    const priceRejectionRate = priceRelatedRejections.length / outcomes.length

    if (priceRejectionRate > 0.3) return 'high'
    if (priceRejectionRate > 0.15) return 'medium'
    return 'low'
  }

  /**
   * Generate alternative pricing strategies
   */
  private generateAlternativeStrategies(baseMarkup: number, insights: any): string[] {
    const strategies: string[] = []

    if (baseMarkup > 30) {
      strategies.push(`Conservative: ${(baseMarkup - 5).toFixed(1)}% markup for higher acceptance probability`)
    }

    if (baseMarkup < 35) {
      strategies.push(`Aggressive: ${(baseMarkup + 5).toFixed(1)}% markup for higher margins`)
    }

    if (insights.bundling?.insights_data?.multi_item_advantage) {
      strategies.push('Bundle discount: Offer 3-5% discount on total to encourage multi-item purchase')
    }

    strategies.push('Volume pricing: Offer tiered discounts for larger quantities')

    return strategies
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

export const quotePricingIntelligence = new QuotePricingIntelligence()
