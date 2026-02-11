import Anthropic from '@anthropic-ai/sdk'
import { getServerSupabase } from './supabase'

interface EmailLog {
  id: string
  gmail_message_id: string
  from_email: string
  subject: string
  payload: any
  created_at: string
}

interface Supplier {
  id: string
  name: string
  company: string
  email: string
}

interface SupplierContact {
  id: string
  supplier_id: string
  email: string
  contact_name: string
}

interface QuoteRequest {
  id: string
  customer_name: string
  customer_email: string
  requested_products: Array<{
    product_name: string
    quantity?: number
    specifications?: string
  }>
  status: string
  created_at: string
}

interface EmailSupplierInteraction {
  id: string
  email_log_id: string
  supplier_id: string
  interaction_type: string
  products_mentioned: string[]
  pricing_data: any
  stock_info: any
  quote_request_id?: string
}

interface ExtractedQuoteData {
  is_quote_response: boolean
  confidence_score: number
  products: Array<{
    product: string
    unit_price?: number
    quantity?: number
    total?: number
    currency?: string
    stock_status?: string
    lead_time_days?: number
  }>
  validity_period?: string
  terms?: string
  additional_notes?: string
}

export class SupplierResponseHandler {
  private anthropic: Anthropic
  private supabase: ReturnType<typeof getServerSupabase>
  private agentName = 'SupplierResponseHandler'

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required')
    }
    
    this.anthropic = new Anthropic({
      apiKey: apiKey,
    })
    this.supabase = getServerSupabase()
  }

  async processSupplierResponse(emailLogId: string): Promise<{
    success: boolean
    isSupplierResponse: boolean
    supplierId?: string
    quoteRequestId?: string
    error?: string
  }> {
    try {
      const emailLog = await this.fetchEmailLog(emailLogId)
      if (!emailLog) {
        throw new Error(`Email log ${emailLogId} not found`)
      }

      const isSupplierResponse = await this.detectSupplierResponse(emailLog)
      if (!isSupplierResponse) {
        return {
          success: true,
          isSupplierResponse: false,
        }
      }

      const supplier = await this.identifySupplier(emailLog.from_email)
      if (!supplier) {
        await this.logToSquad(
          `Supplier response detected but sender not recognized: ${emailLog.from_email}`,
          { email_id: emailLogId, from_email: emailLog.from_email }
        )
        return {
          success: true,
          isSupplierResponse: true,
          error: 'Supplier not found',
        }
      }

      const emailBody = this.extractEmailBody(emailLog.payload)
      const extractedData = await this.extractQuoteDataWithClaude(
        emailLog.subject,
        emailBody
      )

      if (!extractedData.is_quote_response || extractedData.confidence_score < 0.5) {
        return {
          success: true,
          isSupplierResponse: true,
          supplierId: supplier.id,
          error: 'Not a valid quote response',
        }
      }

      const quoteRequest = await this.findActiveQuoteRequest(supplier.id, extractedData)
      
      const pricingData = this.structurePricingData(extractedData)
      const stockInfo = this.structureStockInfo(extractedData)

      const interaction = await this.logSupplierInteraction(
        emailLogId,
        supplier.id,
        extractedData,
        pricingData,
        stockInfo,
        quoteRequest?.id
      )

      if (quoteRequest) {
        await this.updateQuoteRequestWithResponse(
          quoteRequest.id,
          supplier.id,
          interaction.id
        )

        const allResponded = await this.checkAllSuppliersResponded(quoteRequest.id)
        const timedOut = this.checkTimeout(quoteRequest.created_at)

        if (allResponded || timedOut) {
          await this.aggregateResponsesAndTriggerQuoteAgent(
            quoteRequest.id,
            allResponded ? 'all_responded' : 'timeout'
          )
        }
      }

      await this.logToSquad(
        `Supplier response processed from ${supplier.company}`,
        {
          email_id: emailLogId,
          supplier_id: supplier.id,
          quote_request_id: quoteRequest?.id,
          products_count: extractedData.products.length,
          confidence: extractedData.confidence_score,
        }
      )

      return {
        success: true,
        isSupplierResponse: true,
        supplierId: supplier.id,
        quoteRequestId: quoteRequest?.id,
      }

    } catch (error: any) {
      console.error('Error processing supplier response:', error)
      await this.logToSquad(
        `Error processing supplier response: ${error.message}`,
        { email_id: emailLogId, error: error.message }
      )
      return {
        success: false,
        isSupplierResponse: false,
        error: error.message,
      }
    }
  }

  private async fetchEmailLog(emailLogId: string): Promise<EmailLog | null> {
    const { data, error } = await this.supabase
      .from('email_logs')
      .select('*')
      .eq('id', emailLogId)
      .single()

    if (error) {
      console.error('Error fetching email log:', error)
      return null
    }

    return data as EmailLog
  }

  private async detectSupplierResponse(emailLog: EmailLog): Promise<boolean> {
    const subject = emailLog.subject.toLowerCase()
    
    const hasReplyIndicator = subject.includes('re:') || subject.includes('re ')
    const hasQuoteKeyword = subject.includes('quote') || 
                           subject.includes('quotation') || 
                           subject.includes('pricing')
    
    const isFromKnownSupplier = await this.isKnownSupplierEmail(emailLog.from_email)

    return (hasReplyIndicator || hasQuoteKeyword) && isFromKnownSupplier
  }

  private async isKnownSupplierEmail(email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim()

    const { data: suppliers } = await this.supabase
      .from('suppliers')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1)

    if (suppliers && suppliers.length > 0) {
      return true
    }

    const { data: contacts } = await this.supabase
      .from('supplier_contacts')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1)

    return !!(contacts && contacts.length > 0)
  }

  private async identifySupplier(email: string): Promise<Supplier | null> {
    const normalizedEmail = email.toLowerCase().trim()

    const { data: supplier } = await this.supabase
      .from('suppliers')
      .select('*')
      .eq('email', normalizedEmail)
      .single()

    if (supplier) {
      return supplier as Supplier
    }

    const { data: contact } = await this.supabase
      .from('supplier_contacts')
      .select('*, supplier:suppliers(*)')
      .eq('email', normalizedEmail)
      .single()

    if (contact && contact.supplier) {
      return contact.supplier as Supplier
    }

    return null
  }

  private extractEmailBody(payload: any): string {
    if (!payload) return ''
    
    if (payload.body) {
      return typeof payload.body === 'string' ? payload.body : JSON.stringify(payload.body)
    }
    
    if (payload.snippet) {
      return payload.snippet
    }
    
    if (payload.parts) {
      const textParts = payload.parts
        .filter((p: any) => p.mimeType === 'text/plain' || p.mimeType === 'text/html')
        .map((p: any) => p.body?.data || '')
      return textParts.join('\n')
    }
    
    return ''
  }

  private async extractQuoteDataWithClaude(
    subject: string,
    body: string
  ): Promise<ExtractedQuoteData> {
    const prompt = `Analyze this supplier email response to extract quote information.

SUBJECT: ${subject}
BODY: ${body.substring(0, 4000)}

Extract the following information in JSON format:
{
  "is_quote_response": boolean,
  "confidence_score": 0.0 to 1.0,
  "products": [
    {
      "product": "full product name",
      "unit_price": number (if mentioned),
      "quantity": number (if mentioned),
      "total": number (if total price given),
      "currency": "ZAR/USD/EUR/etc",
      "stock_status": "in_stock/out_of_stock/limited/on_order/backorder",
      "lead_time_days": number of days until delivery/availability
    }
  ],
  "validity_period": "how long the quote is valid (e.g., '30 days', 'until end of month')",
  "terms": "payment terms, conditions, or special notes",
  "additional_notes": "any other relevant information"
}

Look for:
- Product names, model numbers, or SKUs
- Unit prices and total amounts
- Quantities quoted
- Currency (ZAR, USD, EUR, etc.)
- Stock availability statements
- Lead times or delivery dates
- Quote validity period
- Payment terms or conditions

Confidence scoring:
- 1.0: Clear quote with specific products and prices
- 0.8-0.9: Quote with products and prices but missing some details
- 0.6-0.7: Partial quote or pricing information
- 0.4-0.5: Ambiguous response that may contain pricing
- 0.0-0.3: Not a quote response

If this is NOT a quote response (e.g., just acknowledgment, out of office, general question), return is_quote_response: false and confidence_score below 0.5.`

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      const responseText = message.content[0].type === 'text' 
        ? message.content[0].text 
        : ''

      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return {
          is_quote_response: false,
          confidence_score: 0,
          products: [],
        }
      }

      const parsed = JSON.parse(jsonMatch[0])
      return parsed

    } catch (error: any) {
      console.error('Claude API error in quote extraction:', error.message)
      return {
        is_quote_response: false,
        confidence_score: 0,
        products: [],
      }
    }
  }

  private structurePricingData(extractedData: ExtractedQuoteData): any {
    const pricingData: any = {}
    
    for (const product of extractedData.products) {
      const key = product.product
      pricingData[key] = {
        unit_price: product.unit_price || null,
        quantity: product.quantity || null,
        total: product.total || null,
        currency: product.currency || 'ZAR',
        stock_status: product.stock_status || null,
        lead_time_days: product.lead_time_days || null,
      }
    }

    return pricingData
  }

  private structureStockInfo(extractedData: ExtractedQuoteData): any {
    const stockInfo: any = {}
    
    for (const product of extractedData.products) {
      if (product.stock_status) {
        const key = product.product
        stockInfo[key] = {
          availability: product.stock_status,
          lead_time_days: product.lead_time_days || null,
        }
      }
    }

    return stockInfo
  }

  private async findActiveQuoteRequest(
    supplierId: string,
    extractedData: ExtractedQuoteData
  ): Promise<QuoteRequest | null> {
    const productNames = extractedData.products.map(p => p.product.toLowerCase())

    const { data: interactions, error } = await this.supabase
      .from('email_supplier_interactions')
      .select('*, quote_request:quote_requests(*)')
      .eq('supplier_id', supplierId)
      .eq('interaction_type', 'quote_request')
      .not('quote_request_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error || !interactions || interactions.length === 0) {
      return await this.findQuoteRequestByProductMatch(productNames)
    }

    for (const interaction of interactions) {
      if (!interaction.quote_request) continue

      const quoteRequest = interaction.quote_request as any
      
      if (quoteRequest.status !== 'suppliers_contacted' && 
          quoteRequest.status !== 'quotes_received') {
        continue
      }

      const requestedProducts = interaction.products_mentioned || []
      
      const matchScore = this.calculateProductMatchScore(
        requestedProducts,
        productNames
      )

      if (matchScore > 0.5) {
        return quoteRequest as QuoteRequest
      }
    }

    return await this.findQuoteRequestByProductMatch(productNames)
  }

  private async findQuoteRequestByProductMatch(
    productNames: string[]
  ): Promise<QuoteRequest | null> {
    const { data: activeQuoteRequests } = await this.supabase
      .from('quote_requests')
      .select('*')
      .in('status', ['suppliers_contacted', 'quotes_received'])
      .order('created_at', { ascending: false })
      .limit(5)

    if (activeQuoteRequests && activeQuoteRequests.length > 0) {
      for (const qr of activeQuoteRequests) {
        const requestedProductNames = (qr.requested_products || []).map(
          (p: any) => p.product_name?.toLowerCase() || ''
        )
        
        const matchScore = this.calculateProductMatchScore(
          requestedProductNames,
          productNames
        )

        if (matchScore > 0.4) {
          return qr as QuoteRequest
        }
      }

      return activeQuoteRequests[0] as QuoteRequest
    }

    return null
  }

  private calculateProductMatchScore(
    requestedProducts: string[],
    responseProducts: string[]
  ): number {
    if (requestedProducts.length === 0 || responseProducts.length === 0) {
      return 0
    }

    let matchCount = 0
    
    for (const requested of requestedProducts) {
      const normalizedRequested = requested.toLowerCase().trim()
      
      for (const response of responseProducts) {
        const normalizedResponse = response.toLowerCase().trim()
        
        if (normalizedRequested.includes(normalizedResponse) || 
            normalizedResponse.includes(normalizedRequested)) {
          matchCount++
          break
        }
        
        const requestedWords = normalizedRequested.split(/\s+/).filter(w => w.length > 3)
        const responseWords = normalizedResponse.split(/\s+/).filter(w => w.length > 3)
        const commonWords = requestedWords.filter(w => responseWords.includes(w))
        
        if (commonWords.length >= 2) {
          matchCount += 0.5
          break
        }
      }
    }

    return matchCount / requestedProducts.length
  }

  private async logSupplierInteraction(
    emailLogId: string,
    supplierId: string,
    extractedData: ExtractedQuoteData,
    pricingData: any,
    stockInfo: any,
    quoteRequestId?: string
  ): Promise<EmailSupplierInteraction> {
    const productsMentioned = extractedData.products.map(p => p.product)

    const interactionData: any = {
      email_log_id: emailLogId,
      supplier_id: supplierId,
      interaction_type: 'quote_response',
      products_mentioned: productsMentioned,
      pricing_data: pricingData,
      stock_info: stockInfo,
      extracted_at: new Date().toISOString(),
      quote_request_id: quoteRequestId || null,
    }

    if (quoteRequestId) {
      if (!interactionData.pricing_data.metadata) {
        interactionData.pricing_data.metadata = {}
      }
      interactionData.pricing_data.metadata.validity_period = extractedData.validity_period
      interactionData.pricing_data.metadata.terms = extractedData.terms
      interactionData.pricing_data.metadata.additional_notes = extractedData.additional_notes
    }

    const { data, error } = await this.supabase
      .from('email_supplier_interactions')
      .insert(interactionData)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to log supplier interaction: ${error.message}`)
    }

    return data as EmailSupplierInteraction
  }

  private async updateQuoteRequestWithResponse(
    quoteRequestId: string,
    supplierId: string,
    interactionId: string
  ): Promise<void> {
    const { data: quoteRequest } = await this.supabase
      .from('quote_requests')
      .select('metadata')
      .eq('id', quoteRequestId)
      .single()

    const metadata = quoteRequest?.metadata || {}
    
    if (!metadata.supplier_responses) {
      metadata.supplier_responses = []
    }

    metadata.supplier_responses.push({
      supplier_id: supplierId,
      interaction_id: interactionId,
      received_at: new Date().toISOString(),
    })

    await this.supabase
      .from('quote_requests')
      .update({
        metadata,
        status: 'quotes_received',
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteRequestId)
  }

  private async checkAllSuppliersResponded(quoteRequestId: string): Promise<boolean> {
    const { data: requestInteractions } = await this.supabase
      .from('email_supplier_interactions')
      .select('supplier_id')
      .eq('interaction_type', 'quote_request')
      .eq('quote_request_id', quoteRequestId)

    if (!requestInteractions || requestInteractions.length === 0) {
      return false
    }

    const contactedSuppliers = new Set(
      requestInteractions.map((i: any) => i.supplier_id)
    )

    const { data: responseInteractions } = await this.supabase
      .from('email_supplier_interactions')
      .select('supplier_id')
      .eq('interaction_type', 'quote_response')
      .eq('quote_request_id', quoteRequestId)

    const respondedSuppliers = new Set(
      (responseInteractions || []).map((i: any) => i.supplier_id)
    )

    for (const supplierId of Array.from(contactedSuppliers)) {
      if (!respondedSuppliers.has(supplierId)) {
        return false
      }
    }

    return true
  }

  private checkTimeout(createdAt: string): boolean {
    const created = new Date(createdAt)
    const now = new Date()
    const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
    
    return hoursDiff >= 48
  }

  private async aggregateResponsesAndTriggerQuoteAgent(
    quoteRequestId: string,
    reason: 'all_responded' | 'timeout'
  ): Promise<void> {
    const { data: quoteRequest } = await this.supabase
      .from('quote_requests')
      .select('*')
      .eq('id', quoteRequestId)
      .single()

    if (!quoteRequest) {
      throw new Error(`Quote request ${quoteRequestId} not found`)
    }

    const { data: interactions } = await this.supabase
      .from('email_supplier_interactions')
      .select('*, supplier:suppliers(*)')
      .eq('interaction_type', 'quote_response')
      .eq('quote_request_id', quoteRequestId)

    const supplierResponses = interactions || []

    const aggregatedData = this.aggregateSupplierResponses(supplierResponses)

    await this.supabase
      .from('quote_requests')
      .update({
        metadata: {
          ...quoteRequest.metadata,
          aggregation_reason: reason,
          aggregated_at: new Date().toISOString(),
          aggregated_data: aggregatedData,
        },
        status: 'pdf_generated',
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteRequestId)

    await this.createQuoteAgentTask(quoteRequest, aggregatedData, reason)

    await this.logToSquad(
      `Quote aggregation complete for request ${quoteRequestId.substring(0, 8)} (${reason})`,
      {
        quote_request_id: quoteRequestId,
        reason,
        responses_count: supplierResponses.length,
        aggregated_products: Object.keys(aggregatedData).length,
      }
    )
  }

  private aggregateSupplierResponses(responses: any[]): any {
    const productMap: any = {}

    for (const response of responses) {
      const supplier = response.supplier
      const pricingData = response.pricing_data || {}

      for (const [productName, productData] of Object.entries(pricingData)) {
        if (productName === 'metadata') continue

        if (!productMap[productName]) {
          productMap[productName] = {
            product_name: productName,
            quotes: [],
          }
        }

        productMap[productName].quotes.push({
          supplier_id: supplier.id,
          supplier_name: supplier.company,
          unit_price: (productData as any).unit_price,
          quantity: (productData as any).quantity,
          total: (productData as any).total,
          currency: (productData as any).currency || 'ZAR',
          stock_status: (productData as any).stock_status,
          lead_time_days: (productData as any).lead_time_days,
        })
      }
    }

    for (const productName in productMap) {
      const quotes = productMap[productName].quotes
      
      if (quotes.length > 0) {
        quotes.sort((a: any, b: any) => {
          if (!a.unit_price) return 1
          if (!b.unit_price) return -1
          return a.unit_price - b.unit_price
        })

        productMap[productName].best_quote = quotes[0]
        productMap[productName].quote_count = quotes.length
      }
    }

    return productMap
  }

  private async createQuoteAgentTask(
    quoteRequest: any,
    aggregatedData: any,
    reason: string
  ): Promise<void> {
    const productList = Object.keys(aggregatedData).slice(0, 3).join(', ')
    const moreProducts = Object.keys(aggregatedData).length > 3 
      ? ` and ${Object.keys(aggregatedData).length - 3} more` 
      : ''

    const responseCount = Object.values(aggregatedData).reduce(
      (sum: number, p: any) => sum + (p.quote_count || 0),
      0
    )

    const description = `Generate customer quote for ${quoteRequest.customer_name || quoteRequest.customer_email}

Products: ${productList}${moreProducts}
Supplier responses: ${responseCount} quotes received
Aggregation reason: ${reason === 'all_responded' ? 'All suppliers responded' : '48h timeout reached'}

Next steps:
1. Review aggregated pricing data
2. Apply markup and generate customer quote
3. Create PDF quote document
4. Send to customer

Quote request ID: ${quoteRequest.id}`

    await this.supabase
      .from('squad_tasks')
      .insert({
        title: `Generate Quote - ${quoteRequest.customer_name || quoteRequest.customer_email}`,
        description,
        status: 'new',
        assigned_agent: 'Mpho',
        priority: 'high',
        mentions_kenny: false,
        deliverable_url: `/quotes/${quoteRequest.id}`,
        metadata: {
          quote_request_id: quoteRequest.id,
          aggregated_data: aggregatedData,
          trigger_reason: reason,
        },
      })
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
            timestamp: new Date().toISOString(),
          },
        })
    } catch (error) {
      console.error('Error logging to squad:', error)
    }
  }
}

export async function processSupplierResponse(emailLogId: string): Promise<{
  success: boolean
  isSupplierResponse: boolean
  supplierId?: string
  quoteRequestId?: string
  error?: string
}> {
  const handler = new SupplierResponseHandler()
  return await handler.processSupplierResponse(emailLogId)
}
