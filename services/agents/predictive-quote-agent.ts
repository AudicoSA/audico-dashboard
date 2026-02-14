import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface CustomerInteraction {
  id: string
  customer_email: string
  interaction_type: string
  interaction_date: string
  subject: string | null
  summary: string | null
  sentiment: string | null
  details: any
}

interface PurchaseHistoryItem {
  customer_email: string
  order_date: string
  products: string[]
  total_amount: number
  category: string | null
}

interface EmailPattern {
  customer_email: string
  avg_response_time_hours: number
  inquiry_frequency: number
  preferred_contact_day: string | null
  last_inquiry_date: string | null
  topics_discussed: string[]
}

interface SeasonalTrend {
  product_category: string
  month: number
  avg_orders: number
  peak_probability: number
}

interface PredictedProduct {
  product_name: string
  category: string
  confidence: number
  reasoning: string
}

interface PredictiveQuoteOpportunity {
  customer_email: string
  customer_name: string | null
  predicted_products: PredictedProduct[]
  confidence_score: number
  trigger_reason: 'repeat_purchase_due' | 'seasonal_opportunity' | 'product_interest_detected' | 'competitor_mention'
  suggested_discount: number
  priority: 'low' | 'medium' | 'high' | 'urgent'
  metadata: {
    last_purchase_date: string | null
    avg_order_value: number
    purchase_frequency_days: number | null
    interaction_signals: string[]
    seasonal_factors: any[]
    competitor_mentions: string[]
    next_expected_purchase: string | null
  }
}

export class PredictiveQuoteAgent {
  private supabase: SupabaseClient
  private agentName = 'PredictiveQuoteAgent'

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  async scoreAllCustomers(): Promise<{
    success: boolean
    opportunities_found: number
    high_confidence_count: number
    medium_confidence_count: number
    tasks_created: number
    quotes_generated: number
    error?: string
  }> {
    try {
      await this.logToSquad('🔮 Starting predictive quote opportunity analysis')

      const customers = await this.getActiveCustomers()
      const opportunities: PredictiveQuoteOpportunity[] = []

      for (const customer of customers) {
        const opportunity = await this.analyzeCustomerOpportunity(customer.email)
        
        if (opportunity && opportunity.confidence_score > 0.5) {
          opportunities.push(opportunity)
        }
      }

      await this.logToSquad(
        `📊 Analyzed ${customers.length} customers, found ${opportunities.length} opportunities`,
        { total_customers: customers.length, opportunities_found: opportunities.length }
      )

      const stored = await this.storeOpportunities(opportunities)

      const highConfidence = opportunities.filter(o => o.confidence_score > 0.8)
      const mediumConfidence = opportunities.filter(o => o.confidence_score >= 0.6 && o.confidence_score <= 0.8)

      let tasksCreated = 0
      let quotesGenerated = 0

      for (const opportunity of highConfidence) {
        const generated = await this.generateProactiveQuote(opportunity)
        if (generated) quotesGenerated++
      }

      for (const opportunity of mediumConfidence) {
        const taskCreated = await this.createReviewTask(opportunity)
        if (taskCreated) tasksCreated++
      }

      await this.logToSquad(
        `✅ Predictive quote analysis complete: ${quotesGenerated} quotes generated, ${tasksCreated} review tasks created`,
        {
          high_confidence: highConfidence.length,
          medium_confidence: mediumConfidence.length,
          quotes_generated: quotesGenerated,
          tasks_created: tasksCreated
        }
      )

      return {
        success: true,
        opportunities_found: opportunities.length,
        high_confidence_count: highConfidence.length,
        medium_confidence_count: mediumConfidence.length,
        tasks_created: tasksCreated,
        quotes_generated: quotesGenerated
      }

    } catch (error: any) {
      console.error('Error in predictive quote analysis:', error)
      await this.logToSquad(`❌ Predictive quote analysis failed: ${error.message}`)
      
      return {
        success: false,
        opportunities_found: 0,
        high_confidence_count: 0,
        medium_confidence_count: 0,
        tasks_created: 0,
        quotes_generated: 0,
        error: error.message
      }
    }
  }

