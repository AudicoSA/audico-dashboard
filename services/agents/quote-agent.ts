import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { gmailService } from '../integrations/gmail-service'
import { quotePricingIntelligence } from '../../lib/quote-pricing-intelligence'

interface QuoteRequestItem {
  product_name: string
  quantity: number
  specifications?: string
}

interface QuoteRequest {
  id: string
  customer_name: string
  customer_email: string
  requested_products: QuoteRequestItem[]
  status: string
  metadata?: any
  created_at: string
  pdf_url?: string
}

interface SupplierResponse {
  id: string
  email_log_id: string
  supplier_id: string
  interaction_type: string
  products_mentioned: string[]
  pricing_data: {
    [productName: string]: {
      unit_price?: number
      quantity?: number
      total_price?: number
      lead_time?: string
      stock_availability?: string
      notes?: string
    }
  }
  stock_info: any
  supplier: {
    id: string
    name: string
    company: string
    email: string
    reliability_score?: number
  }
}

interface ProductQuote {
  product_name: string
  quantity: number
  specifications?: string
  supplier_name: string
  supplier_company: string
  unit_price: number
  total_price: number
  lead_time?: string
  stock_availability?: string
}

interface QuoteDetails {
  quoteId: string
  quoteNumber: string
  customerName: string
  customerEmail: string
  companyName?: string
  items: Array<{
    id: string
    product_name: string
    description?: string
    quantity: number
    unit_price: number
    total_price: number
    supplier?: string
    lead_time?: string
  }>
  subtotal: number
  tax?: number
  shipping?: number
  total: number
  currency: string
  validUntil: string
  notes?: string
  terms?: string
  metadata?: any
}

interface PricingRule {
  id: string
  rule_name: string
  product_category?: string
  markup_percentage: number
  min_margin?: number
  max_discount?: number
  conditions?: any
}

