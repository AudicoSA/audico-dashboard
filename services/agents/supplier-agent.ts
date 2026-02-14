import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { gmailService } from '../integrations/gmail-service'
import { supplierLearningEngine } from '@/lib/supplier-learning-engine'

interface QuoteRequestItem {
  product_name: string
  quantity: number
  specifications?: string
}

interface QuoteRequest {
  id: string
  customer_name: string
  customer_email: string
  items: QuoteRequestItem[]
  status: string
  metadata?: any
  created_at: string
}

interface Supplier {
  id: string
  name: string
  company: string
  email: string
  phone?: string
  specialties: string[]
  relationship_strength: number
  reliability_score?: number
  avg_response_time_hours?: number
  last_contact_date?: string
}

interface SupplierProduct {
  id: string
  supplier_id: string
  product_name: string
  product_category?: string
  manufacturer?: string
  model_number?: string
  typical_lead_time_days?: number
  avg_markup_percentage?: number
  last_quoted_price?: number
  last_quoted_date?: string
  stock_reliability: 'always_in_stock' | 'usually_available' | 'often_delayed' | 'unreliable'
}

interface SupplierContact {
  id: string
  supplier_id: string
  contact_name: string
  email: string
  phone?: string
  role?: string
  specializes_in: string[]
  response_quality_score?: number
  preferred_contact: boolean
}

interface RankedSupplier {
  supplier: Supplier
  contact?: SupplierContact
  products: SupplierProduct[]
  score: number
}