  private async getActiveCustomers(): Promise<Array<{ email: string; name: string | null }>> {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const { data: interactions, error } = await this.supabase
      .from('customer_interactions')
      .select('customer_email, customer_name')
      .gte('interaction_date', sixMonthsAgo.toISOString())
      .not('customer_email', 'is', null)

    if (error) {
      console.error('Error fetching active customers:', error)
      return []
    }

    const uniqueCustomers = new Map<string, string | null>()
    interactions?.forEach(i => {
      if (i.customer_email && !uniqueCustomers.has(i.customer_email)) {
        uniqueCustomers.set(i.customer_email, i.customer_name)
      }
    })

    return Array.from(uniqueCustomers.entries()).map(([email, name]) => ({ email, name }))
  }

  private async analyzeCustomerOpportunity(customerEmail: string): Promise<PredictiveQuoteOpportunity | null> {
    try {
      const [interactions, purchaseHistory, emailPatterns] = await Promise.all([
        this.getCustomerInteractions(customerEmail),
        this.getPurchaseHistory(customerEmail),
        this.analyzeEmailPatterns(customerEmail)
      ])

      if (interactions.length === 0 && purchaseHistory.length === 0) {
        return null
      }

      const repeatPurchaseSignal = this.detectRepeatPurchaseOpportunity(purchaseHistory)
      const seasonalSignal = await this.detectSeasonalOpportunity(purchaseHistory)
      const interestSignal = this.detectProductInterest(interactions)
      const competitorSignal = this.detectCompetitorMentions(interactions)

      let maxSignal = repeatPurchaseSignal
      let triggerReason: PredictiveQuoteOpportunity['trigger_reason'] = 'repeat_purchase_due'

      if (seasonalSignal.confidence > maxSignal.confidence) {
        maxSignal = seasonalSignal
        triggerReason = 'seasonal_opportunity'
      }
      if (interestSignal.confidence > maxSignal.confidence) {
        maxSignal = interestSignal
        triggerReason = 'product_interest_detected'
      }
      if (competitorSignal.confidence > maxSignal.confidence) {
        maxSignal = competitorSignal
        triggerReason = 'competitor_mention'
      }

      if (maxSignal.confidence < 0.5) {
        return null
      }

      const customerName = interactions[0]?.customer_name || purchaseHistory[0]?.customer_name || null
      const avgOrderValue = purchaseHistory.length > 0
        ? purchaseHistory.reduce((sum, p) => sum + p.total_amount, 0) / purchaseHistory.length
        : 0

      const lastPurchase = purchaseHistory.length > 0 
        ? new Date(purchaseHistory[0].order_date)
        : null

      const purchaseFrequency = this.calculatePurchaseFrequency(purchaseHistory)
      const nextExpectedPurchase = lastPurchase && purchaseFrequency
        ? new Date(lastPurchase.getTime() + purchaseFrequency * 24 * 60 * 60 * 1000)
        : null

      const priority = this.determinePriority(maxSignal.confidence, avgOrderValue, triggerReason)
      const suggestedDiscount = this.calculateSuggestedDiscount(
        purchaseHistory.length,
        avgOrderValue,
        maxSignal.confidence
      )

      return {
        customer_email: customerEmail,
        customer_name: customerName,
        predicted_products: maxSignal.products,
        confidence_score: maxSignal.confidence,
        trigger_reason: triggerReason,
        suggested_discount: suggestedDiscount,
        priority,
        metadata: {
          last_purchase_date: lastPurchase?.toISOString() || null,
          avg_order_value: avgOrderValue,
          purchase_frequency_days: purchaseFrequency,
          interaction_signals: maxSignal.signals,
          seasonal_factors: maxSignal.seasonal_factors || [],
          competitor_mentions: competitorSignal.competitor_names,
          next_expected_purchase: nextExpectedPurchase?.toISOString() || null
        }
      }

    } catch (error) {
      console.error(`Error analyzing opportunity for ${customerEmail}:`, error)
      return null
    }
  }

