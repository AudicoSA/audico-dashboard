import Anthropic from '@anthropic-ai/sdk'
import { getServerSupabase } from './supabase'

interface QuoteRequest {
  id: string
  customer_email: string
  customer_name: string | null
  requested_products: Array<{
    product_name: string
    quantity?: number
    model_number?: string
    manufacturer?: string
    notes?: string
    _metadata?: any
  }>
  source_email_id: string | null
  status: string
  confidence_score: number
  created_at: string
  metadata?: any
}

interface EmailLog {
  id: string
  gmail_message_id: string
  from_email: string
  subject: string
  payload: any
  created_at: string
}

interface CustomerProfile {
  segment: 'first_time' | 'repeat' | 'high_value' | 'dormant'
  total_orders: number
  total_revenue: number
  last_order_date: string | null
  interaction_count: number
  avg_response_time_hours: number | null
  preferred_tone: 'formal' | 'casual' | 'friendly' | 'professional' | null
}

interface ToneAnalysis {
  tone: 'formal' | 'casual' | 'friendly' | 'professional'
  urgency: 'low' | 'medium' | 'high' | 'urgent'
  relationship_indicators: string[]
  confidence: number
}

interface Template {
  id: string
  template_name: string
  variant_name: string
  tone: string
  customer_segment: string
  urgency_level: string | null
  subject_template: string
  body_template: string
  signature_template: string
  follow_up_template: string | null
  priority: number
}

interface GeneratedEmail {
  subject: string
  body: string
  tone: string
  urgency: string
  customer_segment: string
  template_id: string | null
  products_mentioned: string[]
  value_props_highlighted: string[]
  follow_up_actions: string[]
  relationship_history: any
}

export class QuoteTemplateEngine {
  private anthropic: Anthropic
  private supabase: ReturnType<typeof getServerSupabase>
  private agentName = 'QuoteTemplateEngine'

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

  async generateQuoteEmail(
    quoteRequestId: string,
    pdfUrl: string
  ): Promise<{
    success: boolean
    emailSendId?: string
    email?: GeneratedEmail
    error?: string
  }> {
    try {
      const quoteRequest = await this.fetchQuoteRequest(quoteRequestId)
      if (!quoteRequest) {
        throw new Error(`Quote request ${quoteRequestId} not found`)
      }

      const sourceEmail = quoteRequest.source_email_id
        ? await this.fetchEmailLog(quoteRequest.source_email_id)
        : null

      const toneAnalysis = sourceEmail
        ? await this.analyzeToneAndUrgency(sourceEmail, quoteRequest)
        : this.getDefaultToneAnalysis()

      const customerProfile = await this.buildCustomerProfile(
        quoteRequest.customer_email
      )

      const template = await this.selectBestTemplate(
        customerProfile,
        toneAnalysis
      )

      const email = await this.generatePersonalizedEmail(
        quoteRequest,
        toneAnalysis,
        customerProfile,
        template,
        pdfUrl,
        sourceEmail
      )

      const emailSend = await this.recordEmailSend(
        quoteRequest,
        email,
        pdfUrl,
        toneAnalysis,
        customerProfile
      )

      await this.updateQuoteRequestStatus(quoteRequestId, pdfUrl)

      await this.logToSquad(
        `Quote email generated for ${quoteRequest.customer_name || quoteRequest.customer_email}`,
        {
          quote_request_id: quoteRequestId,
          email_send_id: emailSend.id,
          tone: email.tone,
          segment: email.customer_segment,
          template_used: email.template_id,
        }
      )

      return {
        success: true,
        emailSendId: emailSend.id,
        email,
      }

    } catch (error: any) {
      console.error('Error generating quote email:', error)
      await this.logToSquad(
        `Quote email generation failed: ${error.message}`,
        { quote_request_id: quoteRequestId, error: error.message }
      )
      return {
        success: false,
        error: error.message,
      }
    }
  }

