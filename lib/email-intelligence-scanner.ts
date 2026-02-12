import { getServerSupabase } from './supabase'
import { gmailService } from '@/services/integrations/gmail-service'
import { chatCompletion } from './openai-client'

interface SupplierData {
  company: string
  contact_name?: string
  email: string
  phone?: string
  specialties?: string[]
}

interface ProductData {
  product_name: string
  manufacturer?: string
  model_number?: string
  product_category?: string
  quantity?: number
}

interface PricingData {
  product: string
  price?: number
  currency?: string
  quantity?: number
  lead_time_days?: number
}

interface StockInfo {
  product: string
  availability: string
  stock_reliability?: string
}

interface ExtractedEmailData {
  is_supplier_communication: boolean
  interaction_type?: 'quote_request' | 'quote_response' | 'stock_inquiry' | 'order_placement' | 'support'
  supplier?: SupplierData
  products?: ProductData[]
  pricing?: PricingData[]
  stock_info?: StockInfo[]
  confidence_score: number
}

interface ScannerState {
  job_id: string
  start_date: string
  end_date: string
  total_messages: number
  processed_count: number
  suppliers_found: number
  products_found: number
  contacts_found: number
  interactions_logged: number
  errors: number
  tokens_used: number
  estimated_cost_usd: number
  status: 'collecting' | 'processing' | 'completed' | 'error'
  error_message?: string
  last_error?: string
}

const BATCH_SIZE = 15
const GPT_INPUT_COST = 0.40 / 1_000_000  // $0.40 per 1M input tokens (gpt-4.1-mini)
const GPT_OUTPUT_COST = 1.60 / 1_000_000  // $1.60 per 1M output tokens (gpt-4.1-mini)

export class EmailIntelligenceScanner {
  private supabase: ReturnType<typeof getServerSupabase>

  constructor() {
    this.supabase = getServerSupabase()
  }

  /**
   * Phase 1: Collect all Gmail message IDs in the date range and store them.
   * Returns the job state with total_messages count.
   */
  async startScan(startDate: Date, endDate: Date): Promise<ScannerState> {
    const jobId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const state: ScannerState = {
      job_id: jobId,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      total_messages: 0,
      processed_count: 0,
      suppliers_found: 0,
      products_found: 0,
      contacts_found: 0,
      interactions_logged: 0,
      errors: 0,
      tokens_used: 0,
      estimated_cost_usd: 0,
      status: 'collecting',
    }

    await this.saveState(state)

    try {
      const startStr = `${startDate.getFullYear()}/${String(startDate.getMonth() + 1).padStart(2, '0')}/${String(startDate.getDate()).padStart(2, '0')}`
      const endStr = `${endDate.getFullYear()}/${String(endDate.getMonth() + 1).padStart(2, '0')}/${String(endDate.getDate()).padStart(2, '0')}`
      const query = `after:${startStr} before:${endStr}`

      const messageIds = await gmailService.collectAllMessageIds(query)

      state.total_messages = messageIds.length
      state.status = 'processing'

      // Store message IDs in a separate squad_messages row
      await this.supabase
        .from('squad_messages')
        .insert({
          from_agent: 'email_intelligence_scanner',
          to_agent: null,
          message: `Job ${jobId}: collected ${messageIds.length} message IDs`,
          task_id: null,
          data: {
            job_id: jobId,
            type: 'message_ids',
            message_ids: messageIds,
            timestamp: new Date().toISOString(),
          },
        })

      await this.saveState(state)
      return state

    } catch (error: any) {
      state.status = 'error'
      state.error_message = error.message
      await this.saveState(state)
      throw error
    }
  }

  /**
   * Phase 2: Process the next batch of emails for a given job.
   * Returns the updated state and whether there are more emails to process.
   */
  async processBatch(jobId: string): Promise<{ state: ScannerState; has_more: boolean; batch_results: any[] }> {
    // Load current state
    const state = await this.loadState(jobId)
    if (!state) {
      throw new Error(`Job ${jobId} not found`)
    }

    if (state.status === 'completed' || state.status === 'error') {
      return { state, has_more: false, batch_results: [] }
    }

    // Load message IDs
    const { data: idsRow } = await this.supabase
      .from('squad_messages')
      .select('data')
      .eq('from_agent', 'email_intelligence_scanner')
      .eq('data->>job_id', jobId)
      .eq('data->>type', 'message_ids')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!idsRow?.data?.message_ids) {
      throw new Error(`Message IDs not found for job ${jobId}`)
    }

