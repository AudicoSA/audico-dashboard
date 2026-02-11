import Anthropic from '@anthropic-ai/sdk'
import { getServerSupabase } from './supabase'

interface EmailThread {
  id: string
  gmail_message_id: string
  from_email: string
  subject: string
  payload: any
  created_at: string
}

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
  total_emails: number
  processed_count: number
  suppliers_found: number
  products_found: number
  contacts_found: number
  interactions_logged: number
  status: 'running' | 'paused' | 'completed' | 'error'
  last_processed_email_id?: string
  error_message?: string
}

export class EmailIntelligenceScanner {
  private anthropic: Anthropic
  private supabase: ReturnType<typeof getServerSupabase>
  private state: ScannerState | null = null
  private isRunning: boolean = false

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

  async scanHistoricalEmails(
    startDate: Date,
    endDate: Date,
    resumeJobId?: string
  ): Promise<ScannerState> {
    try {
      if (resumeJobId) {
        await this.resumeJob(resumeJobId)
      } else {
        await this.initializeJob(startDate, endDate)
      }

      if (!this.state) {
        throw new Error('Failed to initialize scanner state')
      }

      this.isRunning = true
      await this.logProgress('Scan started', { job_id: this.state.job_id })

      const emails = await this.fetchEmailsInRange(
        new Date(this.state.start_date),
        new Date(this.state.end_date),
        this.state.last_processed_email_id
      )

      if (this.state.total_emails === 0) {
        this.state.total_emails = emails.length
      }

      for (const email of emails) {
        if (!this.isRunning) {
          this.state.status = 'paused'
          await this.saveState()
          break
        }

        await this.processEmail(email)
        
        this.state.processed_count++
        this.state.last_processed_email_id = email.id

        if (this.state.processed_count % 10 === 0) {
          await this.logProgress(
            `Scanned ${this.state.processed_count}/${this.state.total_emails} emails, found ${this.state.suppliers_found} suppliers, ${this.state.products_found} products`,
            {
              processed: this.state.processed_count,
              total: this.state.total_emails,
              suppliers: this.state.suppliers_found,
              products: this.state.products_found,
            }
          )
          await this.saveState()
        }
      }

      if (this.isRunning) {
        this.state.status = 'completed'
        await this.logProgress(
          `Scan completed: ${this.state.processed_count} emails processed, ${this.state.suppliers_found} suppliers, ${this.state.products_found} products, ${this.state.interactions_logged} interactions`,
          {
            final_stats: {
              processed: this.state.processed_count,
              suppliers: this.state.suppliers_found,
              products: this.state.products_found,
              contacts: this.state.contacts_found,
              interactions: this.state.interactions_logged,
            },
          }
        )
      }

      await this.saveState()
      return this.state

    } catch (error: any) {
      if (this.state) {
        this.state.status = 'error'
        this.state.error_message = error.message
        await this.saveState()
      }
      await this.logProgress(`Scan error: ${error.message}`, { error: error.message })
      throw error
    }
  }

  async pauseScan(): Promise<void> {
    this.isRunning = false
  }

  private async initializeJob(startDate: Date, endDate: Date): Promise<void> {
    const jobId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    this.state = {
      job_id: jobId,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      total_emails: 0,
      processed_count: 0,
      suppliers_found: 0,
      products_found: 0,
      contacts_found: 0,
      interactions_logged: 0,
      status: 'running',
    }

    await this.saveState()
  }

  private async resumeJob(jobId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('squad_messages')
      .select('data')
      .eq('from_agent', 'email_intelligence_scanner')
      .eq('data->>job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data?.data?.state) {
      throw new Error(`Failed to resume job ${jobId}: Job state not found`)
    }

    this.state = data.data.state
    if (this.state) {
      this.state.status = 'running'
    }
  }

  private async saveState(): Promise<void> {
    if (!this.state) return

    await this.supabase
      .from('squad_messages')
      .insert({
        from_agent: 'email_intelligence_scanner',
        to_agent: null,
        message: `Job state update: ${this.state.status}`,
        task_id: null,
        data: {
          job_id: this.state.job_id,
          state: this.state,
          timestamp: new Date().toISOString(),
        },
      })
  }