  private async getCustomerInteractions(customerEmail: string): Promise<any[]> {
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

    const { data, error } = await this.supabase
      .from('customer_interactions')
      .select('*')
      .eq('customer_email', customerEmail)
      .gte('interaction_date', threeMonthsAgo.toISOString())
      .order('interaction_date', { ascending: false })

    if (error) {
      console.error('Error fetching customer interactions:', error)
      return []
    }

    return data || []
  }

  private async getPurchaseHistory(customerEmail: string): Promise<any[]> {
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const { data, error } = await this.supabase
      .from('quote_outcomes')
      .select('*')
      .eq('customer_email', customerEmail)
      .eq('outcome', 'accepted')
      .gte('outcome_date', oneYearAgo.toISOString())
      .order('outcome_date', { ascending: false })

    if (error) {
      console.error('Error fetching purchase history:', error)
      return []
    }

    return data || []
  }

  private async analyzeEmailPatterns(customerEmail: string): Promise<EmailPattern | null> {
    const { data: interactions } = await this.supabase
      .from('customer_interactions')
      .select('*')
      .eq('customer_email', customerEmail)
      .eq('interaction_type', 'email')
      .order('interaction_date', { ascending: false })
      .limit(20)

    if (!interactions || interactions.length === 0) return null

    const topics = new Set<string>()
    interactions.forEach(i => {
      if (i.subject) topics.add(i.subject.toLowerCase())
    })

    return {
      customer_email: customerEmail,
      avg_response_time_hours: 24,
      inquiry_frequency: interactions.length,
      preferred_contact_day: null,
      last_inquiry_date: interactions[0]?.interaction_date || null,
      topics_discussed: Array.from(topics)
    }
  }