    const allIds: string[] = idsRow.data.message_ids
    const startIdx = state.processed_count
    const batchIds = allIds.slice(startIdx, startIdx + BATCH_SIZE)

    if (batchIds.length === 0) {
      state.status = 'completed'
      await this.saveState(state)
      return { state, has_more: false, batch_results: [] }
    }

    const batchResults: any[] = []

    for (const gmailId of batchIds) {
      try {
        const message = await gmailService.getMessage(gmailId)

        // Skip very short or empty emails
        if (!message.body || message.body.length < 20) {
          state.processed_count++
          batchResults.push({ gmail_id: gmailId, skipped: true, reason: 'empty' })
          continue
        }

        const extracted = await this.analyzeEmail(message.from, message.subject, message.body, state)

        if (extracted.is_supplier_communication && extracted.confidence_score >= 0.6 && extracted.supplier) {
          // Ensure an email_logs row exists for the FK
          const emailLogId = await this.ensureEmailLogExists(gmailId, message)

          const supplier = await this.findOrCreateSupplier(extracted.supplier, state)

          if (extracted.products && extracted.products.length > 0) {
            for (const product of extracted.products) {
              await this.processProduct(supplier.id, product, extracted.pricing, state)
            }
          }

          if (extracted.supplier.contact_name && extracted.supplier.email) {
            await this.processContact(supplier.id, extracted.supplier, state)
          }

          if (extracted.interaction_type && emailLogId) {
            await this.logInteraction(emailLogId, supplier.id, extracted.interaction_type, extracted, state)
          }

          batchResults.push({
            gmail_id: gmailId,
            supplier: extracted.supplier.company,
            products: extracted.products?.length || 0,
            confidence: extracted.confidence_score,
          })
        } else {
          batchResults.push({ gmail_id: gmailId, skipped: true, reason: 'not_supplier' })
        }

        state.processed_count++
      } catch (error: any) {
        console.error(`Error processing Gmail message ${gmailId}:`, error.message)
        state.processed_count++
        state.errors++
        state.last_error = error.message
        batchResults.push({ gmail_id: gmailId, error: error.message })
      }
    }

    const hasMore = state.processed_count < state.total_messages
    if (!hasMore) {
      state.status = 'completed'
    }

    await this.saveState(state)

