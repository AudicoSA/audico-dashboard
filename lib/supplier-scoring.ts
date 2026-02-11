/**
 * Supplier Relationship Scoring System
 * 
 * Calculates and tracks supplier performance metrics:
 * - relationship_strength: Score based on email frequency, response rate, successful orders, tenure
 * - reliability_score: Score based on quote accuracy, on-time delivery, stock availability
 * - avg_response_time_hours: Average time to respond to emails
 * 
 * Identifies deteriorating relationships and new supplier opportunities
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface SupplierScoreData {
  id: string
  email: string
  company: string
  relationship_strength: number
  reliability_score: number | null
  avg_response_time_hours: number | null
  created_at: string
}

interface SupplierInteraction {
  id: string
  supplier_id: string
  interaction_type: string
  created_at: string
  email_log: {
    created_at: string
    from_email: string
  }
}

interface EmailInteractionWithSupplier {
  email_log_id: string
  supplier_id: string | null
  interaction_type: string
  products_mentioned: string[]
  created_at: string
  extracted_at: string
}

interface SupplierProduct {
  id: string
  supplier_id: string
  last_quoted_price: number | null
  stock_reliability: string
}

interface ScoreChangeAlert {
  supplier_id: string
  supplier_name: string
  supplier_company: string
  old_score: number
  new_score: number
  score_drop: number
}

interface NewSupplierOpportunity {
  product_name: string
  email_from: string
  mention_count: number
  recent_mentions: string[]
}

export class SupplierScoringService {
  private supabase: SupabaseClient | null = null
  private agentName = 'SupplierScoringAgent'

  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      this.supabase = createClient(supabaseUrl, supabaseKey)
    }
    return this.supabase
  }

  /**
   * Main weekly cron job function to update all supplier scores
   */
  async updateSupplierScores(): Promise<{
    success: boolean
    suppliers_updated: number
    alerts_created: number
    opportunities_found: number
    error?: string
  }> {
    try {
      await this.logToSquad('Starting weekly supplier scoring update')

      // Get all suppliers
      const { data: suppliers, error: suppliersError } = await this.getSupabase()
        .from('suppliers')
        .select('id, email, company, name, relationship_strength, reliability_score, avg_response_time_hours, created_at')

      if (suppliersError) {
        throw new Error(`Failed to fetch suppliers: ${suppliersError.message}`)
      }

      let suppliersUpdated = 0
      const scoreChangeAlerts: ScoreChangeAlert[] = []

      // Update scores for each supplier
      for (const supplier of suppliers || []) {
        const oldRelationshipScore = supplier.relationship_strength
        const oldReliabilityScore = supplier.reliability_score

        // Calculate relationship strength
        const relationshipStrength = await this.calculateRelationshipStrength(supplier.id, supplier.created_at)

        // Calculate reliability score
        const reliabilityScore = await this.calculateReliabilityScore(supplier.id)

        // Calculate average response time
        const avgResponseTimeHours = await this.calculateAvgResponseTime(supplier.id)

        // Update supplier record
        const { error: updateError } = await this.getSupabase()
          .from('suppliers')
          .update({
            relationship_strength: relationshipStrength,
            reliability_score: reliabilityScore,
            avg_response_time_hours: avgResponseTimeHours,
            updated_at: new Date().toISOString()
          })
          .eq('id', supplier.id)

        if (updateError) {
          console.error(`Failed to update supplier ${supplier.id}:`, updateError)
          continue
        }

        suppliersUpdated++

        // Check for deteriorating relationships (score drop > 10 points)
        if (oldRelationshipScore && relationshipStrength < oldRelationshipScore - 10) {
          scoreChangeAlerts.push({
            supplier_id: supplier.id,
            supplier_name: supplier.name,
            supplier_company: supplier.company,
            old_score: oldRelationshipScore,
            new_score: relationshipStrength,
            score_drop: oldRelationshipScore - relationshipStrength
          })
        }
      }

      // Create tasks for deteriorating relationships
      for (const alert of scoreChangeAlerts) {
        await this.createDeterioratingRelationshipTask(alert)
      }

      // Find new supplier opportunities
      const opportunities = await this.findNewSupplierOpportunities()

      // Log opportunities
      for (const opp of opportunities) {
        await this.logNewSupplierOpportunity(opp)
      }

      await this.logToSquad(
        `Supplier scoring completed: ${suppliersUpdated} suppliers updated, ${scoreChangeAlerts.length} alerts created, ${opportunities.length} new opportunities found`,
        {
          suppliers_updated: suppliersUpdated,
          alerts_created: scoreChangeAlerts.length,
          opportunities_found: opportunities.length
        }
      )

      return {
        success: true,
        suppliers_updated: suppliersUpdated,
        alerts_created: scoreChangeAlerts.length,
        opportunities_found: opportunities.length
      }

    } catch (error: any) {
      console.error('Error updating supplier scores:', error)
      await this.logToSquad(`Supplier scoring failed: ${error.message}`, { error: error.message })
      
      return {
        success: false,
        suppliers_updated: 0,
        alerts_created: 0,
        opportunities_found: 0,
        error: error.message
      }
    }
  }

  /**
   * Calculate relationship strength score (0-100)
   * Based on:
   * - Email frequency (40%)
   * - Response rate (30%)
   * - Successful orders (20%)
   * - Time working together (10%)
   */
  private async calculateRelationshipStrength(supplierId: string, supplierCreatedAt: string): Promise<number> {
    // Get email interactions in last 90 days
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { data: interactions, error } = await this.getSupabase()
      .from('email_supplier_interactions')
      .select('id, interaction_type, created_at')
      .eq('supplier_id', supplierId)
      .gte('created_at', ninetyDaysAgo.toISOString())

    if (error) {
      console.error(`Error fetching interactions for supplier ${supplierId}:`, error)
      return 50 // Default score
    }

    const totalInteractions = interactions?.length || 0

    // 1. Email Frequency Score (40 points)
    // 0-5 emails = 0-10, 6-15 = 11-25, 16-30 = 26-35, 31+ = 36-40
    let emailFrequencyScore = 0
    if (totalInteractions === 0) {
      emailFrequencyScore = 0
    } else if (totalInteractions <= 5) {
      emailFrequencyScore = totalInteractions * 2
    } else if (totalInteractions <= 15) {
      emailFrequencyScore = 10 + ((totalInteractions - 5) * 1.5)
    } else if (totalInteractions <= 30) {
      emailFrequencyScore = 25 + ((totalInteractions - 15) * 0.67)
    } else {
      emailFrequencyScore = Math.min(40, 35 + ((totalInteractions - 30) * 0.1))
    }

    // 2. Response Rate Score (30 points)
    const quoteRequests = interactions?.filter(i => i.interaction_type === 'quote_request').length || 0
    const quoteResponses = interactions?.filter(i => i.interaction_type === 'quote_response').length || 0
    
    let responseRateScore = 0
    if (quoteRequests > 0) {
      const responseRate = quoteResponses / quoteRequests
      responseRateScore = Math.round(responseRate * 30)
    } else {
      // If no quote requests, give neutral score
      responseRateScore = 15
    }

    // 3. Successful Orders Score (20 points)
    const orderInteractions = interactions?.filter(i => i.interaction_type === 'order_placement').length || 0
    let orderScore = 0
    if (orderInteractions === 0) {
      orderScore = 0
    } else if (orderInteractions <= 3) {
      orderScore = orderInteractions * 5
    } else {
      orderScore = Math.min(20, 15 + ((orderInteractions - 3) * 1))
    }

    // 4. Tenure Score (10 points)
    const daysSinceCreated = Math.floor(
      (new Date().getTime() - new Date(supplierCreatedAt).getTime()) / (1000 * 60 * 60 * 24)
    )
    let tenureScore = 0
    if (daysSinceCreated < 30) {
      tenureScore = 2
    } else if (daysSinceCreated < 90) {
      tenureScore = 4
    } else if (daysSinceCreated < 180) {
      tenureScore = 6
    } else if (daysSinceCreated < 365) {
      tenureScore = 8
    } else {
      tenureScore = 10
    }

    const totalScore = Math.round(emailFrequencyScore + responseRateScore + orderScore + tenureScore)
    return Math.min(100, Math.max(0, totalScore))
  }

  /**
   * Calculate reliability score (0-100)
   * Based on:
   * - Quote accuracy (40%)
   * - Stock availability accuracy (30%)
   * - On-time delivery rate (30%)
   */
  private async calculateReliabilityScore(supplierId: string): Promise<number | null> {
    // Get supplier products
    const { data: products, error: productsError } = await this.getSupabase()
      .from('supplier_products')
      .select('id, last_quoted_price, stock_reliability')
      .eq('supplier_id', supplierId)

    if (productsError || !products || products.length === 0) {
      return null // Not enough data to calculate
    }

    // Get quote interactions
    const { data: quoteInteractions, error: quoteError } = await this.getSupabase()
      .from('email_supplier_interactions')
      .select('pricing_data')
      .eq('supplier_id', supplierId)
      .eq('interaction_type', 'quote_response')
      .not('pricing_data', 'is', null)

    if (quoteError) {
      return null
    }

    // 1. Quote Accuracy Score (40 points)
    // Comparing quoted prices with actual prices (variance < 5% = good)
    let quoteAccuracyScore = 40 // Start with full points
    let totalQuoteVariance = 0
    let quoteComparisonCount = 0

    for (const interaction of quoteInteractions || []) {
      if (interaction.pricing_data && typeof interaction.pricing_data === 'object') {
        for (const [productName, priceInfo] of Object.entries(interaction.pricing_data)) {
          const unitPrice = (priceInfo as any).unit_price
          if (unitPrice) {
            const matchingProduct = products.find(p => 
              p.last_quoted_price && 
              Math.abs(p.last_quoted_price - unitPrice) / p.last_quoted_price < 0.2
            )
            
            if (matchingProduct && matchingProduct.last_quoted_price) {
              const variance = Math.abs(matchingProduct.last_quoted_price - unitPrice) / matchingProduct.last_quoted_price
              totalQuoteVariance += variance
              quoteComparisonCount++
            }
          }
        }
      }
    }

    if (quoteComparisonCount > 0) {
      const avgVariance = totalQuoteVariance / quoteComparisonCount
      if (avgVariance > 0.15) {
        quoteAccuracyScore = 10 // Poor accuracy
      } else if (avgVariance > 0.10) {
        quoteAccuracyScore = 20 // Fair accuracy
      } else if (avgVariance > 0.05) {
        quoteAccuracyScore = 30 // Good accuracy
      } else {
        quoteAccuracyScore = 40 // Excellent accuracy
      }
    }

    // 2. Stock Availability Accuracy Score (30 points)
    const stockReliability = {
      always_in_stock: 30,
      usually_available: 20,
      often_delayed: 10,
      unreliable: 0
    }

    let stockScore = 0
    let stockCount = 0
    for (const product of products) {
      if (product.stock_reliability) {
        stockScore += stockReliability[product.stock_reliability as keyof typeof stockReliability] || 15
        stockCount++
      }
    }
    const avgStockScore = stockCount > 0 ? Math.round(stockScore / stockCount) : 15

    // 3. On-time Delivery Rate (30 points)
    // We don't have delivery tracking yet, so use a neutral score based on order count
    const { data: orderInteractions } = await this.getSupabase()
      .from('email_supplier_interactions')
      .select('id')
      .eq('supplier_id', supplierId)
      .eq('interaction_type', 'order_placement')

    const orderCount = orderInteractions?.length || 0
    let deliveryScore = 15 // Default neutral score
    
    if (orderCount > 10) {
      deliveryScore = 30 // Assume good if many orders
    } else if (orderCount > 5) {
      deliveryScore = 25
    } else if (orderCount > 0) {
      deliveryScore = 20
    }

    const totalScore = quoteAccuracyScore + avgStockScore + deliveryScore
    return Math.min(100, Math.max(0, totalScore))
  }

  /**
   * Calculate average response time in hours
   */
  private async calculateAvgResponseTime(supplierId: string): Promise<number | null> {
    // Get quote request and response pairs from last 90 days
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { data: interactions, error } = await this.getSupabase()
      .from('email_supplier_interactions')
      .select(`
        id,
        interaction_type,
        created_at,
        email_log:email_logs!email_supplier_interactions_email_log_id_fkey(
          created_at,
          gmail_message_id
        )
      `)
      .eq('supplier_id', supplierId)
      .gte('created_at', ninetyDaysAgo.toISOString())
      .order('created_at', { ascending: true })

    if (error || !interactions || interactions.length === 0) {
      return null
    }

    const responseTimes: number[] = []
    let lastRequestTime: Date | null = null

    for (const interaction of interactions) {
      if (interaction.interaction_type === 'quote_request' || interaction.interaction_type === 'stock_inquiry') {
        lastRequestTime = new Date((interaction.email_log as any)?.created_at || interaction.created_at)
      } else if (interaction.interaction_type === 'quote_response' && lastRequestTime) {
        const responseTime = new Date((interaction.email_log as any)?.created_at || interaction.created_at)
        const hoursDiff = (responseTime.getTime() - lastRequestTime.getTime()) / (1000 * 60 * 60)
        
        if (hoursDiff > 0 && hoursDiff < 168) { // Within a week
          responseTimes.push(hoursDiff)
        }
        lastRequestTime = null
      }
    }

    if (responseTimes.length === 0) {
      return null
    }

    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    return Math.round(avgResponseTime * 100) / 100
  }

  /**
   * Create task for deteriorating supplier relationship
   */
  private async createDeterioratingRelationshipTask(alert: ScoreChangeAlert): Promise<void> {
    try {
      const { data: task, error: taskError } = await this.getSupabase()
        .from('squad_tasks')
        .insert({
          title: `⚠️ Supplier Relationship Deteriorating: ${alert.supplier_company}`,
          description: `The relationship score for **${alert.supplier_company}** has dropped significantly.

**Score Change:**
- Previous Score: ${alert.old_score}/100
- Current Score: ${alert.new_score}/100
- Drop: ${alert.score_drop} points

**Recommended Actions:**
1. Review recent email communications
2. Check for unresolved issues or complaints
3. Reach out to supplier contact to assess relationship health
4. Consider scheduling a call or meeting
5. Review pricing and terms to ensure competitiveness

This may indicate:
- Reduced communication frequency
- Lower response rates to requests
- Potential issues with recent orders
- Need for relationship maintenance

Please review and take appropriate action to restore the relationship.`,
          status: 'new',
          assigned_agent: 'Kenny',
          priority: 'high',
          mentions_kenny: true,
          metadata: {
            supplier_id: alert.supplier_id,
            supplier_company: alert.supplier_company,
            old_score: alert.old_score,
            new_score: alert.new_score,
            score_drop: alert.score_drop,
            alert_type: 'relationship_deterioration',
            created_by_agent: this.agentName
          }
        })
        .select()
        .single()

      if (taskError) {
        throw taskError
      }

      // Log to squad messages
      await this.getSupabase()
        .from('squad_messages')
        .insert({
          from_agent: this.agentName,
          to_agent: 'Kenny',
          message: `@Kenny - Supplier relationship alert: ${alert.supplier_company} score dropped ${alert.score_drop} points (${alert.old_score} → ${alert.new_score})`,
          task_id: task.id,
          data: {
            supplier_id: alert.supplier_id,
            supplier_company: alert.supplier_company,
            score_drop: alert.score_drop,
            action: 'relationship_alert',
            timestamp: new Date().toISOString()
          }
        })

    } catch (error: any) {
      console.error('Error creating deteriorating relationship task:', error)
    }
  }

  /**
   * Find new supplier opportunities from emails with recurring product mentions
   * but no supplier mapping
   */
  private async findNewSupplierOpportunities(): Promise<NewSupplierOpportunity[]> {
    try {
      // Get emails from last 60 days
      const sixtyDaysAgo = new Date()
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

      // Get all email interactions
      const { data: allInteractions, error: interactionsError } = await this.getSupabase()
        .from('email_supplier_interactions')
        .select('email_log_id, supplier_id, products_mentioned, created_at')
        .gte('created_at', sixtyDaysAgo.toISOString())

      if (interactionsError || !allInteractions) {
        return []
      }

      // Get emails with no supplier mapping
      const { data: unmappedEmailLogs, error: emailsError } = await this.getSupabase()
        .from('email_logs')
        .select('id, from_email, subject, created_at')
        .gte('created_at', sixtyDaysAgo.toISOString())
        .in('category', ['supplier_communication', 'quote_inquiry', 'product_inquiry'])

      if (emailsError || !unmappedEmailLogs) {
        return []
      }

      const unmappedEmailIds = unmappedEmailLogs.map(e => e.id)
      const unmappedInteractions = allInteractions.filter(i => 
        unmappedEmailIds.includes(i.email_log_id) && !i.supplier_id
      )

      // Aggregate product mentions by email sender
      const productMentionsByEmail: Map<string, Map<string, number>> = new Map()
      const emailInfo: Map<string, any> = new Map()

      for (const interaction of unmappedInteractions) {
        const emailLog = unmappedEmailLogs.find(e => e.id === interaction.email_log_id)
        if (!emailLog) continue

        const fromEmail = emailLog.from_email

        if (!productMentionsByEmail.has(fromEmail)) {
          productMentionsByEmail.set(fromEmail, new Map())
          emailInfo.set(fromEmail, emailLog)
        }

        const productMap = productMentionsByEmail.get(fromEmail)!
        
        for (const product of interaction.products_mentioned || []) {
          if (product) {
            productMap.set(product, (productMap.get(product) || 0) + 1)
          }
        }
      }

      // Find opportunities (products mentioned 3+ times from same email)
      const opportunities: NewSupplierOpportunity[] = []

      Array.from(productMentionsByEmail.entries()).forEach(([fromEmail, productMap]) => {
        Array.from(productMap.entries()).forEach(([productName, count]) => {
          if (count >= 3) {
            opportunities.push({
              product_name: productName,
              email_from: fromEmail,
              mention_count: count,
              recent_mentions: [emailInfo.get(fromEmail)?.subject || 'No subject']
            })
          }
        })
      })

      return opportunities

    } catch (error: any) {
      console.error('Error finding new supplier opportunities:', error)
      return []
    }
  }

  /**
   * Log new supplier opportunity to squad messages
   */
  private async logNewSupplierOpportunity(opportunity: NewSupplierOpportunity): Promise<void> {
    try {
      await this.getSupabase()
        .from('squad_messages')
        .insert({
          from_agent: this.agentName,
          to_agent: null,
          message: `💡 New supplier opportunity detected: "${opportunity.product_name}" mentioned ${opportunity.mention_count} times in emails from ${opportunity.email_from}. Consider adding as supplier.`,
          task_id: null,
          data: {
            opportunity_type: 'new_supplier',
            product_name: opportunity.product_name,
            email_from: opportunity.email_from,
            mention_count: opportunity.mention_count,
            recent_mentions: opportunity.recent_mentions,
            timestamp: new Date().toISOString()
          }
        })
    } catch (error: any) {
      console.error('Error logging new supplier opportunity:', error)
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

export const supplierScoringService = new SupplierScoringService()