  private async fetchEmailsInRange(
    startDate: Date,
    endDate: Date,
    afterEmailId?: string
  ): Promise<EmailThread[]> {
    let query = this.supabase
      .from('email_logs')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true })

    if (afterEmailId) {
      const { data: afterEmail } = await this.supabase
        .from('email_logs')
        .select('created_at')
        .eq('id', afterEmailId)
        .single()

      if (afterEmail) {
        query = query.gt('created_at', afterEmail.created_at)
      }
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch emails: ${error.message}`)
    }

    return (data || []) as EmailThread[]
  }

  private async processEmail(email: EmailThread): Promise<void> {
    try {
      const emailBody = this.extractEmailBody(email.payload)
      const extractedData = await this.analyzeEmailWithClaude(
        email.from_email,
        email.subject,
        emailBody
      )

      if (!extractedData.is_supplier_communication || extractedData.confidence_score < 0.6) {
        return
      }

      if (extractedData.supplier) {
        await this.processSupplierData(extractedData.supplier, email, extractedData)
      }

    } catch (error: any) {
      console.error(`Error processing email ${email.id}:`, error.message)
      await this.logProgress(`Error processing email ${email.id}: ${error.message}`, {
        email_id: email.id,
        error: error.message,
      })
    }
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

  private async analyzeEmailWithClaude(
    fromEmail: string,
    subject: string,
    body: string
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
          is_supplier_communication: false,
          confidence_score: 0,
        }
      }

      const parsed = JSON.parse(jsonMatch[0])
      return parsed

    } catch (error: any) {
      console.error('Claude API error:', error.message)
      return {
        is_supplier_communication: false,
        confidence_score: 0,
      }
    }
  }

  private async processSupplierData(
    supplierData: SupplierData,
    email: EmailThread,
    extractedData: ExtractedEmailData
  ): Promise<void> {
    const existingSupplier = await this.findOrCreateSupplier(supplierData)
    
    if (extractedData.products && extractedData.products.length > 0) {
      for (const product of extractedData.products) {
        await this.processProduct(existingSupplier.id, product, extractedData.pricing)
      }
    }

    if (supplierData.contact_name && supplierData.email) {
      await this.processContact(existingSupplier.id, supplierData)
    }

    if (extractedData.interaction_type) {
      await this.logInteraction(
        email.id,
        existingSupplier.id,
        extractedData.interaction_type,
        extractedData
      )
    }
  }

  private async findOrCreateSupplier(supplierData: SupplierData): Promise<any> {
    const normalizedEmail = supplierData.email.toLowerCase().trim()
    const normalizedCompany = this.normalizeCompanyName(supplierData.company)

    let { data: existingSuppliers, error: searchError } = await this.supabase
      .from('suppliers')
      .select('*')
      .or(`email.eq.${normalizedEmail},company.ilike.%${normalizedCompany}%`)

    if (searchError) {
      throw new Error(`Failed to search suppliers: ${searchError.message}`)
    }

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

    const { data: newSupplier, error: insertError } = await this.supabase
      .from('suppliers')
      .insert({
        name: supplierData.contact_name || 'Unknown Contact',
        company: supplierData.company,
        email: supplierData.email,
        phone: supplierData.phone,
        specialties: supplierData.specialties || [],
        relationship_strength: 50,
        last_contact_date: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create supplier: ${insertError.message}`)
    }

    if (this.state) {
      this.state.suppliers_found++
    }

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
    
    const exactEmailMatch = suppliers.find(
      (s) => s.email.toLowerCase() === normalizedEmail
    )
    if (exactEmailMatch) return exactEmailMatch

    const normalizedCompany = this.normalizeCompanyName(supplierData.company)
    const companyMatches = suppliers
      .map((s) => ({
        supplier: s,
        score: this.calculateSimilarity(
          this.normalizeCompanyName(s.company),
          normalizedCompany
        ),
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
    pricingData?: PricingData[]
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
      const bestMatch = existingProducts[0]
      
      const updateData: any = {
        updated_at: new Date().toISOString(),
      }

      if (pricing) {
        updateData.last_quoted_price = pricing.price
        updateData.last_quoted_date = new Date().toISOString()
        if (pricing.lead_time_days) {
          updateData.typical_lead_time_days = pricing.lead_time_days
        }
      }

      await this.supabase
        .from('supplier_products')
        .update(updateData)
        .eq('id', bestMatch.id)

      return
    }

    await this.supabase
      .from('supplier_products')
      .insert({
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

    if (this.state) {
      this.state.products_found++
    }
  }

  private async processContact(supplierId: string, supplierData: SupplierData): Promise<void> {
    const normalizedEmail = supplierData.email.toLowerCase().trim()

    const { data: existingContact } = await this.supabase
      .from('supplier_contacts')
      .select('*')
      .eq('supplier_id', supplierId)
      .eq('email', normalizedEmail)
      .single()

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

    await this.supabase
      .from('supplier_contacts')
      .insert({
        supplier_id: supplierId,
        contact_name: supplierData.contact_name!,
        email: supplierData.email,
        phone: supplierData.phone,
        preferred_contact: false,
      })

    if (this.state) {
      this.state.contacts_found++
    }
  }

  private async logInteraction(
    emailLogId: string,
    supplierId: string,
    interactionType: string,
    extractedData: ExtractedEmailData
  ): Promise<void> {
    const productsMentioned = extractedData.products?.map((p) => p.product_name) || []
    
    const pricingData = extractedData.pricing?.reduce((acc, p) => {
      acc[p.product] = {
        price: p.price,
        currency: p.currency,
        quantity: p.quantity,
        lead_time_days: p.lead_time_days,
      }
      return acc
    }, {} as any)

    const stockInfo = extractedData.stock_info?.reduce((acc, s) => {
      acc[s.product] = {
        availability: s.availability,
        stock_reliability: s.stock_reliability,
      }
      return acc
    }, {} as any)

    await this.supabase
      .from('email_supplier_interactions')
      .insert({
        email_log_id: emailLogId,
        supplier_id: supplierId,
        interaction_type: interactionType,
        products_mentioned: productsMentioned,
        pricing_data: pricingData || {},
        stock_info: stockInfo || {},
        extracted_at: new Date().toISOString(),
      })

    if (this.state) {
      this.state.interactions_logged++
    }
  }

  private async logProgress(message: string, data: any = {}): Promise<void> {
    await this.supabase
      .from('squad_messages')
      .insert({
        from_agent: 'email_intelligence_scanner',
        to_agent: null,
        message,
        task_id: null,
        data,
      })
  }

  getState(): ScannerState | null {
    return this.state
  }
}

export async function scanHistoricalEmails(
  startDate: Date,
  endDate: Date,
  resumeJobId?: string
): Promise<ScannerState> {
  const scanner = new EmailIntelligenceScanner()
  return await scanner.scanHistoricalEmails(startDate, endDate, resumeJobId)
}

export async function createScannerInstance(): Promise<EmailIntelligenceScanner> {
  return new EmailIntelligenceScanner()
}