export class SupplierAgent {
  private supabase: SupabaseClient | null = null
  private agentName = 'SupplierAgent'

  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      this.supabase = createClient(supabaseUrl, supabaseKey)
    }
    return this.supabase
  }

  async processQuoteRequest(quoteRequestId: string): Promise<{
    success: boolean
    suppliersContacted: number
    error?: string
  }> {
    try {
      const quoteRequest = await this.fetchQuoteRequest(quoteRequestId)
      
      if (!quoteRequest) {
        throw new Error(`Quote request ${quoteRequestId} not found`)
      }

      if (!quoteRequest.items || quoteRequest.items.length === 0) {
        throw new Error('Quote request has no items')
      }

      await this.logToSquad(`Processing quote request ${quoteRequestId} with ${quoteRequest.items.length} items`)

      const productSupplierMap = new Map<string, RankedSupplier[]>()

      for (const item of quoteRequest.items) {
        const rankedSuppliers = await this.findBestSuppliersForProduct(
          item.product_name,
          item.specifications
        )
        productSupplierMap.set(item.product_name, rankedSuppliers)
      }

      const emailsSent: Array<{
        supplier: Supplier
        contact?: SupplierContact
        products: QuoteRequestItem[]
      }> = []

      const uniqueSuppliers = this.getUniqueTopSuppliers(productSupplierMap)

      for (const supplierData of uniqueSuppliers) {
        const productsForSupplier = this.getProductsForSupplier(
          supplierData.supplier.id,
          quoteRequest.items,
          productSupplierMap
        )

        if (productsForSupplier.length === 0) continue

        const emailResult = await this.sendSupplierEmail(
          supplierData.supplier,
          supplierData.contact,
          productsForSupplier,
          quoteRequest
        )

        if (emailResult.success) {
          await this.logEmailInteraction(
            emailResult.messageId || '',
            supplierData.supplier.id,
            productsForSupplier,
            quoteRequestId
          )

          emailsSent.push({
            supplier: supplierData.supplier,
            contact: supplierData.contact,
            products: productsForSupplier
          })
        }
      }

      await this.updateQuoteRequestStatus(quoteRequestId, 'suppliers_contacted')

      const taskDeadline = new Date()
      taskDeadline.setHours(taskDeadline.getHours() + 36)

      const taskId = await this.createTrackingTask(
        quoteRequestId,
        quoteRequest.customer_name,
        emailsSent.length,
        taskDeadline
      )

      await this.logSupplierContactSummary(
        quoteRequestId,
        emailsSent,
        productSupplierMap,
        taskId
      )

      return {
        success: true,
        suppliersContacted: emailsSent.length
      }

    } catch (error: any) {
      console.error('Error processing quote request:', error)
      await this.logToSquad(`Error processing quote request ${quoteRequestId}: ${error.message}`)
      return {
        success: false,
        suppliersContacted: 0,
        error: error.message
      }
    }
  }

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

  private async findBestSuppliersForProduct(
    productName: string,
    specifications?: string
  ): Promise<RankedSupplier[]> {
    const searchTerms = this.extractProductKeywords(productName, specifications)
    
    const { data: supplierProducts, error } = await this.getSupabase()
      .from('supplier_products')
      .select(`
        *,
        supplier:suppliers(*)
      `)
      .or(searchTerms.map(term => `product_name.ilike.%${term}%`).join(','))
      .order('stock_reliability')

    if (error || !supplierProducts) {
      console.error('Error fetching supplier products:', error)
      return []
    }

    const supplierMap = new Map<string, {
      supplier: Supplier
      products: SupplierProduct[]
    }>()

    for (const sp of supplierProducts) {
      const supplierId = sp.supplier.id
      if (!supplierMap.has(supplierId)) {
        supplierMap.set(supplierId, {
          supplier: sp.supplier,
          products: []
        })
      }
      supplierMap.get(supplierId)!.products.push(sp)
    }

    const rankedSuppliers: RankedSupplier[] = []

    for (const supplierId of Array.from(supplierMap.keys())) {
      const data = supplierMap.get(supplierId)!
      const { data: contacts } = await this.getSupabase()
        .from('supplier_contacts')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('preferred_contact', { ascending: false })
        .limit(1)

      const score = await this.calculateSupplierScore(data.supplier, data.products)

      rankedSuppliers.push({
        supplier: data.supplier,
        contact: contacts && contacts.length > 0 ? contacts[0] : undefined,
        products: data.products,
        score
      })
    }

    rankedSuppliers.sort((a, b) => b.score - a.score)

    return rankedSuppliers.slice(0, 3)
  }

  private extractProductKeywords(productName: string, specifications?: string): string[] {
    const text = `${productName} ${specifications || ''}`.toLowerCase()
    const words = text.split(/\s+/).filter(w => w.length > 2)
    const uniqueWords = Array.from(new Set(words))
    const keywords = uniqueWords.slice(0, 5)
    return keywords.length > 0 ? keywords : [productName.toLowerCase()]
  }

  private async calculateSupplierScore(supplier: Supplier, products: SupplierProduct[]): Promise<number> {
    let score = 0

    // Base reliability score (30%)
    const reliabilityScore = supplier.reliability_score || 50
    score += reliabilityScore * 0.3

    // Relationship strength (20%)
    const relationshipStrength = supplier.relationship_strength || 50
    score += relationshipStrength * 0.2

    // Stock reliability from products (20%)
    const stockReliabilityScore = this.getAverageStockReliability(products)
    score += stockReliabilityScore * 0.2

    // Get enhanced ranking data from learning engine (30%)
    try {
      const enhancedData = await supplierLearningEngine.getEnhancedSupplierRanking(supplier.id)
      
      if (enhancedData) {
        // Response quality score (15%)
        const qualityScore = enhancedData.response_quality_score || 75
        score += qualityScore * 0.15

        // Stock accuracy rate (10%)
        const stockAccuracy = enhancedData.stock_accuracy_rate || 75
        score += stockAccuracy * 0.10

        // Bonus for emerging relationships (5%)
        if (enhancedData.interaction_trend === 'increasing') {
          score += 5
        }

        // Penalty for decreasing pricing (adjust within the 5% bonus range)
        if (enhancedData.pricing_trend === 'increasing') {
          score -= 3
        }
      } else {
        // If no enhanced data, use baseline scores
        score += 75 * 0.15 // Default quality
        score += 75 * 0.10 // Default stock accuracy
      }
    } catch (error) {
      console.error('Error getting enhanced supplier ranking:', error)
      // Fallback to baseline
      score += 75 * 0.15
      score += 75 * 0.10
    }

    return Math.min(100, Math.max(0, score))
  }

  private getAverageStockReliability(products: SupplierProduct[]): number {
    if (products.length === 0) return 50

    const stockScores = {
      'always_in_stock': 100,
      'usually_available': 75,
      'often_delayed': 40,
      'unreliable': 20
    }

    const total = products.reduce((sum, p) => {
      return sum + (stockScores[p.stock_reliability] || 50)
    }, 0)

    return total / products.length
  }

  private getUniqueTopSuppliers(
    productSupplierMap: Map<string, RankedSupplier[]>
  ): Array<{ supplier: Supplier; contact?: SupplierContact }> {
    const supplierSet = new Map<string, { supplier: Supplier; contact?: SupplierContact; maxScore: number }>()

    const allRankedSuppliers = Array.from(productSupplierMap.values())
    for (const rankedSuppliers of allRankedSuppliers) {
      for (const ranked of rankedSuppliers.slice(0, 2)) {
        const existing = supplierSet.get(ranked.supplier.id)
        if (!existing || ranked.score > existing.maxScore) {
          supplierSet.set(ranked.supplier.id, {
            supplier: ranked.supplier,
            contact: ranked.contact,
            maxScore: ranked.score
          })
        }
      }
    }

    return Array.from(supplierSet.values())
      .sort((a, b) => b.maxScore - a.maxScore)
  }

  private getProductsForSupplier(
    supplierId: string,
    requestedItems: QuoteRequestItem[],
    productSupplierMap: Map<string, RankedSupplier[]>
  ): QuoteRequestItem[] {
    const products: QuoteRequestItem[] = []

    for (const item of requestedItems) {
      const rankedSuppliers = productSupplierMap.get(item.product_name) || []
      const hasSupplier = rankedSuppliers.some(rs => rs.supplier.id === supplierId)
      
      if (hasSupplier) {
        products.push(item)
      }
    }

    return products
  }

  private async sendSupplierEmail(
    supplier: Supplier,
    contact: SupplierContact | undefined,
    products: QuoteRequestItem[],
    quoteRequest: QuoteRequest
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const contactName = contact?.contact_name || supplier.name || 'there'
    const recipientEmail = contact?.email || supplier.email

    if (!recipientEmail) {
      return { success: false, error: 'No email address available for supplier' }
    }

    const productsList = products
      .map((p, idx) => `${idx + 1}. ${p.product_name} - Quantity: ${p.quantity}${p.specifications ? ` (${p.specifications})` : ''}`)
      .join('\n')

    const emailBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <p>Hi ${contactName},</p>
          
          <p>I hope this email finds you well. We have a customer quote request and would appreciate your assistance.</p>
          
          <p>Could you please provide a quote and confirm stock availability for the following items:</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">
            <pre style="margin: 0; font-family: Arial, sans-serif;">${productsList}</pre>
          </div>
          
          <p>We would appreciate your response within 24-48 hours if possible.</p>
          
          <p>Please include:</p>
          <ul>
            <li>Unit pricing</li>
            <li>Current stock availability</li>
            <li>Expected delivery/lead time</li>
            <li>Any applicable discounts for the quantities requested</li>
          </ul>
          
          <p>Thank you for your continued partnership.</p>
          
          <p>Best regards,<br>
          Audico Supply Chain Team<br>
          <em>Quote Reference: ${quoteRequest.id.substring(0, 8)}</em></p>
        </body>
      </html>
    `

    const subject = `Quote Request - ${products.length} item${products.length > 1 ? 's' : ''} - Ref: ${quoteRequest.id.substring(0, 8)}`

    return await gmailService.sendEmail(recipientEmail, subject, emailBody)
  }

  private async logEmailInteraction(
    emailLogId: string,
    supplierId: string,
    products: QuoteRequestItem[],
    quoteRequestId: string
  ): Promise<void> {
    try {
      await this.getSupabase()
        .from('email_supplier_interactions')
        .insert({
          email_log_id: emailLogId,
          supplier_id: supplierId,
          interaction_type: 'quote_request',
          products_mentioned: products.map(p => p.product_name),
          pricing_data: {},
          stock_info: {},
          quote_request_id: quoteRequestId,
          extracted_at: new Date().toISOString()
        })

      await this.getSupabase()
        .from('suppliers')
        .update({
          last_contact_date: new Date().toISOString()
        })
        .eq('id', supplierId)

    } catch (error) {
      console.error('Error logging email interaction:', error)
    }
  }

  private async updateQuoteRequestStatus(
    quoteRequestId: string,
    status: string
  ): Promise<void> {
    await this.getSupabase()
      .from('quote_requests')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', quoteRequestId)
  }

  private async createTrackingTask(
    quoteRequestId: string,
    customerName: string,
    suppliersContacted: number,
    deadline: Date
  ): Promise<string> {
    const { data, error } = await this.getSupabase()
      .from('squad_tasks')
      .insert({
        title: `Track Supplier Responses - Quote ${quoteRequestId.substring(0, 8)}`,
        description: `Waiting for quotes from ${suppliersContacted} supplier${suppliersContacted > 1 ? 's' : ''} for customer ${customerName}. Expected responses within 24-48 hours.`,
        status: 'new',
        assigned_agent: this.agentName,
        priority: 'high',
        mentions_kenny: false,
        deliverable_url: `/quotes/${quoteRequestId}`,
        metadata: {
          quote_request_id: quoteRequestId,
          suppliers_contacted: suppliersContacted,
          deadline: deadline.toISOString(),
          created_by_agent: this.agentName
        }
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating tracking task:', error)
      throw error
    }

    return data.id
  }

  private async logSupplierContactSummary(
    quoteRequestId: string,
    emailsSent: Array<{ supplier: Supplier; contact?: SupplierContact; products: QuoteRequestItem[] }>,
    productSupplierMap: Map<string, RankedSupplier[]>,
    taskId: string
  ): Promise<void> {
    const summary = emailsSent.map(({ supplier, contact, products }) => {
      const productNames = products.map(p => p.product_name).join(', ')
      const contactInfo = contact ? contact.contact_name : supplier.name
      return `• ${supplier.company} (${contactInfo}) - Products: ${productNames}`
    }).join('\n')

    const productBreakdown = Array.from(productSupplierMap.entries()).map(([product, suppliers]) => {
      const supplierNames = suppliers.slice(0, 2).map(s => s.supplier.company).join(', ')
      return `  - ${product}: contacted ${supplierNames}`
    }).join('\n')

    const message = `Quote request ${quoteRequestId.substring(0, 8)} - Contacted ${emailsSent.length} suppliers:

${summary}

Product-Supplier Mapping:
${productBreakdown}

Tracking task created with 24-48h deadline for supplier responses.`

    await this.getSupabase()
      .from('squad_messages')
      .insert({
        from_agent: this.agentName,
        to_agent: null,
        message,
        task_id: taskId,
        data: {
          quote_request_id: quoteRequestId,
          suppliers_contacted: emailsSent.length,
          action: 'suppliers_contacted',
          timestamp: new Date().toISOString()
        }
      })
  }

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

export const supplierAgent = new SupplierAgent()