  private async fetchQuoteRequest(quoteRequestId: string): Promise<QuoteRequest | null> {
    const { data, error } = await this.supabase
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

  private async analyzeToneAndUrgency(
    sourceEmail: EmailLog,
    quoteRequest: QuoteRequest
  ): Promise<ToneAnalysis> {
    const emailBody = this.extractEmailBody(sourceEmail.payload)
    const metadata = quoteRequest.requested_products[0]?._metadata

    const prompt = `Analyze the tone and urgency of this customer quote request email.

FROM: ${sourceEmail.from_email}
SUBJECT: ${sourceEmail.subject}
BODY: ${emailBody.substring(0, 2000)}

Additional context:
${metadata?.urgency_level ? `- Detected urgency: ${metadata.urgency_level}` : ''}
${metadata?.expected_response_time ? `- Expected response: ${metadata.expected_response_time}` : ''}

Analyze and return JSON:
{
  "tone": "formal" | "casual" | "friendly" | "professional",
  "urgency": "low" | "medium" | "high" | "urgent",
  "relationship_indicators": ["list of indicators like 'first time inquiry', 'returning customer', 'urgent deadline', etc"],
  "confidence": 0.0 to 1.0
}

Tone guidelines:
- formal: Very professional language, titles used, no contractions
- professional: Business-like but approachable, standard business language
- friendly: Warm and personable, uses first names
- casual: Relaxed, conversational, informal

Urgency indicators:
- urgent: Words like "ASAP", "urgent", "immediate", "today", specific tight deadlines
- high: "soon", "quickly", "this week", time pressure mentioned
- medium: Standard quote request, no specific urgency
- low: "when you have time", "no rush", exploratory inquiry`

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      })

      const responseText = message.content[0].type === 'text' 
        ? message.content[0].text 
        : ''

      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (error) {
      console.error('Error analyzing tone:', error)
    }