  private detectRepeatPurchaseOpportunity(purchaseHistory: any[]): {
    confidence: number
    products: PredictedProduct[]
    signals: string[]
    seasonal_factors: any[]
    competitor_names: string[]
  } {
    if (purchaseHistory.length < 2) {
      return { confidence: 0, products: [], signals: [], seasonal_factors: [], competitor_names: [] }
    }

    const sortedPurchases = [...purchaseHistory].sort(
      (a, b) => new Date(b.outcome_date).getTime() - new Date(a.outcome_date).getTime()
    )

    const lastPurchase = new Date(sortedPurchases[0].outcome_date)
    const avgFrequency = this.calculatePurchaseFrequency(purchaseHistory)
    
    if (!avgFrequency) {
      return { confidence: 0, products: [], signals: [], seasonal_factors: [], competitor_names: [] }
    }

    const daysSinceLastPurchase = (Date.now() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24)
    const duenessFactor = Math.min(daysSinceLastPurchase / avgFrequency, 1.5)
    
    let confidence = 0
    if (duenessFactor >= 0.9 && duenessFactor <= 1.2) {
      confidence = 0.85
    } else if (duenessFactor >= 0.8 && duenessFactor <= 1.3) {
      confidence = 0.70
    } else if (duenessFactor >= 0.7) {
      confidence = 0.55
    }

    const productFrequency = new Map<string, number>()
    sortedPurchases.slice(0, 3).forEach(purchase => {
      purchase.quoted_products?.forEach((p: any) => {
        const name = p.product_name || p.name
        productFrequency.set(name, (productFrequency.get(name) || 0) + 1)
      })
    })

    const products: PredictedProduct[] = Array.from(productFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        product_name: name,
        category: this.categorizeProduct(name),
        confidence: count / Math.min(3, purchaseHistory.length),
        reasoning: `Purchased ${count} times in recent orders`
      }))

    const signals = [
      `${daysSinceLastPurchase.toFixed(0)} days since last purchase`,
      `Average purchase frequency: ${avgFrequency.toFixed(0)} days`,
      `${purchaseHistory.length} purchases in last 12 months`
    ]

    return { confidence, products, signals, seasonal_factors: [], competitor_names: [] }
  }

  private async detectSeasonalOpportunity(purchaseHistory: any[]): Promise<{
    confidence: number
    products: PredictedProduct[]
    signals: string[]
    seasonal_factors: any[]
    competitor_names: string[]
  }> {
    if (purchaseHistory.length === 0) {
      return { confidence: 0, products: [], signals: [], seasonal_factors: [], competitor_names: [] }
    }

    const currentMonth = new Date().getMonth() + 1
    const monthlyPurchases = new Map<number, number>()
    const monthlyProducts = new Map<number, Set<string>>()

    purchaseHistory.forEach(purchase => {
      const month = new Date(purchase.outcome_date).getMonth() + 1
      monthlyPurchases.set(month, (monthlyPurchases.get(month) || 0) + 1)
      
      if (!monthlyProducts.has(month)) {
        monthlyProducts.set(month, new Set())
      }
      
      purchase.quoted_products?.forEach((p: any) => {
        monthlyProducts.get(month)!.add(p.product_name || p.name)
      })
    })

    const currentMonthPurchases = monthlyPurchases.get(currentMonth) || 0
    const avgMonthlyPurchases = Array.from(monthlyPurchases.values()).reduce((a, b) => a + b, 0) / monthlyPurchases.size

    if (currentMonthPurchases < avgMonthlyPurchases * 0.5) {
      return { confidence: 0, products: [], signals: [], seasonal_factors: [], competitor_names: [] }
    }

    const confidence = Math.min(currentMonthPurchases / avgMonthlyPurchases, 1) * 0.75

    const seasonalProducts = monthlyProducts.get(currentMonth) || new Set()
    const products: PredictedProduct[] = Array.from(seasonalProducts).slice(0, 5).map(name => ({
      product_name: name,
      category: this.categorizeProduct(name),
      confidence: confidence,
      reasoning: `Historically purchased in ${this.getMonthName(currentMonth)}`
    }))

    const signals = [
      `${currentMonthPurchases} purchases in ${this.getMonthName(currentMonth)} historically`,
      `Seasonal pattern detected`
    ]

    const seasonal_factors = [{
      month: currentMonth,
      purchase_count: currentMonthPurchases,
      avg_monthly: avgMonthlyPurchases
    }]

    return { confidence, products, signals, seasonal_factors, competitor_names: [] }
  }

  private detectProductInterest(interactions: any[]): {
    confidence: number
    products: PredictedProduct[]
    signals: string[]
    seasonal_factors: any[]
    competitor_names: string[]
  } {
    const recentInquiries = interactions.filter(i => 
      i.interaction_type === 'inquiry' || i.interaction_type === 'email'
    )

    if (recentInquiries.length === 0) {
      return { confidence: 0, products: [], signals: [], seasonal_factors: [], competitor_names: [] }
    }

    const productMentions = new Map<string, number>()
    const keywords = ['quote', 'price', 'pricing', 'cost', 'available', 'stock', 'buy', 'purchase', 'order']

    recentInquiries.forEach(inquiry => {
      const text = `${inquiry.subject || ''} ${inquiry.summary || ''}`.toLowerCase()
      const hasInterestKeyword = keywords.some(k => text.includes(k))
      
      if (hasInterestKeyword) {
        const products = this.extractProductNames(text)
        products.forEach(product => {
          productMentions.set(product, (productMentions.get(product) || 0) + 1)
        })
      }
    })

    if (productMentions.size === 0) {
      return { confidence: 0, products: [], signals: [], seasonal_factors: [], competitor_names: [] }
    }

    const daysSinceLastInquiry = (Date.now() - new Date(recentInquiries[0].interaction_date).getTime()) / (1000 * 60 * 60 * 24)
    const recencyFactor = Math.max(0, 1 - (daysSinceLastInquiry / 14))
    const frequencyFactor = Math.min(productMentions.size / 3, 1)
    
    const confidence = (recencyFactor * 0.6 + frequencyFactor * 0.4) * 0.9

    const products: PredictedProduct[] = Array.from(productMentions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        product_name: name,
        category: this.categorizeProduct(name),
        confidence: Math.min(count / recentInquiries.length, 1),
        reasoning: `Mentioned ${count} times in recent inquiries`
      }))

    const signals = [
      `${recentInquiries.length} recent inquiries`,
      `${productMentions.size} products mentioned`,
      `Last inquiry ${daysSinceLastInquiry.toFixed(0)} days ago`
    ]

    return { confidence, products, signals, seasonal_factors: [], competitor_names: [] }
  }

  private detectCompetitorMentions(interactions: any[]): {
    confidence: number
    products: PredictedProduct[]
    signals: string[]
    seasonal_factors: any[]
    competitor_names: string[]
  } {
    const competitors = ['competitor', 'alternative', 'compare', 'versus', 'vs', 'other supplier', 'another company']
    const urgencyKeywords = ['switching', 'unhappy', 'looking elsewhere', 'dissatisfied', 'better price', 'better deal']

    const mentionsWithProducts = new Map<string, string[]>()
    const competitorNames: string[] = []

    interactions.forEach(interaction => {
      const text = `${interaction.subject || ''} ${interaction.summary || ''}`.toLowerCase()
      
      const hasCompetitorMention = competitors.some(c => text.includes(c))
      const hasUrgency = urgencyKeywords.some(k => text.includes(k))
      
      if (hasCompetitorMention || hasUrgency) {
        const products = this.extractProductNames(text)
        products.forEach(product => {
          if (!mentionsWithProducts.has(product)) {
            mentionsWithProducts.set(product, [])
          }
          mentionsWithProducts.get(product)!.push(interaction.id)
        })
        
        if (hasCompetitorMention) competitorNames.push('Competitor mentioned')
      }
    })

    if (mentionsWithProducts.size === 0) {
      return { confidence: 0, products: [], signals: [], seasonal_factors: [], competitor_names: [] }
    }

    const daysSinceLastMention = interactions.length > 0
      ? (Date.now() - new Date(interactions[0].interaction_date).getTime()) / (1000 * 60 * 60 * 24)
      : 30

    const urgencyFactor = daysSinceLastMention < 7 ? 1 : daysSinceLastMention < 14 ? 0.8 : 0.6
    const confidence = Math.min(mentionsWithProducts.size / 2, 1) * urgencyFactor * 0.95

    const products: PredictedProduct[] = Array.from(mentionsWithProducts.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5)
      .map(([name, mentions]) => ({
        product_name: name,
        category: this.categorizeProduct(name),
        confidence: Math.min(mentions.length / interactions.length, 1),
        reasoning: 'Mentioned with competitor comparison'
      }))

    const signals = [
      `Competitor mentioned in ${mentionsWithProducts.size} product contexts`,
      `Last mention ${daysSinceLastMention.toFixed(0)} days ago`,
      'High urgency opportunity'
    ]

    return { confidence, products, signals, seasonal_factors: [], competitor_names: competitorNames }
  }

  private calculatePurchaseFrequency(purchaseHistory: any[]): number | null {
    if (purchaseHistory.length < 2) return null

    const sortedPurchases = [...purchaseHistory].sort(
      (a, b) => new Date(a.outcome_date).getTime() - new Date(b.outcome_date).getTime()
    )

    const intervals: number[] = []
    for (let i = 1; i < sortedPurchases.length; i++) {
      const days = (new Date(sortedPurchases[i].outcome_date).getTime() - 
                    new Date(sortedPurchases[i - 1].outcome_date).getTime()) / (1000 * 60 * 60 * 24)
      intervals.push(days)
    }

    return intervals.reduce((a, b) => a + b, 0) / intervals.length
  }

  private extractProductNames(text: string): string[] {
    const productKeywords = [
      'speaker', 'amplifier', 'mixer', 'microphone', 'projector', 'screen',
      'display', 'monitor', 'cable', 'lighting', 'led', 'audio', 'video'
    ]

    const found: string[] = []
    productKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        found.push(keyword.charAt(0).toUpperCase() + keyword.slice(1))
      }
    })

    return found
  }

  private categorizeProduct(productName: string): string {
    const lower = productName.toLowerCase()

    if (lower.includes('speaker') || lower.includes('amplifier') || lower.includes('mixer') || 
        lower.includes('microphone') || lower.includes('audio')) {
      return 'audio'
    }
    if (lower.includes('projector') || lower.includes('screen') || lower.includes('display') || 
        lower.includes('monitor') || lower.includes('video')) {
      return 'visual'
    }
    if (lower.includes('cable') || lower.includes('connector') || lower.includes('adapter')) {
      return 'cables'
    }
    if (lower.includes('light') || lower.includes('lighting') || lower.includes('led')) {
      return 'lighting'
    }

    return 'general'
  }

  private getMonthName(month: number): string {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December']
    return months[month - 1]
  }

  private determinePriority(
    confidence: number,
    avgOrderValue: number,
    triggerReason: string
  ): 'low' | 'medium' | 'high' | 'urgent' {
    if (triggerReason === 'competitor_mention' && confidence > 0.8) return 'urgent'
    if (confidence > 0.9 && avgOrderValue > 50000) return 'urgent'
    if (confidence > 0.85 || avgOrderValue > 30000) return 'high'
    if (confidence > 0.7 || avgOrderValue > 10000) return 'medium'
    return 'low'
  }

  private calculateSuggestedDiscount(
    purchaseCount: number,
    avgOrderValue: number,
    confidence: number
  ): number {
    let baseDiscount = 0

    if (purchaseCount >= 10) baseDiscount = 15
    else if (purchaseCount >= 5) baseDiscount = 10
    else if (purchaseCount >= 3) baseDiscount = 5
    else baseDiscount = 3

    if (avgOrderValue > 50000) baseDiscount += 5
    else if (avgOrderValue > 20000) baseDiscount += 3

    if (confidence > 0.9) baseDiscount += 2

    return Math.min(baseDiscount, 25)
  }

  private async storeOpportunities(opportunities: PredictiveQuoteOpportunity[]): Promise<number> {
    if (opportunities.length === 0) return 0

    const records = opportunities.map(opp => ({
      customer_email: opp.customer_email,
      customer_name: opp.customer_name,
      predicted_products: opp.predicted_products,
      confidence_score: opp.confidence_score,
      trigger_reason: opp.trigger_reason,
      suggested_discount: opp.suggested_discount,
      priority: opp.priority,
      status: 'new',
      metadata: opp.metadata,
      identified_at: new Date().toISOString()
    }))

    const { data, error } = await this.supabase
      .from('predictive_quote_opportunities')
      .upsert(records, { 
        onConflict: 'customer_email',
        ignoreDuplicates: false 
      })
      .select()

    if (error) {
      console.error('Error storing opportunities:', error)
      return 0
    }

    return data?.length || 0
  }

  private async generateProactiveQuote(opportunity: PredictiveQuoteOpportunity): Promise<boolean> {
    try {
      await this.logToSquad(
        `🎯 Generating proactive quote for ${opportunity.customer_name || opportunity.customer_email}`,
        {
          confidence: opportunity.confidence_score,
          trigger: opportunity.trigger_reason,
          products: opportunity.predicted_products.map(p => p.product_name)
        }
      )

      const { data: existingQuote } = await this.supabase
        .from('quote_requests')
        .select('id')
        .eq('customer_email', opportunity.customer_email)
        .in('status', ['detected', 'suppliers_contacted', 'quotes_received'])
        .single()

      if (existingQuote) {
        await this.logToSquad(
          `⏭️ Skipping proactive quote for ${opportunity.customer_email} - existing quote in progress`
        )
        return false
      }

      const { error } = await this.supabase
        .from('quote_requests')
        .insert({
          customer_email: opportunity.customer_email,
          customer_name: opportunity.customer_name,
          requested_products: opportunity.predicted_products.map(p => ({
            product_name: p.product_name,
            category: p.category,
            quantity: 1
          })),
          status: 'detected',
          confidence_score: opportunity.confidence_score,
          metadata: {
            source: 'predictive_agent',
            trigger_reason: opportunity.trigger_reason,
            suggested_discount: opportunity.suggested_discount,
            proactive: true,
            ...opportunity.metadata
          }
        })

      if (error) {
        console.error('Error creating proactive quote:', error)
        return false
      }

      await this.supabase
        .from('predictive_quote_opportunities')
        .update({ 
          status: 'quote_generated',
          actioned_at: new Date().toISOString()
        })
        .eq('customer_email', opportunity.customer_email)

      return true

    } catch (error) {
      console.error('Error generating proactive quote:', error)
      return false
    }
  }

  private async createReviewTask(opportunity: PredictiveQuoteOpportunity): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('squad_tasks')
        .insert({
          title: `Review Predictive Quote Opportunity: ${opportunity.customer_name || opportunity.customer_email}`,
          description: `A ${(opportunity.confidence_score * 100).toFixed(0)}% confidence opportunity has been identified for ${opportunity.customer_name || opportunity.customer_email}.

**Trigger Reason:** ${opportunity.trigger_reason.replace(/_/g, ' ').toUpperCase()}

**Predicted Products:**
${opportunity.predicted_products.map(p => `- ${p.product_name} (${p.category}) - ${(p.confidence * 100).toFixed(0)}% confidence: ${p.reasoning}`).join('\n')}

**Customer Intelligence:**
- Last Purchase: ${opportunity.metadata.last_purchase_date ? new Date(opportunity.metadata.last_purchase_date).toLocaleDateString() : 'N/A'}
- Avg Order Value: R${opportunity.metadata.avg_order_value.toFixed(2)}
- Purchase Frequency: ${opportunity.metadata.purchase_frequency_days ? `${opportunity.metadata.purchase_frequency_days.toFixed(0)} days` : 'N/A'}
- Next Expected Purchase: ${opportunity.metadata.next_expected_purchase ? new Date(opportunity.metadata.next_expected_purchase).toLocaleDateString() : 'N/A'}

**Suggested Discount:** ${opportunity.suggested_discount}%

**Signals Detected:**
${opportunity.metadata.interaction_signals.map(s => `- ${s}`).join('\n')}

**Recommended Action:**
Review this opportunity and decide whether to generate a proactive quote or reach out to the customer.`,
          status: 'new',
          assigned_agent: this.agentName,
          priority: opportunity.priority,
          mentions_kenny: true,
          metadata: {
            opportunity_id: opportunity.customer_email,
            confidence_score: opportunity.confidence_score,
            trigger_reason: opportunity.trigger_reason,
            suggested_discount: opportunity.suggested_discount,
            customer_email: opportunity.customer_email,
            predicted_products: opportunity.predicted_products,
            action_required: 'review_predictive_opportunity',
            created_by_agent: this.agentName
          }
        })

      if (error) {
        console.error('Error creating review task:', error)
        return false
      }

      await this.supabase
        .from('predictive_quote_opportunities')
        .update({ 
          status: 'review_pending',
          actioned_at: new Date().toISOString()
        })
        .eq('customer_email', opportunity.customer_email)

      return true

    } catch (error) {
      console.error('Error creating review task:', error)
      return false
    }
  }

  private async logToSquad(message: string, data: any = {}): Promise<void> {
    try {
      await this.supabase
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

export const predictiveQuoteAgent = new PredictiveQuoteAgent()