    return { state, has_more: hasMore, batch_results: batchResults }
  }

  private async analyzeEmail(
    fromEmail: string,
    subject: string,
    body: string,
    state: ScannerState
  ): Promise<ExtractedEmailData> {
    const prompt = `Analyze this email and extract supplier intelligence data.

FROM: ${fromEmail}
SUBJECT: ${subject}
BODY: ${body.substring(0, 4000)}

Extract the following information in JSON format:
{
  "is_supplier_communication": boolean,
  "interaction_type": "quote_request" | "quote_response" | "stock_inquiry" | "order_placement" | "support" | null,
  "supplier": {
    "company": "company name",
    "contact_name": "person's name from signature",
    "email": "email address",
    "phone": "phone number from signature",
    "specialties": ["product categories they supply"]
  },
  "products": [
    {
      "product_name": "full product name",
      "manufacturer": "brand/manufacturer",
      "model_number": "model number or SKU",
      "product_category": "category like 'headsets', 'speakers', etc",
      "quantity": number mentioned
    }
  ],
  "pricing": [
    {
      "product": "product name",
      "price": number,
      "currency": "ZAR/USD/etc",
      "quantity": number,
      "lead_time_days": number of days mentioned
    }
  ],
  "stock_info": [
    {
      "product": "product name",
      "availability": "in stock/out of stock/limited/on order",
      "stock_reliability": "always_in_stock/usually_available/often_delayed/unreliable"
    }
  ],
  "confidence_score": 0.0 to 1.0
}

Look for:
- Email signatures with company names, contact details
- Product mentions (especially Jabra, Poly, Logitech, Sonos, etc.)
- Pricing information in quotes
- Stock availability statements
- Lead times

If this is NOT a supplier communication, return is_supplier_communication: false and confidence_score: 0.
Focus on B2B supplier relationships, not customer emails.`

    const result = await chatCompletion(
      [{ role: 'user', content: prompt }],
      { maxTokens: 2000 }
    )

    // Track token usage and cost directly in state
    const cost = (result.usage.prompt_tokens * GPT_INPUT_COST) +
                 (result.usage.completion_tokens * GPT_OUTPUT_COST)
    state.tokens_used += result.usage.total_tokens
    state.estimated_cost_usd += cost

    // Extract JSON from response (model may wrap in markdown code blocks)
    let jsonStr = result.content.trim()
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }
    const parsed = JSON.parse(jsonStr)
    return parsed
  }

  private async ensureEmailLogExists(
    gmailId: string,
    message: { from: string; to: string; subject: string; date: string; body: string; snippet: string }
  ): Promise<string | null> {
    // Check if already exists
    const { data: existing } = await this.supabase
      .from('email_logs')
      .select('id')
      .eq('gmail_message_id', gmailId)
      .maybeSingle()

    if (existing) return existing.id

    // Insert a lightweight row
    const { data: inserted, error } = await this.supabase
      .from('email_logs')
      .insert({
        gmail_message_id: gmailId,
        from_email: message.from,
        to_email: message.to || null,
        subject: message.subject,
        category: 'other',
        status: 'archived',
        payload: { snippet: message.snippet },
        metadata: { source: 'historical_scan' },
      })
      .select('id')
      .maybeSingle()

    if (error) {
      console.error(`Failed to create email_logs row for ${gmailId}:`, error.message)
      return null
    }

    return inserted?.id || null
  }

  private async findOrCreateSupplier(supplierData: SupplierData, state: ScannerState): Promise<any> {
    const normalizedEmail = supplierData.email.toLowerCase().trim()
    const normalizedCompany = this.normalizeCompanyName(supplierData.company)

    const { data: existingSuppliers } = await this.supabase
      .from('suppliers')
      .select('*')
      .or(`email.eq.${normalizedEmail},company.ilike.%${normalizedCompany}%`)

    if (existingSuppliers && existingSuppliers.length > 0) {
      const bestMatch = this.findBestSupplierMatch(existingSuppliers, supplierData)

      const { data: updated } = await this.supabase
        .from('suppliers')
        .update({
          email: supplierData.email || bestMatch.email,
          phone: supplierData.phone || bestMatch.phone,
          specialties: this.mergeSpecialties(bestMatch.specialties, supplierData.specialties),
          last_contact_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', bestMatch.id)
        .select()
        .single()

      return updated || bestMatch
    }

    const { data: newSupplier, error } = await this.supabase
      .from('suppliers')
      .insert({
        name: supplierData.contact_name || 'Unknown Contact',
        company: supplierData.company,
        email: supplierData.email,
        phone: supplierData.phone,
        specialties: supplierData.specialties || [],
        relationship_strength: 50,
        reliability_score: 50,
        last_contact_date: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create supplier: ${error.message}`)
    }

    state.suppliers_found++
    return newSupplier
  }

  private normalizeCompanyName(company: string): string {
    return company
      .toLowerCase()
      .replace(/\b(pty|ltd|limited|inc|corp|corporation|llc)\b/gi, '')
      .replace(/[^\w\s]/g, '')
      .trim()
  }

  private findBestSupplierMatch(suppliers: any[], supplierData: SupplierData): any {
    const normalizedEmail = supplierData.email.toLowerCase()
    const exactEmailMatch = suppliers.find((s) => s.email?.toLowerCase() === normalizedEmail)
    if (exactEmailMatch) return exactEmailMatch

    const normalizedCompany = this.normalizeCompanyName(supplierData.company)
    const companyMatches = suppliers
      .map((s) => ({
        supplier: s,
        score: this.calculateSimilarity(this.normalizeCompanyName(s.company || ''), normalizedCompany),
      }))
      .sort((a, b) => b.score - a.score)

    return companyMatches[0]?.supplier || suppliers[0]
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(/\s+/)
    const words2 = str2.split(/\s+/)
    const commonWords = words1.filter((w) => words2.includes(w))
    return commonWords.length / Math.max(words1.length, words2.length)
  }

  private mergeSpecialties(existing: string[] = [], newSpecialties: string[] = []): string[] {
    const merged = new Set([...existing, ...newSpecialties])
    return Array.from(merged)
  }

  private async processProduct(
    supplierId: string,
    product: ProductData,
    pricingData: PricingData[] | undefined,
    state: ScannerState
  ): Promise<void> {
    const normalizedProductName = product.product_name.toLowerCase().trim()
    const normalizedModel = product.model_number?.toUpperCase().trim()

    const { data: existingProducts } = await this.supabase
      .from('supplier_products')
      .select('*')
      .eq('supplier_id', supplierId)
      .or(
        `product_name.ilike.%${normalizedProductName}%${
          normalizedModel ? `,model_number.eq.${normalizedModel}` : ''
        }`
      )

    const pricing = pricingData?.find((p) =>
      p.product.toLowerCase().includes(normalizedProductName)
    )

    if (existingProducts && existingProducts.length > 0) {
      const updateData: any = { updated_at: new Date().toISOString() }
      if (pricing) {
        updateData.last_quoted_price = pricing.price
        updateData.last_quoted_date = new Date().toISOString()
        if (pricing.lead_time_days) {
          updateData.typical_lead_time_days = pricing.lead_time_days
        }
      }
      await this.supabase.from('supplier_products').update(updateData).eq('id', existingProducts[0].id)
      return
    }

    await this.supabase.from('supplier_products').insert({
      supplier_id: supplierId,
      product_name: product.product_name,
      product_category: product.product_category,
      manufacturer: product.manufacturer,
      model_number: product.model_number,
      last_quoted_price: pricing?.price,
      last_quoted_date: pricing ? new Date().toISOString() : null,
      typical_lead_time_days: pricing?.lead_time_days,
      stock_reliability: 'usually_available',
    })

    state.products_found++
  }

  private async processContact(supplierId: string, supplierData: SupplierData, state: ScannerState): Promise<void> {
    const normalizedEmail = supplierData.email.toLowerCase().trim()

    const { data: existingContact } = await this.supabase
      .from('supplier_contacts')
      .select('*')
      .eq('supplier_id', supplierId)
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingContact) {
      await this.supabase
        .from('supplier_contacts')
        .update({
          contact_name: supplierData.contact_name || existingContact.contact_name,
          phone: supplierData.phone || existingContact.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingContact.id)
      return
    }

    await this.supabase.from('supplier_contacts').insert({
      supplier_id: supplierId,
      contact_name: supplierData.contact_name!,
      email: supplierData.email,
      phone: supplierData.phone,
      preferred_contact: false,
    })

    state.contacts_found++
  }

  private async logInteraction(
    emailLogId: string,
    supplierId: string,
    interactionType: string,
    extractedData: ExtractedEmailData,
    state: ScannerState
  ): Promise<void> {
    const productsMentioned = extractedData.products?.map((p) => p.product_name) || []

    const pricingData = extractedData.pricing?.reduce((acc, p) => {
      acc[p.product] = { price: p.price, currency: p.currency, quantity: p.quantity, lead_time_days: p.lead_time_days }
      return acc
    }, {} as any)

    const stockInfo = extractedData.stock_info?.reduce((acc, s) => {
      acc[s.product] = { availability: s.availability, stock_reliability: s.stock_reliability }
      return acc
    }, {} as any)

    await this.supabase.from('email_supplier_interactions').insert({
      email_log_id: emailLogId,
      supplier_id: supplierId,
      interaction_type: interactionType,
      products_mentioned: productsMentioned,
      pricing_data: pricingData || {},
      stock_info: stockInfo || {},
      extracted_at: new Date().toISOString(),
    })

    state.interactions_logged++
  }

  private async saveState(state: ScannerState): Promise<void> {
    await this.supabase
      .from('squad_messages')
      .insert({
        from_agent: 'email_intelligence_scanner',
        to_agent: null,
        message: `Job ${state.job_id}: ${state.status} (${state.processed_count}/${state.total_messages})`,
        task_id: null,
        data: {
          job_id: state.job_id,
          type: 'state',
          state,
          timestamp: new Date().toISOString(),
        },
      })
  }

  private async loadState(jobId: string): Promise<ScannerState | null> {
    const { data } = await this.supabase
      .from('squad_messages')
      .select('data')
      .eq('from_agent', 'email_intelligence_scanner')
      .eq('data->>job_id', jobId)
      .eq('data->>type', 'state')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return data?.data?.state || null
  }

  /** @deprecated Use startScan() + processBatch() instead */
  async scanHistoricalEmails(startDate: Date, endDate: Date, _resumeJobId?: string): Promise<ScannerState> {
    const state = await this.startScan(startDate, endDate)
    let hasMore = true
    while (hasMore) {
      const result = await this.processBatch(state.job_id)
      hasMore = result.has_more
      Object.assign(state, result.state)
    }
    return state
  }
}

/** @deprecated Use new EmailIntelligenceScanner().startScan() + .processBatch() */
export async function scanHistoricalEmails(
  startDate: Date,
  endDate: Date,
  resumeJobId?: string
): Promise<ScannerState> {
  const scanner = new EmailIntelligenceScanner()
  return await scanner.scanHistoricalEmails(startDate, endDate, resumeJobId)
}

/** @deprecated */
export async function createScannerInstance(): Promise<EmailIntelligenceScanner> {
  return new EmailIntelligenceScanner()
}