    return this.getDefaultToneAnalysis()
  }

  private getDefaultToneAnalysis(): ToneAnalysis {
    return {
      tone: 'professional',
      urgency: 'medium',
      relationship_indicators: [],
      confidence: 0.5,
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

  private async buildCustomerProfile(customerEmail: string): Promise<CustomerProfile> {
    const { data: pastQuotes } = await this.supabase
      .from('quote_requests')
      .select('*')
      .eq('customer_email', customerEmail)
      .eq('status', 'sent_to_customer')
      .order('created_at', { ascending: false })

    const { data: interactions } = await this.supabase
      .from('customer_interactions')
      .select('*')
      .eq('customer_email', customerEmail)
      .order('interaction_date', { ascending: false })

    const { data: emailResponses } = await this.supabase
      .from('quote_email_responses')
      .select('*, email_send:quote_email_sends!inner(*)')
      .eq('email_send.customer_email', customerEmail)

    const totalOrders = pastQuotes?.length || 0
    const totalRevenue = 0 // Would come from actual order data
    const lastOrderDate = pastQuotes?.[0]?.created_at || null
    const interactionCount = (interactions?.length || 0) + totalOrders

    const avgResponseTime = emailResponses && emailResponses.length > 0
      ? emailResponses.reduce((sum, r) => sum + (r.response_time_hours || 0), 0) / emailResponses.length
      : null

    let segment: CustomerProfile['segment'] = 'first_time'
    
    if (totalOrders === 0) {
      segment = 'first_time'
    } else if (totalRevenue > 100000) {
      segment = 'high_value'
    } else if (lastOrderDate) {
      const daysSinceLastOrder = (Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceLastOrder > 180) {
        segment = 'dormant'
      } else {
        segment = 'repeat'
      }
    } else {
      segment = 'repeat'
    }

    const preferredTone = await this.determinePreferredTone(customerEmail)

    return {
      segment,
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      last_order_date: lastOrderDate,
      interaction_count: interactionCount,
      avg_response_time_hours: avgResponseTime,
      preferred_tone: preferredTone,
    }
  }

  private async determinePreferredTone(
    customerEmail: string
  ): Promise<'formal' | 'casual' | 'friendly' | 'professional' | null> {
    const { data: bestPerformingTemplate } = await this.supabase
      .from('quote_email_sends')
      .select(`
        tone_detected,
        responses:quote_email_responses!inner(converted)
      `)
      .eq('customer_email', customerEmail)
      .eq('responses.converted', true)
      .order('sent_at', { ascending: false })
      .limit(1)
      .single()

    return (bestPerformingTemplate?.tone_detected as any) || null
  }

  private async selectBestTemplate(
    customerProfile: CustomerProfile,
    toneAnalysis: ToneAnalysis
  ): Promise<Template | null> {
    const tone = customerProfile.preferred_tone || toneAnalysis.tone

    const { data: templates } = await this.supabase
      .from('quote_email_templates')
      .select('*')
      .eq('active', true)
      .or(`customer_segment.eq.${customerProfile.segment},customer_segment.eq.any`)
      .or(`urgency_level.eq.${toneAnalysis.urgency},urgency_level.is.null`)
      .order('priority', { ascending: false })

    if (!templates || templates.length === 0) {
      return null
    }

    const { data: performance } = await this.supabase
      .from('quote_template_performance')
      .select('*')
      .in('template_id', templates.map((t: any) => t.id))
      .gte('sends_count', 5)
      .order('conversion_rate', { ascending: false })

    if (performance && performance.length > 0) {
      const bestTemplateId = performance[0].template_id
      const bestTemplate = templates.find((t: any) => t.id === bestTemplateId)
      if (bestTemplate) {
        return bestTemplate as Template
      }
    }

    const matchingTone = templates.find((t: any) => t.tone === tone)
    if (matchingTone) {
      return matchingTone as Template
    }

    return templates[0] as Template
  }

  private async generatePersonalizedEmail(
    quoteRequest: QuoteRequest,
    toneAnalysis: ToneAnalysis,
    customerProfile: CustomerProfile,
    template: Template | null,
    pdfUrl: string,
    sourceEmail: EmailLog | null
  ): Promise<GeneratedEmail> {
    const products = quoteRequest.requested_products
      .map(p => `${p.quantity ? p.quantity + ' x ' : ''}${p.product_name}`)
      .join(', ')

    const productList = quoteRequest.requested_products
      .map(p => `- ${p.quantity ? p.quantity + ' x ' : ''}${p.product_name}${p.model_number ? ' (' + p.model_number + ')' : ''}`)
      .join('\n')

    const originalEmailContext = sourceEmail
      ? `\n\nOriginal customer email context:\nSubject: ${sourceEmail.subject}\nBody excerpt: ${this.extractEmailBody(sourceEmail.payload).substring(0, 500)}`
      : ''

    const prompt = `Generate a personalized quote email for a customer.

CUSTOMER PROFILE:
- Name: ${quoteRequest.customer_name || 'Customer'}
- Email: ${quoteRequest.customer_email}
- Segment: ${customerProfile.segment}
- Previous orders: ${customerProfile.total_orders}
- Total interactions: ${customerProfile.interaction_count}

QUOTE DETAILS:
- Products requested:
${productList}
- Quote number: Q-${quoteRequest.id.substring(0, 8).toUpperCase()}
- PDF attachment: ${pdfUrl}

TONE & STYLE:
- Required tone: ${toneAnalysis.tone}
- Urgency level: ${toneAnalysis.urgency}
- Relationship indicators: ${toneAnalysis.relationship_indicators.join(', ')}
${originalEmailContext}

${template ? `TEMPLATE GUIDANCE (adapt, don't copy exactly):
Subject template: ${template.subject_template}
Body structure: ${template.body_template}
Signature: ${template.signature_template}
${template.follow_up_template ? `Follow-up: ${template.follow_up_template}` : ''}` : ''}

VALUE PROPOSITIONS TO HIGHLIGHT (choose 2-3 most relevant):
- Competitive pricing with best market rates
- All items in stock and ready to ship
- Fast delivery (2-3 business days standard)
- Expert technical support included
- Flexible payment terms available
- Volume discounts for bulk orders
- Warranty coverage on all products
- Local stock availability (no import delays)

FOLLOW-UP ACTIONS (suggest 1-2 appropriate ones):
- "Reply to this email with any questions"
- "Call me at [number] to discuss technical requirements"
- "Schedule a product demo/consultation"
- "I can arrange installation services if needed"
- "Let me know if you'd like to adjust quantities or add items"
- "I'm available for a quick call to walk through the quote"

Generate a complete email in JSON format:
{
  "subject": "compelling subject line",
  "body": "full email body mentioning specific products, highlighting value props, including PDF reference, appropriate sign-off",
  "value_props_used": ["list of value propositions you highlighted"],
  "follow_up_actions": ["list of follow-up actions you suggested"],
  "products_mentioned": ["list of product names referenced"]
}

Requirements:
- Match the ${toneAnalysis.tone} tone throughout
- Reference specific products by name
- Mention the PDF attachment naturally
- For ${customerProfile.segment} customers: ${this.getSegmentGuidance(customerProfile.segment)}
- Urgency level ${toneAnalysis.urgency}: ${this.getUrgencyGuidance(toneAnalysis.urgency)}
- Keep it concise and scannable
- End with clear next steps`

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })

      const responseText = message.content[0].type === 'text' 
        ? message.content[0].text 
        : ''

      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        
        return {
          subject: parsed.subject,
          body: parsed.body,
          tone: toneAnalysis.tone,
          urgency: toneAnalysis.urgency,
          customer_segment: customerProfile.segment,
          template_id: template?.id || null,
          products_mentioned: parsed.products_mentioned || [],
          value_props_highlighted: parsed.value_props_used || [],
          follow_up_actions: parsed.follow_up_actions || [],
          relationship_history: {
            total_orders: customerProfile.total_orders,
            total_interactions: customerProfile.interaction_count,
            last_order_date: customerProfile.last_order_date,
          },
        }
      }
    } catch (error) {
      console.error('Error generating personalized email:', error)
    }

    return this.generateFallbackEmail(quoteRequest, toneAnalysis, customerProfile, pdfUrl, template)
  }

  private getSegmentGuidance(segment: string): string {
    const guidance: Record<string, string> = {
      first_time: 'Establish trust, explain your process, offer to answer questions',
      repeat: 'Reference past business, express appreciation, be friendly and efficient',
      high_value: 'Provide VIP treatment, offer dedicated support, mention priority handling',
      dormant: 'Welcome them back, highlight what\'s new, offer incentive to return',
    }
    return guidance[segment] || ''
  }

  private getUrgencyGuidance(urgency: string): string {
    const guidance: Record<string, string> = {
      urgent: 'Emphasize immediate availability, priority processing, express readiness to expedite',
      high: 'Mention fast turnaround, highlight in-stock status, suggest quick next steps',
      medium: 'Standard professional approach, clear timeline expectations',
      low: 'Provide thorough information, no pressure, offer to answer questions when convenient',
    }
    return guidance[urgency] || ''
  }

  private generateFallbackEmail(
    quoteRequest: QuoteRequest,
    toneAnalysis: ToneAnalysis,
    customerProfile: CustomerProfile,
    pdfUrl: string,
    template: Template | null
  ): GeneratedEmail {
    const quoteNumber = `Q-${quoteRequest.id.substring(0, 8).toUpperCase()}`
    const products = quoteRequest.requested_products
      .map(p => p.product_name)
      .join(', ')
    
    const subject = template?.subject_template
      .replace('{quote_number}', quoteNumber)
      .replace('{customer_name}', quoteRequest.customer_name || 'Customer')
      .replace('{product_summary}', products.substring(0, 50)) ||
      `Quote ${quoteNumber} - ${products.substring(0, 50)}`

    const greeting = toneAnalysis.tone === 'formal' 
      ? `Dear ${quoteRequest.customer_name || 'Customer'}`
      : `Hi ${quoteRequest.customer_name || 'there'}`

    const body = `${greeting},

Thank you for your quote request. Please find attached our quotation (${quoteNumber}) for the products you requested.

We have competitive pricing and can deliver quickly. All items are in stock.

The full details are in the attached PDF: ${pdfUrl}

Please let me know if you have any questions or need any clarification.

Best regards,
Mpho
Quote Agent`

    return {
      subject,
      body,
      tone: toneAnalysis.tone,
      urgency: toneAnalysis.urgency,
      customer_segment: customerProfile.segment,
      template_id: template?.id || null,
      products_mentioned: quoteRequest.requested_products.map(p => p.product_name),
      value_props_highlighted: ['competitive pricing', 'in stock', 'fast delivery'],
      follow_up_actions: ['Reply with questions'],
      relationship_history: {
        total_orders: customerProfile.total_orders,
        total_interactions: customerProfile.interaction_count,
        last_order_date: customerProfile.last_order_date,
      },
    }
  }

  private async recordEmailSend(
    quoteRequest: QuoteRequest,
    email: GeneratedEmail,
    pdfUrl: string,
    toneAnalysis: ToneAnalysis,
    customerProfile: CustomerProfile
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('quote_email_sends')
      .insert({
        quote_request_id: quoteRequest.id,
        template_id: email.template_id,
        customer_email: quoteRequest.customer_email,
        customer_name: quoteRequest.customer_name,
        subject: email.subject,
        body: email.body,
        pdf_url: pdfUrl,
        tone_detected: toneAnalysis.tone,
        urgency_detected: toneAnalysis.urgency,
        customer_segment: customerProfile.segment,
        relationship_history: email.relationship_history,
        products_mentioned: email.products_mentioned,
        value_props_highlighted: email.value_props_highlighted,
        follow_up_actions: email.follow_up_actions,
        metadata: {
          confidence: toneAnalysis.confidence,
          relationship_indicators: toneAnalysis.relationship_indicators,
        },
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to record email send: ${error.message}`)
    }

    return data
  }

  private async updateQuoteRequestStatus(
    quoteRequestId: string,
    pdfUrl: string
  ): Promise<void> {
    await this.supabase
      .from('quote_requests')
      .update({
        status: 'sent_to_customer',
        pdf_url: pdfUrl,
        completed_at: new Date().toISOString(),
      })
      .eq('id', quoteRequestId)
  }

  async trackEmailResponse(
    emailLogId: string
  ): Promise<{
    success: boolean
    responseId?: string
    error?: string
  }> {
    try {
      const emailLog = await this.fetchEmailLog(emailLogId)
      if (!emailLog) {
        throw new Error(`Email log ${emailLogId} not found`)
      }

      const originalEmailSend = await this.findOriginalQuoteEmail(emailLog.from_email)
      if (!originalEmailSend) {
        return { success: true, error: 'Not a response to a quote email' }
      }

      const responseType = await this.classifyResponse(emailLog)
      const sentiment = await this.analyzeSentiment(emailLog)

      const timeDiff = new Date(emailLog.created_at).getTime() - new Date(originalEmailSend.sent_at).getTime()
      const responseTimeHours = timeDiff / (1000 * 60 * 60)

      const { data: response, error } = await this.supabase
        .from('quote_email_responses')
        .insert({
          email_send_id: originalEmailSend.id,
          quote_request_id: originalEmailSend.quote_request_id,
          response_type: responseType,
          response_time_hours: responseTimeHours,
          response_email_id: emailLog.id,
          sentiment: sentiment,
          converted: responseType === 'acceptance',
          response_details: {
            subject: emailLog.subject,
            from: emailLog.from_email,
          },
        })
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to track email response: ${error.message}`)
      }

      await this.logToSquad(
        `Quote email response tracked: ${responseType}`,
        {
          email_send_id: originalEmailSend.id,
          response_type: responseType,
          sentiment: sentiment,
          response_time_hours: Math.round(responseTimeHours * 10) / 10,
        }
      )

      return {
        success: true,
        responseId: response.id,
      }

    } catch (error: any) {
      console.error('Error tracking email response:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  private async findOriginalQuoteEmail(customerEmail: string): Promise<any> {
    const { data } = await this.supabase
      .from('quote_email_sends')
      .select('*')
      .eq('customer_email', customerEmail)
      .order('sent_at', { ascending: false })
      .limit(1)
      .single()

    return data
  }

  private async classifyResponse(
    emailLog: EmailLog
  ): Promise<'reply' | 'acceptance' | 'rejection' | 'question' | 'negotiation' | 'no_response'> {
    const subject = emailLog.subject.toLowerCase()
    const body = this.extractEmailBody(emailLog.payload).toLowerCase()

    if (subject.includes('accept') || body.includes('accept') || 
        subject.includes('approve') || body.includes('proceed') ||
        body.includes('place order') || body.includes('place the order')) {
      return 'acceptance'
    }

    if (subject.includes('reject') || body.includes('reject') ||
        body.includes('decline') || body.includes('not interested') ||
        body.includes('go with another')) {
      return 'rejection'
    }

    if (body.includes('?') || subject.includes('question') ||
        body.includes('clarify') || body.includes('more information') ||
        body.includes('can you explain')) {
      return 'question'
    }

    if (body.includes('price') || body.includes('discount') ||
        body.includes('better rate') || body.includes('negotiate') ||
        body.includes('can you do')) {
      return 'negotiation'
    }

    return 'reply'
  }

  private async analyzeSentiment(
    emailLog: EmailLog
  ): Promise<'positive' | 'neutral' | 'negative' | 'mixed'> {
    const body = this.extractEmailBody(emailLog.payload).toLowerCase()

    const positiveWords = ['great', 'excellent', 'perfect', 'thank', 'appreciate', 'good', 'happy']
    const negativeWords = ['expensive', 'high', 'disappoint', 'concern', 'issue', 'problem', 'unfortunately']

    const positiveCount = positiveWords.filter(word => body.includes(word)).length
    const negativeCount = negativeWords.filter(word => body.includes(word)).length

    if (positiveCount > 0 && negativeCount > 0) {
      return 'mixed'
    }
    if (positiveCount > negativeCount && positiveCount > 0) {
      return 'positive'
    }
    if (negativeCount > positiveCount && negativeCount > 0) {
      return 'negative'
    }

    return 'neutral'
  }

  async getTemplateRecommendations(
    segment: string,
    urgency: string
  ): Promise<{
    success: boolean
    recommendations?: Array<{
      template: Template
      performance: any
      reason: string
    }>
    error?: string
  }> {
    try {
      const { data: performance } = await this.supabase
        .from('quote_template_performance')
        .select('*, template:quote_email_templates!inner(*)')
        .or(`customer_segment.eq.${segment},customer_segment.eq.all`)
        .or(`urgency_level.eq.${urgency},urgency_level.eq.all`)
        .gte('sends_count', 3)
        .order('conversion_rate', { ascending: false })
        .limit(5)

      if (!performance || performance.length === 0) {
        return {
          success: true,
          recommendations: [],
        }
      }

      const recommendations = performance.map((p: any) => {
        let reason = `${p.conversion_rate}% conversion rate`
        if (p.reply_rate > 50) {
          reason += `, ${p.reply_rate}% reply rate`
        }
        if (p.sends_count > 10) {
          reason += `, proven with ${p.sends_count} sends`
        }

        return {
          template: p.template,
          performance: {
            sends_count: p.sends_count,
            reply_rate: p.reply_rate,
            conversion_rate: p.conversion_rate,
            avg_response_time_hours: p.avg_response_time_hours,
          },
          reason,
        }
      })

      return {
        success: true,
        recommendations,
      }

    } catch (error: any) {
      console.error('Error getting template recommendations:', error)
      return {
        success: false,
        error: error.message,
      }
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
            timestamp: new Date().toISOString(),
          },
        })
    } catch (error) {
      console.error('Error logging to squad:', error)
    }
  }
}

export async function generateQuoteEmail(
  quoteRequestId: string,
  pdfUrl: string
): Promise<{
  success: boolean
  emailSendId?: string
  email?: any
  error?: string
}> {
  const engine = new QuoteTemplateEngine()
  return await engine.generateQuoteEmail(quoteRequestId, pdfUrl)
}

export async function trackEmailResponse(
  emailLogId: string
): Promise<{
  success: boolean
  responseId?: string
  error?: string
}> {
  const engine = new QuoteTemplateEngine()
  return await engine.trackEmailResponse(emailLogId)
}

export async function getTemplateRecommendations(
  segment: string,
  urgency: string
): Promise<{
  success: boolean
  recommendations?: Array<{
    template: any
    performance: any
    reason: string
  }>
  error?: string
}> {
  const engine = new QuoteTemplateEngine()
  return await engine.getTemplateRecommendations(segment, urgency)
}
