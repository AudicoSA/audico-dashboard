import Anthropic from '@anthropic-ai/sdk'
import { getServerSupabase } from './supabase'

interface EmailData {
  id?: string
  gmail_message_id?: string
  from_email: string
  subject: string
  body: string
}

interface CustomerDetails {
  name?: string
  company?: string
  email: string
  phone?: string
}

interface RequestedProduct {
  product_name: string
  quantity?: number
  model_number?: string
  manufacturer?: string
  notes?: string
}

interface QuoteRequestData {
  is_quote_request: boolean
  confidence_score: number
  customer: CustomerDetails
  requested_products: RequestedProduct[]
  urgency_level?: 'low' | 'medium' | 'high' | 'urgent'
  special_requirements?: string[]
  delivery_location?: string
  expected_response_time?: string
}

export class QuoteRequestDetector {
  private anthropic: Anthropic
  private supabase: ReturnType<typeof getServerSupabase>

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

  async detectQuoteRequest(email: EmailData): Promise<{
    isQuoteRequest: boolean
    quoteRequestId?: string
    taskId?: string
    confidenceScore: number
    extractedData?: QuoteRequestData
  }> {
    try {
      const extractedData = await this.analyzeEmailWithClaude(email)

      if (!extractedData.is_quote_request || extractedData.confidence_score < 0.5) {
        return {
          isQuoteRequest: false,
          confidenceScore: extractedData.confidence_score,
        }
      }

      const quoteRequest = await this.createQuoteRequest(email, extractedData)

      let taskId: string | undefined

      if (extractedData.confidence_score > 0.8) {
        taskId = await this.createQuoteAgentTask(quoteRequest, extractedData)
        await this.logToSquadMessages(
          'email_agent',
          `High-confidence quote request detected (${Math.round(extractedData.confidence_score * 100)}%) - Auto-assigned to Mpho`,
          {
            quote_request_id: quoteRequest.id,
            task_id: taskId,
            confidence: extractedData.confidence_score,
          }
        )
      } else if (extractedData.confidence_score >= 0.5 && extractedData.confidence_score <= 0.8) {
        taskId = await this.createKennyReviewTask(quoteRequest, extractedData)
        await this.logToSquadMessages(
          'email_agent',
          `Medium-confidence quote request detected (${Math.round(extractedData.confidence_score * 100)}%) - Requires Kenny's review`,
          {
            quote_request_id: quoteRequest.id,
            task_id: taskId,
            confidence: extractedData.confidence_score,
          }
        )
      }

      return {
        isQuoteRequest: true,
        quoteRequestId: quoteRequest.id,
        taskId,
        confidenceScore: extractedData.confidence_score,
        extractedData,
      }

    } catch (error: any) {
      console.error('Quote request detection error:', error)
      await this.logToSquadMessages(
        'email_agent',
        `Quote detection failed: ${error.message}`,
        { error: error.message, email_id: email.id }
      )
      throw error
    }
  }