export class QuoteAgent {
  private supabase: SupabaseClient | null = null
  private agentName = 'QuoteAgent'

  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      this.supabase = createClient(supabaseUrl, supabaseKey)
    }
    return this.supabase
  }

  async generateCustomerQuote(quoteRequestId: string): Promise<{
    success: boolean
    quoteNumber?: string
    pdfUrl?: string
    taskId?: string
    error?: string
  }> {
    try {
      await this.logToSquad(`Starting quote generation for request ${quoteRequestId}`)

      const quoteRequest = await this.fetchQuoteRequest(quoteRequestId)
      if (!quoteRequest) {
        throw new Error(`Quote request ${quoteRequestId} not found`)
      }

      const supplierResponses = await this.fetchSupplierResponses(quoteRequestId)
      if (supplierResponses.length === 0) {
        throw new Error('No supplier responses found for this quote request')
      }

      await this.logToSquad(`Found ${supplierResponses.length} supplier responses`)

      const bestQuotes = await this.selectBestPricing(
        quoteRequest.requested_products,
        supplierResponses
      )

      if (bestQuotes.length === 0) {
        throw new Error('No valid pricing found in supplier responses')
      }

      const quoteDetails = await this.formatQuoteDetails(
        quoteRequest,
        bestQuotes
      )

      const pdfUrl = await this.generateAndStorePdf(quoteDetails)
      if (!pdfUrl) {
        throw new Error('Failed to generate or store PDF')
      }

      await this.updateQuoteRequestWithPdf(quoteRequestId, pdfUrl)

      const { draftId, previewUrl } = await this.draftCustomerEmail(
        quoteRequest,
        quoteDetails,
        pdfUrl
      )

      const taskId = await this.createApprovalTask(
        quoteRequestId,
        quoteRequest,
        quoteDetails,
        pdfUrl,
        previewUrl,
        draftId
      )

      await this.logToSquad(
        `Quote ${quoteDetails.quoteNumber} generated successfully. Awaiting Kenny's approval.`,
        { quote_request_id: quoteRequestId, task_id: taskId }
      )

      return {
        success: true,
        quoteNumber: quoteDetails.quoteNumber,
        pdfUrl,
        taskId
      }

    } catch (error: any) {
      console.error('Error generating customer quote:', error)
      await this.logToSquad(`Error generating quote for ${quoteRequestId}: ${error.message}`)
      return {
        success: false,
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

  private async fetchSupplierResponses(quoteRequestId: string): Promise<SupplierResponse[]> {
    const { data, error } = await this.getSupabase()
      .from('email_supplier_interactions')
      .select(`
        *,
        supplier:suppliers(*)
      `)
      .eq('quote_request_id', quoteRequestId)
      .eq('interaction_type', 'quote_response')

    if (error) {
      console.error('Error fetching supplier responses:', error)
      return []
    }

    return data as SupplierResponse[]
  }

  private async selectBestPricing(
    requestedProducts: QuoteRequestItem[],
    supplierResponses: SupplierResponse[]
  ): Promise<ProductQuote[]> {
    const productQuotes: ProductQuote[] = []

    for (const product of requestedProducts) {
      const productName = product.product_name.toLowerCase()
      let bestQuote: ProductQuote | null = null
      let bestScore = -1

      for (const response of supplierResponses) {
        if (!response.pricing_data || typeof response.pricing_data !== 'object') {
          continue
        }

        for (const [pricedProduct, priceInfo] of Object.entries(response.pricing_data)) {
          if (pricedProduct.toLowerCase().includes(productName) || 
              productName.includes(pricedProduct.toLowerCase())) {
            
            if (!priceInfo.unit_price || priceInfo.unit_price <= 0) {
              continue
            }

            const reliabilityScore = response.supplier.reliability_score || 50
            const priceScore = 100 - (priceInfo.unit_price / 1000)
            const totalScore = (reliabilityScore * 0.6) + (priceScore * 0.4)

            if (totalScore > bestScore) {
              bestScore = totalScore
              bestQuote = {
                product_name: product.product_name,
                quantity: product.quantity,
                specifications: product.specifications,
                supplier_name: response.supplier.name,
                supplier_company: response.supplier.company,
                unit_price: priceInfo.unit_price,
                total_price: priceInfo.unit_price * product.quantity,
                lead_time: priceInfo.lead_time,
                stock_availability: priceInfo.stock_availability
              }
            }
          }
        }
      }

      if (bestQuote) {
        productQuotes.push(bestQuote)
      }
    }

    return productQuotes
  }

  private async formatQuoteDetails(
    quoteRequest: QuoteRequest,
    productQuotes: ProductQuote[]
  ): Promise<QuoteDetails> {
    const quoteNumber = this.generateQuoteNumber()
    
    const customerSegment = await this.determineCustomerSegment(quoteRequest)
    const urgencyLevel = await this.determineUrgencyLevel(quoteRequest)
    const orderSizeCategory = this.determineOrderSize(productQuotes)

    await this.updateQuoteRequestMetadata(quoteRequest.id, {
      customer_segment: customerSegment,
      urgency_level: urgencyLevel,
      order_size_category: orderSizeCategory
    })

    const intelligentPricing = await quotePricingIntelligence.getIntelligentPricing({
      customerEmail: quoteRequest.customer_email,
      customerSegment,
      products: productQuotes.map(q => ({
        name: q.product_name,
        category: this.categorizeProduct(q.product_name),
        quantity: q.quantity,
        costPrice: q.unit_price
      })),
      urgencyLevel,
      orderSizeCategory
    })

    await this.logToSquad(
      `🎯 Intelligent pricing applied for ${quoteRequest.customer_name}: ` +
      `${intelligentPricing.base_markup.toFixed(1)}% markup (confidence: ${(intelligentPricing.confidence * 100).toFixed(0)}%) - ${intelligentPricing.reasoning}`,
      {
        quote_request_id: quoteRequest.id,
        pricing: intelligentPricing,
        customer_segment: customerSegment,
        urgency: urgencyLevel,
        order_size: orderSizeCategory
      }
    )

    const items = await Promise.all(productQuotes.map(async (quote, index) => {
      const productCategory = this.categorizeProduct(quote.product_name)
      
      let markup = intelligentPricing.base_markup
      
      const productAdjustment = intelligentPricing.adjustments.find(
        a => a.factor === 'product_category'
      )
      if (productAdjustment) {
        markup += productAdjustment.adjustment * 0.5
      }

      markup = Math.max(intelligentPricing.min_markup, Math.min(intelligentPricing.max_markup, markup))

      const costPrice = quote.unit_price
      const sellingPrice = costPrice * (1 + markup / 100)

      return {
        id: `item-${index + 1}`,
        product_name: quote.product_name,
        description: quote.specifications,
        quantity: quote.quantity,
        unit_price: Math.round(sellingPrice * 100) / 100,
        total_price: Math.round(sellingPrice * quote.quantity * 100) / 100,
        supplier: quote.supplier_company,
        lead_time: quote.lead_time,
        metadata: {
          cost_price: costPrice,
          markup_percentage: markup,
          product_category: productCategory,
          intelligent_pricing_applied: true,
          confidence: intelligentPricing.confidence
        }
      }
    }))

    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0)
    const tax = subtotal * 0.15
    const shipping = 0
    const total = subtotal + tax + shipping

    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 30)

    return {
      quoteId: quoteRequest.id,
      quoteNumber,
      customerName: quoteRequest.customer_name,
      customerEmail: quoteRequest.customer_email,
      companyName: quoteRequest.metadata?.company_name,
      items,
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      shipping,
      total: Math.round(total * 100) / 100,
      currency: 'ZAR',
      validUntil: validUntil.toISOString(),
      notes: 'Thank you for your inquiry. Please review the quote below.',
      terms: 'Payment terms: Net 30 days. Prices valid for 30 days from quote date.',
      metadata: {
        generated_by: this.agentName,
        supplier_count: new Set(productQuotes.map(q => q.supplier_company)).size,
        generated_at: new Date().toISOString(),
        quoted_items: items.map(item => ({
          product_name: item.product_name,
          product_category: item.metadata?.product_category,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: item.metadata?.cost_price,
          markup_percentage: item.metadata?.markup_percentage,
          total_price: item.total_price
        })),
        total_amount: total,
        customer_segment: customerSegment,
        urgency_level: urgencyLevel,
        order_size_category: orderSizeCategory,
        intelligent_pricing: {
          base_markup: intelligentPricing.base_markup,
          confidence: intelligentPricing.confidence,
          reasoning: intelligentPricing.reasoning,
          adjustments: intelligentPricing.adjustments.map(a => ({
            factor: a.factor,
            adjustment: a.adjustment
          }))
        }
      }
    }
  }

  private async fetchMarkupRules(): Promise<PricingRule[]> {
    const { data, error } = await this.getSupabase()
      .from('pricing_rules')
      .select('*')
      .eq('active', true)

    if (error) {
      console.error('Error fetching pricing rules:', error)
      return []
    }

    return data || []
  }

  private async calculateAverageMarkup(productQuotes: ProductQuote[]): Promise<number> {
    const supplierIds = new Set(productQuotes.map(q => q.supplier_company))
    const promises = Array.from(supplierIds).map(async (supplierCompany) => {
      const { data } = await this.getSupabase()
        .from('supplier_products')
        .select('avg_markup_percentage, supplier:suppliers!inner(company)')
        .eq('suppliers.company', supplierCompany)
        .not('avg_markup_percentage', 'is', null)

      if (data && data.length > 0) {
        const avgMarkup = data.reduce((sum, sp) => sum + (sp.avg_markup_percentage || 0), 0) / data.length
        return avgMarkup
      }
      return null
    })

    const markups = await Promise.all(promises)
    const validMarkups = markups.filter(m => m !== null) as number[]
    if (validMarkups.length > 0) {
      return validMarkups.reduce((sum, m) => sum + m, 0) / validMarkups.length
    }
    return 25
  }

  private findApplicableMarkup(
    productName: string,
    rules: PricingRule[],
    defaultMarkup: number
  ): number {
    const matchingRule = rules.find(rule => {
      if (rule.product_category) {
        return productName.toLowerCase().includes(rule.product_category.toLowerCase())
      }
      return false
    })

    if (matchingRule) {
      return matchingRule.markup_percentage
    }

    return defaultMarkup
  }

  private generateQuoteNumber(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    
    return `AUD-Q-${year}${month}${day}-${random}`
  }

  private async generateAndStorePdf(quoteDetails: QuoteDetails): Promise<string | null> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/quote/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quoteDetails)
      })

      if (!response.ok) {
        throw new Error(`PDF generation API returned ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success || !result.pdfUrl) {
        throw new Error('PDF generation failed: ' + (result.error || 'Unknown error'))
      }

      return result.pdfUrl

    } catch (error: any) {
      console.error('Error generating PDF:', error)
      return null
    }
  }

  private async updateQuoteRequestWithPdf(quoteRequestId: string, pdfUrl: string): Promise<void> {
    const { data: existing } = await this.getSupabase()
      .from('quote_requests')
      .select('metadata')
      .eq('id', quoteRequestId)
      .single()

    const existingMetadata = existing?.metadata || {}

    await this.getSupabase()
      .from('quote_requests')
      .update({
        status: 'pdf_generated',
        pdf_url: pdfUrl,
        metadata: {
          ...existingMetadata,
          pdf_generated_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', quoteRequestId)
  }

  private async draftCustomerEmail(
    quoteRequest: QuoteRequest,
    quoteDetails: QuoteDetails,
    pdfUrl: string
  ): Promise<{ draftId: string; previewUrl: string }> {
    const subject = `Your Quote: ${quoteDetails.quoteNumber}`
    
    const emailBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <p>Dear ${quoteDetails.customerName},</p>
          
          <p>Thank you for your quote request. Please find attached your customized quote.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-left: 4px solid #007bff; margin: 20px 0;">
            <h3 style="margin-top: 0;">Quote Summary</h3>
            <p><strong>Quote Number:</strong> ${quoteDetails.quoteNumber}</p>
            <p><strong>Total Items:</strong> ${quoteDetails.items.length}</p>
            <p><strong>Total Amount:</strong> ${quoteDetails.currency} ${quoteDetails.total.toFixed(2)}</p>
            <p><strong>Valid Until:</strong> ${new Date(quoteDetails.validUntil).toLocaleDateString()}</p>
          </div>
          
          <h4>Items Quoted:</h4>
          <ul>
            ${quoteDetails.items.map(item => `
              <li><strong>${item.product_name}</strong> - Qty: ${item.quantity} @ ${quoteDetails.currency} ${item.unit_price.toFixed(2)} each</li>
            `).join('')}
          </ul>
          
          <p>The attached PDF contains the complete quote with detailed pricing, terms, and conditions.</p>
          
          <p>If you have any questions or would like to proceed with this order, please don't hesitate to contact us.</p>
          
          <p>Best regards,<br>
          Audico Sales Team<br>
          <em>Quote Reference: ${quoteDetails.quoteNumber}</em></p>
        </body>
      </html>
    `

    const gmailDraftResult = await gmailService.createDraft(
      quoteRequest.customer_email,
      subject,
      emailBody,
      undefined,
      undefined,
      [{ filename: `${quoteDetails.quoteNumber}.pdf`, url: pdfUrl }]
    )

    const draftId = gmailDraftResult.draftId || `draft-${quoteDetails.quoteNumber}`
    
    await this.getSupabase()
      .from('email_drafts')
      .insert({
        id: draftId,
        to_email: quoteRequest.customer_email,
        subject,
        body: emailBody,
        attachments: [pdfUrl],
        status: 'pending_approval',
        metadata: {
          quote_request_id: quoteRequest.id,
          quote_number: quoteDetails.quoteNumber,
          created_by: this.agentName,
          gmail_draft_id: gmailDraftResult.draftId
        }
      })

    const previewUrl = gmailDraftResult.draftId 
      ? `https://mail.google.com/mail/u/0/#drafts/${gmailDraftResult.draftId}`
      : `/email-drafts/${draftId}`
    
    return { draftId, previewUrl }
  }

  private async createApprovalTask(
    quoteRequestId: string,
    quoteRequest: QuoteRequest,
    quoteDetails: QuoteDetails,
    pdfUrl: string,
    emailPreviewUrl: string,
    draftId: string
  ): Promise<string> {
    const { data, error } = await this.getSupabase()
      .from('squad_tasks')
      .insert({
        title: `Approve Quote ${quoteDetails.quoteNumber} for ${quoteRequest.customer_name}`,
        description: `A quote has been generated for ${quoteRequest.customer_name} (${quoteRequest.customer_email}).

**Quote Details:**
- Quote Number: ${quoteDetails.quoteNumber}
- Total Items: ${quoteDetails.items.length}
- Total Amount: ${quoteDetails.currency} ${quoteDetails.total.toFixed(2)}
- Valid Until: ${new Date(quoteDetails.validUntil).toLocaleDateString()}

**Actions Required:**
1. Review the quote PDF: [View PDF](${pdfUrl})
2. Review the draft email: [View Draft](${emailPreviewUrl})
3. Approve and send, or request changes

**Items:**
${quoteDetails.items.map(item => `- ${item.product_name} (Qty: ${item.quantity}) @ ${quoteDetails.currency} ${item.unit_price.toFixed(2)} = ${quoteDetails.currency} ${item.total_price.toFixed(2)}`).join('\n')}`,
        status: 'new',
        assigned_agent: this.agentName,
        priority: 'high',
        mentions_kenny: true,
        deliverable_url: pdfUrl,
        metadata: {
          quote_request_id: quoteRequestId,
          quote_number: quoteDetails.quoteNumber,
          pdf_url: pdfUrl,
          email_preview_url: emailPreviewUrl,
          draft_id: draftId,
          customer_email: quoteRequest.customer_email,
          customer_name: quoteRequest.customer_name,
          total_amount: quoteDetails.total,
          currency: quoteDetails.currency,
          action_required: 'approve_quote',
          created_by_agent: this.agentName
        }
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating approval task:', error)
      throw error
    }

    await this.getSupabase()
      .from('squad_messages')
      .insert({
        from_agent: this.agentName,
        to_agent: 'Kenny',
        message: `@Kenny - Quote ${quoteDetails.quoteNumber} ready for approval. Customer: ${quoteRequest.customer_name}. Total: ${quoteDetails.currency} ${quoteDetails.total.toFixed(2)}. Please review and approve.`,
        task_id: data.id,
        data: {
          quote_request_id: quoteRequestId,
          quote_number: quoteDetails.quoteNumber,
          pdf_url: pdfUrl,
          email_preview_url: emailPreviewUrl,
          action: 'quote_approval_required',
          timestamp: new Date().toISOString()
        }
      })

    return data.id
  }

  private async determineCustomerSegment(quoteRequest: QuoteRequest): Promise<string> {
    const { data: pastQuotes } = await this.getSupabase()
      .from('quote_outcomes')
      .select('total_quoted_amount, outcome')
      .eq('customer_email', quoteRequest.customer_email)
      .order('outcome_date', { ascending: false })
      .limit(10)

    if (!pastQuotes || pastQuotes.length === 0) {
      return 'new_customer'
    }

    const avgOrderValue = pastQuotes.reduce((sum, q) => sum + q.total_quoted_amount, 0) / pastQuotes.length
    const acceptanceRate = pastQuotes.filter(q => q.outcome === 'accepted').length / pastQuotes.length

    if (avgOrderValue > 50000) {
      return 'enterprise'
    } else if (avgOrderValue > 20000) {
      return acceptanceRate > 0.7 ? 'premium' : 'mid_market'
    } else if (avgOrderValue > 5000) {
      return acceptanceRate > 0.6 ? 'loyal_smb' : 'price_sensitive_smb'
    } else {
      return 'small_buyer'
    }
  }

  private async determineUrgencyLevel(quoteRequest: QuoteRequest): Promise<'low' | 'medium' | 'high' | 'urgent'> {
    const keywords = {
      urgent: ['urgent', 'asap', 'immediately', 'emergency', 'critical', 'rush'],
      high: ['soon', 'quickly', 'fast', 'this week', 'needed by', 'deadline'],
      medium: ['next week', 'upcoming', 'planning', 'scheduled'],
    }

    const metadata = quoteRequest.metadata || {}
    const text = (metadata.message_content || '').toLowerCase()

    for (const word of keywords.urgent) {
      if (text.includes(word)) return 'urgent'
    }

    for (const word of keywords.high) {
      if (text.includes(word)) return 'high'
    }

    for (const word of keywords.medium) {
      if (text.includes(word)) return 'medium'
    }

    return 'low'
  }

  private determineOrderSize(productQuotes: ProductQuote[]): 'small' | 'medium' | 'large' | 'enterprise' {
    const totalValue = productQuotes.reduce((sum, q) => sum + (q.unit_price * q.quantity), 0)
    const itemCount = productQuotes.reduce((sum, q) => sum + q.quantity, 0)

    if (totalValue > 100000 || itemCount > 100) {
      return 'enterprise'
    } else if (totalValue > 30000 || itemCount > 30) {
      return 'large'
    } else if (totalValue > 10000 || itemCount > 10) {
      return 'medium'
    } else {
      return 'small'
    }
  }

  private categorizeProduct(productName: string): string {
    const lower = productName.toLowerCase()

    if (lower.includes('speaker') || lower.includes('amplifier') || lower.includes('mixer') || 
        lower.includes('microphone') || lower.includes('audio') || lower.includes('sound')) {
      return 'audio'
    }

    if (lower.includes('projector') || lower.includes('screen') || lower.includes('display') || 
        lower.includes('monitor') || lower.includes('video') || lower.includes('led') || 
        lower.includes('visual')) {
      return 'visual'
    }

    if (lower.includes('cable') || lower.includes('connector') || lower.includes('adapter') || 
        lower.includes('mount') || lower.includes('bracket') || lower.includes('stand')) {
      return 'cables'
    }

    if (lower.includes('light') || lower.includes('lighting') || lower.includes('lamp')) {
      return 'lighting'
    }

    if (lower.includes('control') || lower.includes('processor') || lower.includes('switcher')) {
      return 'control_systems'
    }

    return 'general'
  }

  private async updateQuoteRequestMetadata(quoteRequestId: string, metadata: {
    customer_segment?: string
    urgency_level?: string
    order_size_category?: string
  }): Promise<void> {
    try {
      const { data: existing } = await this.getSupabase()
        .from('quote_requests')
        .select('metadata')
        .eq('id', quoteRequestId)
        .single()

      const existingMetadata = existing?.metadata || {}

      await this.getSupabase()
        .from('quote_requests')
        .update({
          customer_segment: metadata.customer_segment,
          urgency_level: metadata.urgency_level,
          order_size_category: metadata.order_size_category,
          metadata: {
            ...existingMetadata,
            ...metadata,
            intelligent_pricing_applied: true,
            analysis_timestamp: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', quoteRequestId)
    } catch (error) {
      console.error('Error updating quote request metadata:', error)
    }
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

export const quoteAgent = new QuoteAgent()