  private async analyzeEmailWithClaude(email: EmailData): Promise<QuoteRequestData> {
    const prompt = `Analyze this email to determine if it's a quote request.

FROM: ${email.from_email}
SUBJECT: ${email.subject}
BODY: ${email.body.substring(0, 4000)}

Quote request indicators include keywords like:
- 'quote', 'quotation', 'pricing', 'price', 'cost'
- 'how much', 'price for', 'cost for', 'what would it cost'
- 'RFQ' (Request for Quote), 'price list'
- Product quantities like '25 x Jabra EVOLVE2 75UC' or '10 units of'
- Phrases like 'need pricing', 'can you quote', 'please send quote'

Extract the following information in JSON format:
{
  "is_quote_request": boolean,
  "confidence_score": 0.0 to 1.0,
  "customer": {
    "name": "customer name if mentioned",
    "company": "company name if mentioned",
    "email": "customer email",
    "phone": "phone number if provided"
  },
  "requested_products": [
    {
      "product_name": "full product name",
      "quantity": number if specified,
      "model_number": "model/SKU if specified",
      "manufacturer": "brand like Jabra, Poly, Logitech, Sonos",
      "notes": "any specific requirements"
    }
  ],
  "urgency_level": "low" | "medium" | "high" | "urgent",
  "special_requirements": ["any special requirements, customization, warranties, etc"],
  "delivery_location": "delivery address or location if mentioned",
  "expected_response_time": "when they need a response (e.g., 'ASAP', 'by Friday', 'urgent')"
}

Confidence scoring guide:
- 1.0: Clear quote request with specific products and quantities
- 0.8-0.9: Clear quote request but missing some details (products mentioned but no quantities)
- 0.6-0.7: Likely quote request with pricing inquiry but vague products
- 0.4-0.5: Ambiguous - could be a quote request or general inquiry
- 0.0-0.3: Not a quote request

If this is NOT a quote request (e.g., it's a support email, order confirmation, general inquiry without pricing intent), return is_quote_request: false and confidence_score below 0.5.`

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
          is_quote_request: false,
          confidence_score: 0,
          customer: {
            email: email.from_email,
          },
          requested_products: [],
        }
      }

      const parsed = JSON.parse(jsonMatch[0])
      
      if (!parsed.customer) {
        parsed.customer = { email: email.from_email }
      } else if (!parsed.customer.email) {
        parsed.customer.email = email.from_email
      }

      return parsed

    } catch (error: any) {
      console.error('Claude API error in quote detection:', error.message)
      return {
        is_quote_request: false,
        confidence_score: 0,
        customer: {
          email: email.from_email,
        },
        requested_products: [],
      }
    }
  }

  private async createQuoteRequest(
    email: EmailData,
    extractedData: QuoteRequestData
  ): Promise<any> {
    const requestedProducts = extractedData.requested_products.map((product, index) => {
      const productData: any = {
        product_name: product.product_name,
        quantity: product.quantity || null,
        model_number: product.model_number || null,
        manufacturer: product.manufacturer || null,
        notes: product.notes || null,
      }
      
      if (index === 0) {
        productData._metadata = {
          urgency_level: extractedData.urgency_level,
          special_requirements: extractedData.special_requirements || [],
          delivery_location: extractedData.delivery_location,
          expected_response_time: extractedData.expected_response_time,
          customer_company: extractedData.customer.company,
          customer_phone: extractedData.customer.phone,
          email_subject: email.subject,
        }
      }
      
      return productData
    })

    const { data, error } = await this.supabase
      .from('quote_requests')
      .insert({
        customer_email: extractedData.customer.email,
        customer_name: extractedData.customer.name || null,
        requested_products: requestedProducts,
        source_email_id: email.id || null,
        status: 'detected',
        confidence_score: extractedData.confidence_score,
        assigned_agent: null,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create quote request: ${error.message}`)
    }

    return data
  }

  private async createQuoteAgentTask(
    quoteRequest: any,
    extractedData: QuoteRequestData
  ): Promise<string> {
    const productList = extractedData.requested_products
      .map((p) => `${p.quantity ? p.quantity + ' x ' : ''}${p.product_name}`)
      .join(', ')

    const urgencyTag = extractedData.urgency_level === 'urgent' || extractedData.urgency_level === 'high' 
      ? ' [URGENT]' 
      : ''

    const description = `Quote request from ${extractedData.customer.name || extractedData.customer.email}${urgencyTag}

Products requested:
${extractedData.requested_products.map((p) => 
  `- ${p.quantity ? p.quantity + ' x ' : ''}${p.product_name}${p.model_number ? ' (' + p.model_number + ')' : ''}`
).join('\n')}

${extractedData.customer.company ? `Company: ${extractedData.customer.company}\n` : ''}${extractedData.customer.phone ? `Phone: ${extractedData.customer.phone}\n` : ''}${extractedData.special_requirements?.length ? `\nSpecial requirements:\n${extractedData.special_requirements.map(r => `- ${r}`).join('\n')}` : ''}${extractedData.expected_response_time ? `\nExpected response: ${extractedData.expected_response_time}` : ''}

Confidence: ${Math.round(extractedData.confidence_score * 100)}%`

    const priority = extractedData.urgency_level === 'urgent' 
      ? 'urgent' 
      : extractedData.urgency_level === 'high' 
      ? 'high' 
      : 'medium'

    const { data, error } = await this.supabase
      .from('squad_tasks')
      .insert({
        title: `Quote Request: ${productList.substring(0, 80)}${productList.length > 80 ? '...' : ''}`,
        description,
        status: 'new',
        assigned_agent: 'Mpho',
        priority,
        mentions_kenny: false,
        deliverable_url: null,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create quote agent task: ${error.message}`)
    }

    await this.supabase
      .from('quote_requests')
      .update({ assigned_agent: 'Mpho' })
      .eq('id', quoteRequest.id)

    return data.id
  }

  private async createKennyReviewTask(
    quoteRequest: any,
    extractedData: QuoteRequestData
  ): Promise<string> {
    const productList = extractedData.requested_products
      .map((p) => `${p.quantity ? p.quantity + ' x ' : ''}${p.product_name}`)
      .join(', ')

    const description = `Potential quote request detected - needs review

From: ${extractedData.customer.name || extractedData.customer.email}
Confidence: ${Math.round(extractedData.confidence_score * 100)}%

Products mentioned:
${extractedData.requested_products.map((p) => 
  `- ${p.quantity ? p.quantity + ' x ' : ''}${p.product_name}${p.model_number ? ' (' + p.model_number + ')' : ''}`
).join('\n')}

${extractedData.customer.company ? `Company: ${extractedData.customer.company}\n` : ''}${extractedData.customer.phone ? `Phone: ${extractedData.customer.phone}\n` : ''}
Please review and confirm if this should be processed as a quote request.`

    const { data, error } = await this.supabase
      .from('squad_tasks')
      .insert({
        title: `Review: Possible Quote - ${productList.substring(0, 60)}${productList.length > 60 ? '...' : ''}`,
        description,
        status: 'new',
        assigned_agent: 'Jarvis',
        priority: 'medium',
        mentions_kenny: true,
        deliverable_url: null,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create Kenny review task: ${error.message}`)
    }

    await this.supabase
      .from('quote_requests')
      .update({ assigned_agent: 'Jarvis' })
      .eq('id', quoteRequest.id)

    return data.id
  }

  private async logToSquadMessages(fromAgent: string, message: string, data: any = null): Promise<void> {
    await this.supabase
      .from('squad_messages')
      .insert({
        from_agent: fromAgent,
        to_agent: null,
        message,
        task_id: data?.task_id || null,
        data,
      })
  }
}

export async function detectQuoteRequest(email: EmailData): Promise<{
  isQuoteRequest: boolean
  quoteRequestId?: string
  taskId?: string
  confidenceScore: number
  extractedData?: QuoteRequestData
}> {
  const detector = new QuoteRequestDetector()
  return await detector.detectQuoteRequest(email)
}
